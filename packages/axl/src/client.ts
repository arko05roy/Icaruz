import type { AxlConfig } from './config.js';

/** AXL peer id is a 32-byte Ed25519 public key, hex-encoded. */
export type PeerId = string;

export interface McpRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown;
}

export interface McpResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export interface TopologyEntry {
  peerId: PeerId;
  addresses: string[];
  services: string[];
}

/**
 * Thin client over the AXL daemon HTTP API. Maps to:
 *   GET  /topology             → known peers
 *   POST /mcp/{peer}/{service} → JSON-RPC MCP call
 *   POST /a2a/{peer}           → JSON-RPC agent-to-agent
 */
export class AxlClient {
  constructor(private cfg: AxlConfig) {}

  async topology(): Promise<TopologyEntry[]> {
    const res = await fetch(`${this.cfg.apiUrl}/topology`);
    if (!res.ok) throw new Error(`AXL /topology failed: ${res.status}`);
    return (await res.json()) as TopologyEntry[];
  }

  async mcp<T>(peer: PeerId, service: string, request: McpRequest): Promise<McpResponse<T>> {
    const res = await fetch(`${this.cfg.apiUrl}/mcp/${peer}/${service}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      throw new Error(`AXL /mcp/${peer}/${service} failed: ${res.status}`);
    }
    return (await res.json()) as McpResponse<T>;
  }

  async a2a<T>(peer: PeerId, request: McpRequest): Promise<McpResponse<T>> {
    const res = await fetch(`${this.cfg.apiUrl}/a2a/${peer}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error(`AXL /a2a/${peer} failed: ${res.status}`);
    return (await res.json()) as McpResponse<T>;
  }
}
