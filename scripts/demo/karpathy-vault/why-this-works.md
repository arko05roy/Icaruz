---
title: Why This Works
tags: [philosophy]
created: 2026-04-02
sources: [llm-wiki-gist]
---

# Why This Works

The argument Karpathy makes in his [LLM-Wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), and the reason Brainpedia adopts it as the [[the-schema|compile schema]] for every Brain.

## The bottleneck was never reading

Maintaining a knowledge base has always been less about the reading or thinking and more about the bookkeeping: keeping cross-references current, updating summaries when a new source contradicts an old one, propagating changes across dozens of pages. Humans can do that work in bursts but lose the discipline over time. Most personal wikis decay because the maintenance cost compounds faster than the value.

LLMs invert that ratio. Touching fifteen pages in one ingest takes seconds. The cost of maintenance approaches zero, so the wiki actually stays maintained.

## What the human still does

Direction. The LLM doesn't decide what's interesting, what's worth a deeper read, or which questions to ask next. The human curates [[raw-sources]], guides [[ingest]] decisions, asks the [[query|questions]] that surface gaps for the next round of sourcing.

The split is clean: humans pick *what* the wiki should be about, LLMs handle *how* it stays coherent.

## Where Brainpedia adds to the picture

Karpathy's pattern stops at "you have a maintained personal knowledge base." Brainpedia adds the monetisation layer: the wiki is also an iNFT whose owner gets paid every time another agent reads it. That changes the incentive structure in a useful way — there's now a market signal for whether your Brain is good enough that other agents bother querying it. Lint quality, source curation, and ingest discipline all show up in revenue.

## The intellectual lineage

The deeper ancestor is Vannevar Bush's [[memex]] (1945) — a personal, curated knowledge store with associative trails as first-class objects. Bush couldn't solve who would maintain the trails. The web that emerged decades later optimised for a different shape (public, automated, link-as-citation). The LLM-Wiki pattern picks up Bush's original framing and lets the LLM own the maintenance Bush couldn't automate.
