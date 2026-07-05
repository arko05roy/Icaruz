/**
 * Resolves 0G chain & storage configuration from environment variables.
 * Defaults are testnet (Galileo, chain id 16602) but every value is overridable.
 */
export interface ZgConfig {
  rpcUrl: string;
  chainId: number;
  flowContractAddress: string;
  storageIndexerUrl: string;
  /** RPC for the KV node tier — separate from the storage indexer. */
  kvRpcUrl: string;
  explorerUrl: string;
}

export function loadZgConfig(env: NodeJS.ProcessEnv = process.env): ZgConfig {
  const rpcUrl = env.ZG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
  const chainId = Number(env.ZG_CHAIN_ID ?? 16602);
  const flowContractAddress =
    env.ZG_FLOW_CONTRACT_ADDRESS ?? '0x22E03a6A89B950F1c82ec5e74F8eCa321a105296';
  const storageIndexerUrl =
    env.ZG_STORAGE_INDEXER_URL ?? 'https://indexer-storage-testnet-turbo.0g.ai';
  const kvRpcUrl = env.ZG_KV_RPC_URL ?? 'https://kv-storage-testnet-turbo.0g.ai';
  const explorerUrl = env.ZG_EXPLORER_URL ?? 'https://chainscan-galileo.0g.ai';

  if (!Number.isFinite(chainId)) {
    throw new Error(`Invalid ZG_CHAIN_ID: ${env.ZG_CHAIN_ID}`);
  }
  return { rpcUrl, chainId, flowContractAddress, storageIndexerUrl, kvRpcUrl, explorerUrl };
}
