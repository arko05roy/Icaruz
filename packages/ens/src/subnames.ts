import type { Address, Hash, WalletClient } from 'viem';
import { keccak256, stringToBytes, namehash } from 'viem';
import type { EnsClients } from './client.js';
import type { BrainTextRecords } from './types.js';
import { BRAIN_TEXT_KEYS } from './types.js';
import { subnameRegistrarAbi } from './abi.js';

export interface RegisterSubnameInput {
  label: string;
  owner: Address;
  records?: BrainTextRecords;
}

export interface RegisterSubnameResult {
  fullName: string;
  registerTxHash: Hash;
  textRecordsTxHash: Hash | null;
}

/**
 * Register `<label>.<parentName>` (e.g., yudhi.brainpedia.eth) via our
 * deployed SubnameRegistrar, then optionally batch-write text records.
 *
 * Both contract addresses come from env (EnsConfig) — no hardcoding.
 */
export async function registerSubname(
  clients: EnsClients,
  input: RegisterSubnameInput,
): Promise<RegisterSubnameResult> {
  if (!clients.walletClient || !clients.walletClient.account) {
    throw new Error('registerSubname: walletClient with account is required');
  }
  const wallet: WalletClient = clients.walletClient;
  const { config, publicClient } = clients;
  const fullName = `${input.label}.${config.parentName}`;

  const registerTxHash = await wallet.writeContract({
    address: config.subnameRegistrarAddress,
    abi: subnameRegistrarAbi,
    functionName: 'register',
    args: [input.label, input.owner],
    account: wallet.account!,
    chain: wallet.chain ?? null,
  });
  await publicClient.waitForTransactionReceipt({ hash: registerTxHash });

  let textRecordsTxHash: Hash | null = null;
  if (input.records && Object.keys(input.records).length > 0) {
    const { keys, values } = recordsToArrays(input.records);
    if (keys.length > 0) {
      textRecordsTxHash = await wallet.writeContract({
        address: config.subnameRegistrarAddress,
        abi: subnameRegistrarAbi,
        functionName: 'setTextRecords',
        args: [input.label, keys, values],
        account: wallet.account!,
        chain: wallet.chain ?? null,
      });
      await publicClient.waitForTransactionReceipt({ hash: textRecordsTxHash });
    }
  }

  return { fullName, registerTxHash, textRecordsTxHash };
}

/**
 * Compute the keccak256 hash of the label — useful for callers that want to
 * check `ownerOfLabel(labelHash)` directly.
 */
export function labelHash(label: string): Hash {
  return keccak256(stringToBytes(label));
}

/** ENS namehash of a Brain's full name. Re-exported for convenience. */
export function brainNamehash(label: string, parentName: string): Hash {
  return namehash(`${label}.${parentName}`);
}

function recordsToArrays(records: BrainTextRecords): { keys: string[]; values: string[] } {
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
