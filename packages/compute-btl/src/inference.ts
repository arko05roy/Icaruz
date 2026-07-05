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

export function createBtlInferenceClient(cfg: BtlConfig): BtlInferenceClient {
  const openai = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl });

  return {
    async query(req) {
      const userContent = composeRagUserBlock(req.userPrompt, req.context ?? []);
      const model = req.model ?? cfg.queryModel;

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
      const btl = parseBtlHeaders(response.headers as unknown as Headers);

      return {
        answer,
        citations: extractCitations(answer, req.context ?? []),
        confidence: null,
        usage: {
          promptTokens: completion.usage?.prompt_tokens ?? 0,
          completionTokens: completion.usage?.completion_tokens ?? 0,
        },
        btl,
      };
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
