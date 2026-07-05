import type { Address } from 'viem';
import { getTextRecord } from '@ensdomains/ensjs/public';
import { BRAIN_TEXT_KEYS, type BrainTextRecords, type ResolvedBrain } from './types.js';
import type { EnsClients } from './client.js';
import { subnameRegistrarAbi } from './abi.js';

const STANDARD_KEYS = ['description', 'avatar', 'url'] as const;

/**
 * Read every Brainpedia-relevant text record off an ENS name.
 *
 * No values are baked in — the keys themselves are well-known (defined
 * once in types.ts) and the addresses are looked up at runtime via
 * @ensdomains/ensjs.
 */
export async function readBrainRecords(
  clients: EnsClients,
  ensName: string,
): Promise<BrainTextRecords> {
  const out: BrainTextRecords = {};
  const reads: Array<Promise<void>> = [];

  for (const key of STANDARD_KEYS) {
    reads.push(
      getTextRecord(clients.publicClient, { name: ensName, key }).then((v) => {
        if (v) out[key] = v;
      }),
    );
  }

  reads.push(
    getTextRecord(clients.publicClient, { name: ensName, key: BRAIN_TEXT_KEYS.inft }).then(
      (v) => {
        if (v) out.inft = v;
      },
    ),
    getTextRecord(clients.publicClient, {
      name: ensName,
      key: BRAIN_TEXT_KEYS.storageRoot,
    }).then((v) => {
      if (v) out.storageRoot = v;
    }),
    getTextRecord(clients.publicClient, {
      name: ensName,
      key: BRAIN_TEXT_KEYS.axlPeerId,
    }).then((v) => {
      if (v) out.axlPeerId = v;
    }),
    getTextRecord(clients.publicClient, { name: ensName, key: BRAIN_TEXT_KEYS.specialty }).then(
      (v) => {
        if (v) out.specialty = v;
      },
    ),
    getTextRecord(clients.publicClient, {
      name: ensName,
      key: BRAIN_TEXT_KEYS.priceQuery,
    }).then((v) => {
      if (v) out.priceQuery = v;
    }),
    getTextRecord(clients.publicClient, {
      name: ensName,
      key: BRAIN_TEXT_KEYS.computeUrl,
    }).then((v) => {
      if (v) out.computeUrl = v;
    }),
  );

  await Promise.all(reads);
  return out;
}

export async function resolveBrain(
  clients: EnsClients,
  ensName: string,
): Promise<ResolvedBrain> {
  const records = await readBrainRecords(clients, ensName);
  // owner lookup happens via NameWrapper or Registry — wired Day 3.
  const owner: Address | null = null;
  return { ensName, owner, records };
}

/**
 * Write all Brain text records in a single batched call to our
 * SubnameRegistrar.setTextRecords. Caller must own the subname (the
 * registrar enforces this); the wallet account must match `ownerOfLabel`.
 */
export async function writeBrainRecords(
  clients: EnsClients,
  label: string,
  records: BrainTextRecords,
): Promise<{ txHash: `0x${string}` }> {
  const { keys, values } = brainRecordsToArrays(records);
  if (keys.length === 0) throw new Error('writeBrainRecords: no records to write');
  if (!clients.walletClient?.account) {
    throw new Error('writeBrainRecords: walletClient with account is required');
  }

  const txHash = await clients.walletClient.writeContract({
    address: clients.config.subnameRegistrarAddress,
    abi: subnameRegistrarAbi,
    functionName: 'setTextRecords',
    args: [label, keys, values],
    account: clients.walletClient.account,
    chain: clients.walletClient.chain ?? null,
  });
  await clients.publicClient.waitForTransactionReceipt({ hash: txHash });
  return { txHash };
}

function brainRecordsToArrays(records: BrainTextRecords): { keys: string[]; values: string[] } {
  const keys: string[] = [];
  const values: string[] = [];
  const push = (k: string, v: string | undefined) => {
    if (v !== undefined && v.length > 0) {
      keys.push(k);
      values.push(v);
    }
  };
  push('description', records.description);
  push('avatar', records.avatar);
  push('url', records.url);
  push(BRAIN_TEXT_KEYS.inft, records.inft);
  push(BRAIN_TEXT_KEYS.storageRoot, records.storageRoot);
  push(BRAIN_TEXT_KEYS.axlPeerId, records.axlPeerId);
  push(BRAIN_TEXT_KEYS.specialty, records.specialty);
  push(BRAIN_TEXT_KEYS.priceQuery, records.priceQuery);
  push(BRAIN_TEXT_KEYS.computeUrl, records.computeUrl);
  return { keys, values };
}
