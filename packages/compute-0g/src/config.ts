export interface ComputeConfig {
  rpcUrl: string;
  /** Optional — when omitted the broker is asked to pick a provider via listService(). */
  providerAddress?: string;
  providerUrl?: string;
  modelName?: string;
}

export function loadComputeConfig(env: NodeJS.ProcessEnv = process.env): ComputeConfig {
  const rpcUrl = env.ZG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
  return {
    rpcUrl,
    providerAddress: env.ZG_COMPUTE_PROVIDER_ADDRESS,
    providerUrl: env.ZG_COMPUTE_PROVIDER_URL,
    modelName: env.ZG_COMPUTE_MODEL,
  };
}
