import type { ArticleRecord } from '@brainpedia/storage-0g';

/** ponytail: offline fallback when 0G indexer has no segments for the root. */
const DEMO_ARTICLES: ArticleRecord[] = [
  {
    slug: 'reentrancy-guard',
    title: 'Reentrancy attacks and guards',
    body:
      'Reentrancy occurs when an external call re-enters a contract before state updates finish. ' +
      'Classic pattern: withdraw sends ETH then zeroes balance — attacker re-enters withdraw in fallback. ' +
      'Mitigations: checks-effects-interactions, ReentrancyGuard, pull payments, balance snapshots.',
    links: [],
    sources: [],
    updatedAt: '2026-01-01',
  },
  {
    slug: 'stablecoin-yield-overview',
    title: 'Stablecoin yield overview',
    body:
      'Stablecoin yield buckets: lending (Aave, Compound), AMM LP (Curve), and structured products. ' +
      'Risk axes: smart-contract, depeg, oracle, governance, and liquidity.',
    links: [],
    sources: [],
    updatedAt: '2026-01-01',
  },
  {
    slug: 'retrieval-vs-rag',
    title: 'Retrieval vs RAG vs compiled wikis',
    body:
      'RAG embeds documents and k-NN searches at query time. Compiled wikis are curated once and ' +
      'served as ground truth — better recall and structure for specialist brains.',
    links: [],
    sources: [],
    updatedAt: '2026-01-01',
  },
];

export function loadDemoArticles(): ArticleRecord[] {
  return DEMO_ARTICLES;
}
