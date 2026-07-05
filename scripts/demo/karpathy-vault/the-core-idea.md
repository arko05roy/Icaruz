---
title: The Core Idea
tags: [concept, llm-wiki]
created: 2026-04-02
sources: [llm-wiki-gist]
---

# The Core Idea

Brainpedia compiles Brains using a workflow Andrej Karpathy described in his [LLM-Wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). His framing of the difference between RAG and a maintained wiki is the load-bearing insight, and it's the reason Brainpedia treats compiled wikis (not raw vault dumps) as the asset you mint.

## What changes when you maintain a wiki

In a typical RAG setup, the LLM looks at raw documents fresh on every query. Anything that required cross-source synthesis has to be re-derived from chunks each time. Compare that with a wiki where the synthesis already exists on disk: the cross-references are present, contradictions have been flagged, and each query reads from a structure that previous ingests already shaped (see [[rag-vs-wiki]]).

The work doesn't disappear; it shifts to [[ingest]] time. A new source might touch a dozen wiki pages. The LLM does that bookkeeping once and then [[query|queries]] become cheap reads against an already-coherent body of work.

## How Brainpedia uses this

The user owns and edits a vault of [[raw-sources]]. The host LLM (Claude in Claude Code or Claude Desktop) compiles those notes into [[the-wiki]] following [[the-schema]]. Brainpedia takes the resulting wiki, snapshots it onto 0G Storage, and binds the merkle root to an iNFT. The iNFT is the Brain.

Other agents query the iNFT, not the raw vault. The wiki is what they pay to read.

## The collaboration loop

Karpathy's recommendation is to keep the LLM agent and Obsidian open side by side, ingest one source at a time, and inspect the diff after each ingest. Brainpedia preserves that loop: the MCP server's [[ingest|setup_brain]] returns a parsed view of your vault plus the compile schema, you and Claude work through the compilation together, and `upload_articles` pushes the finished wiki to chain.

The same loop runs again whenever you call `sync_vault` after editing notes (the wiki updates, a new merkle root is appended to the iNFT's `IntelligentData[]`).
