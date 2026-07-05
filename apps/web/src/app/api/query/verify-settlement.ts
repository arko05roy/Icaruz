/**
 * Verify that a RoyaltyDistributor settlement tx covers a previously-issued
 * mixture payment plan. Used by the phase-2 unlock path: agent settles, then
 * posts the tx hash; we read the receipt, decode Distributed events, and
 * confirm each (tokenId, amount) pair from the plan was paid.
 */
import { createPublicClient, http, keccak256, toBytes, type Hex } from 'viem';
import { loadZgConfig } from '@brainpedia/storage-0g';

// Distributed(uint256,address,address,uint256,bytes32) — selector for the
// log topic[0]. Indexed: tokenId, brainOwner, payer. Non-indexed: amount, reason.
const DISTRIBUTED_EVENT_TOPIC = keccak256(
  toBytes('Distributed(uint256,address,address,uint256,bytes32)'),
);

export interface VerifyArgs {
  txHash: string;
  expectedDistributor: string;
  expectedSplits: Array<{ inft: string | null; amountWei: string }>;
  /** Block the settler's own receipt reported. The verifier's read RPC may
   *  be a *different node behind the same public LB* than the one the tx was
   *  broadcast to (read-after-write inconsistency). If given, wait until this
   *  read node's head reaches that height before declaring the tx unknown. */
  expectedBlockNumber?: number;
}

export type VerifyResult =
  | { ok: true; payer: string; blockNumber: number }
  | { ok: false; reason: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function verifySettlement(args: VerifyArgs): Promise<VerifyResult> {
  if (!/^0x[a-fA-F0-9]{64}$/.test(args.txHash)) {
    return { ok: false, reason: 'malformed txHash' };
  }
  const zg = loadZgConfig();
  // Explicit per-request timeout + no transport retry inflation: each poll
  // tick is one clean RPC call we fully control the cadence of.
  const client = createPublicClient({
    transport: http(zg.rpcUrl, { timeout: 15_000, retryCount: 0 }),
  });
  const hash = args.txHash as Hex;
  const deadline = Date.now() + 210_000;

  // Stage 1: defeat the public-LB read-after-write race. settle_mixture
  // already mined the tx (it did tx.wait()), but THIS node may lag. Wait
  // until our read node's head reaches the settlement block — once it has,
  // the receipt is guaranteed visible on this node.
  if (typeof args.expectedBlockNumber === 'number' && args.expectedBlockNumber > 0) {
    while (Date.now() < deadline) {
      try {
        const head = await client.getBlockNumber();
        if (Number(head) >= args.expectedBlockNumber) break;
      } catch {
        /* transient LB hiccup — keep polling */
      }
      await sleep(2_000);
    }
  }

  // Stage 2: poll for the receipt. Probe getTransaction too: if the node
  // knows the tx but the receipt is still pending it is definitively
  // propagating (not "unknown"), so keep waiting through the full window.
  let receipt;
  while (true) {
    try {
      receipt = await client.getTransactionReceipt({ hash });
      break;
    } catch (err) {
      const msg = (err as Error).message ?? '';
      const transient =
        /not found|not be found|could not be found|timed out|took too long|fetch failed|ECONNRESET|503|502/i.test(
          msg,
        );
      if (!transient) return { ok: false, reason: `rpc error: ${msg}` };
      if (Date.now() >= deadline) {
        let txKnown = false;
        try {
          await client.getTransaction({ hash });
          txKnown = true;
        } catch {
          /* still unknown to this node */
        }
        let verifierChainId: number | string = 'unknown';
        try {
          verifierChainId = await client.getChainId();
        } catch {
          /* ignore */
        }
        return {
          ok: false,
          reason: txKnown
            ? `settlement tx is on chain ${verifierChainId} but its receipt has not propagated to the verifier RPC node yet — retry the unlock (no re-payment needed)`
            : `settlement tx not found on the verifier's chain (chainId ${verifierChainId}, RPC ${zg.rpcUrl}). If your settler used a different ZG_RPC_URL/ZG_CHAIN_ID the payment went to another network. Confirm the tx exists on chainId ${verifierChainId}, then retry the unlock (no re-payment needed).`,
        };
      }
      await sleep(2_000);
    }
  }
  if (receipt.status !== 'success') {
    return { ok: false, reason: `tx reverted (status=${receipt.status})` };
  }
  const to = (receipt.to ?? '').toLowerCase();
  if (to !== args.expectedDistributor.toLowerCase()) {
    return {
      ok: false,
      reason: `tx to ${to} does not match RoyaltyDistributor ${args.expectedDistributor.toLowerCase()}`,
    };
  }

  // Decode Distributed events. amount is the first non-indexed param, lives
  // in data[0:32].
  const paid = new Map<string, bigint>();
  let payer = '';
  for (const log of receipt.logs) {
    if (log.topics[0] !== DISTRIBUTED_EVENT_TOPIC) continue;
    const tokenIdTopic = log.topics[1];
    if (!tokenIdTopic) continue;
    const tokenId = BigInt(tokenIdTopic).toString();
    const amount = BigInt('0x' + log.data.slice(2, 66));
    paid.set(tokenId, (paid.get(tokenId) ?? 0n) + amount);
    if (!payer && log.topics[3]) {
      payer = '0x' + log.topics[3].slice(-40);
    }
  }

  for (const split of args.expectedSplits) {
    if (!split.inft) continue;
    const owed = BigInt(split.amountWei);
    if (owed === 0n) continue;
    const tokenId = split.inft.split(':')[1];
    if (!tokenId) continue;
    const got = paid.get(tokenId) ?? 0n;
    if (got < owed) {
      return {
        ok: false,
        reason: `tokenId ${tokenId} underpaid: owed ${owed} wei, paid ${got} wei`,
      };
    }
  }

  return { ok: true, payer, blockNumber: Number(receipt.blockNumber) };
}
