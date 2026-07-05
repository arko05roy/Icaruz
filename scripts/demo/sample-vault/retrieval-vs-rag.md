---
title: Retrieval vs RAG
tags: [retrieval, llm]
---

# Retrieval vs RAG vs Compiled Wikis

Retrieval-augmented generation (RAG) became the default answer to "how do I make an LLM use my data": embed your documents, k-NN search at query time, stuff the top hits into the prompt.

Karpathy's critique (and Farzapedia's working proof): for any *important* knowledge base, RAG is worse than a compiled wiki:

- **Recall is non-deterministic** — the embedding similarity lottery hides relevant context that doesn't share surface tokens.
- **Synthesis is shallow** — the LLM has to re-derive structure every time from raw chunks.
- **Stale context is invisible** — outdated chunks get retrieved with no flag.

A compiled wiki, by contrast, is curated, structured, opinionated. Karpathy's LLM Wiki and Farzapedia (2,500 atomic notes → 400 articles) demonstrate that an LLM can author the wiki *once* from your raw vault, then serve it forever as ground truth. See [[agentic-web-overview]] for why this matters at the network scale.

[[brainpedia-architecture]] takes this one step further: the compiled wiki *is* an asset (an [[inft-erc-7857]]), gated by [[on-chain-payments]], reachable by other agents over [[yggdrasil-mesh]], and resolvable by [[ens-as-identity]]. The output of the wiki-compile step becomes a tradeable intelligence layer.
