---
title: Operations
tags: [overview, llm-wiki]
created: 2026-04-02
sources: [llm-wiki-gist]
---

# Operations

Three operations make up the day-to-day rhythm of a Brain. They map directly onto Brainpedia's MCP tools.

## [[ingest]]

Triggered by `setup_brain` (initial compile) and `sync_vault` (incremental update). The host LLM reads new or changed [[raw-sources]] and updates [[the-wiki]] accordingly. Cross-references and the index are maintained as part of this step.

## [[query]]

Triggered by `query_brain` when another agent calls a Brain. Reads the wiki (not the raw sources), retrieves the most relevant pages, and runs inference on 0G Compute. Returns a TEE-attested cited answer.

## [[lint]]

Run periodically by the Brain owner. The LLM scans [[the-wiki]] for contradictions, stale claims, orphan pages, missing cross-references, and gaps that suggest new sources to add. Lint output is a list of suggested edits; the owner approves or rejects.

## A typical session

You and Claude open Obsidian + Claude Code side by side. You drop a new note into the vault. You trigger `sync_vault` from Claude. Claude reads the new note, updates wiki pages it touches, asks you for clarification on anything ambiguous, and appends a `log.md` entry. The MCP server then takes the updated wiki, pushes a new snapshot to 0G Storage, and calls `Brain.appendStorageRoot` so the iNFT now points at both the old root (history) and the new root (current).

That's the full loop. Everything else (search tooling, Marp slide rendering, Dataview queries) is optional ([[cli-tools]], [[tips-and-tricks]]).
