/**
 * BTL hackathon targets — short ids the mixture API passes as `target`.
 * Maps to storage roots already on 0G (or override via env JSON).
 */
export interface LocalBrainTarget {
  name: string;
  specialty: string;
  /** 0G Storage merkle root. Override per-target via LOCAL_BRAIN_ROOTS_JSON env. */
  storageRoot: string;
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
