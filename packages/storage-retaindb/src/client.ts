import { RetainDBContext } from '@retaindb/sdk';
import {
  isRetainDbCloud,
  isRetainDbConfigured,
  loadRetainDbConfig,
  type RetainDbConfig,
} from './config.js';

export interface ArticleMemoryInput {
  slug: string;
  title: string;
  body: string;
  links: string[];
  sources: string[];
  updatedAt: string;
}

export interface ArticleMemoryHit {
  slug: string;
  title: string;
  body: string;
  links: string[];
  sources: string[];
  updatedAt: string;
  score?: number;
}

interface SearchResultRow {
  memory?: { content?: string; metadata?: Record<string, unknown> };
  chunk?: { content?: string; metadata?: Record<string, unknown> };
  similarity?: number;
}

let context: RetainDBContext | null = null;
let healthOk: boolean | null = null;
let healthCheckedAt = 0;
const HEALTH_TTL_MS = 30_000;

function getContext(cfg: RetainDbConfig): RetainDBContext {
  if (!context) {
    const apiKey = cfg.apiKey ?? (isRetainDbCloud(cfg) ? undefined : 'local');
    if (!apiKey) {
      throw new Error('RETAINDB_API_KEY is required for RetainDB Cloud');
    }
    context = new RetainDBContext({
      baseUrl: cfg.baseUrl,
      project: cfg.project,
      apiKey,
    });
  }
  return context;
}

export async function isRetainDbReachable(): Promise<boolean> {
  if (!isRetainDbConfigured()) return false;
  const now = Date.now();
  if (healthOk !== null && now - healthCheckedAt < HEALTH_TTL_MS) return healthOk;

  const cfg = loadRetainDbConfig();
  try {
    if (isRetainDbCloud(cfg)) {
      if (!cfg.apiKey) {
        healthOk = false;
      } else {
        const res = await fetch(`${cfg.baseUrl}/v1/context`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ project: cfg.project, query: 'ping' }),
          signal: AbortSignal.timeout(8_000),
        });
        // API up if we get anything except 5xx / network failure.
        healthOk = res.status > 0 && res.status < 500;
      }
    } else {
      const res = await fetch(`${cfg.baseUrl}/retaindb/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      healthOk = res.ok;
    }
  } catch {
    healthOk = false;
  }
  healthCheckedAt = now;
  return healthOk;
}

function metaFromRow(row: SearchResultRow): Record<string, unknown> {
  return row.chunk?.metadata ?? row.memory?.metadata ?? {};
}

function articleFromRow(row: SearchResultRow): ArticleMemoryHit | null {
  const meta = metaFromRow(row);
  const slug = typeof meta.slug === 'string' ? meta.slug : '';
  const title = typeof meta.title === 'string' ? meta.title : '';
  const body =
    typeof meta.body === 'string'
      ? meta.body
      : row.chunk?.content ?? row.memory?.content ?? '';
  if (!slug || !body) return null;
  return {
    slug,
    title: title || slug,
    body,
    links: Array.isArray(meta.links) ? (meta.links as string[]) : [],
    sources: Array.isArray(meta.sources) ? (meta.sources as string[]) : [],
    updatedAt: typeof meta.updatedAt === 'string' ? meta.updatedAt : new Date().toISOString(),
    score: row.similarity,
  };
}

export async function storeBrainArticles(
  brainId: string,
  articles: ArticleMemoryInput[],
): Promise<void> {
  if (!isRetainDbConfigured() || articles.length === 0) return;
  if (!(await isRetainDbReachable())) return;

  const cfg = loadRetainDbConfig();
  const db = getContext(cfg);
  await db.addMemoriesBulk({
    project: cfg.project,
    memories: articles.map((article) => ({
      memory_type: 'semantic',
      content: `# ${article.title}\n\n${article.body}`,
      metadata: {
        kind: 'brain_article',
        brainId,
        slug: article.slug,
        title: article.title,
        body: article.body,
        links: article.links,
        sources: article.sources,
        updatedAt: article.updatedAt,
      },
    })),
    write_mode: 'async',
  });
}

