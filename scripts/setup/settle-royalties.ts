#!/usr/bin/env bun
/**
 * Settle the royalty splits returned by /api/query?mode=mixture by calling
 * RoyaltyDistributor.distribute(tokenIds, amounts, reason) on chain in one
 * tx — proves the full bounty-spec "automatic royalty splits on usage" path
 * works end-to-end.
 *
 * Usage:
 *   bun run scripts/setup/settle-royalties.ts \
 *     --prompt "safest stablecoin yield" \
 *     --topic defi
 *
 * Reads mixture response from local /api/query (or the live Railway URL via
 * --url), parses the payments[] array, and submits one RoyaltyDistributor
 * tx with msg.value == totalAmountWei. Each Brain owner receives their share
 * directly from the contract. Distributed events log the per-recipient amounts.
 */
import { parseArgs } from 'node:util';
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  id as ethersId,
  type Log,
} from 'ethers';

const { values } = parseArgs({
  options: {
    prompt: { type: 'string', default: 'safest stablecoin yield' },
    topic: { type: 'string', default: 'defi' },
    url: { type: 'string', default: 'https://brainpedia.up.railway.app' },
  },
});

interface PaymentSplit {
  brainEnsName: string;
  inft: string | null;
  citationCount: number;
  weight: number;
  amountWei: string;
  priceQuery: string | null;
}

interface MixtureResponse {
  payments: PaymentSplit[];
  totalAmountWei: string;
  distributor: string | null;
  prompt: string;
}

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`settle-royalties: missing env ${name}`);
    process.exit(1);
  }
  return v;
}

const pk = must('PRIVATE_KEY');
const zgRpc = must('ZG_RPC_URL');

console.log(`settle-royalties: prompt="${values.prompt}", topic="${values.topic}"`);

console.log('\n1. fetch mixture payment plan');
const r = await fetch(`${values.url}/api/query?mode=mixture&topic=${values.topic}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ prompt: values.prompt }),
});
if (!r.ok) {
  console.error(`/api/query failed: ${r.status} ${await r.text()}`);
  process.exit(1);
}
const mix = (await r.json()) as MixtureResponse;
if (!mix.distributor) {
  console.error('mixture response has no `distributor` — set ROYALTY_DISTRIBUTOR_ADDRESS on the web service');
  process.exit(1);
}

const settleable = mix.payments.filter((p) => p.inft && BigInt(p.amountWei) > 0n);
if (settleable.length === 0) {
  console.error('no settleable payments (need inft + non-zero amountWei)');
  process.exit(1);
}

console.log(`   distributor: ${mix.distributor}`);
console.log(`   total: ${mix.totalAmountWei} wei`);
for (const p of settleable) {
  console.log(`   - ${p.brainEnsName.padEnd(28)} weight=${p.weight.toFixed(3)} amount=${p.amountWei} wei  inft=${p.inft}`);
}

const tokenIds = settleable.map((p) => BigInt(p.inft!.split(':')[1]!));
const amounts = settleable.map((p) => BigInt(p.amountWei));
const total = amounts.reduce((acc, a) => acc + a, 0n);

console.log('\n2. call RoyaltyDistributor.distribute');
const provider = new JsonRpcProvider(zgRpc);
const signer = new Wallet(pk, provider);
const abi = [
  'function distribute(uint256[] tokenIds, uint256[] amounts, bytes32 reason) payable',
  'event Distributed(uint256 indexed tokenId, address indexed brainOwner, address indexed payer, uint256 amount, bytes32 reason)',
];
const distributor = new Contract(mix.distributor, abi, signer) as unknown as {
  distribute: (
    tokenIds: bigint[],
    amounts: bigint[],
    reason: string,
    overrides?: { value?: bigint },
  ) => Promise<{ wait: () => Promise<{ hash: string; logs: Log[] }> }>;
};
const reason = ethersId(`mixture:${values.prompt}`);
const tx = await distributor.distribute(tokenIds, amounts, reason, { value: total });
const rcpt = await tx.wait();
console.log(`   tx: ${rcpt.hash}`);

const distEventTopic = ethersId('Distributed(uint256,address,address,uint256,bytes32)');
const events = rcpt.logs.filter((l) => l.topics[0] === distEventTopic);
console.log(`   ${events.length} Distributed events emitted:`);
for (const e of events) {
  const tokenId = BigInt(e.topics[1]!);
  const owner = '0x' + (e.topics[2]?.slice(-40) ?? '');
  console.log(`     - tokenId ${tokenId} → ${owner}`);
}

console.log(`\n✓ settled ${events.length} brain payments in one tx (${rcpt.hash})`);
console.log(`  https://chainscan-galileo.0g.ai/tx/${rcpt.hash}`);
