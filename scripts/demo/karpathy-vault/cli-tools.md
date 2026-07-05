---
title: CLI Tools
tags: [optional, infrastructure]
created: 2026-04-02
sources: [llm-wiki-gist]
---

# CLI Tools

Optional infrastructure for when [[the-wiki]] grows beyond what [[index-and-log|index.md]] can usefully cover.

## When to add search

The bare-minimum setup uses the index file as the LLM's navigation aid. That's enough at the scale most personal vaults run at. Once a Brain grows into the low thousands of wiki pages, the LLM spends too much context on the index and proper search becomes worth it.

## Karpathy's recommendation: qmd

[qmd](https://github.com/tobi/qmd) is a local markdown search engine with hybrid BM25 + vector retrieval and LLM re-ranking. It runs entirely on-device, ships both a CLI (so the LLM can shell out to it) and an MCP server (so the LLM can call it as a tool). For a Brain owner running their compile loop locally, this is the natural next step beyond index-only.

## Brainpedia-side equivalents

Brainpedia's brain handler does its own retrieval over the published wiki at query time (lexical overlap today, embeddings on the roadmap). Brain owners don't need to deploy search infrastructure themselves — the on-chain Brain ships with retrieval baked in.

The case for adding qmd to your local compile loop is different: it's about *authoring* speed, not query-time speed. When you're working on the wiki, qmd helps the LLM find related pages quickly to update during [[ingest]] or [[lint]]. That accelerates the bookkeeping that makes the wiki useful.

## Don't over-engineer this layer

Both Karpathy's gist and Brainpedia's design assume you start without search and add it only when the index breaks down. Spinning up a vector database before you have 500 wiki pages is wasted effort.
