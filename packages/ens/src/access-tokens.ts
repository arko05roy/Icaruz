import { keccak256, namehash, toHex, type Address, type Hash, type WalletClient } from 'viem';
import type { EnsClients } from './client.js';
import { accessTokenRegistrarAbi } from './abi.js';

/**
 * Subnames-as-access-tokens (the "Most Creative Use of ENS" angle).
 *
 * When an agent pays to query a Brain, the AccessTokenRegistrar issues
 * a TTL-bounded subname under `client.<parentName>`:
 *
 *     agent7af2.client.brainpedia.eth → resolves to the authorized session
 *
 * The Brain checks resolution at query time as a capability — no separate
 * API key system. The registrar enforces TTL on chain.
 */
export interface IssueAccessTokenInput {
  /** The agent's address that paid for the query. */
  agent: Address;
  /** Which Brain ENS name they have permission to query. */
  brainEnsName: string;
  /** Optional override (defaults to EnsConfig.accessTokenTtlSeconds). */
  ttlSeconds?: number;
}

export interface IssuedAccessToken {
  /** The full subname, e.g. agent7af2.client.brainpedia.eth */
  tokenName: string;
  label: string;
  /** Block timestamp at which the token expires. */
  expiresAt: number;
  txHash: Hash;
}

export function deriveAccessTokenLabel(agent: Address, brainEnsName: string, salt: bigint): string {
  // Short deterministic label so the agent can derive their token name without an extra read.
  const hash = keccak256(toHex(`${agent.toLowerCase()}|${brainEnsName}|${salt}`));
  return `agent${hash.slice(2, 10)}`;
}

export async function issueAccessToken(
  clients: EnsClients,
  input: IssueAccessTokenInput,
): Promise<IssuedAccessToken> {
  if (!clients.walletClient?.account) {
    throw new Error('issueAccessToken: walletClient with account is required');
  }
  const wallet: WalletClient = clients.walletClient;
  const ttl = BigInt(input.ttlSeconds ?? clients.config.accessTokenTtlSeconds);
  const salt = BigInt(Date.now()) ^ (BigInt(Math.floor(Math.random() * 1e9)) << 32n);
  const label = deriveAccessTokenLabel(input.agent, input.brainEnsName, salt);
  const tokenName = `${label}.client.${clients.config.parentName}`;
  const brainHash = namehash(input.brainEnsName);

  const txHash = await wallet.writeContract({
    address: clients.config.accessTokenRegistrarAddress,
    abi: accessTokenRegistrarAbi,
    functionName: 'issue',
    args: [label, input.agent, brainHash, ttl],
    account: wallet.account!,
    chain: wallet.chain ?? null,
  });
  await clients.publicClient.waitForTransactionReceipt({ hash: txHash });

  const expiresAt = Math.floor(Date.now() / 1000) + Number(ttl);
  return { tokenName, label, expiresAt, txHash };
}

export async function revokeAccessToken(
  clients: EnsClients,
  label: string,
): Promise<{ txHash: Hash }> {
  if (!clients.walletClient?.account) {
    throw new Error('revokeAccessToken: walletClient with account is required');
  }
  const wallet: WalletClient = clients.walletClient;
  const txHash = await wallet.writeContract({
    address: clients.config.accessTokenRegistrarAddress,
    abi: accessTokenRegistrarAbi,
    functionName: 'revoke',
    args: [label],
    account: wallet.account!,
    chain: wallet.chain ?? null,
  });
  await clients.publicClient.waitForTransactionReceipt({ hash: txHash });
  return { txHash };
}

export async function isAccessTokenValid(
  clients: EnsClients,
  label: string,
  agent: Address,
): Promise<boolean> {
  return clients.publicClient.readContract({
    address: clients.config.accessTokenRegistrarAddress,
    abi: accessTokenRegistrarAbi,
    functionName: 'isValid',
    args: [label, agent],
  });
}
