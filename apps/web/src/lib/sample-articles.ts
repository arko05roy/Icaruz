/**
 * Sample articles compiled into the canonical demo Brain (yudhi.brainpedia.eth).
 * Mirrors what `scripts/setup/seed-brain.ts` uploaded to 0G Storage. Once
 * the SDK 0G upload path is unblocked these will be fetched live from the
 * Log layer instead of inlined.
 */

export interface SampleArticle {
  slug: string;
  title: string;
  body: string;
  links: string[];
  sources: string[];
}

export const SAMPLE_BRAIN_LABEL = 'yudhi';
export const SAMPLE_BRAIN_ARTICLES: SampleArticle[] = [
  {
    slug: 'stablecoin-yield-overview',
    title: 'Stablecoin Yield Overview',
    body:
      'Stablecoin yields come from three buckets: (1) lending markets like Aave/Compound — ' +
      'low risk but rates compress with TVL; (2) liquidity-providing on Curve/Uniswap stable pools — ' +
      'yield from swap fees plus token incentives, with impermanent loss risk only in depeg; ' +
      '(3) RWA exposure via Maple, Centrifuge, Ondo — credit risk and longer lockups, but 8-12% sustainable.',
    links: ['lending-markets', 'curve-stableswap', 'rwa-tokenization'],
    sources: ['research/stablecoin-yields-2025.md'],
  },
  {
    slug: 'curve-stableswap',
    title: 'Curve StableSwap mechanics',
    body:
      "Curve's StableSwap invariant blends a constant-sum and constant-product curve, weighted " +
      'by an amplification coefficient A. For correlated pairs (USDC/USDT/DAI) the curve stays ' +
      'near constant-sum, giving near-1:1 exchange rates with low slippage. LPs earn 4 bps trading ' +
      'fees + CRV emissions. Boosted CRV from veCRV multiplies emissions up to 2.5x.',
    links: ['stablecoin-yield-overview', 've-tokenomics'],
    sources: ['research/curve-mechanics.md'],
  },
  {
    slug: 'rwa-tokenization',
    title: 'RWA tokenization landscape',
    body:
      'Real-world asset (RWA) tokenization brings off-chain credit, treasuries, and real-estate ' +
      'cashflows on-chain. Major players: Ondo (tokenized treasuries), Maple (institutional credit), ' +
      'Centrifuge (invoice/asset-backed pools). Yields 4-12% with credit risk; mostly KYC-gated ' +
      'unless the issuer offers a permissionless wrapper. Regulatory exposure varies by jurisdiction.',
    links: ['stablecoin-yield-overview', 'malaysian-regulatory-context'],
    sources: ['research/rwa-overview.md', 'notes/maple-credit.md'],
  },
  {
    slug: 'malaysian-regulatory-context',
    title: 'Malaysian DeFi regulatory context',
    body:
      "Malaysia's SC framework treats most DeFi activity as outside the Capital Markets and " +
      'Services Act unless the protocol issues a security token. Stablecoin holdings and lending ' +
      'are not currently classified as securities. RWA tokens that wrap regulated instruments ' +
      '(treasuries, equity) WILL fall under SC purview — buyer beware. Bank Negara has signalled ' +
      'AML/KYC enforcement on on/off ramps, not on the underlying contracts.',
    links: ['rwa-tokenization'],
    sources: ['notes/sc-defi-2024.md'],
  },
  {
    slug: 'lending-markets',
    title: 'On-chain lending markets',
    body:
      'Aave V3 and Compound V3 (Comet) are the two main lending markets. Aave\'s eMode boosts ' +
      'capital efficiency for correlated assets (e.g., 95% LTV between stables). Comet uses a ' +
      'single-base-asset model: USDC base, all other assets are collateral only. Sustainable ' +
      'rates: 3-6% on USDC. Risk: smart-contract risk + oracle manipulation in volatile markets.',
    links: ['stablecoin-yield-overview'],
    sources: ['research/aave-v3.md', 'research/compound-comet.md'],
  },
  {
    slug: 've-tokenomics',
    title: 've-tokenomics',
    body:
      "Curve's vote-escrowed (ve) model locks CRV for up to 4 years in exchange for veCRV — a " +
      'non-transferable governance token whose voting power decays linearly. Lockers get ' +
      'protocol fees, gauge voting (directs CRV emissions to specific pools), and a boost ' +
      'multiplier. Convex (CVX) abstracts this: one-shot lock through Convex, get CVX + cvxCRV ' +
      'with continuous yield and tradable claims.',
    links: ['curve-stableswap'],
    sources: ['research/curve-ve-design.md'],
  },
];
