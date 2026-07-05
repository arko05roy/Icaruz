import { NextRequest, NextResponse } from 'next/server';
import {
  loadEnsConfig,
  createEnsPublicClient,
  listBrainsForTopic,
  readBrainRecords,
  parsePriceQuery,
  BRAIN_TEXT_KEYS,
} from '@brainpedia/ens';
import { AxlClient, BRAIN_MCP_SERVICE_NAME, type McpResponse } from '@brainpedia/axl';
import {
  loadComputeConfig,
  pickTopic,
  createBrainInferenceClient,
  type RouterChoice,
} from '@brainpedia/compute-0g';
import { getTextRecord } from '@ensdomains/ensjs/public';
import {
  newSessionId,
  putSession,
  getSession,
  markSettled,
  SESSION_TTL_MS,
} from './sessions';
import { verifySettlement } from './verify-settlement';
import {
  isBrainRuntimeConfigured,
  queryBrainLocal,
} from '@/lib/brain-runtime';

/**
 * Discovery shortcuts the orchestrator can route to. The web service ships
 * this registry so the LLM router knows the menu of `<topic>.discover.<parent>`
 * options without having to enumerate ENS. Keep in sync with whatever
 * shortcuts have been issued via `scripts/setup/issue-discovery-shortcut.ts`.
 */
const DISCOVERY_REGISTRY: Array<{ topic: string; description: string }> = [
  {
    topic: 'research',
    description:
      'Senior EVM smart-contract security engineer: reentrancy (single/cross-function/read-only), checks-effects-interactions, access control and ownership, price oracle and flash-loan manipulation, ERC standard pitfalls, ERC-4626 first-depositor inflation, signature replay, audit methodology, real incident post-mortems. Currently: yudhi.bpedia.eth.',
  },
  {
    topic: 'frameworks',
    description:
      'Methodology and framework knowledge: how to organise notes, build wikis, design AI agents, knowledge-management patterns. Currently: karpathy.bpedia.eth.',
  },
  {
    topic: 'all',
    description:
      'Every Brain in the network. Use this when the prompt clearly spans multiple specialties or none match cleanly.',
  },
];

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BrainQueryResult {
  answer: string;
  citations: string[];
  confidence: number | null;
  brainEnsName: string;
  storageRoot: string;
  verified: boolean;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: BrainQueryResult;
  error?: { code: number; message: string };
}

interface MixtureBrainResult extends Partial<BrainQueryResult> {
  brainEnsName: string;
  ok: boolean;
  errorMessage?: string;
}

interface PaymentSplit {
  brainEnsName: string;
  inft: string | null;
  brainOwner?: string;
  /** Citations the brain returned (for transparency only — does NOT affect payment). */
  citationCount: number;
  /** This brain's share of the total bill, derived from amountWei/total. */
  weight: number;
  /** What the agent owes this brain, in wei (always wei for on-chain settlement). */
  amountWei: string;
  /** The brain's advertised brain.price_query ENS text record, as stored
   *  (canonical: "0.001 OG"; legacy raw-wei integers are still accepted on read). */
  priceQuery: string | null;
}

