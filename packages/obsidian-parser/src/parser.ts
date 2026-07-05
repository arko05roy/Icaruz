import matter from 'gray-matter';
import type { ObsidianNote } from './types.js';

const WIKILINK_RE = /\[\[([^\]\|]+)(?:\|[^\]]+)?\]\]/g;
const INLINE_TAG_RE = /(?:^|\s)#([\p{L}0-9_\-/]+)/gu;

export function slugify(pathOrName: string): string {
  return pathOrName
    .replace(/\.md$/i, '')
    .replace(/^\/+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_/\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parseNote(relPath: string, raw: string): ObsidianNote {
  const { data, content } = matter(raw);
  const slug = slugify(relPath);
  const title = (typeof data.title === 'string' && data.title.trim()) || basename(relPath);

  const links = new Set<string>();
  for (const match of content.matchAll(WIKILINK_RE)) {
    const target = match[1];
    if (target) links.add(slugify(target));
  }

  const tags = new Set<string>();
  if (Array.isArray(data.tags)) {
    for (const t of data.tags) if (typeof t === 'string') tags.add(t.replace(/^#/, ''));
  } else if (typeof data.tags === 'string') {
    tags.add(data.tags.replace(/^#/, ''));
  }
  for (const match of content.matchAll(INLINE_TAG_RE)) {
    const tag = match[1];
    if (tag) tags.add(tag);
  }

  return {
    path: relPath,
    slug,
    title,
    frontmatter: data,
    body: content,
    links: [...links],
    tags: [...tags],
  };
}

function basename(p: string): string {
  const last = p.split('/').pop() ?? p;
  return last.replace(/\.md$/i, '');
}
