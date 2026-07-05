import {
  createBrainHandler,
  type BrainQueryRequest,
  type BrainQueryResult,
} from '@brainpedia/brain';
import { getCreatorBrain } from './brain-store';

let handler: ReturnType<typeof createBrainHandler> | null = null;

function must(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

/** True when the in-process brain handler can run (no separate brain service). */
export function isBrainRuntimeConfigured(): boolean {
  return Boolean(
    process.env.ZG_WALLET_PRIVATE_KEY?.trim() &&
      process.env.BRAIN_ENS_NAME?.trim() &&
      process.env.BRAIN_STORAGE_ROOT?.trim() &&
      process.env.BRAIN_SPECIALTY?.trim(),
  );
}

function getHandler() {
  if (!handler) {
    handler = createBrainHandler(
      {
        ensName: must('BRAIN_ENS_NAME'),
        storageRoot: must('BRAIN_STORAGE_ROOT'),
        specialty: must('BRAIN_SPECIALTY'),
        topK: Number(process.env.BRAIN_TOP_K ?? 4),
        enforceAccessTokens: process.env.BRAIN_ENFORCE_ACCESS_TOKENS === 'true',
      },
      must('ZG_WALLET_PRIVATE_KEY'),
    );
  }
  return handler;
}

/** Demo token used by mixture + /api/brain when BRAIN_ENFORCE_ACCESS_TOKENS=false. */
export const BTL_DEMO_AGENT = '0x0000000000000000000000000000000000000001' as const;
export const BTL_DEMO_ACCESS_TOKEN = 'btl-hackathon' as const;

export async function queryBrainLocal(req: BrainQueryRequest): Promise<BrainQueryResult> {
  if (!isBrainRuntimeConfigured()) {
    throw new Error(
      'brain runtime not configured — set ZG_WALLET_PRIVATE_KEY, BRAIN_ENS_NAME, BRAIN_STORAGE_ROOT, BRAIN_SPECIALTY',
    );
  }

  // ponytail: resolve creator brains from the same brains.json /create writes —
  // never depend on a stale @brainpedia/brain dist for newly published targets.
  let query = req;
  if (req.target && !req.storageRoot) {
    const creator = await getCreatorBrain(req.target);
    if (creator?.storageRoot) {
      query = {
        ...req,
        storageRoot: creator.storageRoot,
        specialty: creator.specialty,
      };
    }
  }

  return getHandler().query(query);
}

export type { BrainQueryRequest, BrainQueryResult };
