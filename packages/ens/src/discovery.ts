import { getTextRecord } from '@ensdomains/ensjs/public';
import { namehash, type Hex, type WalletClient } from 'viem';
import type { EnsClients } from './client.js';
import { resolveBrain } from './text-records.js';
import type { ResolvedBrain } from './types.js';

/**
 * Sepolia ENS Public Resolver. Hardcoded because Brainpedia is sepolia-only;
 * if we ever extend to mainnet, plumb this through EnsConfig.
 */
const PUBLIC_RESOLVER_SEPOLIA = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5' as const;
const SET_TEXT_ABI = [
  {
    type: 'function',
    name: 'setText',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
    ],
    outputs: [],
  },
] as const;

/** Text record key on the discovery shortcut whose value is a list of brain ENS names. */
export const DISCOVERY_BRAINS_KEY = 'brainpedia.brains';

/**
 * Topic discovery — `<topic>.discover.<parentName>` resolves (via a curated
 * text record list, or a content hash) to a list of Brain ENS names.
 *
 * Example: `defi.discover.brainpedia.eth` → ["yudhi.brainpedia.eth",
 *                                             "vitalik.brainpedia.eth", ...]
 *
 * For the demo this list lives in the Brain's text record `brainpedia.brains`
 * on the discovery shortcut — easy to update without redeploying.
 */
export function discoveryNameForTopic(topic: string, parentName: string): string {
  const safe = topic.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `${safe}.discover.${parentName}`;
}

/**
 * Read the list of brain ENS names from a discovery shortcut's text record.
 * Splits on newlines and commas, trims, and dedupes. Returns [] on miss.
 */
export async function listBrainsForTopic(
  clients: EnsClients,
  topic: string,
): Promise<string[]> {
  const shortcut = discoveryNameForTopic(topic, clients.config.parentName);
  // ensjs typing for getTextRecord wants ClientWithEns; our EnsPublicClient is the
  // intersection but the action's generic is fussy — cast at the call site only.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await getTextRecord(clients.publicClient as any, {
    name: shortcut,
    key: DISCOVERY_BRAINS_KEY,
  });
  if (!raw) return [];
  const names = raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(names));
}

/**
 * Append a Brain ENS name to a discovery shortcut's `brainpedia.brains` text
 * record. Idempotent: if the brain is already listed, returns alreadyListed
 * and skips the on-chain write. The shortcut subnode (`<topic>.discover.<parent>`)
 * must already exist; this function does not create it.
 *
 * Caller must own the shortcut subnode (typically the deployer wallet for
 * curated shortcuts). The MCP `finalize_brain` tool calls this with topic="all"
 * so every newly-minted Brain joins `all.discover.<parent>` automatically.
 */
export async function addBrainToDiscoveryShortcut(
  clients: EnsClients & { walletClient: WalletClient },
  topic: string,
  brainEnsName: string,
): Promise<{ txHash: Hex | null; brains: string[]; alreadyListed: boolean }> {
  const existing = await listBrainsForTopic(clients, topic);
  if (existing.includes(brainEnsName)) {
    return { txHash: null, brains: existing, alreadyListed: true };
  }
  const updated = [...existing, brainEnsName];
  const shortcut = discoveryNameForTopic(topic, clients.config.parentName);
  const node = namehash(shortcut) as Hex;

  const account = clients.walletClient.account;
  if (!account) {
    throw new Error('addBrainToDiscoveryShortcut: walletClient.account is required');
  }
  const txHash = await clients.walletClient.writeContract({
    account,
    chain: clients.walletClient.chain,
    address: PUBLIC_RESOLVER_SEPOLIA,
    abi: SET_TEXT_ABI,
    functionName: 'setText',
    args: [node, DISCOVERY_BRAINS_KEY, updated.join('\n')],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (clients.publicClient as any).waitForTransactionReceipt({ hash: txHash });
  return { txHash, brains: updated, alreadyListed: false };
}

/**
 * Resolve a topic shortcut to a list of fully-resolved Brains.
 * Reads the `brainpedia.brains` text record on the shortcut and parallel-
 * resolves each name's records.
 */
export async function discoverBrains(
  clients: EnsClients,
  topic: string,
): Promise<ResolvedBrain[]> {
  const names = await listBrainsForTopic(clients, topic);
  if (names.length === 0) return [];
  const resolved = await Promise.all(
    names.map((name) =>
      resolveBrain(clients, name).catch(() => ({
        ensName: name,
        owner: null,
        records: {},
      })),
    ),
  );
  return resolved;
}
