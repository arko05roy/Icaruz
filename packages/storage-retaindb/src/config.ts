export interface RetainDbConfig {
  baseUrl: string;
  project: string;
  apiKey?: string;
}

const CLOUD_BASE = 'https://api.retaindb.com';
const LOCAL_BASE = 'http://localhost:3111';

export function loadRetainDbConfig(): RetainDbConfig {
  const apiKey = process.env.RETAINDB_API_KEY?.trim() || undefined;
  const baseUrl = (
    process.env.RETAINDB_BASE_URL?.trim() ||
    (apiKey ? CLOUD_BASE : LOCAL_BASE)
  ).replace(/\/$/, '');
  const project = process.env.RETAINDB_PROJECT?.trim() || 'Icaruz';
  return { baseUrl, project, apiKey };
}

/** Enabled when a base URL or API key is set. */
export function isRetainDbConfigured(): boolean {
  return Boolean(
    process.env.RETAINDB_BASE_URL?.trim() || process.env.RETAINDB_API_KEY?.trim(),
  );
}

export function isRetainDbCloud(cfg: RetainDbConfig = loadRetainDbConfig()): boolean {
  return cfg.baseUrl.includes('api.retaindb.com') || Boolean(cfg.apiKey);
}
