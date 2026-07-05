---
title: Tips and Tricks
tags: [obsidian, infrastructure]
created: 2026-04-02
sources: [llm-wiki-gist]
---

# Tips and Tricks

Practical Obsidian-side notes for keeping the compile loop pleasant. Most are from Karpathy's gist; the Brainpedia framing is mine.

## Web Clipper for fast source intake

The official Obsidian Web Clipper extension converts arbitrary web pages into markdown notes inside your vault. It's the fastest way to grow [[raw-sources]] without copy-paste. New clippings flow into the next [[ingest]] cycle automatically — Brainpedia's parser just sees them as new `.md` files.

## Local image attachments

If you let Obsidian download attachments locally (Settings → Files and links → Attachment folder path), the LLM can reference images by path during [[ingest]] instead of relying on URLs that may rot. Brainpedia's snapshot manifest captures these path references too, so they're stable on chain.

## Graph view for orphan-spotting

Obsidian's built-in graph view is the easiest way to see which wiki pages have become hubs and which are orphans. Pair it with [[lint]]: orphan pages get flagged for merging or linking; hub pages probably warrant their own overview.

## Marp for slide output

Marp's markdown-to-slide-deck plugin works directly against wiki pages. Useful when a [[query]] should produce a presentation rather than a written answer.

## Dataview for live lists

Dataview queries page frontmatter (which Brainpedia's schema requires every wiki page to have) and produces live tables / lists. Handy for navigation pages and overview synthesis.

## Git is free

Your vault is a directory of plain text. Initialise git inside it and you get version history, branches, and collaboration without any extra tooling. Brainpedia's on-chain snapshot history (every `appendStorageRoot` call on the iNFT) is a rougher, immutable cousin of the same idea.
