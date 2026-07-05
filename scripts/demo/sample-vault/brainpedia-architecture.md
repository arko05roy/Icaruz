---
title: Brainpedia Architecture
tags: [moc, brainpedia]
---

# Brainpedia Architecture

The four-layer stack:

| Layer | Function | Primitive |
|---|---|---|
| 4 | Discovery + identity + auth | [[ens-as-identity]] subnames + text records + capability tokens |
| 3 | Communication | [[mcp-protocol]] over [[yggdrasil-mesh]] |
| 2 | Inference | 0G Compute with [[tee-attested-inference]] |
| 1 | Persistence + ownership | 0G Storage (KV+Log) + [[inft-erc-7857]] |

A query flows top-to-bottom-to-top:

1. Caller resolves `<name>.bpedia.eth` → text records → peer ID, price, iNFT address.
2. Caller pays via [[on-chain-payments]] (`Brain.authorizeUsage{value}`).
3. Caller `POST /mcp/{peer}/brainpedia.brain` over Yggdrasil with prompt + access token.
4. Brain validates token (on-chain `isValid`), fetches the snapshot from 0G Storage by merkle root, retrieves top-K articles, runs inference on 0G Compute (TEE-verified), returns cited answer.

For [[mixture-of-experts]] queries, an orchestrator agent fans out steps 1-4 across N relevant Brains in parallel and synthesises the answers. Discovery shortcuts (`<topic>.discover.bpedia.eth`) make the relevant-Brain set resolvable on chain.

The thing that ties this together is that **every layer is on-chain or on a P2P mesh** — no central API to deprecate, no auth service to maintain. See [[agentic-web-overview]] for the broader thesis.
