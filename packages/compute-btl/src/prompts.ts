/** Question fluff stripped. */
const QUESTION_STOP = new Set([
  'what',
  'how',
  'why',
  'when',
  'where',
  'who',
  'are',
  'is',
  'the',
  'this',
  'that',
  'does',
  'do',
  'can',
  'could',
  'would',
  'should',
  'explain',
  'describe',
  'tell',
  'about',
  'define',
  'meaning',
  'mean',
]);

/** Salient content tokens for retrieval overlap + repeat-cache keys. */
export function contentTokens(prompt: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of prompt.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)) {
    const t = raw.trim();
    if (t.length < 4 || QUESTION_STOP.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.sort();
}

export function promptCacheKey(prompt: string): string {
  const tokens = contentTokens(prompt);
  return tokens.length > 0 ? tokens.join('|') : prompt.trim().toLowerCase();
}

export function composeContextBlock(
  context: Array<{ slug: string; title: string; body: string }>,
): string {
  if (!context.length) return '';
  return context
    .map((c) => `## ${c.title} (${c.slug})\n${c.body}`)
    .join('\n\n---\n\n');
}

/**
 * BTL Runtime's biggest win on agent workloads is prefix cache: stable
 * system + context head, volatile user tail. Keep that shape on every call.
 */
export function buildBrainSystemPrompt(ensName: string, specialty: string): string {
  return (
    `You are ${ensName}, a specialised Brain in the Brainpedia network. ` +
    `Your specialty: ${specialty}. Answer ONLY from the provided context articles. ` +
    `If the context doesn't contain the answer, say so explicitly. Do not hallucinate.\n\n` +
    `OUTPUT FORMAT (strictly required):\n` +
    `1. Your answer in plain prose, 2-5 sentences.\n` +
    `2. A blank line.\n` +
    `3. A single final line in this exact format:\n` +
    `   Citations: slug-1, slug-2, slug-3\n` +
    `Use ONLY the slugs from the context (each article header shows "(slug)"). ` +
    `If you used no context, output "Citations: none".`
  );
}

export function composeRagUserBlock(
  userPrompt: string,
  context: Array<{ slug: string; title: string; body: string }>,
): string {
  const ctx = composeContextBlock(context);
  if (!ctx) return userPrompt;
  // Context block first (stable across similar queries on same brain) then question.
  return `Context:\n\n${ctx}\n\n---\n\nQuestion: ${userPrompt}`;
}

// ponytail: self-check — tensor phrasings must share a cache key.
if (promptCacheKey('what are tensors') !== promptCacheKey('Explain tensors')) {
  throw new Error('promptCacheKey: tensor phrasing aliases diverged');
}
