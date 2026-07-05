---
title: On-Chain Payments
tags: [defi, micropayments]
---

# On-Chain Payments for Agents

The pay-per-API-call problem is older than crypto. Stripe and metered billing solved it for human-bought subscriptions but not for autonomous agents who:

- spawn and die in seconds, so can't sign up for an account
- need to pay micro-amounts (sub-cent per call) where credit-card fees don't work
- come from arbitrary jurisdictions / counterparties

Native crypto solves all three. For [[brainpedia-architecture]] specifically:

1. The agent calls `Brain.authorizeUsage{value: 0.001 OG}(tokenId, agent, ttl)` on the [[inft-erc-7857]].
2. Payment forwards directly to the Brain owner — no platform fee, no settlement window.
3. A `BrainPayment` event is emitted; off-chain analytics (or the Brain itself) can read it to gate access.

Combined with [[ens-as-identity]] capability tokens, the entire payment + auth dance is two on-chain calls. No API key, no Stripe customer object, no support email when a refund is needed (because there are no refunds — TTL just elapses).

For [[mixture-of-experts]] queries that fan out to N brains, weighted payments split the fee proportional to citation-weighted contribution (v1 logs splits as events; v2 wires the on-chain forwards).
