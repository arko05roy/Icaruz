#!/usr/bin/env bun
/**
 * Wire the freshly-deployed registrars to the parent ENS name:
 *   1. setApprovalForAll on ENS Registry for both registrars (so they can
 *      call setSubnodeRecord on subnames of <parent>).
 *   2. setApprovalForAll on Public Resolver for both registrars (so they
 *      can call setText on those subnames — Resolver maintains a separate
 *      operator allowlist from the Registry, this is the gotcha that
 *      bit us on the brainpedia.eth deploy too).
 *   3. Create `client.<parent>` subnode owned by AccessTokenRegistrar so
 *      it can mint `agent<x>.client.<parent>` capability tokens.
 *   4. Create `discover.<parent>` subnode owned by deployer so we can
 *      write `<topic>.discover.<parent>` shortcuts later.
 *
 * Idempotent — safe to re-run; it just emits a no-op tx if already approved.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  namehash,
  stringToBytes,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`wire-ens: missing env ${name}`);
    process.exit(1);
  }
  return v;
}

const pk = must('PRIVATE_KEY') as Hex;
const ensRpcUrl = must('ENS_RPC_URL');
const parentName = must('ENS_PARENT_NAME');
const subnameRegistrar = must('ENS_SUBNAME_REGISTRAR_ADDRESS') as `0x${string}`;
const accessTokenRegistrar = must('ENS_ACCESS_TOKEN_REGISTRAR_ADDRESS') as `0x${string}`;

const REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const;
const PUBLIC_RESOLVER = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5' as const;

const account = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));
const pub = createPublicClient({ chain: sepolia, transport: http(ensRpcUrl) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(ensRpcUrl) });

const parentNode = namehash(parentName);
const clientParentNode = namehash(`client.${parentName}`);
const discoverParentNode = namehash(`discover.${parentName}`);

const approveAbi = [
  {
    type: 'function',
    name: 'setApprovalForAll',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isApprovedForAll',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

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
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
] as const;

async function approveIfNeeded(target: `0x${string}`, operator: `0x${string}`, label: string) {
  const already = await pub.readContract({
    address: target,
    abi: approveAbi,
    functionName: 'isApprovedForAll',
    args: [account.address, operator],
  });
  if (already) {
    console.log(`  ✓ already approved: ${label}`);
    return;
  }
  const h = await wallet.writeContract({
    address: target,
    abi: approveAbi,
    functionName: 'setApprovalForAll',
    args: [operator, true],
  });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log(`  ✓ approved (${label}): ${h}`);
}

async function ensureSubnode(label: string, owner: `0x${string}`, expectedNode: Hex) {
  const labelHash = keccak256(stringToBytes(label));
  const currentOwner = await pub.readContract({
    address: REGISTRY,
    abi: setSubnodeRecordAbi,
    functionName: 'owner',
    args: [expectedNode],
  });
  if (currentOwner.toLowerCase() === owner.toLowerCase()) {
    console.log(`  ✓ ${label}.${parentName} already owned by ${owner}`);
    return;
  }
  console.log(`  → creating ${label}.${parentName} → owner ${owner}`);
  const h = await wallet.writeContract({
    address: REGISTRY,
    abi: setSubnodeRecordAbi,
    functionName: 'setSubnodeRecord',
    args: [parentNode, labelHash, owner, PUBLIC_RESOLVER, 0n],
  });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log(`     tx: ${h}`);
}

console.log(`wire-ens: parent=${parentName} (${parentNode})`);
console.log(`         deployer=${account.address}`);

console.log('\n1. Registry approvals');
await approveIfNeeded(REGISTRY, subnameRegistrar, 'Registry → SubnameRegistrar');
await approveIfNeeded(REGISTRY, accessTokenRegistrar, 'Registry → AccessTokenRegistrar');

console.log('\n2. Public Resolver approvals');
await approveIfNeeded(PUBLIC_RESOLVER, subnameRegistrar, 'Resolver → SubnameRegistrar');
await approveIfNeeded(PUBLIC_RESOLVER, accessTokenRegistrar, 'Resolver → AccessTokenRegistrar');

console.log('\n3. client.<parent> → AccessTokenRegistrar');
await ensureSubnode('client', accessTokenRegistrar, clientParentNode);

console.log('\n4. discover.<parent> → deployer');
await ensureSubnode('discover', account.address, discoverParentNode);

console.log('\n✓ ENS wiring complete');
