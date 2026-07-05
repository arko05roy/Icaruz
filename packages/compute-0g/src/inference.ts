import OpenAI from 'openai';
import type { ComputeConfig } from './config.js';
import { createBroker, type BrokerHandle, type InferenceHandle } from './broker.js';

export interface InferenceMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface InferenceRequest {
  systemPrompt: string;
  userPrompt: string;
  /** Optional retrieved articles for RAG-style grounding. */
  context?: Array<{ slug: string; title: string; body: string }>;
}

export interface InferenceResponse {
  answer: string;
  /** Slugs cited from the context array, when applicable. */
  citations: string[];
  /** Self-reported confidence 0–1, if the model returns one. */
  confidence: number | null;
  usage: { promptTokens: number; completionTokens: number };
  /** Whether the TEE-signed response verified. */
  verified: boolean;
}

export interface BrainInferenceClient {
  query(req: InferenceRequest): Promise<InferenceResponse>;
}

/**
 * Per-Brain inference client. Each Brain instantiates this with its own
 * compute config (typically pinned via ENS text record `brain.compute_url`),
 * and the orchestrator instantiates one for the synthesis step.
 *
 * The OpenAI SDK is used as a transport — the actual auth flows through
 * 0G broker per-request headers (from `BrokerHandle.getInferenceClient`).
 */
export function createBrainInferenceClient(
  cfg: ComputeConfig,
  signerPrivateKey: string,
): BrainInferenceClient {
  if (!cfg.providerAddress) {
    throw new Error('createBrainInferenceClient: ZG_COMPUTE_PROVIDER_ADDRESS missing');
  }
  const broker: BrokerHandle = createBroker(cfg, signerPrivateKey);
  let handle: InferenceHandle | null = null;

  async function getHandle(forceRefresh = false): Promise<InferenceHandle> {
    if (forceRefresh) handle = null;
    if (!handle) {
      await broker.acknowledgeProvider(cfg.providerAddress!);
      handle = await broker.getInferenceClient(cfg.providerAddress!);
    }
    return handle;
  }

  async function runOnce(req: InferenceRequest, forceRefresh: boolean): Promise<InferenceResponse> {
    const h = await getHandle(forceRefresh);
    const userContent = composePrompt(req);
    const headers = await h.headersFor(userContent);

    const openai = new OpenAI({ baseURL: h.endpoint, apiKey: '' });

    const { data: completion, response } = await openai.chat.completions
      .create(
        {
          model: h.model,
          messages: [
            { role: 'system', content: req.systemPrompt },
            { role: 'user', content: userContent },
          ],
        },
        { headers },
      )
      .withResponse();

    const answer = completion.choices[0]?.message.content ?? '';
    const chatId = response.headers.get('ZG-Res-Key') ?? completion.id;
    const verified = await h.verify(chatId, answer).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[inference] verification failed:', (err as Error)?.message ?? err);
      return false;
    });

    return {
      answer,
      citations: extractCitations(answer, req.context ?? []),
      confidence: null,
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
      },
      verified,
    };
  }

  return {
    async query(req) {
      try {
        return await runOnce(req, false);
      } catch (err) {
        // Retry once on transport-level failure: invalidate cached handle and rebuild.
        // 4xx model errors are NOT retried — those are real client mistakes.
        if (!isTransportError(err)) throw err;
        // eslint-disable-next-line no-console
        console.error(
          '[inference] transport error, rebuilding broker handle and retrying once:',
          (err as Error)?.message ?? err,
        );
        handle = null;
        return await runOnce(req, true);
      }
    },
  };
}

/**
 * Decide whether an error came from the transport layer (network, broker
 * connection, 5xx) versus a 4xx model error. Only the former is retried.
 */
function isTransportError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  // OpenAI SDK connection/timeout errors don't carry a numeric status.
  const status = (err as { status?: number }).status;
  if (typeof status === 'number') return status >= 500;
  const name = (err as { name?: string }).name ?? '';
  if (/connection|timeout|network|fetch/i.test(name)) return true;
  const code = (err as { code?: string }).code ?? '';
  if (/ECONN|ETIMEDOUT|ENETUNREACH|ENOTFOUND|EAI_AGAIN/i.test(code)) return true;
  const msg = (err as { message?: string }).message ?? '';
  return /network|fetch failed|socket|connect|timeout/i.test(msg);
}

function composePrompt(req: InferenceRequest): string {
  if (!req.context?.length) return req.userPrompt;
  const ctx = req.context
    .map((c) => `## ${c.title} (${c.slug})\n${c.body}`)
    .join('\n\n---\n\n');
  return `Context:\n\n${ctx}\n\n---\n\nQuestion: ${req.userPrompt}`;
}

/**
 * Citation extraction. The brain handler instructs the LLM to emit a final
 * line `Citations: slug-1, slug-2`. We parse that first (high signal). If the
 * LLM ignored the format, fall back to substring matching slugs/titles in the
 * answer body.
 */
function extractCitations(
  answer: string,
  context: Array<{ slug: string; title: string }>,
): string[] {
  const slugSet = new Set(context.map((c) => c.slug.toLowerCase()));
  const validSlugs: string[] = [];

  // 1. Look for the trailing `Citations:` line (case-insensitive). Take the
  //    last match so a stray "citations:" earlier in prose doesn't win.
  const matches = [...answer.matchAll(/citations\s*:\s*([^\n]+)/gi)];
  if (matches.length > 0) {
    const raw = matches[matches.length - 1]![1]!.trim();
    if (raw.toLowerCase() !== 'none') {
      const claimed = raw
        .split(/[,\s]+/)
        .map((s) => s.trim().replace(/^[`'"]+|[`'".,;]+$/g, '').toLowerCase())
        .filter(Boolean);
      for (const c of claimed) {
        if (slugSet.has(c) && !validSlugs.includes(c)) validSlugs.push(c);
      }
    }
    if (validSlugs.length > 0) return validSlugs;
  }

  // 2. Substring fallback — scan the body for slugs and titles.
  const found = new Set<string>();
  for (const c of context) {
    if (answer.includes(c.slug) || answer.includes(c.title)) found.add(c.slug);
  }
  return [...found];
}
