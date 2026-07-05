---
title: ve-tokenomics
tags: [concept, defi, governance]
created: 2026-04-15
---

# ve-tokenomics

Curve's vote-escrowed (ve) model locks CRV for up to 4 years in exchange for veCRV — a non-transferable governance token whose voting power decays linearly.

Lockers get:
- Protocol fees
- Gauge voting (directs CRV emissions to specific pools)
- Boost multiplier on their own LP positions (up to 2.5x; see [[curve-stableswap]])

**Convex (CVX)** abstracts this: one-shot lock through Convex, get CVX plus cvxCRV with continuous yield and tradable claims. Removes the 4-year lockup friction at the cost of going through Convex's governance.
