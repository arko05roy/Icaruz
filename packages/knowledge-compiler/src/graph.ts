import type { ArticleGraph, CompiledArticle } from './types.js';

/** Build the full adjacency + backlinks structure from compiled articles. */
export function buildGraph(articles: CompiledArticle[]): ArticleGraph {
  const adjacency: Record<string, string[]> = {};
  const backlinks: Record<string, string[]> = {};
  for (const a of articles) {
    adjacency[a.slug] = a.links;
    for (const target of a.links) {
      (backlinks[target] ??= []).push(a.slug);
    }
  }
  return { articles, adjacency, backlinks };
}
