---
title: Indexing and Logging
tags: [infrastructure]
created: 2026-04-02
sources: [llm-wiki-gist]
---

# Indexing and Logging

Two infrastructure files in every wiki. They're how the LLM (and any agent calling the Brain) navigates the structure as it grows.

## index.md — the catalog

A flat list of every page in [[the-wiki]] with a one-line summary, organised by category (entities, concepts, source summaries, etc.). The LLM updates `index.md` on every [[ingest]]. When a [[query]] arrives, the LLM reads the index first to find candidate pages, then drills into them.

This works without embedding-based retrieval up to a few hundred pages. Once a Brain grows past that, the index becomes unwieldy and proper search ([[cli-tools|qmd]] or similar) is worth adding.

## log.md — the timeline

An append-only chronological record of compile and sync events. One line per operation, format:

```
## [YYYY-MM-DD] <op> | <subject>
```

So a string of recent activity looks like:

```
## [2026-05-02] ingest | research/curve-stableswap.md
## [2026-05-02] ingest | research/aave-v3.md
## [2026-05-03] lint | flagged 3 stale claims, 2 orphan pages
## [2026-05-03] sync | snapshot 0xde0e… pushed to 0G
```

The consistent prefix means simple unix tools (`grep`, `tail`) parse the log without needing structured storage. It's also what the brain handler writes when it processes a `sync_vault`.

## Why both

`index.md` answers *"what's currently in the wiki?"*. `log.md` answers *"what happened?"*. Different questions, different shapes. Together they're cheap enough to read at the start of every session and rich enough to carry the wiki's working memory across sessions.

They also feed Brainpedia's on-chain structure: every `sync_vault` that produces a new snapshot becomes a row in the iNFT's `IntelligentData[]` array, mirroring the chronological structure of `log.md` on chain.
