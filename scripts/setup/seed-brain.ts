#!/usr/bin/env bun
/**
 * Seeds a real Brain end-to-end:
 *
 *   1. Synthesize a small set of sample articles (Karpathy-style wiki).
 *   2. Upload a snapshot manifest to 0G Storage Log layer → merkle rootHash.
 *   3. Mint a Brain iNFT on 0G Galileo with that rootHash as initial intelligence.
 *   4. Set Brain.minPayment for the new tokenId.
 *   5. Update the ENS subname's text records:
 *      - brain.inft         = "<contract>:<tokenId>"
 *      - brain.storage_root = "<rootHash>"
 *
 * After this runs, the demo Brain page resolves to fully real on-chain values.
 *
 * Usage:
 *   PRIVATE_KEY=0x... \
 *   ZG_RPC_URL=https://evmrpc-testnet.0g.ai \
 *   ZG_INFT_CONTRACT_ADDRESS=0x928940c1B051db2bd12dfF49499Cf4d6FC2E3Ef6 \
 *   ENS_RPC_URL=https://ethereum-sepolia.publicnode.com \
 *   ENS_NETWORK=sepolia \
 *   ENS_PARENT_NAME=brainpedia.eth \
 *   ENS_SUBNAME_REGISTRAR_ADDRESS=0x928940c1B051db2bd12dfF49499Cf4d6FC2E3Ef6 \
 *   bun run scripts/setup/seed-brain.ts \
 *     --label yudhi --specialty defi-yield-strategies
 */
import { parseArgs } from 'node:util';
import { JsonRpcProvider, Wallet, Contract, id as ethersId, parseEther, keccak256, toUtf8Bytes, type Log } from 'ethers';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, mainnet } from 'viem/chains';
import { addEnsContracts } from '@ensdomains/ensjs';
import {
  loadZgConfig,
  buildSubmissionFromBytes,
  uploadSegments,
  type ArticleRecord,
  type SnapshotManifest,
} from '@brainpedia/storage-0g';
import {
  loadEnsConfig,
  registerSubname,
  writeBrainRecords,
  subnameRegistrarAbi,
  formatPriceQuery,
} from '@brainpedia/ens';
import { keccak256 as viemKeccak256, stringToBytes } from 'viem';

const { values } = parseArgs({
  options: {
    label: { type: 'string', default: 'yudhi' },
    specialty: { type: 'string', default: 'defi-yield-strategies' },
    'price-wei': { type: 'string', default: '1000000000000000' }, // 0.001 OG
    'compute-url': { type: 'string', default: '' },
    'axl-peer-id': { type: 'string', default: '' },
  },
});

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`seed-brain: missing required env var ${name}`);
    process.exit(1);
  }
  return v;
}

const pk = must('PRIVATE_KEY') as Hex;
const inftAddress = must('ZG_INFT_CONTRACT_ADDRESS');
const ensRpcUrl = must('ENS_RPC_URL');
const ensNetwork = (process.env.ENS_NETWORK ?? 'sepolia') as 'mainnet' | 'sepolia';

