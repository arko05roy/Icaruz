/**
 * Each Brain exposes a single MCP tool over AXL: `query`.
 *
 * The Python implementation lives in scripts/demo/brain_service.py
 * (uses AXL's built-in Python MCP integration). This TypeScript
 * surface is the canonical type contract — what callers (the
 * orchestrator) expect to receive.
 */
export interface BrainQueryParams {
  prompt: string;
  /** Caller's ENS-issued access token, e.g. agent7af2.client.brainpedia.eth */
  accessToken?: string;
}

export interface BrainQueryResult {
  answer: string;
  citations: string[];
  confidence: number | null;
  /** Echo for routing/attribution. */
  brainEnsName: string;
  storageRoot: string | null;
}

export const BRAIN_MCP_SERVICE_NAME = 'brainpedia.brain';
