/**
 * In-process brain MCP — same JSON-RPC contract as apps/brain :7100/mcp.
 * POST { jsonrpc, id, method: "query", params: { prompt, target?, ... } }
 */
import { NextResponse } from 'next/server';
import {
  BTL_DEMO_ACCESS_TOKEN,
  BTL_DEMO_AGENT,
  isBrainRuntimeConfigured,
  queryBrainLocal,
} from '@/lib/brain-runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: {
    prompt?: string;
    accessToken?: string;
    agent?: string;
    target?: string;
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function POST(req: Request) {
  if (!isBrainRuntimeConfigured()) {
    return jsonRpc(503, {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32000,
        message:
          'brain runtime not configured — set ZG_WALLET_PRIVATE_KEY, BRAIN_ENS_NAME, BRAIN_STORAGE_ROOT, BRAIN_SPECIALTY',
      },
    });
  }

  let rpc: JsonRpcRequest;
  try {
    rpc = await req.json();
  } catch {
    return jsonRpc(400, {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    });
  }

  if (rpc.method !== 'query') {
    return jsonRpc(200, {
      jsonrpc: '2.0',
      id: rpc.id,
      error: { code: -32601, message: `Method not found: ${rpc.method}` },
    });
  }

  try {
    const result = await queryBrainLocal({
      prompt: rpc.params?.prompt ?? '',
      accessToken: rpc.params?.accessToken ?? BTL_DEMO_ACCESS_TOKEN,
      agent: (rpc.params?.agent ?? BTL_DEMO_AGENT) as `0x${string}`,
      target: rpc.params?.target,
    });
    return jsonRpc(200, { jsonrpc: '2.0', id: rpc.id, result });
  } catch (err) {
    return jsonRpc(200, {
      jsonrpc: '2.0',
      id: rpc.id,
      error: { code: -32000, message: (err as Error).message },
    });
  }
}

function jsonRpc(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

function corsHeaders(): HeadersInit {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
  };
}
