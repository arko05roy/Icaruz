import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * BTL hackathon targets — short ids the mixture API passes as `target`.
 * Maps to storage roots already on 0G (or override via env JSON).
 */
export interface LocalBrainTarget {
  name: string;
  specialty: string;
  /** 0G Storage merkle root, or `local:{brainId}` for file-backed snapshots. */
  storageRoot: string;
}

interface CreatorBrainJson {
  id: string;
  name: string;
  specialty: string;
  storageRoot: string;
}

let creatorCache: CreatorBrainJson[] | null = null;
let creatorCacheAt = 0;
const CREATOR_CACHE_MS = 5_000;

function brainsDataDir(): string {
  return process.env.BRAINS_DATA_DIR?.trim() || join(process.cwd(), 'data');
}

async function loadCreatorBrainsJson(): Promise<CreatorBrainJson[]> {
  const now = Date.now();
  if (creatorCache && now - creatorCacheAt < CREATOR_CACHE_MS) {
    return creatorCache;
  }
  try {
    const raw = await readFile(join(brainsDataDir(), 'brains.json'), 'utf8');
    const parsed = JSON.parse(raw) as CreatorBrainJson[];
    creatorCache = Array.isArray(parsed) ? parsed : [];
  } catch {
    creatorCache = [];
  }
  creatorCacheAt = now;
  return creatorCache;
}

/** Defaults mirror live demo brains; override roots without redeploying. */
export const LOCAL_BRAIN_TARGETS: Record<string, LocalBrainTarget> = {
  yudhi: {
    name: 'yudhi',
    specialty: 'EVM security, audit methodology, incident post-mortems',
    storageRoot: '0xde0ebac78dd387969c8aba6c9ce5ef149a9e726685207c0026ae1c0c155ca37f',
  },
  karpathy: {
    name: 'karpathy',
    specialty: 'LLM wiki methodology, knowledge management, agent design',
    storageRoot: '',
  },
  '0g-expert': {
    name: '0g-expert',
    specialty: '0G Storage, Compute, Chain, and Agentic ID',
    storageRoot: '',
  },
};

function rootFor(key: string): string {
  const perBrain = process.env[`BRAIN_${key.toUpperCase().replace(/-/g, '_')}_STORAGE_ROOT`];
  if (perBrain) return perBrain;
  return process.env.BRAIN_STORAGE_ROOT ?? '';
}

/** Sync resolve for built-in demo targets only. */
export function resolveLocalTarget(id: string): LocalBrainTarget | null {
  const key = id.toLowerCase().replace(/\.bpedia\.eth$/, '');
  const base = LOCAL_BRAIN_TARGETS[key];
  if (!base) return null;

  let storageRoot = base.storageRoot || rootFor(key);

  const envJson = process.env.LOCAL_BRAIN_ROOTS_JSON;
  if (envJson) {
    try {
      const map = JSON.parse(envJson) as Record<string, string>;
      if (map[key]) storageRoot = map[key]!;
    } catch {
      /* ignore malformed override */
    }
  }

  return storageRoot ? { ...base, storageRoot } : null;
}

/** Async resolve including creator brains from data/brains.json. */
export async function resolveLocalTargetAsync(id: string): Promise<LocalBrainTarget | null> {
  const key = id.toLowerCase().replace(/\.bpedia\.eth$/, '');
  const builtIn = resolveLocalTarget(key);
  if (builtIn) return builtIn;

  const creators = await loadCreatorBrainsJson();
  const creator = creators.find((b) => b.id === key || b.name.toLowerCase() === key);
  if (!creator?.storageRoot) return null;

  return {
    name: creator.name,
    specialty: creator.specialty,
    storageRoot: creator.storageRoot,
  };
}
