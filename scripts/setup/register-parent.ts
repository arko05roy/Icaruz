#!/usr/bin/env bun
/**
 * Register the Brainpedia parent name on Sepolia (or mainnet) via the ENS
 * ETHRegistrarController. Uses @ensdomains/ensjs's commit + register actions.
 *
 * Usage:
 *   PRIVATE_KEY=0x... ENS_RPC_URL=... ENS_PARENT_NAME=brainpedia.eth \
 *     bun run scripts/setup/register-parent.ts
 *
 * Flow:
 *   1. Compute price for ENS_PARENT_NAME (1 year)
 *   2. Submit `commit(commitment)`, wait MIN_COMMITMENT_AGE (60s on Sepolia)
 *   3. Submit `register(...)` paying the rent
 *   4. Print the Name Wrapper / Registry ownership of the new name
 */
import { createPublicClient, createWalletClient, http, type Hash, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, mainnet } from 'viem/chains';
import { addEnsContracts } from '@ensdomains/ensjs';
import { commitName, registerName } from '@ensdomains/ensjs/wallet';
import { getPrice } from '@ensdomains/ensjs/public';

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`register-parent: missing required env var ${name}`);
    process.exit(1);
  }
  return v;
}

const network = (process.env.ENS_NETWORK ?? 'sepolia') as 'mainnet' | 'sepolia';
const rpcUrl = must('ENS_RPC_URL');
const parentName = must('ENS_PARENT_NAME');
const privateKey = must('PRIVATE_KEY') as Hex;

if (parentName.split('.').length !== 2 || !parentName.endsWith('.eth')) {
  console.error(`register-parent: ENS_PARENT_NAME must be a 2LD ending in .eth (got "${parentName}")`);
  process.exit(1);
}

const chain = addEnsContracts(network === 'mainnet' ? mainnet : sepolia);
const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : (`0x${privateKey}` as Hex));
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

const label = parentName.replace(/\.eth$/, '');
const duration = 365 * 24 * 60 * 60; // 1 year
const secret = ('0x' + '00'.repeat(31) + '01') as Hex; // any 32-byte secret; we own both sides
const resolverAddress = chain.contracts.ensPublicResolver.address;

console.log(`register-parent: ${parentName} on ${network} as ${account.address}`);

const price = await getPrice(publicClient, { nameOrNames: label, duration });
const totalCost = price.base + price.premium;
console.log(`  rent (1y): base=${price.base}, premium=${price.premium}, total=${totalCost} wei`);

const balance = await publicClient.getBalance({ address: account.address });
console.log(`  wallet balance: ${balance} wei`);
if (balance < totalCost) {
  console.error('register-parent: insufficient balance for rent + gas');
  process.exit(1);
}

console.log('  → commit phase');
const commitTx: Hash = await commitName(walletClient, {
  name: parentName,
  owner: account.address,
  duration,
  secret,
  resolverAddress,
});
await publicClient.waitForTransactionReceipt({ hash: commitTx });
console.log(`     commit tx: ${commitTx}`);

console.log('  → waiting 65s (MIN_COMMITMENT_AGE on Sepolia is 60s)');
await new Promise((r) => setTimeout(r, 65_000));

console.log('  → register phase');
const registerTx: Hash = await registerName(walletClient, {
  name: parentName,
  owner: account.address,
  duration,
  secret,
  resolverAddress,
  // Add a small buffer to handle on-chain price fluctuation
  value: (totalCost * 110n) / 100n,
});
const receipt = await publicClient.waitForTransactionReceipt({ hash: registerTx });
console.log(`     register tx: ${registerTx}`);
console.log(`     gas used:    ${receipt.gasUsed}`);

console.log('\n✓ registered!');
console.log(
  network === 'sepolia'
    ? `  https://sepolia.app.ens.domains/${parentName}`
    : `  https://app.ens.domains/${parentName}`,
);
console.log('\nNext: transfer parent ownership to SubnameRegistrar so it can issue subnames.');
console.log(`  cast send <NameWrapper> "safeTransferFrom(...)" ... or use the ENS UI.`);
