/**
 * BTL-native mixture query — no blockchain paywall, full answers + savings proof.
 *
 * POST /api/mixture
 *   { prompt, topic?: "auto"|"all"|"research"|"frameworks" }
 *
 * GET /api/mixture?quote=1&prompt=...&topic=...
 *   Dry-run BTL quote for one representative brain call.
 *
 * Innovation for BTL hackathon:
 *   - Prefix-stable RAG prompts maximize cache hits on repeated wiki context
 *   - Mixture fan-out returns per-brain x-btl-* economics + aggregate ledger
 *   - Cheap router model (BTL_ROUTER_MODEL) + query model (BTL_QUERY_MODEL) tiering
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  loadBtlConfig,
  isBtlConfigured,
  pickTopicBtl,
  createBtlInferenceClient,
  aggregateBtlEconomics,
  quoteBtlRequest,
  buildBrainSystemPrompt,
  type BtlEconomics,
} from '@brainpedia/compute-btl';
import { DISCOVERY_TOPICS, listLocalBrainsForTopic } from '@/lib/brain-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BRAIN_TIMEOUT_MS = 90_000;

interface BrainRow {
  id: string;
  name: string;
  ok: boolean;
  answer?: string;
  citations?: string[];
  errorMessage?: string;
  btl?: BtlEconomics;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get('quote') !== '1') {
    return NextResponse.json(
      { error: 'Use POST for mixture queries, or GET ?quote=1 for economics preview' },
      { status: 400 },
    );
  }
  if (!isBtlConfigured()) {
    return NextResponse.json({ error: 'GATEWAY_API_KEY not configured' }, { status: 503 });
  }

  const prompt = (url.searchParams.get('prompt') ?? '').trim();
  const topic = url.searchParams.get('topic') ?? 'all';
  if (!prompt) {
    return NextResponse.json({ error: 'prompt query param required' }, { status: 400 });
  }

  const cfg = loadBtlConfig();
  const brains = listLocalBrainsForTopic(topic);
  const sample = brains[0];
  if (!sample) {
    return NextResponse.json({ error: `no brains for topic ${topic}` }, { status: 404 });
  }

  const quote = await quoteBtlRequest(cfg, {
    model: cfg.queryModel,
    messages: [
      {
        role: 'system',
        content: buildBrainSystemPrompt(sample.name, sample.specialty),
      },
      { role: 'user', content: prompt },
    ],
  });

  return NextResponse.json({
    mode: 'quote',
    topic,
    sampleBrain: sample.name,
    brainCount: brains.length,
    quote,
    hint: 'Multiply customerCharge by brainCount for a rough mixture floor; repeat queries hit BTL prefix cache.',
  });
}

export async function POST(req: NextRequest) {
  if (!isBtlConfigured()) {
    return NextResponse.json(
      {
        error: 'Set GATEWAY_API_KEY (BTL Runtime workspace key) to run mixture queries.',
        docs: 'https://runtime.badtheorylabs.com/docs',
      },
      { status: 503 },
    );
  }

  let body: { prompt?: string; topic?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const prompt = (body.prompt ?? '').trim();
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const url = new URL(req.url);
  const rawTopic = body.topic ?? url.searchParams.get('topic') ?? 'auto';
  const cfg = loadBtlConfig();

  let topic = rawTopic;
  let router: { topic: string; reason: string; source: string } | undefined;
  if (rawTopic === 'auto' || rawTopic === '') {
    const choice = await pickTopicBtl({
      prompt,
      candidates: DISCOVERY_TOPICS,
      config: cfg,
    });
    topic = choice.topic;
    router = { topic: choice.topic, reason: choice.reason, source: choice.source };
  }

  const catalog = listLocalBrainsForTopic(topic);
  if (catalog.length === 0) {
    return NextResponse.json({ error: `no brains for topic ${topic}` }, { status: 404 });
  }

  const brainUrl = process.env.BRAINPEDIA_BRAIN_URL;
  if (!brainUrl) {
    return NextResponse.json(
      { error: 'BRAINPEDIA_BRAIN_URL must point at the brain HTTP service' },
      { status: 503 },
    );
  }

  const settled = await Promise.allSettled(
    catalog.map((b) => callBrain(brainUrl, prompt, b.target)),
  );

  const brains: BrainRow[] = settled.map((s, i) => {
    const meta = catalog[i]!;
    if (s.status === 'rejected') {
      return { id: meta.id, name: meta.name, ok: false, errorMessage: String(s.reason) };
    }
    const r = s.value;
    if (!r.ok) {
      return { id: meta.id, name: meta.name, ok: false, errorMessage: r.errorMessage };
    }
    return {
      id: meta.id,
      name: meta.name,
      ok: true,
      answer: r.answer,
      citations: r.citations,
      btl: r.btl,
    };
  });

  const successful = brains.filter((b) => b.ok && b.answer);
  const btlRows = successful.map((b) => b.btl).filter((x): x is BtlEconomics => Boolean(x));

  let synthesis = 'No brain returned a usable answer.';
  let synthesisSource: 'btl' | 'fallback' | 'none' = 'none';
  let synthesisBtl: BtlEconomics | undefined;

  if (successful.length > 0) {
    const sources = successful
      .map((b, i) => {
        const cites = (b.citations ?? []).length ? b.citations!.join(', ') : '(none)';
        return `--- Brain ${i + 1}: ${b.name} (cited: ${cites}) ---\n${b.answer}`;
      })
      .join('\n\n');

    try {
      const client = createBtlInferenceClient(cfg);
      const result = await client.query({
        systemPrompt:
          'Fuse these specialised brain answers into ONE coherent response. ' +
          'Credit brains by name. Under 6 sentences. End with: Sources: name1, name2',
        userPrompt: `User prompt: ${prompt}\n\nBrain answers:\n\n${sources}`,
        model: cfg.queryModel,
      });
      synthesis = result.answer.trim() || synthesis;
      synthesisSource = 'btl';
      synthesisBtl = result.btl;
      if (result.btl) btlRows.push(result.btl);
    } catch {
      synthesis =
        `Synthesised from ${successful.length} brain(s): ` +
        successful.map((b) => `${b.name} [${(b.citations ?? []).join(', ')}]`).join(' · ');
      synthesisSource = 'fallback';
    }
  }

  const economics = aggregateBtlEconomics(btlRows);

  return NextResponse.json({
    mode: 'mixture-btl',
    poweredBy: 'BTL Runtime',
    topic,
    router,
    prompt,
    brains,
    synthesis,
    synthesisSource,
    synthesisBtl,
    btlEconomics: economics,
    /**
     * Hackathon demo narrative: what you would have paid vs what BTL charged.
     * Re-run the same prompt to watch cacheHits climb (prefix cache on wiki context).
     */
    demo: {
      narrative:
        'Re-run this prompt to see cacheHits increase — wiki context is a stable prefix, ' +
        'questions are the volatile tail. BTL dedupes retrieval chunks across mixture fan-out.',
      rerunTip: 'POST the same JSON again without changing prompt to observe prefix cache savings.',
    },
  });
}

