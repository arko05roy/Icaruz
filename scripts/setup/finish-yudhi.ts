#!/usr/bin/env bun
/**
 * One-off: finish the yudhi setup after seed-brain failed at step 4
 * because the SubnameRegistrar didn't have yudhi registered yet
 * (NotLabelOwner). The on-chain bits already done:
 *   - Brain.sol redeployed at $ZG_INFT_CONTRACT_ADDRESS
 *   - tokenId 1 minted to deployer with storage root from Flow.submit
 *   - minPayment set to 0.001 OG
 *
 * Steps performed here:
 *   1. SubnameRegistrar.register('yudhi', deployer)
 *   2. SubnameRegistrar.setTextRecords with the 8 brain.* records
 */
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { addEnsContracts } from '@ensdomains/ensjs';
import { loadEnsConfig, registerSubname, writeBrainRecords } from '@brainpedia/ens';

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`finish-yudhi: missing env ${name}`);
    process.exit(1);
  }
  return v;
}

const pk = must('PRIVATE_KEY') as Hex;
const ensRpcUrl = must('ENS_RPC_URL');
const inftAddress = must('ZG_INFT_CONTRACT_ADDRESS');

// Values from the failed seed-brain run, pulled from on-chain.
const TOKEN_ID = 1n;
const STORAGE_ROOT = '0xe83dd377745a2ed623160ce77632bee4e08155284740f8a7b94891f7a0160a21';
const SPECIALTY = 'defi-yield-strategies';
const ARTICLES = 6;
const LABEL = 'yudhi';
const AXL_PEER_ID = '03e61956b02e12b028b6d34376fbdec962a0ac08bfcc087a594070493738ef2a';

const ens = loadEnsConfig();
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));
const chain = addEnsContracts(sepolia);
const pub = createPublicClient({ chain, transport: http(ensRpcUrl) });
const wallet = createWalletClient({ account, chain, transport: http(ensRpcUrl) });

console.log(`finish-yudhi: ${LABEL}.${ens.parentName} owner=${account.address}`);

console.log(`\n1. registerSubname('${LABEL}', deployer)`);
const reg = await registerSubname(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { publicClient: pub as any, walletClient: wallet as any, config: ens },
  { label: LABEL, owner: account.address },
);
console.log(`   tx: ${reg.registerTxHash}`);

console.log(`\n2. writeBrainRecords (8 brain.* fields)`);
const records = {
  description: `${SPECIALTY} — ${ARTICLES} articles compiled from research notes`,
  url: `https://brainpedia.up.railway.app/${LABEL}`,
  inft: `${inftAddress}:${TOKEN_ID}`,
  storageRoot: STORAGE_ROOT,
  axlPeerId: AXL_PEER_ID,
  specialty: SPECIALTY,
  priceQuery: '0.001 OG',
  computeUrl: '',
};

const result = await writeBrainRecords(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { publicClient: pub as any, walletClient: wallet as any, config: ens },
  LABEL,
  records,
);
console.log(`   tx: ${result.txHash}`);
console.log(`\n✓ ${LABEL}.${ens.parentName} fully wired`);
console.log(`  iNFT:         ${inftAddress}:${TOKEN_ID}`);
console.log(`  storage root: ${STORAGE_ROOT}`);
console.log(`  view: https://brainpedia.up.railway.app/${LABEL}`);
