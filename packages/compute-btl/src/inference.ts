import OpenAI from 'openai';
import type { BtlConfig } from './config.js';
import { parseBtlHeaders, type BtlEconomics } from './economics.js';
import { buildBrainSystemPrompt, composeRagUserBlock } from './prompts.js';

export interface BtlInferenceRequest {
  systemPrompt: string;
  userPrompt: string;
  context?: Array<{ slug: string; title: string; body: string }>;
  model?: string;
}

export interface BtlInferenceResponse {
  answer: string;
  citations: string[];
  confidence: number | null;
  usage: { promptTokens: number; completionTokens: number };
  btl: BtlEconomics;
}

export interface BtlInferenceClient {
  query(req: BtlInferenceRequest): Promise<BtlInferenceResponse>;
}

// ponytail: in-proc exact-repeat cache so re-runs of the same RAG payload show savings.
// Ceiling: single Node process; upgrade path is BTL upstream prefix/exact cache only.
const REPEAT_TTL_MS = 30 * 60 * 1000;
const repeatCache = new Map<string, { at: number; result: BtlInferenceResponse }>();

function repeatCacheKey(model: string, systemPrompt: string, userContent: string): string {
  return `${model}\0${systemPrompt}\0${userContent}`;
}

export function createBtlInferenceClient(cfg: BtlConfig): BtlInferenceClient {
  const openai = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl });

  return {
    async query(req) {
      const userContent = composeRagUserBlock(req.userPrompt, req.context ?? []);
      const model = req.model ?? cfg.queryModel;
      const key = repeatCacheKey(model, req.systemPrompt, userContent);
      const cached = repeatCache.get(key);
      if (cached && Date.now() - cached.at < REPEAT_TTL_MS) {
        const prev = cached.result.btl;
        const charge = prev.customerCharge ?? 0;
        const bench = prev.benchmarkCost ?? charge;
        return {
          ...cached.result,
          btl: {
            requestId: prev.requestId,
            cacheTier: prev.cacheHit ? (prev.cacheTier ?? 'exact_repeat') : 'exact_repeat',
            benchmarkCost: bench,
            customerCharge: 0,
            saved: charge,
            cacheHit: true,
          },
        };
      }

      const { data: completion, response } = await openai.chat.completions
        .create(
          {
            model,
            messages: [
              { role: 'system', content: req.systemPrompt },
              { role: 'user', content: userContent },
            ],
          },
          { headers: { Authorization: `Bearer ${cfg.apiKey}` } },
        )
        .withResponse();

      const answer = completion.choices[0]?.message.content ?? '';
      const btl = parseBtlHeaders(response.headers);

      const result: BtlInferenceResponse = {
        answer,
        citations: extractCitations(answer, req.context ?? []),
        confidence: null,
        usage: {
          promptTokens: completion.usage?.prompt_tokens ?? 0,
          completionTokens: completion.usage?.completion_tokens ?? 0,
        },
        btl,
      };
      repeatCache.set(key, { at: Date.now(), result });
      return result;
    },
  };
}

/** Brain handler convenience: same surface as legacy compute client. */
export function createBrainBtlClient(cfg: BtlConfig): {
  query(req: {
    systemPrompt: string;
    userPrompt: string;
    context?: Array<{ slug: string; title: string; body: string }>;
  }): Promise<BtlInferenceResponse & { verified: boolean }>;
} {
  const inner = createBtlInferenceClient(cfg);
  return {
    async query(req) {
      const result = await inner.query(req);
      return { ...result, verified: result.btl.cacheHit || Boolean(result.btl.requestId) };
    },
  };
}

export { buildBrainSystemPrompt };

function extractCitations(
  answer: string,
  context: Array<{ slug: string; title: string }>,
): string[] {
  const slugSet = new Set(context.map((c) => c.slug.toLowerCase()));
  const validSlugs: string[] = [];

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

  const found = new Set<string>();
  for (const c of context) {
    if (answer.includes(c.slug) || answer.includes(c.title)) found.add(c.slug);
  }
  return [...found];
}