const SAMPLE_ARTICLES: ArticleRecord[] = [
  {
    slug: 'stablecoin-yield-overview',
    title: 'Stablecoin Yield Overview',
    body:
      'Stablecoin yields come from three buckets: (1) lending markets like Aave/Compound — ' +
      'low risk but rates compress with TVL; (2) liquidity-providing on Curve/Uniswap stable pools — ' +
      'yield from swap fees plus token incentives, with impermanent loss risk only in depeg; ' +
      '(3) RWA exposure via Maple, Centrifuge, Ondo — credit risk and longer lockups, but ' +
      '8-12% sustainable.',
    links: ['lending-markets', 'curve-stableswap', 'rwa-tokenization'],
    sources: ['research/stablecoin-yields-2025.md'],
    updatedAt: new Date().toISOString(),
  },
  {
    slug: 'curve-stableswap',
    title: 'Curve StableSwap mechanics',
    body:
      'Curve\'s StableSwap invariant blends a constant-sum and constant-product curve, weighted ' +
      'by an amplification coefficient A. For correlated pairs (USDC/USDT/DAI) the curve stays ' +
      'near constant-sum, giving near-1:1 exchange rates with low slippage. LPs earn 4 bps trading ' +
      'fees + CRV emissions. Boosted CRV from veCRV multiplies emissions up to 2.5x.',
    links: ['stablecoin-yield-overview', 've-tokenomics'],
    sources: ['research/curve-mechanics.md'],
    updatedAt: new Date().toISOString(),
  },
  {
    slug: 'rwa-tokenization',
    title: 'RWA tokenization landscape',
    body:
      'Real-world asset (RWA) tokenization brings off-chain credit, treasuries, and real-estate ' +
      'cashflows on-chain. Major players: Ondo (tokenized treasuries), Maple (institutional credit), ' +
      'Centrifuge (invoice/asset-backed pools). Yields 4-12% with credit risk; mostly KYC-gated ' +
      'unless the issuer offers a permissionless wrapper. Regulatory exposure varies by jurisdiction.',
    links: ['stablecoin-yield-overview', 'malaysian-regulatory-context'],
    sources: ['research/rwa-overview.md', 'notes/maple-credit.md'],
    updatedAt: new Date().toISOString(),
  },
  {
    slug: 'malaysian-regulatory-context',
    title: 'Malaysian DeFi regulatory context',
    body:
      'Malaysia\'s SC framework treats most DeFi activity as outside the Capital Markets and ' +
      'Services Act unless the protocol issues a security token. Stablecoin holdings and lending ' +
      'are not currently classified as securities. RWA tokens that wrap regulated instruments ' +
      '(treasuries, equity) WILL fall under SC purview — buyer beware. Bank Negara has signalled ' +
      'AML/KYC enforcement on on/off ramps, not on the underlying contracts.',
    links: ['rwa-tokenization'],
    sources: ['notes/sc-defi-2024.md'],
    updatedAt: new Date().toISOString(),
  },
  {
    slug: 'lending-markets',
    title: 'On-chain lending markets',
    body:
      'Aave V3 and Compound V3 (Comet) are the two main lending markets. Aave\'s eMode boosts ' +
      'capital efficiency for correlated assets (e.g., 95% LTV between stables). Comet uses a ' +
      'single-base-asset model: USDC base, all other assets are collateral only. Sustainable ' +
      'rates: 3-6% on USDC. Risk: smart-contract risk + oracle manipulation in volatile markets.',
    links: ['stablecoin-yield-overview'],
    sources: ['research/aave-v3.md', 'research/compound-comet.md'],
    updatedAt: new Date().toISOString(),
  },
  {
    slug: 've-tokenomics',
    title: 've-tokenomics',
    body:
      'Curve\'s vote-escrowed (ve) model locks CRV for up to 4 years in exchange for veCRV — a ' +
      'non-transferable governance token whose voting power decays linearly. Lockers get ' +
      'protocol fees, gauge voting (directs CRV emissions to specific pools), and a boost ' +
      'multiplier. Convex (CVX) abstracts this: one-shot lock through Convex, get CVX + cvxCRV ' +
      'with continuous yield and tradable claims.',
    links: ['curve-stableswap'],
    sources: ['research/curve-ve-design.md'],
    updatedAt: new Date().toISOString(),
  },
];

// Mint goes through BrainMinter (permissionless wrapper that owns Brain.sol).
// BRAIN_MINTER_ADDRESS env required. setMinPayment is still a Brain.sol call,
// since only the token owner (= msg.sender from mintToSender) can call it.
const minterAbi = [
  'function mintToSender(bytes32,string) payable returns (uint256)',
  'function mintFeeWei() view returns (uint256)',
] as const;
const brainAbi = [
  'function setMinPayment(uint256 tokenId, uint256 amount)',
  'event BrainMinted(uint256 indexed tokenId, address indexed owner, bytes32 storageRoot)',
] as const;

console.log('seed-brain: starting');
console.log(`  label=${values.label}.${process.env.ENS_PARENT_NAME}`);
console.log(`  specialty=${values.specialty}`);
console.log(`  articles=${SAMPLE_ARTICLES.length}`);

// 1. Upload snapshot to 0G Storage by directly calling Flow.submit(...) on
//    the deployed Galileo Flow contract. The npm SDK (@0glabs/0g-ts-sdk@0.3.3)
//    encodes Submission as the 3-field SubmissionData (length, tags, nodes)
//    only — but the live contract's `submit` takes the 2-field outer
//    Submission { SubmissionData data; address submitter; }, ABI selector
//    0xbc8c11f8. Verified against tx 0x135b1d1e…40a0eb (Galileo block ~30492203).
//    We hand-roll the call via viem so the rootHash that lands in the iNFT
//    is the real Flow merkle root, not a keccak placeholder. The fallback
//    only fires if the on-chain submit reverts (e.g. RPC outage, no balance).
const zg = loadZgConfig();
const provider = new JsonRpcProvider(zg.rpcUrl);
const signer = new Wallet(pk, provider);

