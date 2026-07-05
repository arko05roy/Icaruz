/**
 * Single-brain query via BTL — used on /[name] pages.
 * POST { prompt, target }
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 90_000;

export async function POST(req: Request) {
  const brainUrl = process.env.BRAINPEDIA_BRAIN_URL;
  if (!brainUrl) {
    return NextResponse.json({ error: 'BRAINPEDIA_BRAIN_URL not configured' }, { status: 503 });
  }

  let body: { prompt?: string; target?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const prompt = (body.prompt ?? '').trim();
  const target = (body.target ?? '').trim();
  if (!prompt || !target) {
    return NextResponse.json({ error: 'prompt and target required' }, { status: 400 });
  }

  const endpoint = brainUrl.replace(/\/+$/, '') + '/mcp';
  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'query',
        params: {
          prompt,
          target,
          accessToken: 'btl-hackathon',
          agent: '0x0000000000000000000000000000000000000001',
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `brain unreachable: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const payload = (await upstream.json()) as {
    result?: Record<string, unknown>;
    error?: { message: string };
  };

  if (payload.error) {
    return NextResponse.json({ error: payload.error.message }, { status: 502 });
  }
  if (!payload.result) {
    return NextResponse.json({ error: 'empty brain response' }, { status: 502 });
  }

  return NextResponse.json({
    ...payload.result,
    btlHeaders: {
      requestId: upstream.headers.get('x-btl-request-id'),
      cacheTier: upstream.headers.get('x-btl-cache-tier'),
      benchmarkCost: upstream.headers.get('x-btl-benchmark-cost'),
      customerCharge: upstream.headers.get('x-btl-customer-charge'),
      saved: upstream.headers.get('x-btl-saved'),
    },
  });
}
