import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseNote } from './parser.js';
import type { ObsidianNote, VaultGraph } from './types.js';

const SKIP_DIRS = new Set(['.git', '.obsidian', '.trash', 'node_modules']);

export async function readVault(vaultRoot: string): Promise<ObsidianNote[]> {
  const files = await walk(vaultRoot);
  const notes: ObsidianNote[] = [];
  for (const abs of files) {
    if (!abs.toLowerCase().endsWith('.md')) continue;
    const rel = relative(vaultRoot, abs);
    const raw = await readFile(abs, 'utf8');
    notes.push(parseNote(rel, raw));
  }
  return notes;
}

export function buildGraph(notes: ObsidianNote[]): VaultGraph {
  const adjacency: Record<string, string[]> = {};
  const backlinks: Record<string, string[]> = {};
  for (const note of notes) {
    adjacency[note.slug] = note.links;
    for (const link of note.links) {
      (backlinks[link] ??= []).push(note.slug);
    }
  }
  return { notes, adjacency, backlinks };
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const out: string[] = [];
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = join(dir, name);
    const st = await stat(abs);
    if (st.isDirectory()) {
      out.push(...(await walk(abs)));
    } else {
      out.push(abs);
    }
  }
  return out;
}
