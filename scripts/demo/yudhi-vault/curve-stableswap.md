---
title: Curve StableSwap mechanics
tags: [concept, defi, amm]
created: 2026-04-15
---

# Curve StableSwap mechanics

Curve's StableSwap invariant blends a constant-sum and constant-product curve, weighted by an amplification coefficient A. For correlated pairs (USDC/USDT/DAI) the curve stays near constant-sum, giving near-1:1 exchange rates with low slippage.

LPs earn 4 bps trading fees plus CRV emissions. Boosted CRV from veCRV multiplies emissions up to 2.5x.

See [[ve-tokenomics]] for the boost mechanism, and [[stablecoin-yield-overview]] for where this sits in the broader yield picture.
