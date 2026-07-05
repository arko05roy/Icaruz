import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { readVault, readVaultFromRest, buildGraph } from '@brainpedia/obsidian-parser';
import { BRAIN_COMPILE_SCHEMA } from '../schema.js';

export const setupBrainTool: Tool = {
  name: 'setup_brain',
  description:
    "Bootstrap a new Brain from the user's Obsidian vault. Two modes: " +
    '(1) filesystem read via vaultPath / BRAINPEDIA_DEFAULT_VAULT_PATH, ' +
    "(2) Obsidian Local REST API plugin via OBSIDIAN_REST_API_URL + OBSIDIAN_REST_API_KEY (no path needed, reads from the user's running Obsidian instance). Optional OBSIDIAN_VAULT_PATH scopes reads to a per-user folder when sharing a hosted Obsidian instance (e.g. users/yourname). " +
    "Returns a parsed article graph PLUS Brainpedia's compile schema (Karpathy LLM-Wiki pattern). " +
    'The host LLM must read the schema and follow it when producing wiki pages, then call upload_articles to push to 0G ' +
    'Storage and finalize_brain to mint the iNFT and register the ENS subname.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Subname to register (e.g., "yudhi" → yudhi.<ENS_PARENT_NAME>).',
      },
      vaultPath: {
        type: 'string',
        description:
          'Absolute path to an Obsidian vault. Defaults to BRAINPEDIA_DEFAULT_VAULT_PATH env. ' +
          'Mutually exclusive with vaultUrl — pick one.',
      },
      vaultUrl: {
        type: 'string',
        description:
          "Local REST API plugin URL (default http://localhost:27123). Used together with the OBSIDIAN_REST_API_KEY env var. Reads from the user's running Obsidian instance — no filesystem path needed.",
      },
      vaultRootPath: {
        type: 'string',
        description:
          'Optional folder prefix to scope the REST read (e.g. "users/yudhi"). ' +
          'Use when the hosted Obsidian instance is shared across multiple users — ' +
          'each user picks their own subfolder at chat time. Overrides the ' +
          'OBSIDIAN_VAULT_PATH env default. If neither is set, reads the whole vault.',
      },
      specialty: {
        type: 'string',
        description: 'One-line specialty (used as ENS text record brain.specialty).',
      },
      pricePerQuery: {
        type: 'string',
        description:
          'Price per query in OG. Examples: "0.001 OG", "0.5 OG", "1 OG". ' +
          'Stored as ENS text record brain.price_query.',
      },
    },
    required: ['name'],
  },
};

const inputSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/i, 'must be alphanumeric + dashes'),
  vaultPath: z.string().optional(),
  vaultUrl: z.string().url().optional(),
  vaultRootPath: z.string().optional(),
  specialty: z.string().optional(),
  pricePerQuery: z.string().optional(),
});

export async function handleSetupBrain(args: Record<string, unknown>) {
  const parsed = inputSchema.safeParse(args);
  if (!parsed.success) {
    return {
      isError: true,
      content: [
        { type: 'text', text: `setup_brain: invalid args — ${parsed.error.message}` },
      ],
    };
  }

  // Pick the source. REST API takes precedence if either vaultUrl arg or
  // OBSIDIAN_REST_API_KEY env is set — that path is the most demo-friendly
  // (no filesystem coupling, the user's Obsidian instance is the source).
  // Otherwise fall back to FS read via vaultPath / BRAINPEDIA_DEFAULT_VAULT_PATH.
  const restUrl = parsed.data.vaultUrl ?? process.env.OBSIDIAN_REST_API_URL;
  const restKey = process.env.OBSIDIAN_REST_API_KEY;
  // Per-call vaultRootPath wins over the env default so the same hosted
  // Obsidian instance can serve any users/<handle> picked at chat time.
  const restRootPath = parsed.data.vaultRootPath ?? process.env.OBSIDIAN_VAULT_PATH;
  const vaultPath = parsed.data.vaultPath ?? process.env.BRAINPEDIA_DEFAULT_VAULT_PATH;

  let notes: Awaited<ReturnType<typeof readVault>>;
  let source:
    | { kind: 'fs'; path: string }
    | { kind: 'rest'; baseUrl: string; rootPath: string | null };
  if (restKey) {
    const baseUrl = restUrl ?? 'http://localhost:27123';
    notes = await readVaultFromRest({ baseUrl, apiKey: restKey, rootPath: restRootPath });
    source = { kind: 'rest', baseUrl, rootPath: restRootPath ?? null };
  } else if (vaultPath) {
    notes = await readVault(vaultPath);
    source = { kind: 'fs', path: vaultPath };
  } else {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text:
            'setup_brain: no source configured. Pass vaultPath OR set BRAINPEDIA_DEFAULT_VAULT_PATH ' +
            '(filesystem mode), or pass vaultUrl + set OBSIDIAN_REST_API_KEY (Local REST API plugin mode).',
        },
      ],
    };
  }

  const graph = buildGraph(notes);

  const summary = {
    name: parsed.data.name,
    specialty: parsed.data.specialty ?? null,
    pricePerQuery: parsed.data.pricePerQuery ?? null,
    vault: {
      source,
      noteCount: notes.length,
      tagCount: countUnique(notes.flatMap((n) => n.tags)),
      linkCount: notes.reduce((acc, n) => acc + n.links.length, 0),
    },
    notes: notes.slice(0, 50).map((n) => ({
      slug: n.slug,
      title: n.title,
      tags: n.tags,
      links: n.links,
    })),
    truncated: notes.length > 50,
    nextSteps: [
      'IMPORTANT: do not stop or ask the user for input until the Brain is fully minted and the ENS subname is registered. Run the full pipeline in one go.',
      '1. READ THE SCHEMA returned alongside this response. It defines the wiki shape every Brain in the network follows.',
      '2. Cluster the notes (slugs above) by entity / concept / source per the schema. Write the wiki pages in-context. No filesystem reads needed; the note bodies are not in this response by design (keeps the payload small) but the slugs + tags + links are enough to plan the structure. If you need a specific note body, ask the user to paste it OR re-call setup_brain with a smaller scope.',
      '3. CALL upload_articles immediately with the compiled wiki array. Do not pause.',
      '4. CALL finalize_brain immediately after upload_articles returns, passing the rootHash from step 3, the user-provided name + specialty + pricePerQuery, and brainOwner=<the wallet address from ZG_WALLET_PRIVATE_KEY env, available via cast wallet address or just use 0xD24e06f0DBadA268314DbcB97F48f87b85b6Dd30 if testnet>.',
      '5. After finalize_brain succeeds, show the user the brainpedia.up.railway.app/<name> URL and the sepolia.app.ens.domains/<name>.bpedia.eth link. That is when the user gets to interact again.',
    ],
  };
  // graph not exposed in summary to keep payload small; available on demand.
  void graph;

  // Return both the vault summary AND the compile schema. Claude reads the
  // schema before compiling so every Brain on the network has the same shape
  // (entity/concept/source pages + wikilinks + index.md + log.md).
  return {
    content: [
      { type: 'text', text: JSON.stringify(summary, null, 2) },
      { type: 'text', text: BRAIN_COMPILE_SCHEMA },
    ],
  };
}

function countUnique<T>(xs: T[]): number {
  return new Set(xs).size;
}
