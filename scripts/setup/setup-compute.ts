#!/usr/bin/env bun
/**
 * Bootstrap the new deployer's 0G Compute account:
 *   1. addLedger (3 OG minimum balance — broker SDK requirement)
 *   2. transferFund: top up the per-provider sub-account
 *   3. acknowledgeProviderSigner: TEE attestation handshake
 *
 * Idempotent — safe to re-run.
 */
import { loadComputeConfig, createBroker } from '@brainpedia/compute-0g';
import { parseEther } from 'ethers';

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`setup-compute: missing env ${name}`);
    process.exit(1);
  }
  return v;
}

const pk = must('PRIVATE_KEY');
const cfg = loadComputeConfig();
const providerAddress = must('ZG_COMPUTE_PROVIDER_ADDRESS');

console.log(`setup-compute: provider=${providerAddress} model=${cfg.modelName}`);

const broker = createBroker(cfg, pk);

console.log('\n1. ensureFunded — addLedger(3) + transferFund(1 OG)');
await broker.ensureFunded(providerAddress, 3, parseEther('1'));
console.log('   ok');

console.log('\n2. acknowledgeProviderSigner');
await broker.acknowledgeProvider(providerAddress);
console.log('   ok');

console.log('\n✓ 0G Compute ready for the new deployer');
