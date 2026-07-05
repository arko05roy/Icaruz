import { AxlClient, type PeerId } from './client.js';

/**
 * Mixture-of-Brains orchestrator.
 *
 *   1. Receives a top-level user query.
 *   2. Classifies which Brains are relevant (router model).
 *   3. Resolves each Brain's peer id from its ENS text record
 *      (`brain.axl_peer_id`) — see @brainpedia/ens.
 *   4. Fans out parallel `POST /mcp/{peer}/query` calls.
 *   5. Synthesizes responses via 0G Compute.
 *   6. Returns the answer + per-Brain attribution to the caller.
 *
 * All cross-Brain communication is AXL — never an internal queue or
 * shared process — to satisfy the Gensyn "no centralised broker" rule.
 */

export interface BrainTarget {
  ensName: string;
  peerId: PeerId;
  /** weight assigned by the router (0..1). */
  weight: number;
}

export interface BrainAnswer {
  ensName: string;
  peerId: PeerId;
  answer: string;
  citations: string[];
  confidence: number | null;
}

export interface SynthesizedAnswer {
  answer: string;
  contributions: BrainAnswer[];
  /** Echoed back so the orchestrator caller can show royalty splits. */
  weights: Record<string, number>;
}

export class Orchestrator {
  constructor(private axl: AxlClient) {}

  async query(prompt: string, targets: BrainTarget[]): Promise<SynthesizedAnswer> {
    if (targets.length === 0) throw new Error('Orchestrator.query: no targets');

    const id = Date.now();
    const calls = targets.map(async (t, i): Promise<BrainAnswer> => {
      const res = await this.axl.mcp<{
        answer: string;
        citations: string[];
        confidence: number | null;
      }>(t.peerId, 'query', {
        jsonrpc: '2.0',
        id: `${id}-${i}`,
        method: 'query',
        params: { prompt },
      });
      if (!res.result) {
        throw new Error(
          `Brain ${t.ensName} returned error: ${res.error?.message ?? 'unknown'}`,
        );
      }
      return {
        ensName: t.ensName,
        peerId: t.peerId,
        answer: res.result.answer,
        citations: res.result.citations ?? [],
        confidence: res.result.confidence ?? null,
      };
    });

    const contributions = await Promise.all(calls);

    // Day 4: synthesis pass through 0G Compute (uses @brainpedia/compute-0g).
    // For now, concatenate as a placeholder so end-to-end wiring is testable.
    const answer = contributions
      .map((c) => `[${c.ensName}] ${c.answer}`)
      .join('\n\n');

    const weights = Object.fromEntries(targets.map((t) => [t.ensName, t.weight]));
    return { answer, contributions, weights };
  }
}
