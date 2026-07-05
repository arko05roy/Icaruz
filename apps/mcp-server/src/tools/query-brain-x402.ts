import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { x402Client, x402HTTPClient } from '@x402/core/client';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';

export const queryBrainX402Tool: Tool = {
  name: 'query_brain_x402',
  description:
    'Query a specialist brain on Icaruz with automatic x402 micropayment. ' +
    'POSTs to /api/brain; on HTTP 402 signs USDC payment with ZG_WALLET_PRIVATE_KEY ' +
    'and retries. Use for priced creator brains. Demo brains are free when the ' +
    'server has X402_SKIP_PAYMENT=true.',
  inputSchema: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description: 'Brain id (e.g. yudhi, karpathy, or a creator brain id).',
      },
      prompt: { type: 'string', description: "The user's question." },
      apiUrl: {
        type: 'string',
        description:
          'Icaruz web base URL. Defaults to $ICARUZ_API_URL or http://localhost:3000.',
      },
    },
    required: ['target', 'prompt'],
  },
};

const inputSchema = z.object({
  target: z.string().min(1),
  prompt: z.string().min(1),
  apiUrl: z.string().url().optional(),
});

function defaultApiUrl(): string {
  return (
    process.env.ICARUZ_API_URL?.trim() ||
    process.env.BRAINPEDIA_API_URL?.trim() ||
    'http://localhost:3000'
  );
}

function buildX402HttpClient(privateKey: `0x${string}`): x402HTTPClient {
  const account = privateKeyToAccount(privateKey);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer: account });
  return new x402HTTPClient(client);
}

export async function handleQueryBrainX402(args: Record<string, unknown>) {
  const parsed = inputSchema.safeParse(args);
  if (!parsed.success) {
    return errorResp(`query_brain_x402: invalid args — ${parsed.error.message}`);
  }

  const wallet = process.env.ZG_WALLET_PRIVATE_KEY;
  if (!wallet) {
    return errorResp('query_brain_x402: ZG_WALLET_PRIVATE_KEY required for x402 payments');
  }

  const apiUrl = (parsed.data.apiUrl ?? defaultApiUrl()).replace(/\/+$/, '');
  const endpoint = `${apiUrl}/api/brain`;
  const body = JSON.stringify({ prompt: parsed.data.prompt, target: parsed.data.target });
  const baseHeaders = { 'content-type': 'application/json' };

  const http = buildX402HttpClient(wallet as `0x${string}`);

  let res = await fetch(endpoint, { method: 'POST', headers: baseHeaders, body });

  if (res.status === 402) {
    const errBody = await res.json().catch(() => ({}));
    const paymentRequired = http.getPaymentRequiredResponse(
      (name) => res.headers.get(name),
      errBody,
    );
    const payload = await http.createPaymentPayload(paymentRequired);
    const payHeaders = http.encodePaymentSignatureHeader(payload);
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { ...baseHeaders, ...payHeaders },
      body,
    });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return errorResp(
      `query_brain_x402: ${res.status} — ${typeof data === 'object' && data && 'error' in data ? String((data as { error: unknown }).error) : res.statusText}`,
    );
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            target: parsed.data.target,
            status: res.status,
            paymentSettled: res.status === 200,
            response: data,
          },
          null,
          2,
        ),
      },
    ],
  };
}

function errorResp(message: string) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}
