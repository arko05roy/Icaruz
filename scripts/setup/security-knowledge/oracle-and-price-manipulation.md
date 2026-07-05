# Price Oracle Manipulation

Price oracle manipulation is the exploitation of a protocol that derives a
price from a source an attacker can move within the attack transaction. Most
large DeFi losses since 2020 are some variant of this: borrow against an
inflated collateral price, or repay debt at a deflated price, all inside one
flash-loaned transaction.

## Spot Price Is Not a Price

Reading `getReserves()` on a Uniswap V2 pair, or `slot0` on a V3 pool, gives
the instantaneous marginal price. A flash loan can swap the pool to any ratio
for the duration of one transaction, so any logic that values collateral or
mints shares from a spot read is manipulable for the cost of swap fees. The
rule: never price an asset from a pool's current reserves or current tick.

## TWAP and Its Limits

A time-weighted average price (Uniswap V2 cumulative price, V3
`observe()`) raises the cost of manipulation because the attacker must hold
the manipulated price across multiple blocks, exposing them to arbitrage. A
TWAP is not free of risk: a short window is still cheap to move, low-liquidity
pools can be moved profitably even across blocks, and on low-blocktime chains
the same wall-clock window spans more blocks. Choose the window from the
liquidity depth and the value at risk, not a default.

## Aggregator Oracles and Staleness

Chainlink-style push oracles remove same-transaction manipulation but
introduce freshness and liveness failure modes. Every consumption of
`latestRoundData` must check: `answer > 0`, `updatedAt` is within a
heartbeat-derived staleness bound, `answeredInRound >= roundId`, and that the
price is not pinned to a circuit-breaker min/max bound (the LUNA collapse paid
out at a floored price because the feed could not report low enough). A feed
that reverts or returns stale data must fail closed — pause the dependent
action — not default to the last value.

## Decimals and Cross-Asset Math

Oracle answers carry their own decimals (often 8) which differ from the token
decimals (often 18, sometimes 6). Mixing them without normalization inflates
or deflates a valuation by orders of magnitude. Every price multiplication
must annotate units and normalize to a single fixed-point scale; this is the
most common quiet bug in collateral math.

## LP Token and Vault Share Pricing

Pricing an LP token by `balanceOf` of the underlying times spot price is
manipulable through the same reserves an attacker controls, and through
read-only reentrancy. Use a fair-reserves formula that depends on invariant
and external prices (e.g. the Alpha Finance fair-LP method) and a
manipulation-resistant price for each leg. ERC-4626 `convertToAssets` is
similarly only as safe as the vault's accounting under donation and
first-depositor inflation.

## Mitigation Summary

Price from sources the attacker cannot move atomically; cross-check two
independent sources and deviate-revert; bound staleness and fail closed;
normalize decimals explicitly; and assume any input reachable by a flash loan
will be at its worst value during your most sensitive computation.