interface MixtureResponse {
  mode: 'mixture';
  /**
   * `awaiting-payment`: phase-1 response; the synthesis + per-brain answers
   * are gated until the agent settles the plan and re-calls with sessionId
   * + txHash. `paid`: phase-2 response after the on-chain Distributed events
   * matched the plan; full synthesis + answers are unlocked.
   */
  status: 'awaiting-payment' | 'paid';
  /** Opaque handle the agent posts back with txHash to claim the answer. */
  sessionId: string;
  /** Wall-clock deadline by which the session expires (epoch ms). */
  expiresAt: number;
  /**
   * Settlement metadata, present on phase-2 responses only. The agent uses
   * this to confirm to the user which on-chain event chain unlocked the
   * answer.
   */
  settlement?: {
    txHash: string;
    payer: string;
    blockNumber: number;
    explorer: string;
  };
  /** The shortcut actually used to fan out (post-routing). */
  topic: string;
  /**
   * Set when topic was 'auto' (or omitted): how the orchestrator picked a
   * shortcut. `source: 'llm'` means a TEE-attested compute call classified
   * the prompt; `source: 'fallback'` means routing was skipped (no compute
   * key on the web service or the model output was unparseable).
   */
  router?: { auto: true; reason: string; source: RouterChoice['source']; available: string[] };
  prompt: string;
  /**
   * Underlying transport for each brain call: 'axl' if we routed through the
   * AXL daemon's HTTP API at AXL_API_URL, 'local' when the brain handler runs
   * in-process inside Next.js (default), or 'https' when falling back to a
   * legacy external BRAINPEDIA_BRAIN_URL.
   */
  transport: 'axl' | 'local' | 'https';
  brains: MixtureBrainResult[];
  synthesis: string;
  /**
   * 'llm' = TEE-attested synthesis call fused per-brain answers into one
   * coherent response. 'fallback' = compute env unavailable or call failed,
   * served the legacy template ("Synthesised from N brains: ..."). 'none' =
   * no brain returned a usable answer to fuse.
   */
  synthesisSource: 'llm' | 'fallback' | 'none';
  /**
   * Per-brain payment plan. The agent (or a payment-relayer) settles by
   * calling RoyaltyDistributor.distribute(tokenIds, amounts, reason) on the
   * `distributor` address in one tx — see contracts/src/RoyaltyDistributor.sol.
   * Each brain receives exactly its advertised brain.price_query.
   */
  payments: PaymentSplit[];
  /** Sum of priceQueryWei across responding brains. Pay-per-brain at sticker. */
  totalAmountWei: string;
  /** RoyaltyDistributor contract address on the Brain.sol chain — caller
   *  sends `totalAmountWei` and the same arrays of tokenIds + amounts to
   *  distribute() to settle on chain. Null if the env var isn't set. */
  distributor: string | null;
}

const BRAIN_TIMEOUT_MS = 90_000;

/**
 * Default single-brain proxy. Forwards prompt as JSON-RPC `query` to the
 * brain (over AXL when AXL_API_URL is set, otherwise direct HTTPS to
 * BRAINPEDIA_BRAIN_URL).
 *
 * POST /api/query?mode=mixture&topic=auto
 *   → kicks the multi-brain fan-out path: LLM router picks the discovery
 *     shortcut (or pass an explicit topic), resolves the shortcut's
 *     brainpedia.brains text record, calls each brain in parallel, and
 *     returns per-brain results + a synthesised summary + a pay-per-brain
 *     plan (each responder paid its advertised brain.price_query) ready
 *     for on-chain settlement via RoyaltyDistributor.
 */
export async function POST(req: NextRequest) {
  let body: {
    prompt?: string;
    accessToken?: string;
    agent?: string;
    target?: string;
    mixture?: boolean;
    topic?: string;
    /** Phase-2 unlock: opaque session handle from the phase-1 response. */
    sessionId?: string;
    /** Phase-2 unlock: RoyaltyDistributor.distribute tx hash to verify against
     *  the cached plan before releasing the synthesis. */
    txHash?: string;
    /** Phase-2 unlock: block the settlement tx mined in (from the settler's
     *  own receipt). Lets the verifier wait for its read RPC node to catch up
     *  to that height before declaring the tx unknown — kills the public-LB
     *  read-after-write race. */
    settlementBlock?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const url = new URL(req.url);
  const wantsMixture = body.mixture === true || url.searchParams.get('mode') === 'mixture';

  // Phase-2 mixture unlock: agent has settled and is reclaiming the synthesis.
  if (wantsMixture && body.sessionId && body.txHash) {
    return claimMixture(body.sessionId, body.txHash, body.settlementBlock);
  }

  const prompt = (body?.prompt ?? '').toString().trim();
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const transport = transportPreference();
  if (transport === 'https' && !process.env.BRAINPEDIA_BRAIN_URL) {
    return NextResponse.json(
      { error: 'BRAINPEDIA_BRAIN_URL must be configured for https transport' },
      { status: 503 },
    );
  }
  if (transport === 'local' && !isBrainRuntimeConfigured()) {
    return NextResponse.json(
      {
        error:
          'brain runtime not configured — set ZG_WALLET_PRIVATE_KEY, BRAIN_ENS_NAME, BRAIN_STORAGE_ROOT, BRAIN_SPECIALTY',
      },
      { status: 503 },
    );
  }

  if (wantsMixture) {
    const rawTopic = (body.topic ?? url.searchParams.get('topic') ?? 'auto').toString();
    return mixtureFanOut(prompt, rawTopic, transport);
  }

  return singleBrainQuery(prompt, body, transport);
}

function transportPreference(): 'axl' | 'local' | 'https' {
  if (process.env.AXL_API_URL) return 'axl';
  if (isBrainRuntimeConfigured()) return 'local';
  if (process.env.BRAINPEDIA_BRAIN_URL) return 'https';
  return 'local';
}

async function singleBrainQuery(
  prompt: string,
  body: { accessToken?: string; agent?: string; target?: string },
  transport: 'axl' | 'local' | 'https',
): Promise<NextResponse> {
  const result = await callBrain(prompt, {
    target: body.target,
    accessToken: body.accessToken,
    agent: body.agent,
    transport,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.errorMessage, code: result.code },
      { status: 502 },
    );
  }
  return NextResponse.json(result.value, { status: 200 });
}

