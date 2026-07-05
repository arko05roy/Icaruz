/**
 * Read an Obsidian vault over the Local REST API plugin instead of the
 * filesystem. Plugin docs: https://github.com/coddingtonbear/obsidian-local-rest-api
 *
 * The plugin exposes the active vault on http://localhost:27123 (HTTP) or
 * https://localhost:27124 (HTTPS, self-signed). Endpoints we use:
 *
 *   GET /vault/             → list of files in the vault root
 *   GET /vault/<dir>/       → list of files in a sub-directory
 *   GET /vault/<file.md>    → raw markdown body
 *
 * Auth: every request needs `Authorization: Bearer <api-key>`. The user
 * grabs the key from the plugin's settings tab in Obsidian.
 *
 * Why this matters: drops the "give me an absolute filesystem path"
 * requirement. The MCP server just needs the API key in env; the user's
 * Obsidian instance is the source of truth — exactly the path the spec
 * envisaged ("Reads the vault directory" without specifying the
 * mechanism). Onboarding becomes "install the plugin, paste the key,
 * say 'set up my Brain'".
 */
import { parseNote } from './parser.js';
import type { ObsidianNote } from './types.js';

export interface RestVaultClientOptions {
  /** Base URL of the Local REST API plugin. Default http://localhost:27123. */
  baseUrl?: string;
  /** Bearer token from the plugin's settings tab. */
  apiKey: string;
  /**
   * Optional path inside the Obsidian vault to scope reads to. Use to carve
   * a per-user namespace out of a shared hosted vault, e.g. `users/yudhi`
   * means only files under that folder are walked + parsed, and slugs are
   * computed relative to the rootPath (so a note at
   * `users/yudhi/curve.md` becomes slug `curve`, not `users/yudhi/curve`).
   * Empty / undefined = read the whole vault.
   */
  rootPath?: string;
  /** AbortSignal for cancelling listings/reads. Optional. */
  signal?: AbortSignal;
}

export async function readVaultFromRest(opts: RestVaultClientOptions): Promise<ObsidianNote[]> {
  const baseUrl = (opts.baseUrl ?? 'http://localhost:27123').replace(/\/+$/, '');
  const root = (opts.rootPath ?? '').replace(/^\/+|\/+$/g, '');
  const headers = {
    Authorization: `Bearer ${opts.apiKey}`,
    Accept: 'application/json',
  };

  const filePaths = await listAllFiles(root, baseUrl, headers, opts.signal);
  const notes: ObsidianNote[] = [];
  for (const absPath of filePaths) {
    if (!absPath.toLowerCase().endsWith('.md')) continue;
    const raw = await readFile(absPath, baseUrl, opts.apiKey, opts.signal);
    // Re-base the path relative to rootPath so wikilinks + slugs don't
    // include the per-user prefix. A vault carved into users/yudhi/ should
    // produce the same slugs as a standalone vault would.
    const relPath = root && absPath.startsWith(`${root}/`) ? absPath.slice(root.length + 1) : absPath;
    notes.push(parseNote(relPath, raw));
  }
  return notes;
}

interface VaultListing {
  files: string[];
}

async function listAllFiles(
  dir: string,
  baseUrl: string,
  headers: Record<string, string>,
  signal: AbortSignal | undefined,
): Promise<string[]> {
  // The plugin returns relative names per directory. Folders end in '/'.
  const url = `${baseUrl}/vault/${encodeURI(dir)}`;
  const res = await fetch(url, { headers, signal });
  if (!res.ok) {
    throw new Error(`obsidian-rest: list ${dir || '/'} returned ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as VaultListing;
  const out: string[] = [];
  for (const entry of body.files ?? []) {
    const child = dir ? `${dir.replace(/\/$/, '')}/${entry}` : entry;
    if (entry.endsWith('/')) {
      out.push(...(await listAllFiles(child, baseUrl, headers, signal)));
    } else {
      out.push(child);
    }
  }
  return out;
}

async function readFile(
  relPath: string,
  baseUrl: string,
  apiKey: string,
  signal: AbortSignal | undefined,
): Promise<string> {
  const url = `${baseUrl}/vault/${encodeURI(relPath)}`;
  // The plugin returns markdown as text/markdown — set Accept explicitly so
  // a future plugin update doesn't switch to JSON-wrapped responses on us.
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'text/markdown',
    },
    signal,
  });
  if (!res.ok) {
    throw new Error(`obsidian-rest: read ${relPath} returned ${res.status} ${res.statusText}`);
  }
  return await res.text();
}
