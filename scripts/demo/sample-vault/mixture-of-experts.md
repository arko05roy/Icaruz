---
title: Mixture of Experts
tags: [ml, architecture]
---

# Mixture of Experts (MoE)

Classical MoE: a single big model contains many specialised "experts" (typically MLP blocks); a learned router activates a small subset per token. Mixtral and DeepSeek-V3 popularised this for open-weights LLMs.

The Brainpedia twist: instead of *experts inside one model*, the experts are *separately-owned Brains in a network* (see [[brainpedia-architecture]]). The router is the orchestrator agent, the activation is a real network call (see [[mcp-protocol]] over [[yggdrasil-mesh]]), and the experts live behind their own [[inft-erc-7857]] / [[ens-as-identity]] / [[on-chain-payments]] surface.

Two things this gets right that classical MoE doesn't:

1. **Independent ownership and incentives** — a Brain owner is paid per query, so they're motivated to keep their snapshot fresh and accurate. Inside one big model the experts share the same training run; they don't compete.
2. **Composability across organisations** — a query can fan out to brains owned by three different humans on three different continents. No vendor lock-in, no API key dance.

The cost: latency. A network MoE adds a P2P round trip per expert. Mitigation: parallel fan-out via [[yggdrasil-mesh]].
