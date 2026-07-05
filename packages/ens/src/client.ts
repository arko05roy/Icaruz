import { createPublicClient, http, type PublicClient, type WalletClient } from 'viem';
import { addEnsContracts } from '@ensdomains/ensjs';
import type { ClientWithEns } from '@ensdomains/ensjs/contracts';
import { loadEnsConfig, viemChainForNetwork, type EnsConfig } from './config.js';

/**
 * Builds a viem PublicClient pre-configured with the ENS contract
 * deployment for the chosen network. We never hardcode Registry /
 * Resolver / NameWrapper addresses — `addEnsContracts` resolves them
 * from the chain id, which itself is selected by ENS_NETWORK env.
 *
 * Return type is the intersection of PublicClient (for waitForTransactionReceipt,
 * readContract, etc.) and ClientWithEns (for ensjs-specific actions).
 */
export type EnsPublicClient = PublicClient & ClientWithEns;

export function createEnsPublicClient(cfg: EnsConfig = loadEnsConfig()): EnsPublicClient {
  const chain = addEnsContracts(viemChainForNetwork(cfg.network));
  return createPublicClient({
    chain,
    transport: http(cfg.rpcUrl),
  }) as unknown as EnsPublicClient;
}

export interface EnsClients {
  publicClient: EnsPublicClient;
  config: EnsConfig;
  /** Optional — set when we need to write (subname registration, text record updates). */
  walletClient?: WalletClient;
}
