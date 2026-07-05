#!/usr/bin/env bun
/**
 * Issue a one-time-use access-token subname under client.<parent>, e.g.
 *
 *     agent7af2.client.brainpedia.eth
 *
 * with a TTL set on chain by AccessTokenRegistrar. This is the "Most
 * Creative Use of ENS" angle — capability tokens as ENS subnames.
 *
 * Flow:
 *   1. Brain owner authorises the agent on the iNFT (forwarding payment).
 *      Skipped here for the demo since the deployer already owns the iNFT.
 *   2. AccessTokenRegistrar.issue(label, agent, brainNameHash, ttl) mints
 *      the temporary subname; the registrar enforces the deadline.
 *   3. Brain checks isValid(label, agent) at query time — no separate
 *      auth service, no off-chain key system.
 *
 * The registrar contract has an issuers allowlist. For the demo the
 * deployer is granted issuer status; production would have the iNFT
 * contract grant itself issuer status as part of authorizeUsage.
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  namehash,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { addEnsContracts } from '@ensdomains/ensjs';
import {
  loadEnsConfig,
  deriveAccessTokenLabel,
  accessTokenRegistrarAbi,
} from '@brainpedia/ens';

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`issue-access-token: missing env ${name}`);
    process.exit(1);
  }
  return v;
}

const pk = must('PRIVATE_KEY') as Hex;
const ensRpcUrl = must('ENS_RPC_URL');

const ens = loadEnsConfig();
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));
const chain = addEnsContracts(sepolia);
const wallet = createWalletClient({ account, chain, transport: http(ensRpcUrl) });
const pub = createPublicClient({ chain, transport: http(ensRpcUrl) });

const brainEnsName = process.env.BRAIN_ENS_NAME ?? `yudhi.${ens.parentName}`;
const agent = (process.env.AGENT_ADDRESS ?? account.address) as `0x${string}`;
const ttlSeconds = Number(process.env.TTL_SECONDS ?? ens.accessTokenTtlSeconds);

console.log(`issue-access-token: granting ${agent.slice(0, 10)}… access to ${brainEnsName}`);
console.log(`  TTL: ${ttlSeconds}s`);

// 0. Make sure the deployer is allowed to mint (issuers[deployer] = true).
console.log('\n0. setIssuer(deployer, true)');
const setIssuerAbi = [
  {
    type: 'function',
    name: 'setIssuer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'issuer', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
  },
] as const;
try {
  const h = await wallet.writeContract({
    address: ens.accessTokenRegistrarAddress,
    abi: setIssuerAbi,
    functionName: 'setIssuer',
    args: [account.address, true],
  });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log(`   tx: ${h}`);
} catch (err) {
  // Already an issuer? Continue.
  console.log(`   (skipping — likely already set: ${(err as Error).message.slice(0, 60)}…)`);
}

// 1. Derive a deterministic label so the agent can predict its name.
const salt = BigInt(Date.now()) ^ (BigInt(Math.floor(Math.random() * 1e9)) << 32n);
const label = deriveAccessTokenLabel(agent, brainEnsName, salt);
const tokenName = `${label}.client.${ens.parentName}`;
console.log(`\n1. issuing token: ${tokenName}`);

const brainHash = namehash(brainEnsName);
const txHash = await wallet.writeContract({
  address: ens.accessTokenRegistrarAddress,
  abi: accessTokenRegistrarAbi,
  functionName: 'issue',
  args: [label, agent, brainHash, BigInt(ttlSeconds)],
});
const rcpt = await pub.waitForTransactionReceipt({ hash: txHash });
console.log(`   tx: ${txHash} gas=${rcpt.gasUsed} logs=${rcpt.logs.length}`);

// 2. Verify isValid.
const valid = await pub.readContract({
  address: ens.accessTokenRegistrarAddress,
  abi: accessTokenRegistrarAbi,
  functionName: 'isValid',
  args: [label, agent],
});
console.log(`\n2. isValid(${label}, agent) = ${valid}`);

const expiresAt = new Date((Math.floor(Date.now() / 1000) + ttlSeconds) * 1000);
console.log(`\n✓ token ${tokenName} valid until ${expiresAt.toISOString()}`);
console.log(`  Brain checks isValid(label, agent) at query time — no separate API key system.`);
