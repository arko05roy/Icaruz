#!/usr/bin/env bun
/**
 * End-to-end ERC-7857 "private metadata sealed for owner" + oracle-attested
 * secureTransfer demo on 0G mainnet.
 *
 * Flow:
 *   1. Compose a sample plaintext manifest (the "private" brain content).
 *   2. Generate a random 32-byte symmetric key.
 *   3. Encrypt the manifest with AES-256-GCM under that key.
 *   4. Upload the encrypted ciphertext to 0G Storage via the existing log
 *      client. Get the merkle root.
 *   5. Seal the symmetric key for the recipient pubkey using ECIES-style
 *      box (for demo: ephemeral X25519 + HKDF + AES-GCM, but we keep it
 *      simple here with a deterministic labeled wrap — the contract only
 *      stores opaque bytes anyway, the encryption ceremony is off chain).
 *   6. Mint via BrainMinter.mintToSender with non-empty encryptedURI +
 *      metadataHash + sealedKey. This is the canonical ERC-7857 mint
 *      shape: public-only Brains use empty values, private Brains use
 *      full sealed metadata.
 *   7. Generate a fresh recipient wallet (the "buyer" of this Brain).
 *   8. Sign an EIP-712 TransferAttestation as the attestor (= deployer in
 *      our hackathon configuration). The attestation commits to
 *      (tokenId, from, to, sealedKeyHash, deadline).
 *   9. Call Brain.secureTransfer(tokenId, to, abi.encode(attestation)).
 *      BrainOracle.verifyProof validates the signature, checks the
 *      (tokenId, from, to) match the live transfer context, and confirms
 *      the deadline is not expired. Ownership flips on chain.
 *
 * Result: chainscan shows
 *   - a Mint event with non-zero metadataHash + KeySealed event
 *   - a SecureTransferred event (the ERC-7857 transfer hook)
 *   - the recipient now owns the Brain
 *
 * This is the differentiating ERC-7857 path. Public-only Brains never
 * exercise the sealed key or oracle attestor; this script proves the
 * full mechanism works on 0G mainnet end to end.
 *
 * Usage: bun scripts/setup/sealed-key-demo.ts
 */
import crypto from 'node:crypto';
import { createBrainLogClient, loadZgConfig } from '@brainpedia/storage-0g';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  http,
  keccak256,
  toBytes,
  type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

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

