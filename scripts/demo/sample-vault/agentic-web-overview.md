---
title: Agentic Web Overview
tags: [moc, agentic-web]
created: 2026-04-15
---

# Agentic Web Overview

The "agentic web" describes a layer above the human web where autonomous agents discover services, negotiate access, and transact on behalf of users. Three primitives matter:

1. **Identity** — every agent and every service needs a portable, on-chain handle. See [[ens-as-identity]].
2. **Communication** — agents must reach each other without a central API gateway. See [[yggdrasil-mesh]] and [[mcp-protocol]].
3. **Settlement** — pay-per-call without sign-up flows. See [[on-chain-payments]].

Brainpedia is a thesis bet that *knowledge* is the most valuable thing agents will trade — and that compiled human expertise (compiled the way Karpathy, Farzapedia, and the second-brain crowd already do it) is the supply side. See [[brainpedia-architecture]] for how those three primitives plug into the iNFT layer (see [[inft-erc-7857]]).

The wider context is [[mixture-of-experts]]: a single LLM is bad at being broad and deep at the same time. The agentic web's answer is many narrow specialty models composed at query time.
