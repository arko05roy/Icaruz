---
title: RAG vs Wiki
tags: [llm-wiki, comparison]
---

# RAG vs Wiki

Most people's experience with LLMs and documents is RAG (retrieval-augmented generation). The [[the-core-idea|LLM-Wiki pattern]] is different along three axes.

## Where the synthesis lives

| | RAG | LLM Wiki |
|---|---|---|
| Synthesis happens at | Query time | Ingest time |
| Output of synthesis | Discarded after answer | Filed in [[the-wiki]] |
| Cross-references | Re-derived per query | Maintained as a graph |

## Cost over time

RAG cost per query is roughly constant — every question pays for retrieval + synthesis from scratch. The Wiki front-loads cost into [[ingest]]; subsequent [[query|queries]] are cheap because the synthesis is already on disk.

The crossover happens fast. By the time you've asked the same source set ten different questions, the Wiki has paid for itself in compute and quality.

## Failure modes

**RAG fails silently** when retrieval misses a relevant chunk. The LLM answers from whatever it found, the user has no way to know what was missed.

**The Wiki fails loudly** during [[lint]]. Stale claims, orphan pages, contradictions all surface as actionable items. The maintenance discipline replaces silent failure with explicit follow-ups.

## When RAG is still right

- Your sources are too large or change too fast for [[ingest]] to keep up (think: live news feeds, terabytes of logs).
- You're answering one-off questions, not building a long-lived knowledge base.
- The accumulated synthesis has no value to you.

For everything else, the Wiki wins long-term.
