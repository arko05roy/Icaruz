import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile, unlink } from 'node:fs/promises';
import { Indexer } from '@0glabs/0g-ts-sdk';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  toBytes,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { ZgConfig } from './config.js';
import type { ArticleRecord } from './kv.js';
import { buildSubmissionFromBytes } from './submission.js';
import { uploadSegments } from './upload.js';

/**
 * 0G Storage Log layer — immutable snapshots of a Brain's compiled wiki.
 * The merkle root from each upload is what gets embedded in the
 * ERC-7857 iNFT IntelligentData and written to the ENS text record
 * `brain.storage_root` on the Brain's subname.
 */
export interface SnapshotManifest {
  brainOwner: string;
  createdAt: string;
  articleCount: number;
  articles: Array<{
    slug: string;
    contentHash: string;
    bytes: number;
  }>;
  /** Optional pointer back to the previous snapshot's root. */
  previousRoot: string | null;
  /** Articles inlined for snapshot self-containment. */
  payload: ArticleRecord[];
}

export interface SnapshotResult {
  /** Merkle root hash from the upload tree — what we put on chain. */
  rootHash: string;
  txHash: string;
  manifest: SnapshotManifest;
}

export interface BrainLogClient {
  uploadSnapshot(
    brainOwner: string,
    articles: ArticleRecord[],
    previousRoot?: string | null,
  ): Promise<SnapshotResult>;
  fetchSnapshot(rootHash: string): Promise<SnapshotManifest>;
}

const enc = new TextEncoder();

function hashBody(body: string): string {
  return keccak256(toBytes(body));
}

const FLOW_ABI = [
  {
    type: 'function',
    name: 'submit',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'submission',
        type: 'tuple',
        components: [
          {
            name: 'data',
            type: 'tuple',
            components: [
              { name: 'length', type: 'uint256' },
              { name: 'tags', type: 'bytes' },
              {
                name: 'nodes',
                type: 'tuple[]',
                components: [
                  { name: 'root', type: 'bytes32' },
                  { name: 'height', type: 'uint256' },
                ],
              },
            ],
          },
          { name: 'submitter', type: 'address' },
        ],
      },
    ],
    outputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'bytes32' },
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'market',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

