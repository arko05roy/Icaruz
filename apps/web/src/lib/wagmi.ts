import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { injected } from 'wagmi/connectors';
import { mainnet, sepolia } from 'wagmi/chains';

/**
 * 0G Aristotle mainnet, chain id 16661.
 * Brainpedia's Brain iNFT contracts live here. We hardcode the chain id so
 * a misconfigured deploy can't silently swap us back to testnet.
 */
const zeroGMainnet = defineChain({
  id: 16661,
  name: '0G Aristotle',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ZG_RPC_URL ?? 'https://evmrpc.0g.ai'],
    },
  },
  blockExplorers: {
    default: {
      name: '0G Chainscan',
      url: process.env.NEXT_PUBLIC_ZG_EXPLORER_URL ?? 'https://chainscan.0g.ai',
    },
  },
});

/** 0G Galileo testnet, still useful for dev work. */
const zeroGGalileo = defineChain({
  id: 16602,
  name: '0G Galileo Testnet',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmrpc-testnet.0g.ai'] },
  },
  blockExplorers: {
    default: { name: '0G Chainscan Galileo', url: 'https://chainscan-galileo.0g.ai' },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [zeroGMainnet, zeroGGalileo, sepolia, mainnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [zeroGMainnet.id]: http(process.env.NEXT_PUBLIC_ZG_RPC_URL ?? 'https://evmrpc.0g.ai'),
    [zeroGGalileo.id]: http('https://evmrpc-testnet.0g.ai'),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
    [mainnet.id]: http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL),
  },
  ssr: true,
});

/** Always 16661 (0G Aristotle mainnet). Hardcoded so build-time env mismatches can't break the mint UX. */
export const ZG_MAINNET_ID = 16661;
export const ZG_MAINNET_RPC =
  process.env.NEXT_PUBLIC_ZG_RPC_URL ?? 'https://evmrpc.0g.ai';
export const ZG_EXPLORER_URL =
  process.env.NEXT_PUBLIC_ZG_EXPLORER_URL ?? 'https://chainscan.0g.ai';

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
