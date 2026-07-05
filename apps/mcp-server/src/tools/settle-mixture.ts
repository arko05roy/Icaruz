import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  id as ethersId,
  type Log,
} from 'ethers';
import { loadZgConfig } from '@brainpedia/storage-0g';

/**
 * Phase 1.5 + Phase 2 of the pay-to-read mixture flow.
 *
 * Takes a sessionId returned by `query_mixture`, looks up the cached payment
 * plan from /api/query?mode=mixture&peek=true (or just trusts the agent to
 * also pass the explicit splits — see args), settles the plan in one
 * RoyaltyDistributor.distribute tx using the agent's wallet, then posts
 * `{sessionId, txHash}` back to /api/query?mode=mixture which verifies the
 * Distributed events match the cached plan and releases the synthesis +
 * full per-brain answers.
 *
 * The agent is REQUIRED to ask the user for confirmation before calling this
 * tool — see the matching warning in `query_mixture`.
 */
export const settleMixtureTool: Tool = {
  name: 'settle_mixture',
  description:
    'PHASE 2 of pay-to-read mixture query. Settles the payment plan returned ' +
    'by query_mixture in a single RoyaltyDistributor.distribute tx, then ' +
    'unlocks the cached synthesis. Only call this AFTER the user has ' +
    'explicitly confirmed they want to pay the total OG amount shown in the ' +
    "phase-1 plan. The agent's wallet (ZG_WALLET_PRIVATE_KEY) signs and pays. " +
    'RECOVERY: if a settlement tx already paid but the unlock failed (e.g. ' +
    '402 "not yet confirmed"), call this AGAIN with the SAME sessionId and ' +
    'pass that prior txHash in the `txHash` arg — it re-verifies and unlocks ' +
    'at ZERO cost and does NOT broadcast another payment. Never re-call ' +
    'without txHash to recover a failed unlock; that double-pays.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Opaque session handle returned by query_mixture (e.g. "mix_abc...").',
      },
      payments: {
        type: 'array',
        description:
          'The payments[] array from the query_mixture response. Each item ' +
          'must include `inft` (format "<addr>:<tokenId>") and `amountWei`. ' +
          'Used to construct the RoyaltyDistributor.distribute(tokenIds, amounts) call.',
        items: {
          type: 'object',
          properties: {
            inft: { type: ['string', 'null'] },
            amountWei: { type: 'string' },
          },
          required: ['inft', 'amountWei'],
        },
      },
      distributor: {
        type: 'string',
        description:
          'RoyaltyDistributor contract address from the query_mixture response. ' +
          'Used as the tx target.',
      },
      reason: {
        type: 'string',
        description:
          "Optional human-readable settlement reason (turned into the tx's ".concat(
            'bytes32 reason via keccak256). Defaults to "mixture-settle".',
          ),
      },
      txHash: {
        type: 'string',
        description:
          'RECOVERY / VERIFY-ONLY. Hash of a settlement tx that ALREADY paid ' +
          'this session. If set, this tool does NOT broadcast a new payment — ' +
          'it only re-posts {sessionId, txHash} to the unlock endpoint to ' +
          'verify and release the synthesis at zero cost. Use this after a ' +
          'failed unlock instead of re-calling without it (which double-pays).',
      },
      apiUrl: {
        type: 'string',
        description:
          'Base URL of the Brainpedia web service. Defaults to ' +
          '$BRAINPEDIA_API_URL or https://brainpedia.up.railway.app.',
      },
    },
    required: ['sessionId'],
  },
};

const inputSchema = z.object({
  sessionId: z.string().min(1),
  payments: z
    .array(
      z.object({
        inft: z.string().nullable(),
        amountWei: z.string().regex(/^\d+$/),
      }),
    )
    .min(1)
    .optional(),
  distributor: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  reason: z.string().optional(),
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'txHash must be a 0x-prefixed 32-byte hash')
    .optional(),
  apiUrl: z.string().url().optional(),
});

