import type { Address } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

/**
 * Per ENS bounty — "Demo must be functional (no hard-coded values)".
 *
 * Every value here flows through env. Network selection picks the chain
 * (and through @ensdomains/ensjs, the deployed ENS Registry / Resolver /
 * NameWrapper addresses for that chain). Our own contracts (subname +
 * access-token registrars) are also addressed via env, never inline.
 */
export type EnsNetwork = 'mainnet' | 'sepolia';

export interface EnsConfig {
  network: EnsNetwork;
  rpcUrl: string;
  /** Parent name we own and issue subnames under (e.g., "brainpedia.eth"). */
  parentName: string;
  /** Our deployed registrar contract for <name>.<parent>. */
  subnameRegistrarAddress: Address;
  /** Our deployed registrar for one-time access-token subnames. */
  accessTokenRegistrarAddress: Address;
  /** Default TTL (seconds) for issued access-token subnames. */
  accessTokenTtlSeconds: number;
}

const isAddress = (v: string): v is Address => /^0x[0-9a-fA-F]{40}$/.test(v);

export function loadEnsConfig(env: NodeJS.ProcessEnv = process.env): EnsConfig {
  const network = (env.ENS_NETWORK ?? 'sepolia') as EnsNetwork;
  if (network !== 'mainnet' && network !== 'sepolia') {
    throw new Error(`ENS_NETWORK must be "mainnet" or "sepolia" (got "${env.ENS_NETWORK}")`);
  }

  const parentName = env.ENS_PARENT_NAME?.trim();
  if (!parentName) {
    throw new Error('ENS_PARENT_NAME is required (e.g., "brainpedia.eth")');
  }

  const rpcUrl = env.ENS_RPC_URL?.trim();
  if (!rpcUrl) {
    throw new Error('ENS_RPC_URL is required');
  }

  const subnameRegistrarAddress = env.ENS_SUBNAME_REGISTRAR_ADDRESS?.trim() ?? '';
  if (!isAddress(subnameRegistrarAddress)) {
    throw new Error(
      'ENS_SUBNAME_REGISTRAR_ADDRESS must be set to the deployed SubnameRegistrar address',
    );
  }

  const accessTokenRegistrarAddress = env.ENS_ACCESS_TOKEN_REGISTRAR_ADDRESS?.trim() ?? '';
  if (!isAddress(accessTokenRegistrarAddress)) {
    throw new Error(
      'ENS_ACCESS_TOKEN_REGISTRAR_ADDRESS must be set to the deployed AccessTokenRegistrar address',
    );
  }

  const accessTokenTtlSeconds = Number(env.ENS_ACCESS_TOKEN_TTL_SECONDS ?? 900);
  if (!Number.isFinite(accessTokenTtlSeconds) || accessTokenTtlSeconds <= 0) {
    throw new Error('ENS_ACCESS_TOKEN_TTL_SECONDS must be a positive number');
  }

  return {
    network,
    rpcUrl,
    parentName,
    subnameRegistrarAddress,
    accessTokenRegistrarAddress,
    accessTokenTtlSeconds,
  };
}

export function viemChainForNetwork(network: EnsNetwork) {
  return network === 'mainnet' ? mainnet : sepolia;
}
