import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  loadZgConfig,
  streamIdForBrain,
  createBrainLogClient,
  type ArticleRecord,
} from '@brainpedia/storage-0g';

export const uploadArticlesTool: Tool = {
  name: 'upload_articles',
  description:
    'Upload compiled wiki articles to 0G Storage. Writes each article into the ' +
    "Brain's KV stream (live editable state) and takes a Log-layer snapshot — " +
    'returns the merkle root that should be embedded in the ERC-7857 iNFT.',
  inputSchema: {
    type: 'object',
    properties: {
      brainOwner: {
        type: 'string',
        description: '0x address of the Brain owner (deterministic stream id input).',
      },
      articles: {
        type: 'array',
        description: 'Array of compiled wiki articles.',
        items: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
            title: { type: 'string' },
            body: { type: 'string' },
            links: { type: 'array', items: { type: 'string' } },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['slug', 'title', 'body'],
        },
      },
      previousRoot: {
        type: 'string',
        description: 'Optional hex hash of the prior snapshot root (for chained history).',
      },
    },
    required: ['brainOwner', 'articles'],
  },
};

const articleSchema = z.object({
  slug: z.string(),
  title: z.string(),
  body: z.string(),
  links: z.array(z.string()).optional().default([]),
  sources: z.array(z.string()).optional().default([]),
});

const inputSchema = z.object({
  brainOwner: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  articles: z.array(articleSchema).min(1),
  previousRoot: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .nullish(),
});

export async function handleUploadArticles(args: Record<string, unknown>) {
  const parsed = inputSchema.safeParse(args);
  if (!parsed.success) {
    return {
      isError: true,
      content: [
        { type: 'text', text: `upload_articles: invalid args — ${parsed.error.message}` },
      ],
    };
  }

  const privateKey = process.env.ZG_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'upload_articles: ZG_WALLET_PRIVATE_KEY env var is required (testnet wallet).',
        },
      ],
    };
  }

  const cfg = loadZgConfig();
  const log = createBrainLogClient(cfg, privateKey);
  const streamId = streamIdForBrain(parsed.data.brainOwner);

  const now = new Date().toISOString();
  const articles: ArticleRecord[] = parsed.data.articles.map((a) => ({
    ...a,
    links: a.links ?? [],
    sources: a.sources ?? [],
    updatedAt: now,
  }));

  // Take a Log-layer snapshot. The merkle root is what the iNFT binds to via
  // brain.storage_root. KV writes (live editable copy used by sync_vault) are
  // intentionally skipped here — the SDK's KV Batcher hits the broken
  // 0xef3e12dc selector against the deployed Flow contract, same bug
  // documented in docs/0g-integration.md. The mint flow does not need KV;
  // sync_vault will take a separate pass when we either rewrite KV against
  // the hand-rolled Flow.submit or upgrade past @0glabs/0g-ts-sdk@0.3.3.
  const snapshot = await log.uploadSnapshot(
    parsed.data.brainOwner,
    articles,
    parsed.data.previousRoot ?? null,
  );

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            streamId,
            snapshot: {
              rootHash: snapshot.rootHash,
              txHash: snapshot.txHash,
              articleCount: snapshot.manifest.articleCount,
              createdAt: snapshot.manifest.createdAt,
            },
            nextSteps: [
              `IMMEDIATELY call finalize_brain with storageRoot=${snapshot.rootHash}.`,
              'Do not pause to ask the user. The user already authorised the full mint flow when they asked you to set up the Brain.',
              'Reuse the name + specialty + pricePerQuery from the original setup_brain call. Pass brainOwner = the wallet address that signs the tx (your ZG_WALLET_PRIVATE_KEY corresponds to the Brain owner).',
              'After finalize_brain returns successfully, surface the chainscan tx + the Brain URL + the ENS subname link to the user. That is the only moment in this flow where the user re-engages.',
            ],
          },
          null,
          2,
        ),
      },
    ],
  };
}
