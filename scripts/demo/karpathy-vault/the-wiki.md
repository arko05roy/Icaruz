---
title: The Wiki
tags: [concept, layer]
created: 2026-04-02
sources: [llm-wiki-gist]
---

# The Wiki

Layer 2 of the [[architecture]]. The LLM-generated body of pages compiled from your [[raw-sources]] following [[the-schema]]. This is what becomes the Brain.

## What ends up in the wiki

A few page types, all produced by the host LLM during [[ingest]]:

- **Entity pages** — one per named thing (people, organisations, models, papers, frameworks, places). Each accumulates everything the raw notes say about that entity.
- **Concept pages** — one per distinct idea or technique. The canonical explanation, with examples drawn from the raw notes.
- **Source summary pages** — one per ingested raw note. Captures the gist and links to the entity / concept pages that this source informed.
- **Comparison pages** — produced when [[query|a query]] asks for one (e.g. *"X vs Y"*) and the result is worth keeping.
- **An overview / synthesis page** — the top-down view the user reads first.

Plus two infrastructure files:

- `index.md` — a catalog of every page (see [[index-and-log]]).
- `log.md` — chronological record of compile and sync events.

## Why this shape

A pile of notes is a personal scratchpad. A wiki has navigability: each page stands on its own, links resolve, the graph is dense enough to wander. Brainpedia enforces this shape because every Brain on the network gets queried by other agents — they need predictable structure, citations they can verify, and entry points (the index) they can navigate.

## The LLM owns this layer end-to-end

You don't write the wiki by hand. The LLM creates pages, updates them on every [[ingest]], maintains cross-references, and keeps things consistent. You read the result, push back where needed, and direct the next ingest. This division of labour is the entire point of the pattern (see [[why-this-works]]).