const ROYALTY_DISTRIBUTOR_ABI = [
  'function distribute(uint256[] tokenIds, uint256[] amounts, bytes32 reason) payable',
  'event Distributed(uint256 indexed tokenId, address indexed brainOwner, address indexed payer, uint256 amount, bytes32 reason)',
];
const DISTRIBUTED_EVENT_TOPIC = ethersId(
  'Distributed(uint256,address,address,uint256,bytes32)',
);

export async function handleSettleMixture(args: Record<string, unknown>) {
  const parsed = inputSchema.safeParse(args);
  if (!parsed.success) {
    return errorResp(`settle_mixture: invalid args — ${parsed.error.message}`);
  }
  const { sessionId } = parsed.data;
  const apiUrl =
    parsed.data.apiUrl ??
    process.env.BRAINPEDIA_API_URL ??
    'https://brainpedia.up.railway.app';
  const zg = loadZgConfig();

  let txHash: string;
  let total = 0n;
  let distributedEvents: Array<{ tokenId: string; brainOwner: string }> = [];
  let settlementBlock: number | undefined;
  const verifyOnly = Boolean(parsed.data.txHash);

  if (verifyOnly) {
    // RECOVERY / VERIFY-ONLY: a prior tx already paid this session. Do NOT
    // broadcast anything — just re-post {sessionId, txHash} so the server
    // re-verifies (or returns its idempotent cached unlock). Zero cost.
    txHash = parsed.data.txHash!;
  } else {
    const wallet = process.env.ZG_WALLET_PRIVATE_KEY;
    if (!wallet) {
      return errorResp('settle_mixture: ZG_WALLET_PRIVATE_KEY required to sign settlement tx');
    }
    if (!parsed.data.distributor) {
      return errorResp('settle_mixture: distributor is required to broadcast a new settlement (to recover an already-paid session instead, pass txHash and omit payments/distributor)');
    }
    if (!parsed.data.payments) {
      return errorResp('settle_mixture: payments[] is required to broadcast a new settlement (to recover an already-paid session instead, pass txHash and omit payments/distributor)');
    }
    const settleable = parsed.data.payments.filter(
      (p) => p.inft && BigInt(p.amountWei) > 0n,
    );
    if (settleable.length === 0) {
      return errorResp('settle_mixture: no settleable payments (each split needs both an inft and a non-zero amountWei)');
    }

    const tokenIds = settleable.map((p) => BigInt(p.inft!.split(':')[1]!));
    const amounts = settleable.map((p) => BigInt(p.amountWei));
    total = amounts.reduce((acc, a) => acc + a, 0n);
    const reasonHash = ethersId(parsed.data.reason ?? `mixture-settle:${sessionId}`);
    try {
      const provider = new JsonRpcProvider(zg.rpcUrl);

      // HARD CHAIN GUARD. The verifier checks the configured 0G mainnet RPC.
      // If THIS provider is a different network (stale/testnet ZG_RPC_URL,
      // wrong ZG_CHAIN_ID), a settlement here pays real value on a chain the
      // verifier never inspects → silent unrecoverable burn. Refuse to
      // broadcast and say exactly which RPC/chain is wrong, BEFORE any spend.
      const net = await provider.getNetwork();
      const liveChainId = Number(net.chainId);
      if (liveChainId !== zg.chainId) {
        return errorResp(
          `settle_mixture: REFUSING to pay — RPC/chain mismatch. ZG_RPC_URL ${zg.rpcUrl} ` +
            `is chainId ${liveChainId}, but ZG_CHAIN_ID is ${zg.chainId}. The unlock ` +
            `verifier only checks chainId ${zg.chainId}, so a payment here would be ` +
            `lost. Fix ZG_RPC_URL to a chainId-${zg.chainId} 0G endpoint (mainnet: ` +
            `https://evmrpc.0g.ai, ZG_CHAIN_ID=16661) and retry. No funds were spent.`,
        );
      }
      if (zg.chainId !== 16661) {
        return errorResp(
          `settle_mixture: REFUSING to pay — ZG_CHAIN_ID is ${zg.chainId}, not 0G ` +
            `mainnet (16661). The Brains, RoyaltyDistributor, and the web verifier all ` +
            `live on 16661. Set ZG_CHAIN_ID=16661 and ZG_RPC_URL=https://evmrpc.0g.ai. ` +
            `No funds were spent.`,
        );
      }

      const signer = new Wallet(wallet, provider);
      const contract = new Contract(parsed.data.distributor, ROYALTY_DISTRIBUTOR_ABI, signer) as unknown as {
        distribute: (
          tokenIds: bigint[],
          amounts: bigint[],
          reason: string,
          overrides: { value: bigint },
        ) => Promise<{ wait: () => Promise<{ hash: string; blockNumber: number; status: number | null; logs: Log[] }> }>;
      };
      const tx = await contract.distribute(tokenIds, amounts, reasonHash, { value: total });
      const rcpt = await tx.wait();
      // ethers v6 tx.wait() resolves even on revert (status 0) — guard it,
      // otherwise we'd post a reverted hash to unlock and 402 forever.
      if (rcpt.status === 0) {
        return errorResp(
          `settle_mixture: settlement tx ${rcpt.hash} REVERTED on chain ${liveChainId}. ` +
            `No royalties were paid. Re-check the payments[]/distributor from the ` +
            `query_mixture response and retry.`,
        );
      }
      txHash = rcpt.hash;
      settlementBlock = rcpt.blockNumber;
      distributedEvents = rcpt.logs
        .filter((l) => l.topics[0] === DISTRIBUTED_EVENT_TOPIC)
        .map((e) => ({
          tokenId: BigInt(e.topics[1]!).toString(),
          brainOwner: '0x' + (e.topics[2]?.slice(-40) ?? ''),
        }));
    } catch (err) {
      return errorResp(`settle_mixture: settlement tx failed: ${(err as Error).message}`);
    }
  }

  // Phase-2 unlock. Server is idempotent: a re-claim of an already-settled
  // session returns the cached answer free. settlementBlock lets the verifier
  // wait for its read RPC node to catch up (public-LB read-after-write race).
  const recoveryHint = verifyOnly
    ? ''
    : ` The payment IS on chain (tx ${txHash}). Recover the answer at ZERO cost: re-call settle_mixture with sessionId="${sessionId}" and txHash="${txHash}" (omit payments/distributor). Do NOT pay again.`;
  let unlocked: Record<string, unknown>;
  try {
    const r = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/query?mode=mixture`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        txHash,
        ...(settlementBlock ? { settlementBlock } : {}),
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return errorResp(
        `settle_mixture: ${verifyOnly ? 'verify-only ' : ''}unlock failed (${r.status}): ${text.slice(0, 300)}.${recoveryHint}`,
      );
    }
    unlocked = (await r.json()) as Record<string, unknown>;
  } catch (err) {
    return errorResp(`settle_mixture: cannot reach unlock endpoint: ${(err as Error).message}.${recoveryHint}`);
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            settlement: {
              txHash,
              mode: verifyOnly ? 'verify-only (no new payment broadcast)' : 'paid',
              rpc: zg.rpcUrl,
              chainId: zg.chainId,
              explorer: `${zg.explorerUrl}/tx/${txHash}`,
              totalWei: total.toString(),
              totalOg: weiToOg(total),
              distributedCount: distributedEvents.length,
              distributed: distributedEvents,
            },
            unlocked,
          },
          null,
          2,
        ),
      },
    ],
  };
}

function weiToOg(wei: bigint): string {
  const ether = wei / 10n ** 18n;
  const frac = wei % 10n ** 18n;
  if (frac === 0n) return `${ether} OG`;
  const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '');
  return `${ether}.${fracStr} OG`;
}

function errorResp(message: string) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}
