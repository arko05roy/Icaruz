import { encodeBase64 } from 'ethers';
import {
  Indexer,
  MemData,
  StorageNode,
  DEFAULT_SEGMENT_SIZE,
  DEFAULT_SEGMENT_MAX_CHUNKS,
  DEFAULT_CHUNK_SIZE,
} from '@0glabs/0g-ts-sdk';

/**
 * Push raw segments for a previously-submitted Flow tx into 0G storage nodes.
 *
 * `Flow.submit` only writes the merkle commitment on chain. Without a
 * follow-up `zgs_uploadSegmentsByTxSeq` RPC against a writable storage
 * node, the indexer will return 404 on `getFileLocations` and any
 * downstream `Indexer.download` will fail. This helper closes that gap.
 *
 * Mirrors the segment-upload phase of `Uploader.uploadFile` from
 * `@0glabs/0g-ts-sdk@0.3.3`, but skips the on-chain submit (the caller
 * already did that hand-rolled in viem).
 */
export interface UploadSegmentsOptions {
  /** Indexer URL — defaults from ZgConfig.storageIndexerUrl. */
  indexerUrl: string;
  /** Submission index emitted by Flow.Submit (`txSeq`). */
  txSeq: bigint | number;
  /** Optional: how many storage replicas to push to. Default 1. */
  expectedReplica?: number;
  /** Optional: how long (ms) to wait for the indexer to see the upload. Default 60s. */
  finalityTimeoutMs?: number;
  /** Optional: poll interval (ms) while waiting for finality. Default 2s. */
  finalityPollMs?: number;
}

export interface UploadSegmentsResult {
  /** Merkle root we just pushed segments for. */
  rootHash: `0x${string}`;
  /** Storage nodes that accepted the segments. */
  storageNodeUrls: string[];
  /** True if at least one node reports the file as finalized. */
  finalized: boolean;
}

/**
 * Push the raw bytes for a Flow submission into storage nodes selected via
 * the Indexer. After this returns, `Indexer.download(rootHash)` round-trips.
 */
export async function uploadSegments(
  bytes: Uint8Array,
  opts: UploadSegmentsOptions,
): Promise<UploadSegmentsResult> {
  const indexer = new Indexer(opts.indexerUrl);
  const expectedReplica = Math.max(1, opts.expectedReplica ?? 1);
  const txSeqNum = Number(opts.txSeq);
  if (!Number.isFinite(txSeqNum)) {
    throw new Error(`uploadSegments: invalid txSeq ${opts.txSeq}`);
  }

  const [nodes, selErr] = await indexer.selectNodes(expectedReplica);
  if (selErr || nodes.length === 0) {
    throw new Error(
      `uploadSegments: no storage nodes available (${selErr?.message ?? 'empty selection'})`,
    );
  }

  const file = new MemData(Array.from(bytes));
  const [tree, treeErr] = await file.merkleTree();
  if (treeErr || !tree || tree.rootHash() == null) {
    throw new Error(`uploadSegments: merkle tree build failed: ${treeErr?.message ?? 'unknown'}`);
  }
  const rootHash = tree.rootHash() as `0x${string}`;

  // Build all SegmentWithProof records up front. For Brainpedia manifests
  // (a few KB of JSON) this is always 1 segment, but the loop generalises
  // so we don't break if a Brain ever ships a bigger snapshot.
  const numChunks = file.numChunks();
  const numSegments = file.numSegments();
  const segments: Array<{
    root: string;
    data: string;
    index: number;
    proof: { lemma: string[]; path: boolean[] };
    fileSize: number;
  }> = [];

  for (let segIndex = 0; segIndex < numSegments; segIndex++) {
    const iter = file.iterateWithOffsetAndBatch(
      segIndex * DEFAULT_SEGMENT_SIZE,
      DEFAULT_SEGMENT_SIZE,
      true,
    );
    const [ok, iterErr] = await iter.next();
    if (iterErr || !ok) {
      throw new Error(
        `uploadSegments: segment ${segIndex} read failed: ${iterErr?.message ?? 'short read'}`,
      );
    }
    let segment = iter.current();
    const startChunk = segIndex * DEFAULT_SEGMENT_MAX_CHUNKS;
    if (startChunk + segment.length / DEFAULT_CHUNK_SIZE >= numChunks) {
      const expectedLen = DEFAULT_CHUNK_SIZE * (numChunks - startChunk);
      segment = segment.slice(0, expectedLen);
    }

    const proof = tree.proofAt(segIndex);
    segments.push({
      root: rootHash,
      data: encodeBase64(segment),
      index: segIndex,
      proof: {
        // SDK Proof exposes lemma/path; cast tolerates the loose typing.
        lemma: proof.lemma as unknown as string[],
        path: proof.path,
      },
      fileSize: file.size(),
    });
  }

  // Push to every selected replica. uploadSegmentsByTxSeq returns null on
  // success (RPC has no return payload); errors throw.
  const acceptedUrls: string[] = [];
  for (const node of nodes as StorageNode[]) {
    try {
      // The SDK signature is uploadSegmentsByTxSeq(segs, txSeq: number).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await node.uploadSegmentsByTxSeq(segments as any, txSeqNum);
      acceptedUrls.push(node.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // "already uploaded and finalized" is a no-op success.
      if (
        msg.includes('already uploaded and finalized') ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err as any)?.data === 'already uploaded and finalized'
      ) {
        acceptedUrls.push(node.url);
        continue;
      }
      throw new Error(`uploadSegments: node ${node.url} rejected: ${msg}`);
    }
  }

  // Wait for at least one node to mark the file as finalized so the
  // indexer's getFileLocations starts returning it.
  const timeoutMs = opts.finalityTimeoutMs ?? 60_000;
  const pollMs = opts.finalityPollMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;
  let finalized = false;
  while (Date.now() < deadline) {
    for (const node of nodes as StorageNode[]) {
      try {
        const info = await node.getFileInfoByTxSeq(txSeqNum);
        if (info && info.finalized) {
          finalized = true;
          break;
        }
      } catch {
        // ignore; node may be syncing
      }
    }
    if (finalized) break;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  return { rootHash, storageNodeUrls: acceptedUrls, finalized };
}
