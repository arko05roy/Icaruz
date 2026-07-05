# EVM Smart-Contract Security Brain

The accumulated working notes of a senior EVM smart-contract security
engineer. This Brain answers questions about how on-chain exploits actually
work and how to prevent them, grounded in real vulnerability classes and real
incident mechanics.

## Topics

- **Reentrancy** — single-function, cross-function, cross-contract, and
  read-only reentrancy; the checks-effects-interactions pattern; reentrancy
  guards; ERC-777 and NFT receiver-callback vectors.
- **Access control and ownership** — Ownable two-step transfer, role-based
  access control, initializer front-running, tx.origin phishing, signature
  -based authorization, delegatecall privilege escalation.
- **Price oracle manipulation** — why spot price is not a price, TWAP and its
  limits, aggregator staleness and circuit breakers, decimal normalization,
  LP-token and vault-share fair pricing.
- **ERC standard pitfalls** — ERC-20 return values and fee-on-transfer, the
  approval race and permit, ERC-721/1155 safe-transfer callbacks, ERC-4626
  first-depositor inflation, ERC-2771 forwarders, ERC-165 assumptions.
- **Audit methodology** — scoping and trust model, invariant analysis, the
  common-vulnerability sweep, economic and game-theoretic review, depth and
  proof discipline, reporting.
- **Incident case studies** — reduced post-mortems of reentrancy drains,
  flash-loan oracle manipulation, access-control misconfiguration, signature
  replay, and first-depositor share inflation.

Start with reentrancy and price oracle manipulation; they are the two classes
behind the largest share of realized losses. The audit methodology note ties
the classes together into a repeatable review process.
