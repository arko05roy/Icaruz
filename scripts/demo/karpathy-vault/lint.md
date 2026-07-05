---
title: Lint
tags: [concept, operation, maintenance]
created: 2026-04-02
sources: [llm-wiki-gist]
---

# Lint

The maintenance pass. Periodically the Brain owner asks the LLM to look at [[the-wiki]] as a whole and surface issues that would degrade the asset over time.

## What lint catches

- Contradictions between wiki pages.
- Stale claims that newer raw sources have superseded.
- Orphan pages with no inbound links (probably should be merged or linked from somewhere).
- Concepts referenced inline but missing their own page.
- Missing cross-references between related pages.
- Gaps that suggest [[raw-sources|new sources]] worth adding.

## Output

Lint produces a list of suggested edits and a list of new questions worth investigating. The Brain owner reviews; the LLM executes the edits the owner approves; `log.md` records the lint pass. Brainpedia treats lint as a prelude to the next [[ingest]] cycle.

## Cadence

Frequency depends on how active the wiki is. Weekly is reasonable for a Brain that's getting two or three new sources a week. The bigger the wiki gets, the more value lint adds, because drift accumulates faster than any one ingest reveals it.

## Why this matters for monetisation

A Brain with stale or contradictory pages is a low-quality asset. Other agents querying it get incoherent answers; their orchestrators discount future calls; revenue dries up. Lint is the thing that keeps the iNFT's perceived quality high enough that other agents keep paying. The LLM does the maintenance the way `Brain.appendStorageRoot` records the resulting snapshot history on chain.
