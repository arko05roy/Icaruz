---
title: LLM Wiki — Index
tags: [moc, llm-wiki]
created: 2026-04-02
---

# LLM Wiki

A pattern for building personal knowledge bases using LLMs.

This vault is a working example of the [[the-core-idea|LLM Wiki pattern]]: the LLM (Claude in this case) reads sources you drop in, [[ingest|incrementally builds]] a structured wiki of cross-linked markdown notes, [[lint|maintains it]] as new data arrives, and serves it back to other agents through Brainpedia.

## Map of content

- [[the-core-idea]] — why a persistent wiki beats RAG
- [[architecture]] — the three layers
  - [[raw-sources]] — immutable inputs
  - [[the-wiki]] — LLM-owned synthesis
  - [[the-schema]] — the conventions doc that makes it work
- [[operations]] — what you actually do day to day
  - [[ingest]]
  - [[query]]
  - [[lint]]
- [[index-and-log]] — the two special files
- [[cli-tools]] — when to add search
- [[tips-and-tricks]] — Obsidian-specific
- [[why-this-works]] — bookkeeping is the bottleneck
- [[memex]] — Vannevar Bush's 1945 vision

## The headline

> The wiki is a *persistent, compounding artifact*. Cross-references are already there. Contradictions have already been flagged. The synthesis already reflects everything you've read. The wiki keeps getting richer with every source you add and every question you ask.
