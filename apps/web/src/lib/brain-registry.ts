/**
 * Local brain catalog for BTL hackathon mode — no ENS, no chain, no AXL.
 * Each entry maps to a target the multi-tenant brain handler can resolve.
 */
export interface LocalBrain {
  id: string;
  name: string;
  specialty: string;
  /** Passed as `target` to the brain MCP handler. */
  target: string;
  topics: string[];
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

export function listLocalBrainsForTopic(topic: string): LocalBrain[] {
  const t = topic.toLowerCase();
  if (t === 'all') return LOCAL_BRAINS;
  return LOCAL_BRAINS.filter((b) => b.topics.includes(t));
}
