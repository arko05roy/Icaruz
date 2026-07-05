#!/usr/bin/env bun
/**
 * One-shot backfill: rewrite the brain.price_query ENS text record on every
 * Brain in `all.discover.bpedia.eth` from raw-wei integers ("1000000000000000")
 * to the canonical OG-decimal form ("0.001 OG"), so the records are
 * human-readable when judges inspect them on sepolia.app.ens.domains.
 *
 * Idempotent: if a record is already in canonical OG form, skip it.
 *
 * Usage:
 *   PRIVATE_KEY=0x... bun run scripts/setup/backfill-price-format.ts
 */
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { addEnsContracts } from '@ensdomains/ensjs';
import {
  loadEnsConfig,
  createEnsPublicClient,
  listBrainsForTopic,
  readBrainRecords,
  writeBrainRecords,
  parsePriceQuery,
  formatPriceQuery,
} from '@brainpedia/ens';

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`backfill-price-format: missing ${name}`);
    process.exit(1);
  }
  return v;
}

const pk = must('PRIVATE_KEY') as Hex;
const ensRpc = must('ENS_RPC_URL');
const ens = loadEnsConfig();

console.log(`backfill-price-format: parent=${ens.parentName} rpc=${ensRpc}`);

const ensClient = createEnsPublicClient(ens);
const brains = await listBrainsForTopic(
  { publicClient: ensClient, config: ens },
  'all',
);
console.log(`found ${brains.length} brains in all.discover.${ens.parentName}: ${brains.join(', ')}`);

const account = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));
const chain = addEnsContracts(sepolia);
const pub = createPublicClient({ chain, transport: http(ensRpc) });
const wallet = createWalletClient({ account, chain, transport: http(ensRpc) });

let updated = 0;
let skipped = 0;
for (const ensName of brains) {
  const records = await readBrainRecords(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { publicClient: ensClient as any, config: ens },
    ensName,
  );
  const current = records.priceQuery;
  if (!current) {
    console.log(`  ${ensName}: no brain.price_query record, skipping`);
    skipped++;
    continue;
  }
  const wei = parsePriceQuery(current);
  if (wei === null) {
    console.log(`  ${ensName}: unparseable "${current}", skipping`);
    skipped++;
    continue;
  }
  const canonical = formatPriceQuery(wei);
  if (current === canonical) {
    console.log(`  ${ensName}: already canonical (${canonical})`);
    skipped++;
    continue;
  }

  // Strip the parent suffix → label (writeBrainRecords expects "yudhi" not "yudhi.bpedia.eth")
  const label = ensName.endsWith(`.${ens.parentName}`)
    ? ensName.slice(0, -1 - ens.parentName.length)
    : ensName.split('.')[0]!;

  console.log(`  ${ensName}: rewriting "${current}" → "${canonical}"`);
  const result = await writeBrainRecords(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { publicClient: pub as any, walletClient: wallet as any, config: ens },
    label,
    { priceQuery: canonical },
  );
  console.log(`    tx: ${result.txHash}`);
  updated++;
}

console.log(`\n✓ done. updated=${updated} skipped=${skipped}`);
