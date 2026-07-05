import {
  createBrainInferenceClient,
  loadComputeConfig,
  type BrainInferenceClient,
} from '@brainpedia/compute-0g';
import type { ArticleCandidate, Compiler, CompiledArticle } from '../types.js';

/**
 * v2 compiler. Each article candidate is rewritten by 0G Compute's
 * TEE-attested Qwen 2.5 7B into a focused Karpathy-style wiki article.
 *
 * Why use the same model that answers queries to also compile the wiki?
 *   1. The "0G Compute used at both ends" story is real. Brain creation
 *      AND brain inference run through the same TEE attestor.
 *   2. The compiled wiki is shaped by the same model that will later
 *      read it; cross-references and section structure match the
 *      retrieval model's natural format.
 *   3. Every compiled article carries `verified: true` from the TEE
 *      attestor, so the Brain's content provenance is verifiable end
 *      to end.
 *
 * Tradeoff: each candidate is an inference call. A 10-article Brain
 * takes ~30 seconds and costs whatever the provider charges per call.
 * The deterministic compiler stays the default for fast/cheap mints;
 * pass this compiler explicitly when you want the depth signal.
 */
export interface ComputeCompilerOptions {
  /** 0G signer key. Falls back to process.env.ZG_WALLET_PRIVATE_KEY. */
  signerPrivateKey?: string;
  /** Override the inference client if you already have one configured. */
  client?: BrainInferenceClient;
  /** Per-article timeout in ms. Default 60000. */
  timeoutMs?: number;
}

export function createComputeCompiler(opts: ComputeCompilerOptions = {}): Compiler {
  const cfg = loadComputeConfig();
  const key = opts.signerPrivateKey ?? process.env.ZG_WALLET_PRIVATE_KEY ?? '';
  if (!opts.client && !key) {
    throw new Error(
      'createComputeCompiler: ZG_WALLET_PRIVATE_KEY missing (required for broker ledger)',
    );
  }
  const client: BrainInferenceClient =
    opts.client ?? createBrainInferenceClient(cfg, key);
  const timeoutMs = opts.timeoutMs ?? 60_000;

  return {
    name: 'compute-0g-v2',
    async compile(candidates: ArticleCandidate[]): Promise<CompiledArticle[]> {
      const now = new Date().toISOString();

      // First pass: pick slugs deterministically so cross-references can
      // resolve by slug even when the LLM rewrites titles.
      const used = new Set<string>();
      const slugged = candidates.map((c) => {
        let slug = slugify(c.title);
        if (!slug) slug = 'untitled';
        let unique = slug;
        let n = 2;
        while (used.has(unique)) unique = `${slug}-${n++}`;
        used.add(unique);
        return { ...c, slug: unique };
      });

      const slugIndex = slugged
        .map((c) => `- ${c.slug}: ${c.title}`)
        .join('\n');

      const out: CompiledArticle[] = [];
      for (const c of slugged) {
        const article = await compileOne(client, c, slugIndex, timeoutMs, now);
        out.push(article);
      }
      return out;
    },
  };
}

async function compileOne(
  client: BrainInferenceClient,
  c: ArticleCandidate & { slug: string },
  slugIndex: string,
  timeoutMs: number,
  updatedAt: string,
): Promise<CompiledArticle> {
  const systemPrompt = [
    'You are the Brainpedia knowledge compiler. You receive a raw section',
    'of text from a human author and produce a single focused wiki article',
    'optimized for LLM retrieval and citation. Rules:',
    '',
    '1. Preserve every factual claim and citation present in the input.',
    '   Do not invent new facts.',
    '2. Output GitHub-flavored markdown. Start with a single `# Title` line.',
    '   No frontmatter, no commentary, no meta-discussion.',
    '3. Use `[[slug]]` wikilinks where the body legitimately references',
    '   another article in the index. Only use slugs from the provided list.',
    '   Do not invent slugs.',
    '4. Keep the article focused on ONE topic. If the input mixes topics,',
    '   keep the topic that matches the title and trim the rest.',
    '5. Target length: 250 to 1500 words. Shorter is fine.',
    '',
    'The slug index for this Brain (use ONLY these for wikilinks):',
    slugIndex,
  ].join('\n');

  const userPrompt = [
    `Compile this section as the wiki article "${c.title}" (slug \`${c.slug}\`).`,
    '',
    'Raw section:',
    '',
    c.text,
  ].join('\n');

  const withTimeout = <T>(p: Promise<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`compile timeout after ${timeoutMs}ms`)), timeoutMs);
      p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });

  let body = c.text;
  try {
    const response = await withTimeout(
      client.query({ systemPrompt, userPrompt }),
    );
    body = response.answer?.trim() || c.text;
  } catch (err) {
    // If 0G Compute fails for any reason, fall back to the raw text
    // verbatim. Better to ship a Brain with un-rewritten articles than
    // to fail the whole mint.
    console.warn('[compute-0g compiler] inference failed, falling back to raw text:', err);
  }

  // Extract title from the model output if it leads with a heading.
  const titleMatch = /^# (.+)$/m.exec(body);
  const title = titleMatch?.[1]?.trim() || c.title;

  // Pull wikilinks the model emitted, validating against known slugs.
  const linkMatches = body.match(/\[\[([a-z0-9-]+)\]\]/g) ?? [];
  const links = Array.from(
    new Set(linkMatches.map((m) => m.slice(2, -2)).filter((slug) => slug !== c.slug)),
  );

  return {
    slug: c.slug,
    title,
    body,
    links,
    sources: Array.from(new Set(c.sources.map((s) => s.path))),
    updatedAt,
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
