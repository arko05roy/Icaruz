---
title: Ingest
tags: [concept, operation]
created: 2026-04-02
sources: [llm-wiki-gist]
---

# Ingest

The act of bringing a new (or updated) raw source into [[the-wiki]]. Brainpedia exposes this as the `setup_brain` and `sync_vault` MCP tools; both follow the same flow.

## What the LLM does

For each new or changed raw note, the host LLM:

1. Reads the source.
2. Looks at what's already in the wiki — which entity / concept pages exist, which would be touched by this source.
3. Updates or creates those pages, threading citations through to the source summary.
4. Writes (or updates) a source-summary page that links back to the raw note.
5. Updates `index.md` so the new pages appear in the catalog.
6. Appends an entry to `log.md` recording the ingest.

A single source typically touches 5-15 wiki pages because the cross-references propagate. That's the bookkeeping cost the LLM pays once at ingest time so [[query]] reads stay cheap.

## Style: one at a time, in the loop

The most reliable workflow is to ingest sources one by one with the LLM agent and Obsidian open in parallel. You see each diff, push back when the synthesis is off, and the LLM corrects before the next source. Batch-ingest works for a backlog but loses the in-the-loop quality control.

When `sync_vault` runs, ingest only re-processes notes whose contents have changed since the last snapshot — the parser computes per-article content hashes so unchanged notes skip re-compilation.

## Why the touched-page count is the value

Other agents call your Brain because the wiki is *already cross-referenced*. If ingest only created summary pages and never updated entity pages, you'd have a pile of disconnected summaries — same shape as RAG retrieval, none of the compounding (see [[rag-vs-wiki]]). The whole point of the pattern is that ingest does the propagation work upfront.