async function callBrain(
  brainUrl: string,
  prompt: string,
  target: string,
): Promise<
  | { ok: true; answer: string; citations: string[]; btl?: BtlEconomics }
  | { ok: false; errorMessage: string }
> {
  const endpoint = brainUrl.replace(/\/+$/, '') + '/mcp';
  const rpcBody = {
    jsonrpc: '2.0' as const,
    id: 1,
    method: 'query',
    params: { prompt, target, accessToken: 'btl-hackathon', agent: '0x0000000000000000000000000000000000000001' },
  };

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(rpcBody),
      signal: AbortSignal.timeout(BRAIN_TIMEOUT_MS),
    });
  } catch (err) {
    return { ok: false, errorMessage: `brain unreachable: ${(err as Error).message}` };
  }

  const btl = {
    requestId: upstream.headers.get('x-btl-request-id'),
    cacheTier: upstream.headers.get('x-btl-cache-tier'),
    benchmarkCost: parseMoney(upstream.headers.get('x-btl-benchmark-cost')),
    customerCharge: parseMoney(upstream.headers.get('x-btl-customer-charge')),
    saved: parseMoney(upstream.headers.get('x-btl-saved')),
    cacheHit: Boolean(upstream.headers.get('x-btl-cache-tier')),
  };

  let payload: {
    result?: { answer: string; citations?: string[]; btl?: BtlEconomics };
    error?: { message: string };
  };
  try {
    payload = await upstream.json();
  } catch {
    return { ok: false, errorMessage: `non-JSON response (${upstream.status})` };
  }

  if (payload.error) {
    return { ok: false, errorMessage: payload.error.message };
  }
  if (!payload.result?.answer) {
    return { ok: false, errorMessage: 'empty brain answer' };
  }

  return {
    ok: true,
    answer: payload.result.answer,
    citations: payload.result.citations ?? [],
    btl: payload.result.btl ?? btl,
  };
}

function parseMoney(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
