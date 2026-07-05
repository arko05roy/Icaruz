/**
 * Brain catalog — static demo brains + persisted creator brains.
 */
import { getCreatorBrain, listCreatorBrains, type CreatorBrainRecord } from './brain-store';

export interface LocalBrain {
  id: string;
  name: string;
  specialty: string;
  /** Passed as `target` to the brain MCP handler. */
  target: string;
  topics: string[];
  /** Present on creator-published brains. */
  payoutWallet?: `0x${string}`;
  priceUsd?: number;
  isCreator?: boolean;
}

export const LOCAL_BRAINS: LocalBrain[] = [
  {
    id: 'yudhi',
    name: 'yudhi',
    specialty: 'EVM security, audit methodology, incident post-mortems',
    target: 'yudhi',
    topics: ['research', 'all'],
  },
  {
    id: 'karpathy',
    name: 'karpathy',
    specialty: 'LLM wiki methodology, knowledge management, agent design',
    target: 'karpathy',
    topics: ['frameworks', 'all'],
  },
  {
    id: '0g-expert',
    name: '0g-expert',
    specialty: '0G Storage, Compute, Chain, and Agentic ID documentation',
    target: '0g-expert',
    topics: ['research', 'all'],
  },
];

export const DISCOVERY_TOPICS: Array<{ topic: string; description: string }> = [
  {
    topic: 'research',
    description:
      'Security engineering, smart-contract audits, incident analysis, DeFi risk.',
  },
  {
    topic: 'frameworks',
    description: 'Knowledge management, LLM wikis, note-taking systems, agent design.',
  },
  {
    topic: 'all',
    description: 'Every brain in the local catalog.',
  },
];

function creatorToLocal(b: CreatorBrainRecord): LocalBrain {
  return {
    id: b.id,
    name: b.name,
    specialty: b.specialty,
    target: b.id,
    topics: b.topics,
    payoutWallet: b.payoutWallet,
    priceUsd: b.priceUsd,
    isCreator: true,
  };
}

/** Static demo brains only (sync). */
export function listLocalBrainsForTopic(topic: string): LocalBrain[] {
  const t = topic.toLowerCase();
  if (t === 'all') return LOCAL_BRAINS;
  return LOCAL_BRAINS.filter((b) => b.topics.includes(t));
}

/** Demo + creator brains for a topic (async). */
export async function listAllBrainsForTopic(topic: string): Promise<LocalBrain[]> {
  const t = topic.toLowerCase();
  const creators = (await listCreatorBrains()).map(creatorToLocal);
  const staticBrains = t === 'all' ? LOCAL_BRAINS : LOCAL_BRAINS.filter((b) => b.topics.includes(t));
  const creatorFiltered =
    t === 'all' ? creators : creators.filter((b) => b.topics.includes(t));
  return [...staticBrains, ...creatorFiltered];
}

export async function findBrainById(name: string): Promise<LocalBrain | null> {
  const key = name.toLowerCase();
  const staticBrain = LOCAL_BRAINS.find((b) => b.id === key || b.name === key);
  if (staticBrain) return staticBrain;
  const creator = await getCreatorBrain(key);
  return creator ? creatorToLocal(creator) : null;
}

export interface CreatorEconomicsRow {
  id: string;
  name: string;
  wallet: `0x${string}` | null;
  priceUsd: number;
  /** True when x402 payment was verified on this request (agent path). */
  paid: boolean;
}

export function buildCreatorEconomics(
  brains: LocalBrain[],
  paidIds: Set<string> = new Set(),
): {
  brains: CreatorEconomicsRow[];
  totalUsd: number;
  x402: { endpoint: string; instructions: string };
} {
  const rows: CreatorEconomicsRow[] = brains.map((b) => ({
    id: b.id,
    name: b.name,
    wallet: b.payoutWallet ?? null,
    priceUsd: b.priceUsd ?? 0,
    paid: paidIds.has(b.id) || !(b.priceUsd && b.payoutWallet),
  }));
  const totalUsd = rows.reduce((sum, r) => sum + r.priceUsd, 0);
  return {
    brains: rows,
    totalUsd,
    x402: {
      endpoint: '/api/brain',
      instructions:
        'POST { prompt, target } per brain. Without X-PAYMENT, priced brains return HTTP 402. ' +
        'Pay via x402 (USDC on Base), retry with payment header. Demo UI skips via X402_SKIP_PAYMENT.',
    },
  };
}
