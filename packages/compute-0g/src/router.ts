import type { ComputeConfig } from './config.js';
import { createBrainInferenceClient } from './inference.js';

export interface RouterCandidate {
  /** Topic slug used to look up `<topic>.discover.<parent>`. */
  topic: string;
  /** One-line description of what this discovery shortcut covers. */
  description: string;
}

export interface RouterChoice {
  topic: string;
  reason: string;
  /** 'llm' = picked by the orchestrator LLM. 'fallback' = compute unavailable
   *  or response unparseable; defaulted to the first candidate (typically `all`). */
  source: 'llm' | 'fallback';
}

const ROUTER_SPECIALTY = 'orchestrator routing — pick the best discovery shortcut for an inbound prompt';
const ROUTER_ENS_NAME = 'router.bpedia.eth';

/**
 * One-shot topic classifier. Calls the same TEE-attested compute endpoint the
 * brains use, with a short system prompt that constrains the output to a
 * single topic slug from `candidates`. The verification step is best-effort —
 * for routing we accept whatever the model returns even if attestation fails.
 *
 * Falls back to candidates[0] (typically `all`) if the response can't be
 * parsed or compute isn't configured. The fallback path keeps the API working
 * without a wallet key on the web service.
 */
export async function pickTopic(opts: {
  prompt: string;
  candidates: RouterCandidate[];
  signerPrivateKey?: string;
  config?: ComputeConfig;
}): Promise<RouterChoice> {
  const { prompt, candidates } = opts;
  if (candidates.length === 0) {
    throw new Error('pickTopic: candidates is empty');
  }
  const fallback: RouterChoice = {
    topic: candidates[0]!.topic,
    reason: 'compute not configured; defaulted to the broadest shortcut',
    source: 'fallback',
  };

  if (!opts.signerPrivateKey || !opts.config?.providerAddress) {
    return fallback;
  }

  const validTopics = new Set(candidates.map((c) => c.topic.toLowerCase()));
  const list = candidates.map((c) => `- ${c.topic}: ${c.description}`).join('\n');

  const systemPrompt =
    `You are the Brainpedia orchestrator. Given an inbound prompt, decide which ` +
    `discovery shortcut should handle it. Each shortcut maps to a set of ` +
    `specialised Brains.\n\n` +
    `Available shortcuts:\n${list}\n\n` +
    `OUTPUT FORMAT (strictly required):\n` +
    `Line 1: TOPIC: <topic-slug>\n` +
    `Line 2: REASON: <one short sentence>\n` +
    `Pick exactly one topic from the list above. If the prompt clearly spans ` +
    `multiple specialties or none, pick the broadest shortcut (usually "all").`;

  try {
    const client = createBrainInferenceClient(opts.config, opts.signerPrivateKey);
    const result = await client.query({
      systemPrompt,
      userPrompt: `Inbound prompt:\n${prompt}`,
    });
    const parsed = parseRouterOutput(result.answer, validTopics);
    if (parsed) return { ...parsed, source: 'llm' };
    return {
      topic: fallback.topic,
      reason: `routed to "${fallback.topic}" (default shortcut)`,
      source: 'fallback',
    };
  } catch {
    return {
      topic: fallback.topic,
      reason: `routed to "${fallback.topic}" (default shortcut)`,
      source: 'fallback',
    };
  }
  void ROUTER_SPECIALTY;
  void ROUTER_ENS_NAME;
}

function parseRouterOutput(
  answer: string,
  validTopics: Set<string>,
): { topic: string; reason: string } | null {
  const topicMatch = answer.match(/topic\s*:\s*([a-z0-9-]+)/i);
  if (!topicMatch) return null;
  const topic = topicMatch[1]!.toLowerCase();
  if (!validTopics.has(topic)) return null;
  const reasonMatch = answer.match(/reason\s*:\s*([^\n]+)/i);
  const reason = reasonMatch ? reasonMatch[1]!.trim() : 'no reason provided';
  return { topic, reason: truncate(reason, 200) };
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
