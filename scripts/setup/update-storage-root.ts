#!/usr/bin/env bun
/**
 * Point yudhi.bpedia.eth at the new storage root that actually has segments
 * pushed (0xde0ebac78dd…). Three on-chain updates:
 *   1. Brain.sol.appendStorageRoot(tokenId=1, newRoot, "...")  on Galileo
 *   2. SubnameRegistrar.setTextRecords(yudhi, brain.storage_root=newRoot)  on Sepolia
 *   3. (Operator updates Railway env separately.)
 */
import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { addEnsContracts } from '@ensdomains/ensjs';
import { loadEnsConfig, writeBrainRecords } from '@brainpedia/ens';

const NEW_ROOT = '0xde0ebac78dd387969c8aba6c9ce5ef149a9e726685207c0026ae1c0c155ca37f';
const TOKEN_ID = 1n;
const LABEL = 'yudhi';

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`update-storage-root: missing ${name}`);
    process.exit(1);
  }
  return v;
}

const pk = must('PRIVATE_KEY') as Hex;
const inftAddress = must('ZG_INFT_CONTRACT_ADDRESS');
const zgRpc = must('ZG_RPC_URL');
const ensRpc = must('ENS_RPC_URL');

console.log(`updating yudhi.bpedia.eth → root ${NEW_ROOT}`);

// 1. Brain.sol.appendStorageRoot
console.log('\n1. Brain.sol.appendStorageRoot(1, newRoot)');
const provider = new JsonRpcProvider(zgRpc);
const signer = new Wallet(pk, provider);
const abi = ['function appendStorageRoot(uint256 tokenId, bytes32 storageRoot, string description)'] as const;
const brain = new Contract(inftAddress, abi, signer) as unknown as {
  appendStorageRoot: (id: bigint, root: string, desc: string) => Promise<{ wait: () => Promise<{ hash: string }> }>;
};
const tx = await brain.appendStorageRoot(TOKEN_ID, NEW_ROOT, 'segments-pushed snapshot v2');
const rcpt = await tx.wait();
console.log(`   tx: ${rcpt.hash}`);

// 2. ENS text record
console.log('\n2. ENS setTextRecords brain.storage_root');
const ens = loadEnsConfig();
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));
const chain = addEnsContracts(sepolia);
const pub = createPublicClient({ chain, transport: http(ensRpc) });
const wallet = createWalletClient({ account, chain, transport: http(ensRpc) });

const result = await writeBrainRecords(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { publicClient: pub as any, walletClient: wallet as any, config: ens },
  LABEL,
  { storageRoot: NEW_ROOT },
);
console.log(`   tx: ${result.txHash}`);

console.log(`\n✓ on-chain root updated to ${NEW_ROOT}`);
console.log(`  next: railway variable set BRAIN_STORAGE_ROOT=${NEW_ROOT} --service brainpedia-brain && railway redeploy --service brainpedia-brain --yes`);