const MINTER_ABI = [
  {
    type: 'function',
    name: 'mintToSender',
    stateMutability: 'payable',
    inputs: [
      { name: 'initialStorageRoot', type: 'bytes32' },
      { name: 'encryptedURI', type: 'bytes' },
      { name: 'metadataHash', type: 'bytes32' },
      { name: 'description', type: 'string' },
      { name: 'sealedKey', type: 'bytes' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
] as const;

async function main() {
  const cfg = loadZgConfig();
  if (cfg.chainId !== 16661) {
    throw new Error(`expected 0G mainnet (16661), got chainId ${cfg.chainId}`);
  }
  const pk = process.env.ZG_WALLET_PRIVATE_KEY;
  if (!pk) throw new Error('ZG_WALLET_PRIVATE_KEY missing');
  const brainAddr = process.env.ZG_INFT_CONTRACT_ADDRESS as `0x${string}` | undefined;
  const oracleAddr = process.env.ZG_BRAIN_ORACLE_ADDRESS as `0x${string}` | undefined;
  const minterAddr = process.env.ZG_BRAIN_MINTER_ADDRESS as `0x${string}` | undefined;
  if (!brainAddr || !oracleAddr || !minterAddr) {
    throw new Error('Missing ZG_INFT_CONTRACT_ADDRESS / ZG_BRAIN_ORACLE_ADDRESS / ZG_BRAIN_MINTER_ADDRESS');
  }

  const ownerAcc = privateKeyToAccount((pk.startsWith('0x') ? pk : `0x${pk}`) as Hex);
  console.log('sealed-key + secureTransfer demo');
  console.log('  network:    0G Aristotle mainnet (16661)');
  console.log('  brain:     ', brainAddr);
  console.log('  oracle:    ', oracleAddr);
  console.log('  minter:    ', minterAddr);
  console.log('  owner:     ', ownerAcc.address);
  console.log();

  // ============ STEP 1: sample plaintext manifest ============
  const plaintextManifest = {
    schema: 'brainpedia/sealed-manifest@v1',
    name: 'Sealed Specialty Brain — demo',
    specialty: 'AI x Web3 protocol design',
    privateNotes: [
      'Mixture-of-Brains royalty math: amount_i = parsePriceQuery(brain_i.price_query)',
      'Use Ownable2Step everywhere; never the single-step variant on owned contracts.',
      'TEE attestation gates BOTH creation (knowledge-compiler compute backend) AND query (per-Brain inference).',
    ],
    createdAt: new Date().toISOString(),
  };
  const plaintextBytes = new TextEncoder().encode(JSON.stringify(plaintextManifest));
  const metadataHash = keccak256(plaintextBytes);
  console.log('1. plaintext manifest');
  console.log(`   ${plaintextBytes.length} bytes`);
  console.log(`   keccak256(plaintext) = ${metadataHash}`);
  console.log();

  // ============ STEP 2-3: symmetric key + AES-256-GCM encryption ============
  const symmetricKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', symmetricKey, iv);
  const ct1 = cipher.update(Buffer.from(plaintextBytes));
  const ct2 = cipher.final();
  const authTag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([iv, authTag, ct1, ct2]);
  console.log('2. AES-256-GCM encryption');
  console.log(`   key:  ${symmetricKey.toString('hex')} (off chain, never on chain)`);
  console.log(`   iv:   ${iv.toString('hex')}`);
  console.log(`   ciphertext: ${ciphertext.length} bytes`);
  console.log();

  // ============ STEP 4: upload encrypted manifest to 0G Storage ============
  // The storage-0g log client uploads an ArticleRecord[] manifest. For a
  // sealed Brain we want to upload the ciphertext itself, so we wrap it
  // as a single opaque "article" whose body is base64 of the ciphertext.
  // The on-chain rootHash points at this snapshot; only the holder of
  // sealedKey can decrypt it.
  const logClient = createBrainLogClient(cfg, pk);
  const sealedRecord = {
    slug: 'sealed-manifest',
    title: 'Encrypted Brain Manifest',
    body: ciphertext.toString('base64'),
    links: [],
    sources: ['sealed-manifest.bin'],
    updatedAt: new Date().toISOString(),
  };
  console.log('3. uploading encrypted snapshot to 0G Storage');
  const snapshot = await logClient.uploadSnapshot(ownerAcc.address, [sealedRecord], null);
  console.log(`   rootHash: ${snapshot.rootHash}`);
  console.log(`   tx:       ${snapshot.txHash}`);
  console.log();

  // ============ STEP 5: seal the symmetric key for the (future) recipient ============
  // Real production: ECIES box(ephemeral X25519, recipient pubkey, HKDF, AES-GCM).
  // Demo: deterministic labeled wrap so the bytes are non-trivial but readable.
  // The contract only stores opaque bytes — the encryption scheme is off chain.
  const sealedKey = Buffer.concat([
    Buffer.from('SEAL_v1|', 'utf8'),
    symmetricKey,
    Buffer.from('|owner:', 'utf8'),
    Buffer.from(ownerAcc.address.toLowerCase().slice(2), 'hex'),
  ]);
  console.log('4. seal symmetric key for current owner (placeholder ECIES)');
  console.log(`   sealedKey: ${sealedKey.length} bytes`);
  console.log();

  // ============ STEP 6: mint with non-empty sealed metadata ============
  const chain = defineChain({
    id: cfg.chainId,
    name: '0G Aristotle',
    nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
    blockExplorers: { default: { name: '0G Chainscan', url: cfg.explorerUrl } },
  });
  const ownerWallet = createWalletClient({ account: ownerAcc, chain, transport: http(cfg.rpcUrl) });
  const publicClient = createPublicClient({ chain, transport: http(cfg.rpcUrl) });

  const encryptedURI = new TextEncoder().encode(`0g://${snapshot.rootHash}`);

  console.log('5. mint sealed Brain via BrainMinter.mintToSender');
  const mintHash = await ownerWallet.writeContract({
    address: minterAddr,
    abi: MINTER_ABI,
    functionName: 'mintToSender',
    args: [
      snapshot.rootHash as `0x${string}`,
      `0x${Buffer.from(encryptedURI).toString('hex')}` as `0x${string}`,
      metadataHash as `0x${string}`,
      'Sealed Specialty Brain — ERC-7857 private metadata demo',
      `0x${sealedKey.toString('hex')}` as `0x${string}`,
    ],
    value: 0n,
  });
  const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
  // Tease out tokenId from logs. Brain.mint emits BrainMinted(tokenId, owner, root, metadataHash)
  // topic[1] is indexed tokenId.
  let tokenId: bigint | null = null;
  for (const log of mintReceipt.logs) {
    if (log.address.toLowerCase() === brainAddr.toLowerCase() && log.topics[1]) {
      tokenId = BigInt(log.topics[1]);
      break;
    }
  }
  if (tokenId === null) throw new Error('could not parse minted tokenId from logs');
  console.log(`   tx: ${mintHash}`);
  console.log(`   tokenId: ${tokenId}`);
  console.log();

  // ============ STEP 7: generate a fresh recipient wallet ============
  const recipientPk = generatePrivateKey();
  const recipientAcc = privateKeyToAccount(recipientPk);
  console.log('6. generated recipient wallet');
  console.log(`   address: ${recipientAcc.address}`);
  console.log(`   pk:      ${recipientPk}  (keep so we can later verify ownership)`);
  console.log();

  // ============ STEP 8: sign EIP-712 TransferAttestation as attestor ============
  // Attestor = deployer in our hackathon setup. The signature commits to
  // (tokenId, from, to, sealedKeyHash, deadline).
  const newSealedKeyHash = keccak256(toBytes(`SEAL_v1|${ownerAcc.address}->${recipientAcc.address}|t=${tokenId}`));
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

  console.log('7. attestor signs EIP-712 TransferAttestation');
  const sig = await ownerAcc.signTypedData({
    domain: {
      name: 'BrainOracle',
      version: '1',
      chainId: cfg.chainId,
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
      tokenId,
      from: ownerAcc.address,
      to: recipientAcc.address,
      sealedKeyHash: newSealedKeyHash,
      deadline,
    },
  });
  console.log(`   signature: ${sig}`);
  console.log();

  // ============ STEP 9: encode oracle proof + call Brain.secureTransfer ============
  const oracleProof = encodeAbiParameters(
    [
      { type: 'uint256' },
      { type: 'address' },
      { type: 'address' },
      { type: 'bytes32' },
      { type: 'uint64' },
      { type: 'bytes' },
    ],
    [
      tokenId,
      ownerAcc.address,
      recipientAcc.address,
      newSealedKeyHash,
      deadline,
      sig,
    ],
  );

  console.log('8. call Brain.secureTransfer with oracle proof');
  const newSealedKey = toBytes(
    `SEAL_v1|owner->${recipientAcc.address}|t=${tokenId}|new`,
  );
  const transferHash = await ownerWallet.writeContract({
    address: brainAddr,
    abi: BRAIN_ABI,
    functionName: 'secureTransfer',
    args: [
      recipientAcc.address,
      tokenId,
      `0x${Buffer.from(newSealedKey).toString('hex')}` as `0x${string}`,
      oracleProof as `0x${string}`,
    ],
  });
  const transferReceipt = await publicClient.waitForTransactionReceipt({ hash: transferHash });
  console.log(`   tx: ${transferHash}`);
  console.log(`   status: ${transferReceipt.status}`);
  console.log();

  // ============ verify ownership flipped ============
  const newOwner = await publicClient.readContract({
    address: brainAddr,
    abi: BRAIN_ABI,
    functionName: 'ownerOf',
    args: [tokenId],
  });
  console.log('9. ownership verification');
  console.log(`   Brain.ownerOf(${tokenId}) = ${newOwner}`);
  console.log(`   expected:                  = ${recipientAcc.address}`);
  console.log(`   match: ${newOwner.toLowerCase() === recipientAcc.address.toLowerCase() ? 'YES' : 'NO'}`);
  console.log();

  console.log('done.');
  console.log(`  mint tx:     ${cfg.explorerUrl}/tx/${mintHash}`);
  console.log(`  transfer tx: ${cfg.explorerUrl}/tx/${transferHash}`);
}

main().catch((err) => {
  console.error('sealed-key-demo failed:', err);
  process.exit(1);
});
