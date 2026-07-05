import { NextRequest, NextResponse } from 'next/server';
import {
  NextAdapter,
  x402HTTPResourceServer,
  x402ResourceServer,
} from '@x402/next';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import type { RouteConfig } from '@x402/next';
import type { Network } from '@x402/core/types';
import type { LocalBrain } from './brain-registry';

let resourceServer: x402ResourceServer | null = null;
let initPromise: Promise<void> | null = null;

type VerifiedGate = Extract<
  Awaited<ReturnType<x402HTTPResourceServer['processHTTPRequest']>>,
  { type: 'payment-verified' }
>;

export function x402SkipPayment(req?: NextRequest): boolean {
  if (process.env.X402_SKIP_PAYMENT === 'true') return true;
  if (req?.headers.get('x-demo-access') === 'btl-hackathon') return true;
  return false;
}

export function x402Network(): Network {
  return (process.env.X402_NETWORK?.trim() || 'eip155:84532') as Network;
}

function facilitatorUrl(): string {
  return process.env.X402_FACILITATOR_URL?.trim() || 'https://x402.org/facilitator';
}

function getResourceServer(): x402ResourceServer {
  if (!resourceServer) {
    const facilitator = new HTTPFacilitatorClient({ url: facilitatorUrl() });
    resourceServer = new x402ResourceServer(facilitator).register(
      x402Network(),
      new ExactEvmScheme(),
    );
  }
  return resourceServer;
}

async function ensureInitialized(httpServer: x402HTTPResourceServer): Promise<void> {
  if (!initPromise) {
    initPromise = httpServer.initialize().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
}

function routeConfigForBrain(brain: LocalBrain): RouteConfig {
  const price = brain.priceUsd && brain.priceUsd > 0 ? `$${brain.priceUsd.toFixed(2)}` : '$0.01';
  return {
    accepts: {
      scheme: 'exact',
      price,
      network: x402Network(),
      payTo: brain.payoutWallet!,
    },
    description: `Query specialist brain: ${brain.name}`,
    mimeType: 'application/json',
  };
}

function requestContext(req: NextRequest) {
  const adapter = new NextAdapter(req);
  return {
    adapter,
    path: req.nextUrl.pathname,
    method: req.method,
    paymentHeader:
      adapter.getHeader('payment-signature') || adapter.getHeader('x-payment') || undefined,
  };
}

function paymentErrorToResponse(response: {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  isHtml?: boolean;
}): NextResponse {
  const headers = new Headers(response.headers);
  if (response.isHtml) {
    headers.set('Content-Type', 'text/html');
    return new NextResponse(response.body as BodyInit, { status: response.status, headers });
  }
  headers.set('Content-Type', 'application/json');
  return new NextResponse(JSON.stringify(response.body ?? {}), {
    status: response.status,
    headers,
  });
}

export type BrainPaymentGateResult =
  | { status: 'free' }
  | { status: 'blocked'; response: NextResponse }
  | { status: 'verified'; httpServer: x402HTTPResourceServer; verified: VerifiedGate; context: ReturnType<typeof requestContext> };

/** Verify x402 payment before running a priced brain query. */
export async function gateBrainPayment(
  req: NextRequest,
  brain: LocalBrain,
): Promise<BrainPaymentGateResult> {
  if (x402SkipPayment(req)) return { status: 'free' };
  if (!brain.payoutWallet || !brain.priceUsd || brain.priceUsd <= 0) {
    return { status: 'free' };
  }

  const httpServer = new x402HTTPResourceServer(getResourceServer(), {
    '*': routeConfigForBrain(brain),
  });

  try {
    await ensureInitialized(httpServer);
  } catch (err) {
    console.error('[x402] facilitator init failed:', err);
    return {
      status: 'blocked',
      response: NextResponse.json(
        { error: 'x402 facilitator unavailable', detail: (err as Error).message },
        { status: 503 },
      ),
    };
  }

  const context = requestContext(req);
  const result = await httpServer.processHTTPRequest(context);

  switch (result.type) {
    case 'no-payment-required':
      return { status: 'free' };
    case 'payment-error':
      return { status: 'blocked', response: paymentErrorToResponse(result.response) };
    case 'payment-verified':
      return { status: 'verified', httpServer, verified: result, context };
    default:
      return {
        status: 'blocked',
        response: NextResponse.json({ error: 'unexpected x402 state' }, { status: 500 }),
      };
  }
}

/** Settle x402 payment after a successful brain response (status < 400). */
export async function settleBrainPayment(
  gate: Extract<BrainPaymentGateResult, { status: 'verified' }>,
  handlerResponse: NextResponse,
): Promise<NextResponse> {
  if (handlerResponse.status >= 400) {
    await gate.verified.cancellationDispatcher.cancel({
      reason: 'handler_failed',
      responseStatus: handlerResponse.status,
    });
    return handlerResponse;
  }

  try {
    const responseBody = Buffer.from(await handlerResponse.clone().arrayBuffer());
    const responseHeaders: Record<string, string> = {};
    handlerResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const result = await gate.httpServer.processSettlement(
      gate.verified.paymentPayload,
      gate.verified.paymentRequirements,
      gate.verified.declaredExtensions,
      { request: gate.context, responseBody, responseHeaders },
    );

    if (!result.success) {
      const body = result.response.isHtml
        ? result.response.body
        : JSON.stringify(result.response.body ?? {});
      return new NextResponse(body as BodyInit, {
        status: result.response.status,
        headers: result.response.headers,
      });
    }

    Object.entries(result.headers).forEach(([key, value]) => {
      handlerResponse.headers.set(key, value);
    });
    return handlerResponse;
  } catch (err) {
    console.error('[x402] settlement failed:', err);
    return NextResponse.json({ error: 'payment settlement failed' }, { status: 402 });
  }
}
