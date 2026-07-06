/**
 * In-memory session cache for the two-phase mixture API.
 *
 * Phase 1: server fans out, computes plan, caches the FULL result keyed by a
 * fresh sessionId, returns a redacted preview to the caller.
 * Phase 2: caller settles on chain, re-calls with sessionId + txHash; server
 * verifies the tx, returns the cached full result.
 *
 * TTL is 10 minutes — long enough for an agent to read the plan, build a
 * settlement tx, and confirm it on Galileo (block time ~1s but RPC + relay
 * latency can stretch this). Cache is per-instance — fine for the demo on a
 * single Railway replica; would need Redis to scale out.
 */
import { randomBytes } from 'node:crypto';
import { loadMixtureSession, storeMixtureSession } from '@brainpedia/storage-retaindb';

export interface CachedMixture {
  createdAt: number;
  topic: string;
  prompt: string;
  /** Anything we want to surface AFTER settlement — including the per-brain
   *  answers, the synthesis line, and the resolved router decision. */
  full: unknown;
  /** Plan needed to verify on-chain settlement. */
  plan: {
    distributor: string | null;
    splits: Array<{ inft: string | null; amountWei: string }>;
    totalAmountWei: string;
  };
  /** Set once the plan has been verified-paid on chain. Makes subsequent
   *  claims idempotent: a re-claim (any txHash, or none) returns the cached
   *  unlocked response at zero cost instead of re-verifying or re-paying. */
  settled?: {
    txHash: string;
    response: unknown;
  };
}

// 30 min: long enough that a failed-unlock → verify-only retry (or a
// re-record across recording takes) stays within the same session.
const TTL_MS = 30 * 60 * 1000;
const sessions = new Map<string, CachedMixture>();

function gc(now = Date.now()): void {
  for (const [k, v] of sessions) {
    if (now - v.createdAt > TTL_MS) sessions.delete(k);
  }
}

export function newSessionId(): string {
  return 'mix_' + randomBytes(12).toString('hex');
}

export function putSession(sessionId: string, value: CachedMixture): void {
  gc();
  sessions.set(sessionId, value);
  void storeMixtureSession(sessionId, value).catch((err) => {
    console.warn('[sessions] RetainDB persist failed:', err);
  });
}

export async function getSession(sessionId: string): Promise<CachedMixture | null> {
  gc();
  const v = sessions.get(sessionId);
  if (v) {
    if (Date.now() - v.createdAt > TTL_MS) {
      sessions.delete(sessionId);
      return null;
    }
    return v;
  }

  const restored = await loadMixtureSession<CachedMixture>(sessionId);
  if (!restored) return null;
  if (Date.now() - restored.createdAt > TTL_MS) return null;
  sessions.set(sessionId, restored);
  return restored;
}

/** Record a verified settlement so future claims are idempotent + free. */
export function markSettled(
  sessionId: string,
  txHash: string,
  response: unknown,
): void {
  const v = sessions.get(sessionId);
  if (v) v.settled = { txHash, response };
}

export const SESSION_TTL_MS = TTL_MS;
