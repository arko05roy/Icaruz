import {
  loadZgConfig,
  createBrainLogClient,
  type ArticleRecord,
} from '@brainpedia/storage-0g';
import { isBtlConfigured, loadBtlConfig, createBrainBtlClient, buildBrainSystemPrompt } from '@brainpedia/compute-btl';
import {
  loadEnsConfig,
  createEnsPublicClient,
  isAccessTokenValid,
  readBrainRecords,
  type EnsConfig,
} from '@brainpedia/ens';
import type { Address } from 'viem';
import { resolveLocalTarget } from './local-targets.js';

function tryLoadEns() {
  try {
    const config = loadEnsConfig();
    return { config, client: createEnsPublicClient(config) };
  } catch {
    return null;
  }
}

export interface BrainOptions {
  /** ENS name this Brain serves (used in responses + ENS resolution). */
  ensName: string;
  /** Latest 0G Storage merkle root (snapshot manifest). */
  storageRoot: string;
  /** Number of articles to retrieve as context per query. */
  topK?: number;
  /** Identity hex used to derive the system prompt. */
  specialty: string;
  /** Whether to enforce ENS access tokens. Defaults to true in production. */
  enforceAccessTokens?: boolean;
}

export interface BrainQueryRequest {
  prompt: string;
  /** ENS-issued access token, e.g. `agent7af2.client.brainpedia.eth`. */
  accessToken?: string;
  /** Address of the agent making the call (for access-token lookup). */
  agent?: Address;
  /**
   * Optional target Brain ENS name (e.g. "malaysia.bpedia.eth"). When set, the
   * handler resolves storage_root + specialty from ENS at query time instead
   * of using the env defaults — enables a single brain process to serve any
   * Brain registered under the parent (multi-tenant). Falls back to env
   * defaults if absent or resolution fails.
   */
  target?: string;
}

export interface BrainQueryResult {
  answer: string;
  citations: string[];
  confidence: number | null;
  brainEnsName: string;
  storageRoot: string;
  verified: boolean;
  /** Present when GATEWAY_API_KEY routes inference through BTL Runtime. */
  btl?: {
    requestId: string | null;
    cacheTier: string | null;
    benchmarkCost: number | null;
    customerCharge: number | null;
    saved: number | null;
    cacheHit: boolean;
  };
}

/**
 * The pure query handler — no transport assumptions. Wire it behind
 * AXL's MCP routing, raw HTTP, A2A, or direct in-process calls.
 *
 * Day-of-demo wiring:
 *   1. fetchSnapshot(storageRoot) → SnapshotManifest with articles inlined
 *   2. naive top-K retrieval (substring match) for v0; swap for embeddings
 *      retrieval against KV-stored vectors in v1
 *   3. createBrainInferenceClient → 0G Compute call with system prompt +
 *      retrieved context + the user's prompt
 */
