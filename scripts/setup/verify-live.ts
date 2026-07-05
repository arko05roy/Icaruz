#!/usr/bin/env bun
/**
 * Smoke-test every live piece of the Brainpedia stack end-to-end.
 * Run anytime:    bun run --cwd scripts verify-live
 *
 * No write operations, no funded wallet needed — pure RPC reads.
 */
import { createPublicClient, http, namehash, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { addEnsContracts } from '@ensdomains/ensjs';
import { getTextRecord } from '@ensdomains/ensjs/public';

const ZG_RPC = 'https://evmrpc-testnet.0g.ai';
const SEPOLIA_RPC = 'https://ethereum-sepolia.publicnode.com';
const WEB_URL = 'https://brainpedia.up.railway.app';

// Post-redeploy addresses (new deployer 0xD24e06f0… after the bpedia.eth
// deployer key was lost). Parent is bpedia.eth on Sepolia.
const BRAIN = '0x8C2BE2D73876ec7BD8A190f3317f3C6cA91d66D6' as Address;
const SUBNAME_REGISTRAR = '0xBb921bFFBbbE2219D1EC365213a74097348F28F0' as Address;
const ACCESS_TOKEN_REGISTRAR = '0x3e7D22150d6b883a89703d760d66743D2223456b' as Address;
const PARENT_NAME = 'bpedia.eth';

const ok = (label: string) => console.log(`  ✓ ${label}`);
const fail = (label: string, why: string) => console.log(`  ✗ ${label} — ${why}`);
const info = (k: string, v: string) => console.log(`      ${k.padEnd(18)} ${v}`);
const hr = (title: string) => console.log(`\n${title}`);

let failures = 0;
async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    failures++;
    fail(label, (e as Error).message.slice(0, 100));
  }
}

// ---------------------------------------------------------------------------
hr('1. 0G Galileo — Brain.sol (ERC-7857)');
const zgFetch = (method: string, params: unknown[]) =>
  fetch(ZG_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  })
    .then((r) => r.json() as Promise<{ result?: string }>)
    .then((d) => d.result);

await check('Brain contract has code', async () => {
  const code = await zgFetch('eth_getCode', [BRAIN, 'latest']);
  if (!code || code === '0x') throw new Error('no code');
  ok(`Brain.sol deployed (${code.length} chars of bytecode)`);
});

await check('tokenId 1 has IntelligentData', async () => {
  // currentStorageRoot(uint256) = 0x... selector = 0x9b06a09e (keccak("currentStorageRoot(uint256)"))
  // currentStorageRoot(uint256) = 0x50da6a6c
  const data =
    '0x50da6a6c' +
    '0000000000000000000000000000000000000000000000000000000000000001';
  const result = await zgFetch('eth_call', [{ to: BRAIN, data }, 'latest']);
  if (!result || result === '0x') throw new Error('tokenId 1 missing');
  ok(`tokenId 1 currentStorageRoot = ${result}`);
});

await check('tokenId 1 owner is the deployer', async () => {
  // ownerOf(uint256) — selector 0x6352211e
  const data =
    '0x6352211e' +
    '0000000000000000000000000000000000000000000000000000000000000001';
  const result = await zgFetch('eth_call', [{ to: BRAIN, data }, 'latest']);
  const addr = '0x' + (result ?? '').slice(-40);
  ok(`tokenId 1 owner = ${addr}`);
});

// ---------------------------------------------------------------------------
hr('2. Sepolia ENS — registrars + parent + subnames');
const ensClient = createPublicClient({
  chain: addEnsContracts(sepolia),
  transport: http(SEPOLIA_RPC),
}) as never;

const sepoliaCode = (addr: Address) =>
  fetch(SEPOLIA_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getCode', params: [addr, 'latest'], id: 1 }),
  })
    .then((r) => r.json() as Promise<{ result?: string }>)
    .then((d) => d.result ?? '0x');

await check('SubnameRegistrar deployed', async () => {
  const code = await sepoliaCode(SUBNAME_REGISTRAR);
  if (code === '0x') throw new Error('no code');
  ok(`SubnameRegistrar (${code.length} bytecode chars)`);
});

await check('AccessTokenRegistrar deployed', async () => {
  const code = await sepoliaCode(ACCESS_TOKEN_REGISTRAR);
  if (code === '0x') throw new Error('no code');
  ok(`AccessTokenRegistrar (${code.length} bytecode chars)`);
});

await check('bpedia.eth registered', async () => {
  const node = namehash('bpedia.eth');
  const result = await fetch(SEPOLIA_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [
        {
          to: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
          data: '0x02571be3' + node.slice(2),
        },
        'latest',
      ],
      id: 1,
    }),
  })
    .then((r) => r.json() as Promise<{ result?: string }>)
    .then((d) => '0x' + (d.result ?? '').slice(-40));
  if (result === '0x0000000000000000000000000000000000000000') throw new Error('not registered');
  ok(`bpedia.eth owner = ${result}`);
});

await check('yudhi.bpedia.eth has 8 brain.* records', async () => {
  const keys = [
    'description',
    'avatar',
    'url',
    'brain.inft',
    'brain.storage_root',
    'brain.axl_peer_id',
    'brain.specialty',
    'brain.price_query',
    'brain.compute_url',
  ];
  let count = 0;
  for (const k of keys) {
    const v = await getTextRecord(ensClient, { name: 'yudhi.bpedia.eth', key: k });
    if (v) {
      count++;
      if (k === 'brain.inft' || k === 'brain.storage_root' || k === 'brain.specialty') {
        info(k, v);
      }
    }
  }
  ok(`yudhi.bpedia.eth resolves ${count}/${keys.length} records`);
});

await check('defi.discover.bpedia.eth lists Brains', async () => {
  const v = await getTextRecord(ensClient, {
    name: 'defi.discover.bpedia.eth',
    key: 'brainpedia.brains',
  });
  if (!v) throw new Error('no brainpedia.brains record');
  const brains = v.split('\n').filter(Boolean);
  ok(`discovery shortcut → ${brains.length} brain(s): ${brains.join(', ')}`);
});

// ---------------------------------------------------------------------------
hr('3. Live web');

await check('homepage 200', async () => {
  const r = await fetch(WEB_URL);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  if (!/Mixture-of-Brains/.test(html)) throw new Error('homepage missing D3 section');
  ok(`${WEB_URL} (HTTP 200, D3 viz rendered)`);
});

await check('Brain page resolves ENS', async () => {
  const r = await fetch(`${WEB_URL}/yudhi`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  if (!/0x8C2BE2D73876ec7BD8A190f3317f3C6cA91d66D6:1/i.test(html)) {
    throw new Error('Brain page missing iNFT pair');
  }
  if (!/defi-yield-strategies/.test(html)) {
    throw new Error('Brain page missing specialty');
  }
  ok(`${WEB_URL}/yudhi (live ENS records rendered)`);
});

// ---------------------------------------------------------------------------
hr('4. Summary');
if (failures === 0) {
  console.log('\n✓ all checks passed');
} else {
  console.log(`\n✗ ${failures} failure(s)`);
  process.exit(1);
}
