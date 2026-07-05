---
title: The Schema
tags: [concept, layer, configuration]
created: 2026-04-02
sources: [llm-wiki-gist]
---

# The Schema

Layer 3 of the [[architecture]]. The conventions document that constrains how the host LLM compiles a vault into [[the-wiki]].

## Brainpedia's schema

Brainpedia ships a fixed schema as part of `brainpedia-mcp` (see [`docs/brain-compile-schema.md`](../../../docs/brain-compile-schema.md)). The MCP server returns it from every `setup_brain` call so Claude can't ignore it. The schema specifies:

- The page types the LLM must produce (entity / concept / source / comparison / overview / infrastructure).
- The conventions every page follows: YAML frontmatter, kebab-case slugs, `[[wikilink]]` style, citation indirection through source-summary pages.
- The operations: `ingest` is what `setup_brain` triggers, `query` is what the brain handler does at request time, `lint` is what `sync_vault` runs.
- How specialty awareness flows from the brain.specialty ENS text record into the system prompt.

This is non-negotiable across the network. Every Brain on Brainpedia ends up with the same shape because every compile uses the same schema.

## Why the schema lives in the MCP server, not in the vault

Karpathy's gist describes the schema as a per-vault file (`CLAUDE.md` or `AGENTS.md`) that you and the LLM co-evolve. Brainpedia centralises it instead, for one specific reason: composability. Mixture-of-Brains queries fan out across many Brains in parallel; the orchestrator can only synthesise their answers if every Brain follows the same conventions. A free-form per-vault schema would make the network non-composable.

The trade-off: you can't tweak the page types or the citation rules per Brain. The trade-off is worth it because Brains derive value from being uniformly queryable.

## Co-evolution still happens, just at the protocol level

The schema isn't fixed forever. Updates to `docs/brain-compile-schema.md` ship as new versions of `brainpedia-mcp`. Brain owners pick up the changes the next time they run `npx -y brainpedia-mcp` and trigger a `sync_vault`.