const MARKET_ABI = [
  {
    type: 'function',
    name: 'pricePerSector',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

/** Submit(address,uint256,bytes32,uint256,uint256,...) topic0. The deployed
 *  Flow's Submit event has only 3 indexed topics; submissionIndex (txSeq)
 *  lives in data[0:32], not topics[3]. */
const SUBMIT_TOPIC0 =
  '0x167ce04d2aa1981994d3a31695da0d785373335b1078cec239a1a3a2c7675555';

export function createBrainLogClient(cfg: ZgConfig, signerPrivateKey: string): BrainLogClient {
  const pk = (signerPrivateKey.startsWith('0x') ? signerPrivateKey : `0x${signerPrivateKey}`) as Hex;
  const account = privateKeyToAccount(pk);
  const galileo = defineChain({
    id: cfg.chainId,
    name: '0G Galileo',
    nativeCurrency: { name: 'OG', symbol: 'OG', decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
    blockExplorers: { default: { name: '0G Chainscan', url: cfg.explorerUrl } },
  });
  const publicClient = createPublicClient({ chain: galileo, transport: http(cfg.rpcUrl) });
  const walletClient = createWalletClient({ account, chain: galileo, transport: http(cfg.rpcUrl) });
  const indexer = new Indexer(cfg.storageIndexerUrl);

  return {
    async uploadSnapshot(brainOwner, articles, previousRoot = null) {
      const manifest: SnapshotManifest = {
        brainOwner: brainOwner.toLowerCase(),
        createdAt: new Date().toISOString(),
        articleCount: articles.length,
        articles: articles.map((a) => ({
          slug: a.slug,
          contentHash: hashBody(a.body),
          bytes: enc.encode(a.body).length,
        })),
        previousRoot,
        payload: articles,
      };

      const manifestBytes = enc.encode(JSON.stringify(manifest));

      // 1. Hand-roll Flow.submit. The official @0glabs/0g-ts-sdk@0.3.3
      //    `Indexer.upload` encodes selector 0xef3e12dc (the inner
      //    SubmissionData), but the deployed Flow at
      //    0x22E03a6A89B950F1c82ec5e74F8eCa321a105296 expects 0xbc8c11f8
      //    for the 2-field outer Submission { SubmissionData data; address submitter; }
      //    tuple. Reusing the SDK's MemData for merkle tree gen is fine; we
      //    just have to send the tx ourselves.
      const built = await buildSubmissionFromBytes(manifestBytes);

      const marketAddr = (await publicClient.readContract({
        address: cfg.flowContractAddress as Address,
        abi: FLOW_ABI,
        functionName: 'market',
      })) as Address;
      const pricePerSector = (await publicClient.readContract({
        address: marketAddr,
        abi: MARKET_ABI,
        functionName: 'pricePerSector',
      })) as bigint;

      let sectors = 0n;
      for (const n of built.nodes) sectors += 1n << BigInt(n.height);
      const flowFee = sectors * pricePerSector;

      const submitTx = await walletClient.writeContract({
        address: cfg.flowContractAddress as Address,
        abi: FLOW_ABI,
        functionName: 'submit',
        args: [
          {
            data: {
              length: BigInt(built.length),
              tags: '0x' as Hex,
              nodes: built.nodes.map((n) => ({ root: n.root, height: BigInt(n.height) })),
            },
            submitter: account.address,
          },
        ],
        value: flowFee,
      });

      // 0G's RPC sometimes 404s for ~30-60s after submit, and viem's
      // waitForTransactionReceipt can give up earlier than expected when
      // it sees consecutive "not found" responses. Wrap with our own
      // polling loop so we wait the full timeout regardless of viem's
      // internal retry state.
      const submitReceipt = await pollForReceipt(publicClient, submitTx, {
        timeoutMs: 240_000,
        pollIntervalMs: 3_000,
      });
      if (submitReceipt.status !== 'success') {
        throw new Error(`uploadSnapshot: Flow.submit reverted: ${submitTx}`);
      }

      // 2. Decode Submit event for txSeq (lives in data[0:32], not topics[3]).
      const submitLog = submitReceipt.logs.find(
        (l) =>
          l.address.toLowerCase() === cfg.flowContractAddress.toLowerCase() &&
          l.topics[0]?.toLowerCase() === SUBMIT_TOPIC0,
      );
      if (!submitLog) {
        throw new Error('uploadSnapshot: Submit event not found in receipt');
      }
      const txSeq = BigInt(submitLog.data.slice(0, 66));

      // 3. Push raw segments to the storage nodes so the indexer can serve
      //    Indexer.download(rootHash) round-trips later. Without this step
      //    the on-chain commitment exists but no data backs it.
      const upload = await uploadSegments(manifestBytes, {
        indexerUrl: cfg.storageIndexerUrl,
        txSeq,
        expectedReplica: 1,
      });
      if (upload.rootHash.toLowerCase() !== built.rootHash.toLowerCase()) {
        throw new Error(
          `uploadSnapshot: rootHash mismatch (built=${built.rootHash}, pushed=${upload.rootHash})`,
        );
      }

      return { rootHash: built.rootHash, txHash: submitTx, manifest };
    },

    async fetchSnapshot(rootHash) {
      const tmp = join(tmpdir(), `brainpedia-${rootHash.replace(/^0x/, '')}.json`);
      const err = await indexer.download(rootHash, tmp, false);
      if (err) throw err;
      try {
        return JSON.parse(await readFile(tmp, 'utf8')) as SnapshotManifest;
      } finally {
        await unlink(tmp).catch(() => {});
      }
    },
  };
}

/**
 * Poll `eth_getTransactionReceipt` until either the receipt resolves OR the
 * timeout expires. viem's built-in waitForTransactionReceipt sometimes
 * gives up early when the RPC returns null on the first few polls
 * (0G mainnet has a noticeable mempool→block latency on submit). This
 * helper sidesteps that by manually polling for the entire budget.
 */
async function pollForReceipt(
  client: PublicClient,
  hash: Hex,
  opts: { timeoutMs: number; pollIntervalMs: number },
): Promise<TransactionReceipt> {
  const deadline = Date.now() + opts.timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const r = await client.getTransactionReceipt({ hash });
      if (r) return r;
    } catch (err) {
      lastError = err;
    }
    await new Promise((res) => setTimeout(res, opts.pollIntervalMs));
  }
  const msg = lastError instanceof Error ? lastError.message : 'no receipt within timeout';
  throw new Error(`pollForReceipt: ${hash} not confirmed within ${opts.timeoutMs}ms (${msg})`);
}
