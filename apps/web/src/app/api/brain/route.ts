/**
 * Single-brain query via BTL — used on /[name] pages.
 * POST { prompt, target }
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

export async function POST(req: Request) {
  if (!isBrainRuntimeConfigured()) {
    return NextResponse.json(
      {
        error:
          'brain runtime not configured — set ZG_WALLET_PRIVATE_KEY, BRAIN_ENS_NAME, BRAIN_STORAGE_ROOT, BRAIN_SPECIALTY',
      },
      { status: 503 },
    );
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

  try {
    const result = await queryBrainLocal({
      prompt,
      target,
      accessToken: BTL_DEMO_ACCESS_TOKEN,
      agent: BTL_DEMO_AGENT,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
