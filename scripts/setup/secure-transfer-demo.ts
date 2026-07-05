#!/usr/bin/env bun
/**
 * Demo: oracle-attested secureTransfer of an existing Brain iNFT.
 *
 * Owner of tokenId TARGET_TOKEN_ID is the deployer (= attestor in our
 * hackathon configuration). We:
 *   1. Generate a fresh recipient wallet (we keep the private key so
 *      ownership stays auditable on chain).
 *   2. Sign an EIP-712 TransferAttestation via the deployer key.
 *   3. Call Brain.secureTransfer(tokenId, recipient, abi.encode(attestation)).
 *   4. Verify Brain.ownerOf(tokenId) == recipient.
 *
 * This proves the ERC-7857 secureTransfer path (context-bound attestation
 * over (tokenId, from, to, sealedKeyHash, deadline)) end to end on mainnet.
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  getAddress,
  http,
  keccak256,
  toBytes,
  type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

const TARGET_TOKEN_ID = 5n;

const BRAIN_ABI = [
  {
    type: 'function',
    name: 'secureTransfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'sealedKey', type: 'bytes' },
      { name: 'oracleProof', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

async function main() {
  const pk = process.env.ZG_WALLET_PRIVATE_KEY;
  if (!pk) throw new Error('ZG_WALLET_PRIVATE_KEY missing');
  const rpcUrl = process.env.ZG_RPC_URL ?? 'https://evmrpc.0g.ai';
  if (!process.env.ZG_INFT_CONTRACT_ADDRESS || !process.env.ZG_BRAIN_ORACLE_ADDRESS) {
    throw new Error('ZG_INFT_CONTRACT_ADDRESS / ZG_BRAIN_ORACLE_ADDRESS missing');
  }
  // getAddress() normalizes whatever case the env / docs use and validates it.
  const brainAddr = getAddress(process.env.ZG_INFT_CONTRACT_ADDRESS);
  const oracleAddr = getAddress(process.env.ZG_BRAIN_ORACLE_ADDRESS);
  const chainId = Number(process.env.ZG_CHAIN_ID ?? 16661);

  const owner = privateKeyToAccount((pk.startsWith('0x') ? pk : `0x${pk}`) as Hex);
  const recipientPk = generatePrivateKey();
  const recipient = privateKeyToAccount(recipientPk);

  console.log('secureTransfer demo');
  console.log('  chain:    ', chainId);
  console.log('  brain:    ', brainAddr);
  console.log('  oracle:   ', oracleAddr);
  console.log('  tokenId:  ', TARGET_TOKEN_ID);
  console.log('  owner:    ', owner.address);
  console.log('  recipient:', recipient.address, '(fresh wallet)');
  console.log('  recipient pk (save):', recipientPk);
  console.log();

  const chain = defineChain({
    id: chainId,
    name: '0G Aristotle',
    nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const ownerWallet = createWalletClient({ account: owner, chain, transport: http(rpcUrl) });

  // 1. Sign attestation
  const newSealedKeyHash = keccak256(
    toBytes(`SEAL_v1|${owner.address}->${recipient.address}|t=${TARGET_TOKEN_ID}`),
  );
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  console.log('1. attestor signs EIP-712 TransferAttestation');
  const sig = await owner.signTypedData({
    domain: {
      name: 'BrainOracle',
      version: '1',
      chainId,
      verifyingContract: oracleAddr,
    },
    types: {
      TransferAttestation: [
        { name: 'tokenId', type: 'uint256' },
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'sealedKeyHash', type: 'bytes32' },
        { name: 'deadline', type: 'uint64' },
      ],
    },
    primaryType: 'TransferAttestation',
    message: {
      tokenId: TARGET_TOKEN_ID,
      from: owner.address,
      to: recipient.address,
      sealedKeyHash: newSealedKeyHash,
      deadline,
    },
  });
  console.log(`   sig: ${sig}`);
  console.log();

  // 2. Encode oracle proof
  const oracleProof = encodeAbiParameters(
    [
      { type: 'uint256' },
      { type: 'address' },
      { type: 'address' },
      { type: 'bytes32' },
      { type: 'uint64' },
      { type: 'bytes' },
    ],
    [TARGET_TOKEN_ID, owner.address, recipient.address, newSealedKeyHash, deadline, sig],
  ) as `0x${string}`;

  // 3. Re-seal a fresh symmetric key for the recipient (placeholder ECIES wrap;
  // the contract emits this in KeySealed but treats it as opaque bytes).
  const newSealedKey = toBytes(
    `SEAL_v1|owner->${recipient.address}|t=${TARGET_TOKEN_ID}|new`,
  );

  console.log('2. call Brain.secureTransfer');
  const hash = await ownerWallet.writeContract({
    address: brainAddr,
    abi: BRAIN_ABI,
    functionName: 'secureTransfer',
    args: [
      recipient.address,
      TARGET_TOKEN_ID,
      `0x${Buffer.from(newSealedKey).toString('hex')}` as `0x${string}`,
      oracleProof,
    ],
  });
  console.log(`   tx: ${hash}`);

  // Wait for receipt with extended polling
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    pollingInterval: 1500,
    timeout: 90_000,
  });
  console.log(`   status: ${receipt.status} | block: ${receipt.blockNumber}`);
  console.log();

  // 4. Verify ownership flipped
  const newOwner = await publicClient.readContract({
    address: brainAddr,
    abi: BRAIN_ABI,
    functionName: 'ownerOf',
    args: [TARGET_TOKEN_ID],
  });
  console.log('3. ownership check');
  console.log(`   Brain.ownerOf(${TARGET_TOKEN_ID}) = ${newOwner}`);
  console.log(`   recipient        = ${recipient.address}`);
  const match = newOwner.toLowerCase() === recipient.address.toLowerCase();
  console.log(`   match: ${match ? 'YES — secureTransfer succeeded' : 'NO'}`);
  console.log();
  console.log(`  https://chainscan.0g.ai/tx/${hash}`);
}

main().catch((err) => {
  console.error('secure-transfer-demo failed:', err);
  process.exit(1);
});
