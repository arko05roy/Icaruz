import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { JsonRpcProvider, Wallet, Contract, parseEther } from 'ethers';
import {
  loadEnsConfig,
  createEnsPublicClient,
  resolveBrain,
  parsePriceQuery,
  BRAIN_TEXT_KEYS,
} from '@brainpedia/ens';
import { AxlClient, loadAxlConfig, BRAIN_MCP_SERVICE_NAME } from '@brainpedia/axl';
import { loadZgConfig } from '@brainpedia/storage-0g';

export const queryBrainTool: Tool = {
  name: 'query_brain',
  description:
    'Query a remote Brain. Resolves the target ENS name via @brainpedia/ens, ' +
    'reads brain.* text records to get the iNFT, peer id, and price, calls ' +
    'authorizeUsage on the iNFT (with payment), then sends the prompt over AXL ' +
    'via POST /mcp/{peer_id}/brainpedia.brain.',
  inputSchema: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description:
          'Brain ENS name (e.g., "yudhi.bpedia.eth"). Topic discovery shortcuts ' +
          '(<topic>.discover.<parent>) are not yet handled by this tool.',
      },
      prompt: { type: 'string', description: 'The user\'s question.' },
      ttlSeconds: {
        type: 'number',
        description: 'Seconds the authorization should remain valid (default 900).',
      },
    },
    required: ['target', 'prompt'],
  },
};

const inputSchema = z.object({
  target: z.string().min(3),
  prompt: z.string().min(1),
  ttlSeconds: z.number().int().positive().optional(),
});

const brainAbi = [
  'function authorizeUsage(uint256 tokenId, address agent, uint64 ttlSeconds) payable',
] as const;

export async function handleQueryBrain(args: Record<string, unknown>) {
  const parsed = inputSchema.safeParse(args);
  if (!parsed.success) {
    return errorResp(`query_brain: invalid args — ${parsed.error.message}`);
  }
  const wallet = process.env.ZG_WALLET_PRIVATE_KEY;
  if (!wallet) return errorResp('query_brain: ZG_WALLET_PRIVATE_KEY required');

  const ens = loadEnsConfig();
  const zg = loadZgConfig();
  const axl = loadAxlConfig();

  // 1. Resolve the Brain's ENS records.
  const ensClient = createEnsPublicClient(ens);
  const resolved = await resolveBrain(
    { publicClient: ensClient, config: ens },
    parsed.data.target,
  );

  const peerId = resolved.records.axlPeerId;
  if (!peerId) {
    return errorResp(
      `query_brain: ${parsed.data.target} has no ${BRAIN_TEXT_KEYS.axlPeerId} text record`,
    );
  }
  const inftRef = resolved.records.inft; // "<addr>:<tokenId>"
  if (!inftRef || !inftRef.includes(':')) {
    return errorResp(
      `query_brain: ${parsed.data.target} has no ${BRAIN_TEXT_KEYS.inft} text record`,
    );
  }
  const [inftAddr, tokenIdStr] = inftRef.split(':');
  const tokenId = BigInt(tokenIdStr!);
  const priceWei = parsePriceQuery(resolved.records.priceQuery) ?? 0n;

  // 2. Authorize agent on the iNFT (one tx, payable to Brain owner).
  const provider = new JsonRpcProvider(zg.rpcUrl);
  const signer = new Wallet(wallet, provider);
  const brain = new Contract(inftAddr!, brainAbi, signer) as unknown as {
    authorizeUsage: (
      tokenId: bigint,
      agent: string,
      ttl: bigint,
      overrides: { value: bigint },
    ) => Promise<{ wait: () => Promise<{ hash: string }> }>;
  };
  const ttl = BigInt(parsed.data.ttlSeconds ?? 900);
  const authTx = await brain.authorizeUsage(tokenId, signer.address, ttl, {
    value: priceWei,
  });
  const authReceipt = await authTx.wait();

  // 3. Query the Brain over AXL.
  const client = new AxlClient(axl);
  const res = await client.mcp<{
    answer: string;
    citations: string[];
    confidence: number | null;
    storageRoot: string | null;
  }>(peerId, BRAIN_MCP_SERVICE_NAME, {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'query',
    params: { prompt: parsed.data.prompt },
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            target: resolved.ensName,
            authorize: {
              txHash: authReceipt.hash,
              priceWei: priceWei.toString(),
              ttlSeconds: Number(ttl),
              explorer: `${zg.explorerUrl}/tx/${authReceipt.hash}`,
            },
            response: res.result ?? { error: res.error },
          },
          null,
          2,
        ),
      },
    ],
  };
}

void parseEther; // re-export-only convenience kept for symmetry with finalize-brain

function errorResp(message: string) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}
