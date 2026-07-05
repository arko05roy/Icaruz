/**
 * Single-brain query via BTL — used on /[name] pages.
 * Priced creator brains require x402 payment (unless X402_SKIP_PAYMENT or demo header).
 *
 * POST { prompt, target }
 */
import { NextRequest, NextResponse } from 'next/server';
import { findBrainById } from '@/lib/brain-registry';
import {
  BTL_DEMO_ACCESS_TOKEN,
  BTL_DEMO_AGENT,
  isBrainRuntimeConfigured,
  queryBrainLocal,
} from '@/lib/brain-runtime';
import { gateBrainPayment, settleBrainPayment } from '@/lib/x402-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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

  const brainMeta = await findBrainById(target);
  const gate = brainMeta
    ? await gateBrainPayment(req, brainMeta)
    : ({ status: 'free' } as const);

  if (gate.status === 'blocked') {
    return gate.response;
  }

  try {
    const result = await queryBrainLocal({
      prompt,
      target,
      accessToken: BTL_DEMO_ACCESS_TOKEN,
      agent: BTL_DEMO_AGENT,
    });

    const creatorEconomics =
      brainMeta?.payoutWallet && brainMeta.priceUsd
        ? {
            wallet: brainMeta.payoutWallet,
            amountUsd: brainMeta.priceUsd,
            paid: gate.status === 'verified',
          }
        : undefined;

    let response: NextResponse = NextResponse.json({ ...result, creatorEconomics });

    if (gate.status === 'verified') {
      response = await settleBrainPayment(gate, response);
    }

    return response;
  } catch (err) {
    if (gate.status === 'verified') {
      await gate.verified.cancellationDispatcher.cancel({ reason: 'handler_threw', error: err });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
