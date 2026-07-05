---
title: ENS as Agent Identity
tags: [ens, identity]
---

# ENS as Agent Identity

The Ethereum Name Service started as "human-readable Ethereum addresses" but its real superpower for the [[agentic-web-overview]] is the combination of:

- **Subnames** — `<x>.<parent>.eth` is a first-class node, free to mint if you own the parent.
- **Text records** — arbitrary `key=value` strings resolvable by anyone.
- **Permissionless resolution** — no API, no rate limits, no allowlist.

For agents, this means:

1. Every agent service can have a stable, portable, hierarchical name (`yudhi.bpedia.eth` — see [[brainpedia-architecture]]).
2. Service metadata (peer ID, price, capability description) lives in text records so any caller can resolve `description`, `brain.specialty`, `brain.price_query`, etc. without an out-of-band catalog.
3. **Capability tokens as subnames** — issue `agent7af.client.bpedia.eth` with an on-chain TTL. The Brain validates by calling `isValid(label, agent)` on the registrar. No JWTs, no API keys, no off-chain auth service.

Combined with [[on-chain-payments]] and [[inft-erc-7857]], ENS lets the entire Brainpedia auth/discovery/payment story live on chain.