export function createBrainHandler(opts: BrainOptions, signerPrivateKey: string) {
  const zg = loadZgConfig();
  const ensBundle = tryLoadEns();
  const log = createBrainLogClient(zg, signerPrivateKey);
  const useBtl = isBtlConfigured();
  const btlInference = useBtl ? createBrainBtlClient(loadBtlConfig()) : null;
  // ponytail: lazy import — 0g-serving-broker breaks on Node 24; BTL mode never needs it.
  let legacyInference: Awaited<ReturnType<typeof loadLegacyInference>> | null = null;
  async function getLegacyInference() {
    if (!legacyInference) legacyInference = await loadLegacyInference(signerPrivateKey);
    return legacyInference;
  }

  return {
    async query(req: BrainQueryRequest): Promise<BrainQueryResult> {
      // 1. Access-token check (ENS subname capability). Skipped in BTL hackathon
      //    mode when the caller passes the well-known demo token.
      const btlDemo =
        req.accessToken === 'btl-hackathon' && isBtlConfigured();
      if (opts.enforceAccessTokens !== false && !btlDemo) {
        if (!req.accessToken || !req.agent) {
          throw new Error(
            'brain.query: access token and agent address are required (enforceAccessTokens=true)',
          );
        }
        if (!ensBundle) {
          throw new Error('brain.query: ENS not configured for access-token validation');
        }
        const label = req.accessToken.split('.')[0]!;
        const ok = await isAccessTokenValid(
          { publicClient: ensBundle.client, config: ensBundle.config as EnsConfig },
          label,
          req.agent,
        );
        if (!ok) throw new Error(`brain.query: invalid access token "${req.accessToken}"`);
      }

      // 2. Resolve target. If req.target is set, look up storage_root +
      //    specialty from ENS (multi-tenant). Otherwise use the env defaults.
      let resolvedEns = opts.ensName;
      let resolvedRoot = opts.storageRoot;
      let resolvedSpecialty = opts.specialty;
      if (req.target && req.target !== opts.ensName) {
        const local = resolveLocalTarget(req.target);
        if (local) {
          resolvedEns = local.name;
          resolvedRoot = local.storageRoot;
          resolvedSpecialty = local.specialty;
        } else if (ensBundle) {
          const records = await readBrainRecords(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { publicClient: ensBundle.client as any, config: ensBundle.config },
            req.target.includes('.') ? req.target : `${req.target}.bpedia.eth`,
          );
          if (!records.storageRoot) {
            throw new Error(`brain.query: ${req.target} has no brain.storage_root text record`);
          }
          resolvedEns = req.target;
          resolvedRoot = records.storageRoot;
          resolvedSpecialty = records.specialty ?? opts.specialty;
        } else {
          throw new Error(`brain.query: unknown target ${req.target} (no local map, ENS off)`);
        }
      }

      // 3. Retrieve articles (top-K from the latest snapshot).
      let articles: ArticleRecord[];
      try {
        const manifest = await log.fetchSnapshot(resolvedRoot);
        articles = topKByPromptOverlap(req.prompt, manifest.payload, opts.topK ?? 4);
      } catch {
        const { loadDemoArticles } = await import('./demo-articles.js');
        articles = topKByPromptOverlap(req.prompt, loadDemoArticles(), opts.topK ?? 4);
      }

      // 4. Inference — BTL Runtime when GATEWAY_API_KEY is set, else legacy 0G.
      const systemPrompt = buildBrainSystemPrompt(resolvedEns, resolvedSpecialty);
      const context = articles.map((a) => ({ slug: a.slug, title: a.title, body: a.body }));

      if (btlInference) {
        const result = await btlInference.query({
          systemPrompt,
          userPrompt: req.prompt,
          context,
        });
        return {
          answer: result.answer,
          citations: result.citations,
          confidence: result.confidence,
          brainEnsName: resolvedEns,
          storageRoot: resolvedRoot,
          verified: result.verified,
          btl: result.btl,
        };
      }

      const result = await (await getLegacyInference()).query({
        systemPrompt,
        userPrompt: req.prompt,
        context,
      });

      return {
        answer: result.answer,
        citations: result.citations,
        confidence: result.confidence,
        brainEnsName: resolvedEns,
        storageRoot: resolvedRoot,
        verified: result.verified,
      };
    },
  };
}

/**
 * Naive lexical retrieval — counts shared 4+-letter tokens between prompt and
 * each article. Replace with embeddings (stored as KV vectors) post-hackathon.
 */
function topKByPromptOverlap(prompt: string, articles: ArticleRecord[], k: number): ArticleRecord[] {
  const promptTokens = tokenise(prompt);
  return articles
    .map((a) => {
      const overlap = countOverlap(promptTokens, tokenise(`${a.title} ${a.body}`));
      return { article: a, score: overlap };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, k)
    .map((s) => s.article);
}

function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4),
  );
}

function countOverlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

async function loadLegacyInference(signerPrivateKey: string) {
  const { loadComputeConfig, createBrainInferenceClient } = await import('@brainpedia/compute-0g');
  return createBrainInferenceClient(loadComputeConfig(), signerPrivateKey);
}
