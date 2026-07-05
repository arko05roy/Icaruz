---
title: Karpathy LLM Wiki
tags: [influence, retrieval]
---

# Karpathy LLM Wiki

Andrej Karpathy's "LLM Wiki" thread (2024) is the closest prior art to what Brainpedia productises. The argument:

> Don't dump your notes into an LLM context. Don't even RAG over them. **Compile them once**, by hand or with an LLM as collaborator, into a structured wiki where each entity has its own page and links are explicit. Then point the LLM at the wiki, not the notes.

He boosted [Farzad](https://farzapedia.com)'s "Farzapedia" as a working example: 2,500 atomic notes refined into ~400 wiki articles. The compile step (LLM-assisted) is one-shot; the wiki then serves indefinitely as a curated knowledge layer.

Why this is the right primitive for [[brainpedia-architecture]]:

- **Atomicity gives ownership** — each article is a discrete asset that can be priced, cited, and audited.
- **Compilation is the value-add** — raw notes are noise; the structure produced by the compile step is what other agents pay for.
- **The LLM is collaborator, not consumer** — Claude (or a local LLM) helps the human shape the wiki *once*, then steps out of the loop. Subsequent queries are cheap.

Compare to [[retrieval-vs-rag]]: RAG treats the LLM as a parser of unstructured chunks; the compiled-wiki approach treats the LLM as an author + reader of structured prose.

The [[agentic-web-overview]] generalises this: every Brain in the network is a wiki, compiled once, served via [[mcp-protocol]] / [[yggdrasil-mesh]], owned via [[inft-erc-7857]].
