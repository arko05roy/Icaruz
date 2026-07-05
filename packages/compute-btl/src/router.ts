import type { BtlConfig } from './config.js';
import { createBtlInferenceClient } from './inference.js';

export interface RouterCandidate {
  topic: string;
  description: string;
}

export interface RouterChoice {
  topic: string;
  reason: string;
  source: 'btl' | 'fallback';
}

/**
 * Route mixture fan-out via a cheap BTL model call. Output is constrained to
 * known topic slugs so we never hallucinate a discovery shortcut.
 */
export async function pickTopicBtl(opts: {
  prompt: string;
  candidates: RouterCandidate[];
  config: BtlConfig;
}): Promise<RouterChoice> {
  const { prompt, candidates, config } = opts;
  const fallback: RouterChoice = {
    topic: candidates[0]?.topic ?? 'all',
    reason: 'defaulted to broadest shortcut',
    source: 'fallback',
  };
  if (candidates.length === 0) return fallback;

  const validTopics = new Set(candidates.map((c) => c.topic.toLowerCase()));
  const list = candidates.map((c) => `- ${c.topic}: ${c.description}`).join('\n');

  const systemPrompt =
    `You are the Brainpedia orchestrator. Pick ONE discovery shortcut for the inbound prompt.\n\n` +
    `Available shortcuts:\n${list}\n\n` +
    `OUTPUT FORMAT (strictly required):\n` +
    `Line 1: TOPIC: <topic-slug>\n` +
    `Line 2: REASON: <one short sentence>`;

  try {
    const client = createBtlInferenceClient(config);
    const result = await client.query({
      systemPrompt,
      userPrompt: `Inbound prompt:\n${prompt}`,
      model: config.routerModel,
    });
    const parsed = parseRouterOutput(result.answer, validTopics);
    if (parsed) return { ...parsed, source: 'btl' };
    return fallback;
  } catch {
    return fallback;
  }
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
  return { topic, reason: reason.length > 200 ? reason.slice(0, 199) + '…' : reason };
}
