/**
 * upload-security-brain-content
 *
 * Compiles scripts/setup/security-knowledge/ (a senior EVM smart-contract
 * security engineer's notes) into a Karpathy-style wiki and uploads the
 * snapshot to 0G Storage Log. Prints the merkle rootHash.
 *
 * It does NOT mint a new Brain. The live `brainpedia-brain` service serves
 * whatever BRAIN_STORAGE_ROOT it is configured with; we point that env var
 * at the root this script prints so the demo network answers EVM-security
 * questions with EVM-security citations — matching the vault dragged into
 * /create on camera. One Flow.submit storage tx, deployer wallet. No mint,
 * no ENS write, no MCP/user-wallet payment.
 *
 * Required env (same as the other 0G mainnet seed scripts):
 *   ZG_WALLET_PRIVATE_KEY, ZG_RPC_URL, ZG_CHAIN_ID=16661,
 *   ZG_FLOW_CONTRACT_ADDRESS, ZG_STORAGE_INDEXER_URL, ZG_EXPLORER_URL
 *
 * Usage:
 *   bun run scripts/setup/upload-security-brain-content.ts
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileKnowledge, deterministicCompiler } from '@brainpedia/knowledge-compiler';
import { createBrainLogClient, loadZgConfig } from '@brainpedia/storage-0g';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';

const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'security-knowledge');

async function main() {
  const cfg = loadZgConfig();
  if (cfg.chainId !== 16661) {
    throw new Error(`expected ZG_CHAIN_ID=16661 (0G mainnet), got ${cfg.chainId}`);
  }
  const pk = process.env.ZG_WALLET_PRIVATE_KEY;
  if (!pk) throw new Error('ZG_WALLET_PRIVATE_KEY missing in env');

  const account = privateKeyToAccount((pk.startsWith('0x') ? pk : `0x${pk}`) as Hex);
  console.log('security brain content upload (no mint)');
  console.log('  network:   0G Aristotle (chainId 16661)');
  console.log('  rpc:      ', cfg.rpcUrl);
  console.log('  deployer: ', account.address);
  console.log('  content:  ', CONTENT_DIR);
  console.log();

  // 1. Read local knowledge folder
  console.log('1. reading', CONTENT_DIR);
  const names = (await readdir(CONTENT_DIR)).filter((n) => n.endsWith('.md')).sort();
  const inputs = await Promise.all(
    names.map(async (name) => ({
      path: name,
      bytes: new Uint8Array(await readFile(join(CONTENT_DIR, name))),
    })),
  );
  console.log(`   ${inputs.length} files: ${names.join(', ')}`);
  console.log();

  // 2. Compile
  console.log('2. compiling articles');
  const compiled = await compileKnowledge(inputs, { compiler: deterministicCompiler });
  console.log(`   ${compiled.articles.length} articles`);
  for (const a of compiled.articles) {
    console.log(`   - ${a.slug} | ${a.title} | ${a.body.length} chars | ${a.links.length} links`);
  }
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
  console.log();
  console.log('   rootHash:', snapshot.rootHash);
  console.log('   tx:      ', snapshot.txHash);
  console.log();
  console.log('NEXT: set the live brain to serve this root (no gas):');
  console.log(`  railway variables --service brainpedia-brain \\`);
  console.log(`    --set "BRAIN_STORAGE_ROOT=${snapshot.rootHash}" \\`);
  console.log(`    --set "BRAIN_SPECIALTY=evm-smart-contract-security"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
