---
title: Architecture
tags: [llm-wiki, architecture, moc]
---

# Architecture

There are three layers.

## [[raw-sources]]

Your curated collection of source documents. Articles, papers, images, data files. These are immutable: the LLM reads from them but never modifies them. This is your source of truth.

## [[the-wiki]]

A directory of LLM-generated markdown files. Summaries, entity pages, concept pages, comparisons, an overview, a synthesis. The LLM owns this layer entirely. It creates pages, updates them when new sources arrive, maintains cross-references, and keeps everything consistent. You read it; the LLM writes it.

## [[the-schema]]

A document (e.g. `CLAUDE.md` for Claude Code, `AGENTS.md` for Codex) that tells the LLM how the wiki is structured, what the conventions are, and what workflows to follow when ingesting sources, answering questions, or maintaining the wiki. This is the key configuration file. It's what makes the LLM a disciplined wiki maintainer rather than a generic chatbot. You and the LLM co-evolve this over time as you figure out what works for your domain.

## How the layers compose

The schema points the LLM at both the raw sources and the wiki. The wiki cites back into the raw sources. The raw sources never change once filed. New sources flow through the schema's [[ingest]] workflow into the wiki, with the LLM doing all the cross-reference bookkeeping (see [[why-this-works]]).
