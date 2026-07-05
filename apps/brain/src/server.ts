import { createServer } from 'node:http';
import { URL } from 'node:url';
import type { Address } from 'viem';
import {
  createBrainHandler,
  type BrainOptions,
  type BrainQueryRequest,
} from './handler.js';

interface ServerOptions extends BrainOptions {
  /** Port this Brain MCP server listens on. */
  port: number;
  /** AXL MCP router URL (default http://127.0.0.1:9003). */
  routerUrl: string;
  /** Service name to register with the router. */
  serviceName: string;
  /** Wallet private key for 0G operations (storage + compute). */
  signerPrivateKey: string;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: { prompt?: string; accessToken?: string; agent?: string; target?: string };
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * Brain MCP server — registers itself with a local AXL MCP router so
 * incoming POST /mcp/{this-peer-id}/brainpedia.brain requests get
 * forwarded to this process. See gensyn-ai/axl/docs/integrations.md.
 */
export function startBrainServer(opts: ServerOptions) {
  const handler = createBrainHandler(opts, opts.signerPrivateKey);
  const endpoint = `http://127.0.0.1:${opts.port}/mcp`;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    // Permissive CORS so the web app's API route (and dev tools) can call us.
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type, authorization',
        'access-control-max-age': '86400',
      });
      return res.end();
    }
    res.setHeader('access-control-allow-origin', '*');

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, service: opts.serviceName });
    }
    if (req.method !== 'POST' || url.pathname !== '/mcp') {
      return json(res, 404, { error: 'not found' });
    }

    let body = '';
    for await (const chunk of req) body += chunk;

    let rpc: JsonRpcRequest;
    try {
      rpc = JSON.parse(body);
    } catch {
      return jsonRpc(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }

    if (rpc.method !== 'query') {
      return jsonRpc(res, 200, {
        jsonrpc: '2.0',
        id: rpc.id,
        error: { code: -32601, message: `Method not found: ${rpc.method}` },
      });
    }

    try {
      const params: BrainQueryRequest = {
        prompt: rpc.params?.prompt ?? '',
        accessToken: rpc.params?.accessToken,
        agent: rpc.params?.agent as Address | undefined,
        target: rpc.params?.target,
      };
      const result = await handler.query(params);
      return jsonRpc(res, 200, { jsonrpc: '2.0', id: rpc.id, result });
    } catch (err) {
      return jsonRpc(res, 200, {
        jsonrpc: '2.0',
        id: rpc.id,
        error: { code: -32000, message: (err as Error).message },
      });
    }
  });

  // Bind 0.0.0.0 so containers (Railway) can route external traffic in.
  // routerUrl="" means router registration is skipped entirely.
  const host = process.env.BRAIN_BIND_HOST ?? '0.0.0.0';
  return new Promise<{ close: () => Promise<void> }>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port, host, async () => {
      if (opts.routerUrl) {
        try {
          await registerWithRouter(opts.routerUrl, opts.serviceName, endpoint);
          // eslint-disable-next-line no-console
          console.log(
            `[brain] ${opts.serviceName} listening at http://${host}:${opts.port}/mcp (registered with ${opts.routerUrl})`,
          );
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[brain] router registration failed:', (err as Error).message);
        }
      } else {
        // eslint-disable-next-line no-console
        console.log(
          `[brain] ${opts.serviceName} listening at http://${host}:${opts.port}/mcp (router registration skipped)`,
        );
      }

      const close = async () => {
        if (opts.routerUrl) {
          await deregisterFromRouter(opts.routerUrl, opts.serviceName).catch(() => {});
        }
        await new Promise<void>((r) => server.close(() => r()));
      };
      // Deregister cleanly on SIGTERM/SIGINT.
      const onExit = async () => {
        await close();
        process.exit(0);
      };
      process.once('SIGTERM', onExit);
      process.once('SIGINT', onExit);

      resolve({ close });
    });
  });
}

async function registerWithRouter(routerUrl: string, service: string, endpoint: string) {
  const res = await fetch(`${routerUrl}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ service, endpoint }),
  });
  if (!res.ok) throw new Error(`router /register returned ${res.status}`);
}

async function deregisterFromRouter(routerUrl: string, service: string) {
  await fetch(`${routerUrl}/register/${encodeURIComponent(service)}`, {
    method: 'DELETE',
  });
}

function json(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function jsonRpc(
  res: import('node:http').ServerResponse,
  status: number,
  body: JsonRpcResponse,
) {
  json(res, status, body);
}
