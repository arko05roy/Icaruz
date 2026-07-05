/**
 * Brainpedia's compile methodology, instantiating Karpathy's LLM-Wiki pattern.
 * Returned by setup_brain so the host LLM (Claude) follows the same discipline
 * across every Brain. This file is the canonical source; the schema lives inline
 * so the bundled npm package is self-contained.
 *
 * Pattern credit: Andrej Karpathy's LLM-Wiki gist
 * (https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).
 * Karpathy explicitly invites readers to "share it with your LLM agent and
 * work together to instantiate a version that fits your needs". This is
 * Brainpedia's instantiation, layered with on-chain monetisation.
 */
export const BRAIN_COMPILE_SCHEMA = `# How to compile this vault into a Brain

Brainpedia uses Andrej Karpathy's LLM-Wiki pattern as its compile
methodology. Follow it strictly so every Brain on the network has a
predictable shape that other agents can reason about.

Reference: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

## Three layers

1. Raw sources — the user's vault notes (what setup_brain just listed
   for you). Treat as immutable; the user owns this layer.
2. The wiki — the LLM-generated pages YOU write next. Cross-linked,
   structured, the artefact that gets uploaded to 0G Storage and minted
   as the iNFT.
3. The schema — this document. Tells you what page types to produce.

## Page types to produce

For every Brain, the wiki should contain:

- Entity pages — one per person, organisation, model, paper, framework,
  etc. mentioned across the raw notes. Each accumulates everything
  known about that entity from the raw collection.
- Concept pages — one per idea, pattern, or technique. Canonical
  explanation, with examples drawn from raw sources.
- Source summary pages — one per raw note, linking back to the raw
  file and to the entity / concept pages it touches.
- Comparison pages — produced when the user asks for one (e.g. "X vs Y").
- An overview / synthesis page — top-level perspective.

Plus two infrastructure files:

- index.md — catalog of every wiki page, one-line summaries, organised
  by category.
- log.md — chronological append-only record of compile / sync events,
  format: ## [YYYY-MM-DD] <op> | <subject>

## Conventions

- Frontmatter on every page: title, tags (first tag is the page type:
  entity / concept / source / comparison / overview / infrastructure),
  created, sources.
- Wikilinks as [[slug]] or [[slug|display]]. Slugs are kebab-case.
- Cite raw sources via the source-summary page, not directly.

## What you do next

1. Read the raw notes (use the slugs from this response).
2. Cluster them by entity and concept.
3. Write the wiki pages following the conventions above.
4. Call upload_articles with the compiled list — this pushes the wiki
   to 0G Storage and returns a merkle root.
5. Call finalize_brain to mint the iNFT (via BrainMinter, permissionless),
   register the ENS subname, and write all brain.* text records.

The wiki is the asset being monetised. Treat it as a product, not a
notes dump. Other agents will pay per query to read what you produce.
`;