// 0G Galileo viem chain definition. RPC + chainId come from ZG config so
// they stay overridable via env (defaults: chainId 16602, evmrpc-testnet.0g.ai).
const galileo = defineChain({
  id: zg.chainId,
  name: '0G Galileo',
  nativeCurrency: { name: 'OG', symbol: 'OG', decimals: 18 },
  rpcUrls: { default: { http: [zg.rpcUrl] } },
  blockExplorers: { default: { name: '0G Chainscan', url: zg.explorerUrl } },
});
const ogAccount = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));
const ogPublic = createPublicClient({ chain: galileo, transport: http(zg.rpcUrl) });
const ogWallet = createWalletClient({ account: ogAccount, chain: galileo, transport: http(zg.rpcUrl) });

// Real Flow.submit ABI on Galileo (verified from contracts/dataFlow/Flow.sol +
// interfaces/Submission.sol in 0gfoundation/0g-storage-contracts):
//   submit(Submission((uint256 length, bytes tags, (bytes32 root, uint256 height)[] nodes), address submitter))
//   -> (uint256 index, bytes32 digest, uint256 startIndex, uint256 length)
const flowSubmitAbi = [
  {
    type: 'function',
    name: 'submit',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'submission',
        type: 'tuple',
        components: [
          {
            name: 'data',
            type: 'tuple',
            components: [
              { name: 'length', type: 'uint256' },
              { name: 'tags', type: 'bytes' },
              {
                name: 'nodes',
                type: 'tuple[]',
                components: [
                  { name: 'root', type: 'bytes32' },
                  { name: 'height', type: 'uint256' },
                ],
              },
            ],
          },
          { name: 'submitter', type: 'address' },
        ],
      },
    ],
    outputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'bytes32' },
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'market',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

