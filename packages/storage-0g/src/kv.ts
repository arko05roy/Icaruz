import { keccak256, toUtf8Bytes, JsonRpcProvider, Wallet } from 'ethers';
import {
  Batcher,
  KvClient,
  Indexer,
  getFlowContract,
} from '@0glabs/0g-ts-sdk';
import type { ZgConfig } from './config.js';

/**
 * 0G Storage KV layer — used for the live, editable wiki state of a Brain.
 *
 * Stream id per Brain is a deterministic hash of the owner address so any
 * client (web app, MCP, other Brains) can derive and read state without an
 * out-of-band registry.
 */
export function streamIdForBrain(brainOwner: string): string {
  return keccak256(toUtf8Bytes(`brainpedia:${brainOwner.toLowerCase()}`));
}

export interface ArticleRecord {
  slug: string;
  title: string;
  body: string;
  /** Slugs of linked articles. */
  links: string[];
  /** Slugs of source notes used as inputs to compilation. */
  sources: string[];
  /** ISO-8601 last update. */
  updatedAt: string;
}

export interface BrainKvClient {
  putArticle(streamId: string, article: ArticleRecord): Promise<{ txHash: string }>;
  getArticle(streamId: string, slug: string): Promise<ArticleRecord | null>;
  listArticles(streamId: string): Promise<string[]>;
}

const enc = new TextEncoder();
const articleKey = (slug: string) => enc.encode(`article:${slug}`);
const indexKeyBytes = () => enc.encode('index:articles');

export function createBrainKvClient(cfg: ZgConfig, signerPrivateKey: string): BrainKvClient {
  const provider = new JsonRpcProvider(cfg.rpcUrl);
  const signer = new Wallet(signerPrivateKey, provider);
  const indexer = new Indexer(cfg.storageIndexerUrl);
  const reader = new KvClient(cfg.kvRpcUrl);

  // Flow contract is discovered via the storage node's networkIdentity, never hardcoded.
  // Cached per-batcher because nodes can rotate; we re-select before each write.
  async function buildBatcher(): Promise<Batcher> {
    const [nodes, selErr] = await indexer.selectNodes(1);
    if (selErr) throw selErr;
    const status = await nodes[0]!.getStatus();
    if (!status) throw new Error('storage node returned null status');
    // Cast: SDK was built against ethers CJS; Signer types are structurally compatible.
    const flow = getFlowContract(status.networkIdentity.flowAddress, signer as never);
    return new Batcher(1, nodes, flow, cfg.rpcUrl);
  }

  return {
    async putArticle(streamId, article) {
      const batcher = await buildBatcher();
      batcher.streamDataBuilder.set(
        streamId,
        articleKey(article.slug),
        enc.encode(JSON.stringify(article)),
      );
      const [result, err] = await batcher.exec();
      if (err) throw err;
      return { txHash: result.txHash };
    },

    async getArticle(streamId, slug) {
      // SDK accepts Uint8Array key; node returns base64-encoded data.
      const v = await reader.getValue(streamId, articleKey(slug));
      if (!v?.data) return null;
      try {
        return JSON.parse(Buffer.from(v.data, 'base64').toString('utf8')) as ArticleRecord;
      } catch {
        return null;
      }
    },

    async listArticles(streamId) {
      const v = await reader.getValue(streamId, indexKeyBytes());
      if (!v?.data) return [];
      try {
        return JSON.parse(Buffer.from(v.data, 'base64').toString('utf8')) as string[];
      } catch {
        return [];
      }
    },
  };
}
