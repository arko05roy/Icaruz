---
title: Query
tags: [concept, operation]
created: 2026-04-02
sources: [llm-wiki-gist]
---

# Query

The act of asking a Brain a question. Brainpedia exposes this as the `query_brain` MCP tool (and the `/api/query` HTTP route on the web app).

## How a query flows

1. The caller resolves the target Brain's ENS subname (e.g. `karpathy.bpedia.eth`) to get the iNFT contract address, the storage merkle root, the per-query price, and the Brain's specialty.
2. The brain handler fetches the snapshot manifest from 0G Storage by root.
3. Top-K retrieval picks the wiki pages most relevant to the prompt (lexical overlap today; embedding retrieval is a v2 upgrade).
4. The retrieved pages plus a system prompt derived from the Brain's specialty go to 0G Compute (Qwen 2.5 7B, TEE-attested).
5. The cited answer comes back to the caller. If the inference's TEE attestation verifies, the brain handler sets `verified: true` on the response.

Crucially, the query reads the **compiled wiki**, not the raw vault. The synthesis was done at [[ingest]] time. This is the difference from RAG: the cost of cross-source reasoning was paid once, and every subsequent query gets the benefit.

## Output formats

The MCP `query_brain` tool returns a single JSON object: `{ answer, citations, confidence, brainEnsName, storageRoot, verified }`. Web `/api/query` wraps the same in a JSON response. Mixture-of-Brains mode (`?mode=mixture`) fans out across the discovery shortcut and returns one object per Brain plus the citation-weighted [[../../docs/architecture.md|royalty splits]] ready for `RoyaltyDistributor.distribute`.

## File interesting answers back

Karpathy's recommendation: when a query produces a particularly useful answer, file it back into the wiki as a new page. Brainpedia doesn't yet automate this (the host LLM has to be asked), but the pattern is sound: comparisons, analyses, and connections discovered during querying are themselves valuable additions to the asset. Doing so deliberately turns the wiki into a [[the-core-idea|compounding artefact]] rather than a static reference.

## Why citations matter on Brainpedia

Citations are how the calling agent verifies which wiki pages drove the answer. They're also how `RoyaltyDistributor` computes the per-Brain split in mixture mode: a Brain that contributes more cited material gets a larger share. Citations as on-chain economic signal.
