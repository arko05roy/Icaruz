#!/usr/bin/env bun
/**
 * Set up a discovery shortcut subname:
 *
 *   <topic>.discover.<parent>  →  text record `brainpedia.brains` is a
 *                                  newline-separated list of Brain ENS names
 *
 * Agents resolve a topic name and get back a list of relevant Brains; no
 * out-of-band registry needed. Today the list is curated by the registrar
 * owner; v1 lets Brain owners self-list by paying a discovery fee.
 *
 * Usage:
 *   PRIVATE_KEY=0x... ENS_RPC_URL=... ENS_PARENT_NAME=brainpedia.eth \
 *     bun run scripts/setup/issue-discovery-shortcut.ts \
 *       --topic defi --brains yudhi.brainpedia.eth,vitalik.brainpedia.eth
 */
import { parseArgs } from 'node:util';
import {
  createWalletClient,
  createPublicClient,
  http,
  keccak256,
  namehash,
  stringToBytes,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { addEnsContracts } from '@ensdomains/ensjs';
import { loadEnsConfig } from '@brainpedia/ens';

const { values } = parseArgs({
  options: {
    topic: { type: 'string', default: 'defi' },
    brains: {
      type: 'string',
      default: 'yudhi.brainpedia.eth',
    },
    description: { type: 'string', default: '' },
  },
});

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`issue-discovery-shortcut: missing env ${name}`);
    process.exit(1);
  }
  return v;
}

const REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const;
const PUBLIC_RESOLVER = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5' as const;

const pk = must('PRIVATE_KEY') as Hex;
const ensRpcUrl = must('ENS_RPC_URL');
const ens = loadEnsConfig();

const account = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));
const chain = addEnsContracts(sepolia);
const wallet = createWalletClient({ account, chain, transport: http(ensRpcUrl) });
const pub = createPublicClient({ chain, transport: http(ensRpcUrl) });

const topic = values.topic!;
const brainsCsv = values.brains!;
const brains = brainsCsv.split(',').map((b) => b.trim()).filter(Boolean);
const description = values.description || `${topic} discovery shortcut — ${brains.length} brains`;

console.log(`issue-discovery-shortcut: ${topic}.discover.${ens.parentName}`);
console.log(`  brains: ${brains.join(', ')}`);

// 1. Create discover.<parent> subnode owned by deployer (idempotent).
const discoverLabelHash = keccak256(stringToBytes('discover'));
const parentNamehash = namehash(ens.parentName) as Hex;

const setSubnodeOwnerAbi = [
  {
    type: 'function',
    name: 'setSubnodeOwner',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'label', type: 'bytes32' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const;

console.log('\n1. ensure discover.brainpedia.eth exists');
const ownerCheckAbi = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
] as const;
const discoverNode = namehash(`discover.${ens.parentName}`) as Hex;
const discoverOwner = await pub.readContract({
  address: REGISTRY,
  abi: ownerCheckAbi,
  functionName: 'owner',
  args: [discoverNode],
});
if (discoverOwner === '0x0000000000000000000000000000000000000000') {
  const h = await wallet.writeContract({
    address: REGISTRY,
    abi: setSubnodeOwnerAbi,
    functionName: 'setSubnodeOwner',
    args: [parentNamehash, discoverLabelHash, account.address],
  });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log(`   created: ${h}`);
} else {
  console.log(`   already owned by ${discoverOwner}`);
}

// 2. Create <topic>.discover.<parent> subnode owned by deployer + set resolver.
const setSubnodeRecordAbi = [
  {
    type: 'function',
    name: 'setSubnodeRecord',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'label', type: 'bytes32' },
      { name: 'owner', type: 'address' },
      { name: 'resolver', type: 'address' },
      { name: 'ttl', type: 'uint64' },
    ],
    outputs: [],
  },
] as const;

console.log(`\n2. create ${topic}.discover.${ens.parentName}`);
const topicLabelHash = keccak256(stringToBytes(topic));
const h2 = await wallet.writeContract({
  address: REGISTRY,
  abi: setSubnodeRecordAbi,
  functionName: 'setSubnodeRecord',
  args: [discoverNode, topicLabelHash, account.address, PUBLIC_RESOLVER, 0n],
});
await pub.waitForTransactionReceipt({ hash: h2 });
console.log(`   tx: ${h2}`);

// 3. Set the brainpedia.brains text record on it.
const setTextAbi = [
  {
    type: 'function',
    name: 'setText',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
    ],
    outputs: [],
  },
] as const;

const topicNode = namehash(`${topic}.discover.${ens.parentName}`) as Hex;

console.log(`\n3. set text records on ${topic}.discover.${ens.parentName}`);
const h3 = await wallet.writeContract({
  address: PUBLIC_RESOLVER,
  abi: setTextAbi,
  functionName: 'setText',
  args: [topicNode, 'brainpedia.brains', brains.join('\n')],
});
await pub.waitForTransactionReceipt({ hash: h3 });
console.log(`   brainpedia.brains tx: ${h3}`);

const h4 = await wallet.writeContract({
  address: PUBLIC_RESOLVER,
  abi: setTextAbi,
  functionName: 'setText',
  args: [topicNode, 'description', description],
});
await pub.waitForTransactionReceipt({ hash: h4 });
console.log(`   description tx:        ${h4}`);

console.log(`\n✓ ${topic}.discover.${ens.parentName} now resolves to ${brains.length} brains`);
console.log(`  view: https://sepolia.app.ens.domains/${topic}.discover.${ens.parentName}`);