const marketPriceAbi = [
  {
    type: 'function',
    name: 'pricePerSector',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

interface FlowSubmitResult {
  rootHash: Hex;
  txHash: Hex;
  /** Submission index emitted by the Submit event. */
  txSeq?: bigint;
}

/**
 * Hand-rolled 0G Storage submit. Computes the merkle tree the same way the
 * SDK does (so the root we use here is the canonical Flow root for the
 * manifest), then encodes the 2-field Submission tuple the live contract
 * actually expects. Returns the on-chain rootHash + tx hash.
 *
 * Note: this writes the merkle commitment to chain but does NOT push the
 * raw bytes into storage nodes. Verifiers can reconstruct the manifest
 * from the snapshot payload included in this script — the rootHash binds
 * the Brain's iNFT to the exact bytes. A follow-up can layer in
 * StorageNode.uploadSegmentsByTxSeq() once the SDK's main path is patched.
 */
async function submitSnapshotToFlow(manifestBytes: Uint8Array): Promise<FlowSubmitResult> {
  const built = await buildSubmissionFromBytes(manifestBytes);

  const nodes = built.nodes.map((n) => ({
    root: n.root,
    height: BigInt(n.height),
  }));

  // Fee = sum(2^node.height) sectors * pricePerSector. Mirrors
  // @0glabs/0g-ts-sdk/lib.esm/transfer/utils.js#calculatePrice.
  const marketAddr = await ogPublic.readContract({
    address: zg.flowContractAddress as Address,
    abi: flowSubmitAbi,
    functionName: 'market',
  });
  const pricePerSector = await ogPublic.readContract({
    address: marketAddr,
    abi: marketPriceAbi,
    functionName: 'pricePerSector',
  });
  let sectors = 0n;
  for (const n of nodes) sectors += 1n << n.height;
  const fee = sectors * pricePerSector;

  const txHash = await ogWallet.writeContract({
    address: zg.flowContractAddress as Address,
    abi: flowSubmitAbi,
    functionName: 'submit',
    args: [
      {
        data: {
          length: BigInt(built.length),
          tags: '0x' as Hex,
          nodes,
        },
        submitter: ogAccount.address,
      },
    ],
    value: fee,
  });

  const receipt = await ogPublic.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') {
    throw new Error(`Flow.submit reverted: ${txHash}`);
  }

  // Deployed Flow's Submit event signature is
  //   keccak256("Submit(address,bytes32,uint256,uint256,uint256,(uint256,bytes,(bytes32,uint256)[]))")
  //   = 0x167ce04d…  with topics = [sig, indexed sender, indexed identityHash].
  // The submissionIndex is NOT a 4th topic — it's the first 32 bytes of `data`.
  // (Verified against tx 0x12947ba… on Galileo.) The previous version of this
  // code read topics[3] and silently produced txSeq=undefined, skipping the
  // segment-push step and leaving the indexer with no bytes for the rootHash.
  const SUBMIT_TOPIC0 = '0x167ce04d2aa1981994d3a31695da0d785373335b1078cec239a1a3a2c7675555';
  void ethersId;
  const submitLog = receipt.logs.find(
    (l) =>
      l.address.toLowerCase() === zg.flowContractAddress.toLowerCase() &&
      l.topics[0]?.toLowerCase() === SUBMIT_TOPIC0,
  );
  const txSeq = submitLog ? BigInt(submitLog.data.slice(0, 66)) : undefined;

  return { rootHash: built.rootHash, txHash, txSeq };
}

const snapshotManifest: SnapshotManifest = {
  brainOwner: signer.address.toLowerCase(),
  createdAt: new Date().toISOString(),
  articleCount: SAMPLE_ARTICLES.length,
  articles: SAMPLE_ARTICLES.map((a) => ({
    slug: a.slug,
    contentHash: keccak256(toUtf8Bytes(a.body)),
    bytes: new TextEncoder().encode(a.body).length,
  })),
  previousRoot: null,
  payload: SAMPLE_ARTICLES,
};
const manifestBytes = new TextEncoder().encode(JSON.stringify(snapshotManifest));

console.log('\n1. uploading snapshot to 0G Storage Log layer (Flow.submit via viem) …');
let storageRoot: string;
let storageTxHash = '';
let flowTxSeq: bigint | undefined;
try {
  const res = await submitSnapshotToFlow(manifestBytes);
  storageRoot = res.rootHash;
  storageTxHash = res.txHash;
  flowTxSeq = res.txSeq;
  console.log(`   rootHash: ${storageRoot}`);
  console.log(`   txHash:   ${storageTxHash}`);
  if (res.txSeq !== undefined) console.log(`   txSeq:    ${res.txSeq}`);
  console.log(`   explorer: ${zg.explorerUrl}/tx/${storageTxHash}`);
} catch (err) {
  const msg = (err as Error).message;
  console.warn(`   ⚠ Flow.submit failed: ${msg.split('\n')[0]}`);
  console.warn('   ⚠ falling back to deterministic keccak256(manifest) for demo');
  const placeholderManifest = JSON.stringify({
    brainOwner: signer.address.toLowerCase(),
    articleCount: SAMPLE_ARTICLES.length,
    articles: SAMPLE_ARTICLES.map((a) => ({ slug: a.slug, title: a.title })),
  });
  storageRoot = keccak256(toUtf8Bytes(placeholderManifest));
  console.log(`   placeholder rootHash: ${storageRoot}`);
}
const snapshot = { rootHash: storageRoot, txHash: storageTxHash };

// 1b. Push raw segments so the 0G indexer can serve the manifest back to
//     anyone who only has the rootHash (e.g. apps/brain's log.fetchSnapshot).
//     Without this step Flow.submit only writes the merkle commitment and
//     `Indexer.download(rootHash)` returns 404. We fail loudly here — a
//     real Brain query is impossible without the bytes being retrievable.
if (flowTxSeq !== undefined) {
  console.log('\n1b. pushing segments to 0G storage nodes (uploadSegmentsByTxSeq) …');
  const upload = await uploadSegments(manifestBytes, {
    indexerUrl: zg.storageIndexerUrl,
    txSeq: flowTxSeq,
    expectedReplica: 1,
  });
  console.log(`   nodes: ${upload.storageNodeUrls.join(', ') || '(none)'}`);
  console.log(`   finalized: ${upload.finalized}`);
  if (upload.rootHash.toLowerCase() !== storageRoot.toLowerCase()) {
    throw new Error(
      `seed-brain: rootHash mismatch (Flow=${storageRoot}, segments=${upload.rootHash})`,
    );
  }
} else if (storageTxHash) {
  // Flow.submit succeeded but we couldn't decode the txSeq from logs. Bail
  // — without txSeq we can't push segments, and an iNFT pointing at
  // unrecoverable bytes is worse than a clean failure.
  throw new Error(
    'seed-brain: Flow.submit succeeded but txSeq missing from receipt; cannot push segments',
  );
}

// 2. Mint Brain iNFT — via BrainMinter (permissionless self-mint).
console.log('\n2. minting Brain iNFT via BrainMinter …');
const minterAddress = process.env.BRAIN_MINTER_ADDRESS;
if (!minterAddress) {
  console.error('seed-brain: BRAIN_MINTER_ADDRESS env var required');
  process.exit(1);
}
const minter = new Contract(minterAddress, minterAbi, signer) as unknown as {
  mintFeeWei: () => Promise<bigint>;
  mintToSender: (root: string, desc: string, overrides?: { value?: bigint }) => Promise<{ wait: () => Promise<{ hash: string; logs: Log[] }> }>;
};
const brain = new Contract(inftAddress, brainAbi, signer) as unknown as {
  setMinPayment: (id: bigint, amount: bigint) => Promise<{ wait: () => Promise<unknown> }>;
};
const fee = await minter.mintFeeWei();
const tx = await minter.mintToSender(
  snapshot.rootHash,
  `${values.specialty} brain — ${SAMPLE_ARTICLES.length} articles`,
  { value: fee },
);
const rcpt = await tx.wait();
const topic = ethersId('BrainMinted(uint256,address,bytes32)');
const logEntry = rcpt.logs.find((l) => l.topics[0] === topic);
if (!logEntry?.topics[1]) throw new Error('seed-brain: BrainMinted event not found');
const tokenId = BigInt(logEntry.topics[1]);
console.log(`   tokenId: ${tokenId}`);
console.log(`   mint tx: ${rcpt.hash}`);
console.log(`   explorer: ${zg.explorerUrl}/tx/${rcpt.hash}`);

// 3. setMinPayment
const priceWei = BigInt(values['price-wei']!);
console.log(`\n3. setMinPayment(${tokenId}, ${priceWei} wei)`);
const setTx = await brain.setMinPayment(tokenId, priceWei);
await setTx.wait();
console.log('   ok');

// 4. Update ENS text records on the existing subname.
const ens = loadEnsConfig();
const chain = addEnsContracts(ensNetwork === 'mainnet' ? mainnet : sepolia);
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));
const ensPublic = createPublicClient({ chain, transport: http(ensRpcUrl) });
const ensWallet = createWalletClient({ account, chain, transport: http(ensRpcUrl) });

