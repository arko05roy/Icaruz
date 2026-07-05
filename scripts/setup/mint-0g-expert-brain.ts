#!/usr/bin/env bun
/**
 * Mint a "0G Expert Brain" on 0G mainnet, populated with the canonical
 * 0G documentation corpus (docs.0g.ai/llms-full.txt).
 *
 *   1. Fetch the full LLM-friendly docs bundle from docs.0g.ai.
 *   2. Run it through @brainpedia/knowledge-compiler (deterministic v1
 *      backend; the TEE backend is available via env if desired).
 *   3. Upload the compiled snapshot to 0G Storage Log layer via
 *      @brainpedia/storage-0g.
 *   4. Call BrainMinter.mintToSender on 0G mainnet from the local
 *      ZG_WALLET_PRIVATE_KEY. The minted Brain iNFT is owned by that
 *      wallet.
 *
 * Net result: Brainpedia hosts a paid AI agent for 0G's own
 * documentation, running on 0G itself. The hero demo asset.
 *
 * Usage:
 *
 *   bun scripts/setup/mint-0g-expert-brain.ts
 *
 * Required env (read from .env at repo root):
 *
 *   ZG_WALLET_PRIVATE_KEY      deployer key (signs storage + mint)
 *   ZG_RPC_URL                 0G mainnet RPC (evmrpc.0g.ai)
 *   ZG_CHAIN_ID                16661
 *   ZG_FLOW_CONTRACT_ADDRESS   0G Storage Flow contract on mainnet
 *   ZG_STORAGE_INDEXER_URL     0G Storage indexer URL
 *   ZG_BRAIN_MINTER_ADDRESS    deployed BrainMinter on mainnet
 *
 * Optional:
 *
 *   USE_TEE_COMPILER=1         use the 0G Compute TEE compiler instead
 *                              of deterministic (slower, costs broker
 *                              credits, but emits per-article TEE
 *                              attestations)
 */
import { compileKnowledge, createComputeCompiler, deterministicCompiler } from '@brainpedia/knowledge-compiler';
import { createBrainLogClient, loadZgConfig } from '@brainpedia/storage-0g';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const DOCS_URL = 'https://docs.0g.ai/llms-full.txt';
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

const MINTER_ABI = [
  {
    type: 'function',
    name: 'mintToSender',
    stateMutability: 'payable',
    inputs: [
      { name: 'initialStorageRoot', type: 'bytes32' },
      { name: 'encryptedURI', type: 'bytes' },
      { name: 'metadataHash', type: 'bytes32' },
      { name: 'description', type: 'string' },
      { name: 'sealedKey', type: 'bytes' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
] as const;

async function main() {
  const cfg = loadZgConfig();
  if (cfg.chainId !== 16661) {
    throw new Error(`expected ZG_CHAIN_ID=16661 (0G mainnet), got ${cfg.chainId}`);
  }
  const pk = process.env.ZG_WALLET_PRIVATE_KEY;
  if (!pk) throw new Error('ZG_WALLET_PRIVATE_KEY missing in env');
  const minter = process.env.ZG_BRAIN_MINTER_ADDRESS;
  if (!minter) throw new Error('ZG_BRAIN_MINTER_ADDRESS missing in env');

  const account = privateKeyToAccount((pk.startsWith('0x') ? pk : `0x${pk}`) as Hex);
  console.log('0G expert brain mint');
  console.log('  network:        0G Aristotle (chainId 16661)');
  console.log('  rpc:            ', cfg.rpcUrl);
  console.log('  deployer:       ', account.address);
  console.log('  brain minter:   ', minter);
  console.log('  compile backend:', process.env.USE_TEE_COMPILER ? '0G Compute TEE' : 'deterministic');
  console.log();

  // 1. Fetch docs corpus
  console.log('1. fetching', DOCS_URL);
  const res = await fetch(DOCS_URL);
  if (!res.ok) throw new Error(`docs fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  console.log(`   ${text.length} chars`);
  console.log();

  // 2. Compile
  console.log('2. compiling articles');
  const useTee = Boolean(process.env.USE_TEE_COMPILER);
  const compiler = useTee ? createComputeCompiler() : deterministicCompiler;
  const compiled = await compileKnowledge(
    [
      {
        path: '0g-llms-full.md',
        bytes: new TextEncoder().encode(text),
      },
    ],
    { compiler },
  );
  console.log(`   ${compiled.articles.length} articles`);
  for (const a of compiled.articles.slice(0, 8)) {
    console.log(`   - ${a.slug} | ${a.title} | ${a.body.length} chars | ${a.links.length} links`);
  }
  if (compiled.articles.length > 8) console.log(`   …and ${compiled.articles.length - 8} more`);
  console.log();

  // 3. Upload snapshot to 0G Storage
  console.log('3. uploading snapshot to 0G Storage Log layer');
  const logClient = createBrainLogClient(cfg, pk);
  const articleRecords = compiled.articles.map((a) => ({
    slug: a.slug,
    title: a.title,
    body: a.body,
    links: a.links,
    sources: a.sources,
    updatedAt: a.updatedAt,
  }));
  const snapshot = await logClient.uploadSnapshot(account.address, articleRecords, null);
  console.log('   rootHash:', snapshot.rootHash);
  console.log('   tx:      ', snapshot.txHash);
  console.log();

  // 4. Mint via BrainMinter
  console.log('4. minting via BrainMinter.mintToSender');
  const chain = defineChain({
    id: cfg.chainId,
    name: '0G Aristotle',
    nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
    blockExplorers: { default: { name: '0G Chainscan', url: cfg.explorerUrl } },
  });
  const wallet = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) });
  const publicClient = createPublicClient({ chain, transport: http(cfg.rpcUrl) });

  const mintHash = await wallet.writeContract({
    address: minter as `0x${string}`,
    abi: MINTER_ABI,
    functionName: 'mintToSender',
    args: [
      snapshot.rootHash as `0x${string}`,
      '0x' as `0x${string}`,
      ZERO_BYTES32,
      '0G Expert Brain — official 0G documentation as a paid AI agent on 0G itself',
      '0x' as `0x${string}`,
    ],
    value: 0n,
  });
  console.log('   tx:', mintHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
  // BrainMinted(uint256 indexed tokenId, address indexed owner, bytes32 storageRoot, bytes32 metadataHash)
  // We could decode logs, but for the script we just print the explorer link.
  console.log('   block:', receipt.blockNumber);
  console.log();

  console.log('done.');
  console.log('  explorer:', `${cfg.explorerUrl}/tx/${mintHash}`);
  console.log('  brain:   ', `${cfg.explorerUrl}/address/${process.env.ZG_INFT_CONTRACT_ADDRESS}`);
}

main().catch((err) => {
  console.error('mint-0g-expert-brain failed:', err);
  process.exit(1);
});
