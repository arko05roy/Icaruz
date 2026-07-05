#!/usr/bin/env bun
/**
 * Pre-deploy helper — computes the namehashes and resolves the right
 * ENS Registry / PublicResolver addresses for the chosen network, then
 * writes a `.env.deploy` file that `forge script` reads.
 *
 * Usage:
 *   ENS_NETWORK=sepolia ENS_PARENT_NAME=brainpedia.eth bun run scripts/setup/prep-deploy.ts
 *
 * Reads:  ENS_NETWORK, ENS_PARENT_NAME (env)
 * Writes: contracts/.env.deploy
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { namehash } from 'viem';
import { addEnsContracts } from '@ensdomains/ensjs';
import { mainnet, sepolia } from 'viem/chains';

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`prep-deploy: missing required env var ${name}`);
    process.exit(1);
  }
  return v;
}

const network = (process.env.ENS_NETWORK ?? 'sepolia') as 'mainnet' | 'sepolia';
if (network !== 'mainnet' && network !== 'sepolia') {
  console.error(`prep-deploy: ENS_NETWORK must be 'mainnet' or 'sepolia' (got "${network}")`);
  process.exit(1);
}

const parentName = must('ENS_PARENT_NAME');
const clientParent = `client.${parentName}`;

const chain = addEnsContracts(network === 'mainnet' ? mainnet : sepolia);
const registry = chain.contracts.ensRegistry?.address;
const resolver = chain.contracts.ensPublicResolver?.address;
if (!registry || !resolver) {
  console.error(`prep-deploy: ENS contracts missing for ${network}`);
  process.exit(1);
}

const env = {
  ENS_NETWORK: network,
  ENS_REGISTRY: registry,
  ENS_PUBLIC_RESOLVER: resolver,
  ENS_PARENT_NAME: parentName,
  ENS_CLIENT_PARENT_NAME: clientParent,
  ENS_PARENT_NODE: namehash(parentName),
  ENS_CLIENT_PARENT_NODE: namehash(clientParent),
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const out = resolve(repoRoot, 'contracts/.env.deploy');
const lines = Object.entries(env)
  .map(([k, v]) => `${k}=${v}`)
  .join('\n');
writeFileSync(out, lines + '\n');

console.log(`prep-deploy: wrote ${out}`);
for (const [k, v] of Object.entries(env)) console.log(`  ${k.padEnd(24)} = ${v}`);
console.log('\nNext:');
console.log(`  cd contracts && set -a && source .env.deploy && set +a \\`);
console.log(`    && PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url <rpc> --broadcast`);
