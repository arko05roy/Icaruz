---
title: Raw Sources
tags: [concept, layer]
created: 2026-04-02
sources: [llm-wiki-gist]
---

# Raw Sources

Layer 1 of the [[architecture|three-layer architecture]]. In Brainpedia's instantiation of Karpathy's pattern, this is your Obsidian vault.

## Properties Brainpedia relies on

- **The user owns it.** Brainpedia never writes back to your vault. You edit notes in Obsidian; Brainpedia reads them.
- **Stable for the duration of a compile.** The MCP server snapshots the vault state when [[ingest|setup_brain]] runs. New edits arrive on the next `sync_vault` call.
- **Heterogeneous content welcome.** The [`obsidian-parser` package](../../../packages/obsidian-parser/src) accepts any `.md` file with optional YAML frontmatter and `[[wikilink]]` syntax — vaults, plain notes folders, web-clipped articles, anything markdown.

## Two ways Brainpedia reads it

The MCP server's `setup_brain` and `sync_vault` tools both accept either:

- A filesystem path (`vaultPath` arg or `BRAINPEDIA_DEFAULT_VAULT_PATH` env), good when the MCP server runs on the same machine that holds the vault.
- A URL to the [Obsidian Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api) plus its API key (`OBSIDIAN_REST_API_URL` + `OBSIDIAN_REST_API_KEY`). The user installs the plugin once, pastes the key in their MCP config, and Brainpedia reads from whatever vault their Obsidian instance currently has open. No filesystem path required.

The REST mode is the cleaner demo because it removes the "where's your vault" question entirely.

## What the LLM does next

[[the-wiki|Layer 2]] is built from these raw notes by the host LLM following the rules in [[the-schema]]. The raw layer never gets uploaded on chain — only the compiled wiki does. Citations in the wiki point back into the raw layer via [[index-and-log|source-summary pages]] so anyone reading the Brain can trace a claim to its origin.
