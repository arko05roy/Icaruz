export interface BtlConfig {
  apiKey: string;
  baseUrl: string;
  /** Cheap model for routing / classification. */
  routerModel: string;
  /** Default model for brain Q&A + synthesis. */
  queryModel: string;
}

const DEFAULT_BASE = 'https://api.badtheorylabs.com/v1';

export function loadBtlConfig(env: NodeJS.ProcessEnv = process.env): BtlConfig {
  const apiKey =
    env.GATEWAY_API_KEY?.trim() ||
    env.BTL_RUNTIME_API_KEY?.trim() ||
    '';
  if (!apiKey) {
    throw new Error('GATEWAY_API_KEY (or BTL_RUNTIME_API_KEY) is required for BTL Runtime');
  }
  return {
    apiKey,
    baseUrl: (env.BTL_RUNTIME_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, ''),
    routerModel: env.BTL_ROUTER_MODEL ?? 'btl-2',
    queryModel: env.BTL_QUERY_MODEL ?? 'btl-2',
  };
}

export function isBtlConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.GATEWAY_API_KEY?.trim() || env.BTL_RUNTIME_API_KEY?.trim());
}