export async function storeBrainCatalogRecord(record: Record<string, unknown>): Promise<void> {
  if (!isRetainDbConfigured()) return;
  if (!(await isRetainDbReachable())) return;

  const cfg = loadRetainDbConfig();
  const db = getContext(cfg);
  const brainId = typeof record.id === 'string' ? record.id : 'unknown';
  await db.addMemory({
    project: cfg.project,
    memory_type: 'project_state',
    content: JSON.stringify(record),
    metadata: { kind: 'brain_catalog', brainId },
    write_mode: 'async',
  });
}

export async function searchBrainArticles(
  brainId: string,
  query: string,
  topK: number,
): Promise<ArticleMemoryHit[]> {
  if (!isRetainDbConfigured() || !query.trim()) return [];
  if (!(await isRetainDbReachable())) return [];

  const cfg = loadRetainDbConfig();
  const db = getContext(cfg);
  const result = await db.searchMemories({
    project: cfg.project,
    query,
    top_k: Math.max(topK * 4, topK),
    profile: 'balanced',
  });

  const seen = new Set<string>();
  const out: ArticleMemoryHit[] = [];
  for (const row of result.results as SearchResultRow[]) {
    const meta = metaFromRow(row);
    if (meta.kind !== 'brain_article' || meta.brainId !== brainId) continue;
    const article = articleFromRow(row);
    if (!article || seen.has(article.slug)) continue;
    seen.add(article.slug);
    out.push(article);
    if (out.length >= topK) break;
  }
  return out;
}

export async function storeMixtureSession(sessionId: string, payload: unknown): Promise<void> {
  if (!isRetainDbConfigured()) return;
  if (!(await isRetainDbReachable())) return;

  const cfg = loadRetainDbConfig();
  const db = getContext(cfg);
  await db.addMemory({
    project: cfg.project,
    memory_type: 'event',
    session_id: sessionId,
    content: JSON.stringify(payload),
    metadata: { kind: 'mixture_session', sessionId },
    write_mode: 'async',
  });
}

export async function loadMixtureSession<T>(sessionId: string): Promise<T | null> {
  if (!isRetainDbConfigured()) return null;
  if (!(await isRetainDbReachable())) return null;

  const cfg = loadRetainDbConfig();
  const db = getContext(cfg);
  const result = await db.searchMemories({
    project: cfg.project,
    query: sessionId,
    session_id: sessionId,
    top_k: 4,
    profile: 'fast',
  });

  const rows = result.results as SearchResultRow[];
  const hit =
    rows.find((row) => metaFromRow(row).sessionId === sessionId) ??
    rows.find((row) => metaFromRow(row).kind === 'mixture_session') ??
    rows[0];
  const content = hit?.memory?.content ?? hit?.chunk?.content;
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function rememberQueryTurn(input: {
  brainId: string;
  sessionId?: string;
  prompt: string;
  answer: string;
}): Promise<void> {
  if (!isRetainDbConfigured()) return;
  if (!(await isRetainDbReachable())) return;

  const cfg = loadRetainDbConfig();
  const db = getContext(cfg);
  const now = new Date().toISOString();
  await db.ingestSession({
    project: cfg.project,
    session_id: input.sessionId ?? `brain:${input.brainId}:${Date.now()}`,
    agent_id: input.brainId,
    messages: [
      { role: 'user', content: input.prompt, timestamp: now },
      { role: 'assistant', content: input.answer, timestamp: now },
    ],
    write_mode: 'async',
  });
}

// ponytail: self-check — run with RetainDB up: `node dist/client.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  const ok = await isRetainDbReachable();
  console.log('retaindb reachable:', ok);
  if (ok) {
    await storeBrainArticles('self-check', [
      {
        slug: 'ponytail-check',
        title: 'Ponytail check',
        body: 'RetainDB article storage works.',
        links: [],
        sources: [],
        updatedAt: new Date().toISOString(),
      },
    ]);
    const hits = await searchBrainArticles('self-check', 'ponytail', 1);
    console.assert(hits[0]?.slug === 'ponytail-check', 'search miss');
    console.log('self-check ok');
  }
}
