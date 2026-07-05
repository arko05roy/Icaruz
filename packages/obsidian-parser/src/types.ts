export interface ObsidianNote {
  /** Path relative to the vault root, e.g. "topics/defi/uniswap.md" */
  path: string;
  /** Slug derived from the path (no extension). */
  slug: string;
  /** Note title — frontmatter `title` if present, else filename. */
  title: string;
  /** Parsed frontmatter (YAML). */
  frontmatter: Record<string, unknown>;
  /** Markdown body without the frontmatter block. */
  body: string;
  /** Wikilinks `[[Target]]` extracted from the body, normalised to slugs. */
  links: string[];
  /** Tags from frontmatter and inline `#tag`. */
  tags: string[];
}

export interface VaultGraph {
  notes: ObsidianNote[];
  /** Adjacency list — slug → outgoing link slugs. */
  adjacency: Record<string, string[]>;
  /** Reverse adjacency — slug → incoming link slugs. */
  backlinks: Record<string, string[]>;
}
