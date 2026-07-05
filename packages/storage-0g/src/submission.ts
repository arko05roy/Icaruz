import { MemData } from '@0glabs/0g-ts-sdk';

/**
 * Pure helpers for building the inputs to a 0G `Flow.submit(...)` call,
 * without committing to any specific transaction-sending stack (ethers vs
 * viem). The deployed Flow on Galileo (`0x22E03a6A89B950F1c82ec5e74F8eCa321a105296`)
 * expects the 2-field outer Submission tuple
 *
 *     struct Submission {
 *       SubmissionData data;     // { uint256 length; bytes tags; SubmissionNode[] nodes; }
 *       address       submitter;
 *     }
 *
 * — selector `0xbc8c11f8`. The npm SDK (`@0glabs/0g-ts-sdk@0.3.3`) only
 * encodes the inner SubmissionData (selector `0xef3e12dc`), so its
 * built-in `Indexer.upload` reverts. Callers can use these helpers to
 * compute the merkle root + the SubmissionData fields, then hand-roll
 * the on-chain call with whatever wallet they have.
 */

export interface SubmissionNodeInput {
  /** keccak-style 32-byte root for this segment node, as 0x-prefixed hex. */
  root: `0x${string}`;
  /** Tree height as a regular number — converted to bigint at call site. */
  height: number;
}

export interface BuiltSubmission {
  /** The Flow merkle rootHash for the manifest — what goes into the iNFT. */
  rootHash: `0x${string}`;
  /** Raw byte length of the manifest (matches Submission.data.length). */
  length: number;
  /** SubmissionNode[] — pre-padded by the SDK to satisfy Flow.valid(). */
  nodes: SubmissionNodeInput[];
}

/**
 * Build the inputs to a Flow.submit() call from raw manifest bytes.
 * Uses the SDK's `MemData` (which already implements the segment tree
 * + padding the contract validates) so future SDK fixes still produce
 * a layout the contract accepts.
 */
export async function buildSubmissionFromBytes(bytes: Uint8Array): Promise<BuiltSubmission> {
  const file = new MemData(Array.from(bytes));

  const [tree, mtErr] = await file.merkleTree();
  if (mtErr || !tree || tree.rootHash() == null) {
    throw new Error(`buildSubmissionFromBytes: merkle tree failed: ${mtErr?.message ?? 'unknown'}`);
  }
  const rootHash = tree.rootHash() as `0x${string}`;

  const [submission, csErr] = await file.createSubmission('0x');
  if (csErr || !submission) {
    throw new Error(`buildSubmissionFromBytes: createSubmission failed: ${csErr?.message ?? 'unknown'}`);
  }

  const nodes: SubmissionNodeInput[] = submission.nodes.map((n) => ({
    root: n.root as `0x${string}`,
    height: Number(n.height.toString()),
  }));

  return {
    rootHash,
    length: Number(submission.length.toString()),
    nodes,
  };
}
