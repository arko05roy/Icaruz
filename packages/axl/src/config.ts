/**
 * AXL config — points at a locally-running `axl` daemon. Each Brain is a
 * separate process with its own daemon, its own Ed25519 key, and its own
 * port (`AXL_API_URL` per process).
 *
 * The Gensyn bounty requires "communication across separate AXL nodes,
 * not just in-process" — so we never multiplex Brains over a single
 * daemon.
 */
export interface AxlConfig {
  /** HTTP API of the local AXL daemon, e.g. http://127.0.0.1:9002 */
  apiUrl: string;
  /** Comma-separated list of bootstrap peer addresses (TLS-prefixed). */
  bootstrapPeers: string[];
}

export function loadAxlConfig(env: NodeJS.ProcessEnv = process.env): AxlConfig {
  const apiUrl = env.AXL_API_URL ?? 'http://127.0.0.1:9002';
  const bootstrapPeers = (env.AXL_BOOTSTRAP_PEERS ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return { apiUrl, bootstrapPeers };
}