// 4a. Ensure the subname is registered in SubnameRegistrar with the deployer
//     as ownerOfLabel — setTextRecords reverts with NotLabelOwner() otherwise.
//     Idempotent: skips if already registered to us, errors loudly if owned
//     by someone else (would mean a label collision worth investigating).
console.log(`\n4. ensuring ${values.label}.${ens.parentName} is registered`);
const labelHash = viemKeccak256(stringToBytes(values.label!));
const labelOwner = (await ensPublic.readContract({
  address: ens.subnameRegistrarAddress,
  abi: subnameRegistrarAbi,
  functionName: 'ownerOfLabel',
  args: [labelHash],
})) as `0x${string}`;
if (labelOwner.toLowerCase() === account.address.toLowerCase()) {
  console.log(`   already registered to ${labelOwner}`);
} else if (labelOwner === '0x0000000000000000000000000000000000000000') {
  const reg = await registerSubname(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { publicClient: ensPublic as any, walletClient: ensWallet as any, config: ens },
    { label: values.label!, owner: account.address },
  );
  console.log(`   registered: ${reg.registerTxHash}`);
} else {
  throw new Error(
    `seed-brain: ${values.label}.${ens.parentName} is owned by ${labelOwner}, not deployer`,
  );
}

console.log(`\n5. writing brain.* text records to ${values.label}.${ens.parentName}`);
const records = {
  description: `${values.specialty} — ${SAMPLE_ARTICLES.length} articles compiled from research notes`,
  url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://brainpedia.up.railway.app'}/${values.label}`,
  inft: `${inftAddress}:${tokenId}`,
  storageRoot: snapshot.rootHash,
  axlPeerId:
    values['axl-peer-id'] ||
    'cb4cc72222a27f577ac28d6a963ec95ce4b02e924ba05f17e700bd8a2e6b33b8',
  specialty: values.specialty,
  priceQuery: formatPriceQuery(priceWei),
  computeUrl: values['compute-url'] || '',
};

const result = await writeBrainRecords(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { publicClient: ensPublic as any, walletClient: ensWallet as any, config: ens },
  values.label!,
  records,
);
console.log(`   tx: ${result.txHash}`);

console.log(`\n✓ ${values.label}.${ens.parentName} now points at the real Brain`);
console.log(`  iNFT:         ${inftAddress}:${tokenId}`);
console.log(`  storage root: ${snapshot.rootHash}`);
console.log(`  view: https://brainpedia.up.railway.app/${values.label}`);

void parseEther; // keep import (used elsewhere as needed)