async function mixtureFanOut(
  prompt: string,
  rawTopic: string,
  transport: 'axl' | 'local' | 'https',
): Promise<NextResponse> {
  // Resolve topic. `auto` (or empty) → call the LLM router to pick from the
  // discovery registry. Anything else is taken at face value.
  let topic = rawTopic;
  let routerInfo: MixtureResponse['router'] | undefined;
  if (rawTopic === 'auto' || rawTopic === '') {
    const choice = await pickTopic({
      prompt,
      candidates: DISCOVERY_REGISTRY,
      signerPrivateKey: process.env.ZG_WALLET_PRIVATE_KEY,
      config: loadComputeConfig(),
    });
    topic = choice.topic;
    routerInfo = {
      auto: true,
      reason: choice.reason,
      source: choice.source,
      available: DISCOVERY_REGISTRY.map((c) => c.topic),
    };
  }

  let brainNames: string[];
  const cfg = loadEnsConfig();
  const ensClient = createEnsPublicClient(cfg);
  try {
    brainNames = await listBrainsForTopic(
      { publicClient: ensClient, config: cfg },
      topic,
    );
  } catch (err) {
    return NextResponse.json(
      { error: `mixture: discovery resolve failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  if (brainNames.length === 0) {
    return NextResponse.json(
      { error: `mixture: no brains registered under ${topic}.discover.<parent>` },
      { status: 404 },
    );
  }

  const settled = await Promise.allSettled(
    brainNames.map((name) => callBrain(prompt, { target: name, transport })),
  );

  const brains: MixtureBrainResult[] = settled.map((s, i) => {
    const name = brainNames[i]!;
    if (s.status === 'rejected') {
      return { brainEnsName: name, ok: false, errorMessage: String(s.reason) };
    }
    const r = s.value;
    if (!r.ok) {
      return { brainEnsName: name, ok: false, errorMessage: r.errorMessage };
    }
    return { ...r.value, ok: true };
  });

  const successful = brains.filter((b) => b.ok);
  const { synthesis, synthesisSource } = await synthesise(prompt, successful);

  const payments = await computePayments(ensClient, cfg, successful);
  const totalAmountWei = payments
    .reduce((acc, p) => acc + BigInt(p.amountWei), 0n)
    .toString();

  const distributor = process.env.ROYALTY_DISTRIBUTOR_ADDRESS ?? null;
  const sessionId = newSessionId();
  const expiresAt = Date.now() + SESSION_TTL_MS;

  const fullResponse: MixtureResponse = {
    mode: 'mixture',
    status: 'paid', // when surfaced via cache after settlement
    sessionId,
    expiresAt,
    topic,
    ...(routerInfo ? { router: routerInfo } : {}),
    prompt,
    transport,
    brains,
    synthesis,
    synthesisSource,
    payments,
    totalAmountWei,
    distributor,
  };

  putSession(sessionId, {
    createdAt: Date.now(),
    topic,
    prompt,
    full: fullResponse,
    plan: {
      distributor,
      splits: payments.map((p) => ({ inft: p.inft, amountWei: p.amountWei })),
      totalAmountWei,
    },
  });

  // Phase-1 response: REDACT answers + synthesis. Surface enough metadata
  // for the agent to understand what they're paying for (which brains
  // responded, how many citations each returned, the per-brain price) but
  // not the actual content.
  const phaseOne: MixtureResponse = {
    mode: 'mixture',
    status: 'awaiting-payment',
    sessionId,
    expiresAt,
    topic,
    ...(routerInfo ? { router: routerInfo } : {}),
    prompt,
    transport,
    brains: brains.map((b) => ({
      brainEnsName: b.brainEnsName,
      ok: b.ok,
      verified: b.verified,
      citations: b.citations ? b.citations : undefined,
      ...(b.errorMessage ? { errorMessage: b.errorMessage } : {}),
      // answer + storageRoot are intentionally omitted until paid.
    })),
    synthesis: 'Synthesis is gated until the agent settles the payment plan and re-calls /api/query?mode=mixture with sessionId + txHash.',
    synthesisSource,
    payments,
    totalAmountWei,
    distributor,
  };
  return NextResponse.json(phaseOne, { status: 200 });
}

async function claimMixture(
  sessionId: string,
  txHash: string,
  settlementBlock?: number,
): Promise<NextResponse> {
  const cached = getSession(sessionId);
  if (!cached) {
    return NextResponse.json(
      { error: `mixture: sessionId not found or expired (TTL ${Math.round(SESSION_TTL_MS / 60_000)} min)` },
      { status: 404 },
    );
  }

  // Idempotency: once a session is verified-paid, every subsequent claim
  // (a retry after a flaky unlock, a different txHash, the same txHash)
  // returns the cached unlocked response immediately. No re-verify, no
  // re-pay. This is what makes a failed unlock cost 0 OG to recover.
  if (cached.settled) {
    return NextResponse.json(cached.settled.response as MixtureResponse, {
      status: 200,
    });
  }

  if (!cached.plan.distributor) {
    return NextResponse.json(
      { error: 'mixture: cached plan has no distributor address; ROYALTY_DISTRIBUTOR_ADDRESS env was missing at fan-out time' },
      { status: 500 },
    );
  }

  const verdict = await verifySettlement({
    txHash,
    expectedDistributor: cached.plan.distributor,
    expectedSplits: cached.plan.splits,
    expectedBlockNumber: settlementBlock,
  });
  if (!verdict.ok) {
    return NextResponse.json(
      {
        error: `mixture: settlement verification failed: ${verdict.reason}`,
        // Tell the agent recovery is free — do NOT re-broadcast a payment.
        recovery:
          'The payment may already be on chain. Re-call settle_mixture with the SAME sessionId and pass the prior txHash to re-verify at zero cost — do not pay again.',
        sessionId,
        txHash,
      },
      { status: 402 },
    );
  }

  const full = cached.full as MixtureResponse;
  const explorerBase = process.env.ZG_EXPLORER_URL ?? 'https://chainscan-galileo.0g.ai';
  const settled: MixtureResponse = {
    ...full,
    status: 'paid',
    settlement: {
      txHash,
      payer: verdict.payer,
      blockNumber: verdict.blockNumber,
      explorer: `${explorerBase}/tx/${txHash}`,
    },
  };
  markSettled(sessionId, txHash, settled);
  return NextResponse.json(settled, { status: 200 });
}

interface BrainCallSuccess {
  ok: true;
  value: BrainQueryResult;
}
interface BrainCallFailure {
  ok: false;
  errorMessage: string;
  code?: number;
}
type BrainCall = BrainCallSuccess | BrainCallFailure;

async function callBrain(
  prompt: string,
  params: {
    target?: string;
    accessToken?: string;
    agent?: string;
    transport: 'axl' | 'local' | 'https';
  },
): Promise<BrainCall> {
  const rpcBody = {
    jsonrpc: '2.0' as const,
    id: 1,
    method: 'query',
    params: {
      prompt,
      ...(params.target ? { target: params.target } : {}),
      ...(params.accessToken ? { accessToken: params.accessToken } : {}),
      ...(params.agent ? { agent: params.agent } : {}),
    },
  };

  if (params.transport === 'axl') {
    return callBrainViaAxl(rpcBody, params.target);
  }
  if (params.transport === 'local') {
    return callBrainLocal(rpcBody.params);
  }
  return callBrainViaHttps(rpcBody);
}

async function callBrainLocal(params: {
  prompt: string;
  target?: string;
  accessToken?: string;
  agent?: string;
}): Promise<BrainCall> {
  try {
    const result = await queryBrainLocal({
      prompt: params.prompt,
      target: params.target,
      accessToken: params.accessToken,
      agent: params.agent as `0x${string}` | undefined,
    });
    return { ok: true, value: result };
  } catch (err) {
    return { ok: false, errorMessage: (err as Error).message };
  }
}

async function callBrainViaAxl(
  rpcBody: { jsonrpc: '2.0'; id: number; method: string; params: Record<string, unknown> },
  target: string | undefined,
): Promise<BrainCall> {
  const apiUrl = process.env.AXL_API_URL!;
  // We need the brain's AXL peer id to route through the mesh. Resolve it
  // from the target's brain.axl_peer_id ENS text record. Falls back to
  // AXL_DEFAULT_BRAIN_PEER if target is missing (single-tenant mode).
  let peerId: string | undefined = process.env.AXL_DEFAULT_BRAIN_PEER;
  if (target) {
    try {
      const cfg = loadEnsConfig();
      const ensClient = createEnsPublicClient(cfg);
      const records = await readBrainRecords(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { publicClient: ensClient as any, config: cfg },
        target,
      );
      peerId = records.axlPeerId ?? peerId;
    } catch (err) {
      return { ok: false, errorMessage: `axl: failed to resolve peer for ${target}: ${(err as Error).message}` };
    }
  }
  if (!peerId) {
    return { ok: false, errorMessage: 'axl: no peer id (set AXL_DEFAULT_BRAIN_PEER or use a target with brain.axl_peer_id record)' };
  }

  const client = new AxlClient({ apiUrl, bootstrapPeers: [] });
  let envelope: McpResponse<BrainQueryResult>;
  try {
    envelope = await client.mcp<BrainQueryResult>(peerId, BRAIN_MCP_SERVICE_NAME, rpcBody);
  } catch (err) {
    return { ok: false, errorMessage: `axl unreachable at ${apiUrl}: ${(err as Error).message}` };
  }
  if (envelope.error) {
    return { ok: false, errorMessage: envelope.error.message, code: envelope.error.code };
  }
  if (!envelope.result) {
    return { ok: false, errorMessage: 'axl: brain returned no result' };
  }
  return { ok: true, value: envelope.result };
}

async function callBrainViaHttps(rpcBody: object): Promise<BrainCall> {
  const brainUrl = process.env.BRAINPEDIA_BRAIN_URL!;
  const endpoint = brainUrl.replace(/\/+$/, '') + '/mcp';
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

  let payload: JsonRpcResponse;
  try {
    payload = (await upstream.json()) as JsonRpcResponse;
  } catch {
    return { ok: false, errorMessage: `brain returned non-JSON (${upstream.status})` };
  }
  if (payload.error) {
    return { ok: false, errorMessage: payload.error.message, code: payload.error.code };
  }
  if (!payload.result) {
    return { ok: false, errorMessage: 'brain returned no result' };
  }
  return { ok: true, value: payload.result };
}

/**
 * Real synthesis: feed the per-brain answers + their citations into a
 * TEE-attested 0G Compute call, ask it to fuse them into one coherent answer
 * the agent can act on. Falls back to the legacy template synthesis when
 * compute env is missing or the inference call errors — the legacy form is
 * still useful for debugging routing/citations even without a fused answer.
 */
async function synthesise(
  prompt: string,
  successful: MixtureBrainResult[],
): Promise<{ synthesis: string; synthesisSource: 'llm' | 'fallback' | 'none' }> {
  if (successful.length === 0) {
    return {
      synthesis: 'No brain in the discovery shortcut returned a usable answer.',
      synthesisSource: 'none',
    };
  }
  const fallback = `Synthesised from ${successful.length} brain${successful.length === 1 ? '' : 's'}: `
    + successful
        .map((b) => `${b.brainEnsName.split('.')[0]} cites [${(b.citations ?? []).join(', ')}]`)
        .join(' · ');

  const cfg = loadComputeConfig();
  const wallet = process.env.ZG_WALLET_PRIVATE_KEY;
  if (!wallet || !cfg.providerAddress) {
    return { synthesis: fallback, synthesisSource: 'fallback' };
  }

  const sources = successful
    .map((b, i) => {
      const cites = (b.citations ?? []).length > 0
        ? `cited: ${(b.citations ?? []).join(', ')}`
        : 'cited: (none)';
      return `--- Brain ${i + 1}: ${b.brainEnsName} (${cites}) ---\n${b.answer ?? ''}`;
    })
    .join('\n\n');

  const systemPrompt =
    'You are the Brainpedia orchestrator. You receive a user prompt and 1-N answers ' +
    'from specialised Brains, each with the slugs they cited. Fuse them into ONE ' +
    'coherent answer for the user — synthesise, do not just concatenate. Acknowledge ' +
    'when brains disagree. Quote brain ENS names inline when crediting a specific ' +
    'point. Keep it under ~6 sentences. Do NOT invent facts not present in the ' +
    'inputs. End with a single line listing the brains you drew on, in this exact ' +
    'format: Sources: yudhi.bpedia.eth, karpathy.bpedia.eth';

  try {
    const client = createBrainInferenceClient(cfg, wallet);
    const result = await client.query({
      systemPrompt,
      userPrompt: `User prompt: ${prompt}\n\nBrain answers:\n\n${sources}`,
    });
    const text = result.answer.trim();
    if (!text) return { synthesis: fallback, synthesisSource: 'fallback' };
    return { synthesis: text, synthesisSource: 'llm' };
  } catch {
    return { synthesis: fallback, synthesisSource: 'fallback' };
  }
}

/**
 * Pay-per-brain at sticker. Each responding brain receives exactly its
 * advertised brain.price_query — no citation-based redistribution. The agent's
 * total bill is the sum of those prices across brains that returned a usable
 * answer. Brains that errored are not included; brains with no price record
 * get 0 (free).
 *
 * Citations are still surfaced in the response for transparency, but they do
 * not affect amounts. `weight` is the brain's share of the total bill purely
 * for display.
 *
 * This is a payment *plan* — settlement happens via
 * RoyaltyDistributor.distribute(tokenIds, amounts, reason) called by the
 * agent (or the query_mixture MCP tool) in a single tx, so the web service
 * never needs a hot wallet.
 */
async function computePayments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ensClient: any,
  cfg: ReturnType<typeof loadEnsConfig>,
  successful: MixtureBrainResult[],
): Promise<PaymentSplit[]> {
  if (successful.length === 0) return [];

  const enriched = await Promise.all(
    successful.map(async (b) => {
      let inft: string | null = null;
      let priceWei: bigint | null = null;
      let priceRecord: string | null = null;
      try {
        const records = await readBrainRecords(
          { publicClient: ensClient, config: cfg },
          b.brainEnsName,
        );
        inft = records.inft ?? null;
        priceRecord = records.priceQuery ?? null;
        priceWei = parsePriceQuery(priceRecord);
      } catch {
        // tolerate ENS read failures — payment plan just won't include this brain
      }
      return { brain: b, inft, priceWei, priceRecord };
    }),
  );

  const total = enriched.reduce((acc, e) => acc + (e.priceWei ?? 0n), 0n);

  const splits: PaymentSplit[] = enriched.map((e) => {
    const amount = e.priceWei ?? 0n;
    const weight = total === 0n ? 0 : Number((amount * 10_000n) / total) / 10_000;
    return {
      brainEnsName: e.brain.brainEnsName,
      inft: e.inft,
      citationCount: (e.brain.citations ?? []).length,
      weight,
      amountWei: amount.toString(),
      priceQuery: e.priceRecord,
    };
  });

  void getTextRecord;
  void BRAIN_TEXT_KEYS;
  return splits;
}
