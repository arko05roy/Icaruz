#!/usr/bin/env bun
/**
 * Re-push the yudhi snapshot segments to 0G storage nodes so the indexer
 * can serve them back when apps/brain calls log.fetchSnapshot(rootHash).
 *
 * Re-builds the same manifest bytes the seed-brain script produced (same
 * 6 articles, same brainOwner address — articles[].updatedAt is the only
 * volatile field; we feed it a deterministic timestamp for reproducibility),
 * re-submits to Flow to get a fresh txSeq, then uploads segments under it.
 * The merkle root stays the same as long as the bytes do.
 */
import { JsonRpcProvider, Wallet, keccak256, toUtf8Bytes, id as ethersId } from 'ethers';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  loadZgConfig,
  buildSubmissionFromBytes,
  uploadSegments,
  type SnapshotManifest,
} from '@brainpedia/storage-0g';

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`push-segments: missing env ${name}`);
    process.exit(1);
  }
  return v;
}

const pk = must('PRIVATE_KEY') as Hex;
const zg = loadZgConfig();

// Re-build the same articles seed-brain.ts uses (verbatim copies).
const SAMPLE_ARTICLES = [
  { slug: 'stablecoin-yield-overview', title: 'Stablecoin Yield Overview',
    body: 'Stablecoin yields come from three buckets: (1) lending markets like Aave/Compound — low risk but rates compress with TVL; (2) liquidity-providing on Curve/Uniswap stable pools — yield from swap fees plus token incentives, with impermanent loss risk only in depeg; (3) RWA exposure via Maple, Centrifuge, Ondo — credit risk and longer lockups, but 8-12% sustainable.',
    links: ['lending-markets','curve-stableswap','rwa-tokenization'],
    sources: ['research/stablecoin-yields-2025.md'] },
  { slug: 'curve-stableswap', title: 'Curve StableSwap mechanics',
    body: "Curve's StableSwap invariant blends a constant-sum and constant-product curve, weighted by an amplification coefficient A. For correlated pairs (USDC/USDT/DAI) the curve stays near constant-sum, giving near-1:1 exchange rates with low slippage. LPs earn 4 bps trading fees + CRV emissions. Boosted CRV from veCRV multiplies emissions up to 2.5x.",
    links: ['stablecoin-yield-overview','ve-tokenomics'],
    sources: ['research/curve-mechanics.md'] },
  { slug: 'rwa-tokenization', title: 'RWA tokenization landscape',
    body: 'Real-world asset (RWA) tokenization brings off-chain credit, treasuries, and real-estate cashflows on-chain. Major players: Ondo (tokenized treasuries), Maple (institutional credit), Centrifuge (invoice/asset-backed pools). Yields 4-12% with credit risk; mostly KYC-gated unless the issuer offers a permissionless wrapper. Regulatory exposure varies by jurisdiction.',
    links: ['stablecoin-yield-overview','malaysian-regulatory-context'],
    sources: ['research/rwa-overview.md','notes/maple-credit.md'] },
  { slug: 'malaysian-regulatory-context', title: 'Malaysian DeFi regulatory context',
    body: "Malaysia's SC framework treats most DeFi activity as outside the Capital Markets and Services Act unless the protocol issues a security token. Stablecoin holdings and lending are not currently classified as securities. RWA tokens that wrap regulated instruments (treasuries, equity) WILL fall under SC purview — buyer beware. Bank Negara has signalled AML/KYC enforcement on on/off ramps, not on the underlying contracts.",
    links: ['rwa-tokenization'],
    sources: ['notes/sc-defi-2024.md'] },
  { slug: 'lending-markets', title: 'On-chain lending markets',
    body: "Aave V3 and Compound V3 (Comet) are the two main lending markets. Aave's eMode boosts capital efficiency for correlated assets (e.g., 95% LTV between stables). Comet uses a single-base-asset model: USDC base, all other assets are collateral only. Sustainable rates: 3-6% on USDC. Risk: smart-contract risk + oracle manipulation in volatile markets.",
    links: ['stablecoin-yield-overview'],
    sources: ['research/aave-v3.md','research/compound-comet.md'] },
  { slug: 've-tokenomics', title: 've-tokenomics',
    body: "Curve's vote-escrowed (ve) model locks CRV for up to 4 years in exchange for veCRV — a non-transferable governance token whose voting power decays linearly. Lockers get protocol fees, gauge voting (directs CRV emissions to specific pools), and a boost multiplier. Convex (CVX) abstracts this: one-shot lock through Convex, get CVX + cvxCRV with continuous yield and tradable claims.",
    links: ['curve-stableswap'],
    sources: ['research/curve-ve-design.md'] },
];

const provider = new JsonRpcProvider(zg.rpcUrl);
const signer = new Wallet(pk, provider);

const galileo = defineChain({
  id: zg.chainId,
  name: '0G Galileo',
  nativeCurrency: { name: 'OG', symbol: 'OG', decimals: 18 },
  rpcUrls: { default: { http: [zg.rpcUrl] } },
});
const ogAccount = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));
const ogPublic = createPublicClient({ chain: galileo, transport: http(zg.rpcUrl) });
const ogWallet = createWalletClient({ account: ogAccount, chain: galileo, transport: http(zg.rpcUrl) });

const flowAbi = [
  { type:'function', name:'submit', stateMutability:'payable',
    inputs:[{ name:'submission', type:'tuple', components:[
      { name:'data', type:'tuple', components:[
        { name:'length', type:'uint256' }, { name:'tags', type:'bytes' },
        { name:'nodes', type:'tuple[]', components:[
          { name:'root', type:'bytes32' }, { name:'height', type:'uint256' }] }] },
      { name:'submitter', type:'address' }] }],
    outputs:[
      { name:'', type:'uint256' }, { name:'', type:'bytes32' },
      { name:'', type:'uint256' }, { name:'', type:'uint256' }] },
  { type:'function', name:'market', stateMutability:'view', inputs:[], outputs:[{type:'address'}] },
] as const;
const marketAbi = [
  { type:'function', name:'pricePerSector', stateMutability:'view', inputs:[], outputs:[{type:'uint256'}] },
] as const;

// Match seed-brain.ts: rebuild manifest with deterministic-ish timestamps
// (each article's updatedAt mirrors what the failed run wrote — Date.now()
// at the moment of run). For idempotency here, use a fixed timestamp so
// the rootHash is reproducible. The original failed run produced
// 0xe83dd37774…0160a21 — if our timestamp differs we get a different root,
// and we'll just push what we re-build.
const ts = '2026-05-02T12:48:00.000Z';
const articles = SAMPLE_ARTICLES.map((a) => ({ ...a, updatedAt: ts }));
const snapshotManifest: SnapshotManifest = {
  brainOwner: signer.address.toLowerCase(),
  createdAt: ts,
  articleCount: articles.length,
  articles: articles.map((a) => ({
    slug: a.slug,
    contentHash: keccak256(toUtf8Bytes(a.body)),
    bytes: new TextEncoder().encode(a.body).length,
  })),
  previousRoot: null,
  payload: articles,
};
const manifestBytes = new TextEncoder().encode(JSON.stringify(snapshotManifest));

console.log(`push-segments: deployer=${signer.address}`);
console.log(`               manifest bytes=${manifestBytes.length}`);

console.log('\n1. Flow.submit (re-submit to get fresh txSeq)');
const built = await buildSubmissionFromBytes(manifestBytes);
console.log(`   computed rootHash: ${built.rootHash}`);

const marketAddr = await ogPublic.readContract({
  address: zg.flowContractAddress as Address, abi: flowAbi, functionName: 'market',
});
const pricePerSector = await ogPublic.readContract({
  address: marketAddr, abi: marketAbi, functionName: 'pricePerSector',
});
let sectors = 0n;
for (const n of built.nodes) sectors += 1n << BigInt(n.height);
const fee = sectors * pricePerSector;
console.log(`   fee: ${fee} wei`);

const txHash = await ogWallet.writeContract({
  address: zg.flowContractAddress as Address, abi: flowAbi, functionName: 'submit',
  args: [{
    data: { length: BigInt(built.length), tags: '0x' as Hex,
      nodes: built.nodes.map((n) => ({ root: n.root, height: BigInt(n.height) })) },
    submitter: ogAccount.address,
  }], value: fee,
});
const rcpt = await ogPublic.waitForTransactionReceipt({ hash: txHash });
if (rcpt.status !== 'success') throw new Error(`Flow.submit reverted: ${txHash}`);
console.log(`   txHash: ${txHash}`);

// Submit event signature is keccak256("Submit(address,bytes32,uint256,uint256,uint256,(uint256,bytes,(bytes32,uint256)[]))")
// = 0x167ce04d… on the deployed Flow at 0x22E03a6A. Topics layout:
//   [0]=sig  [1]=indexed sender  [2]=indexed identityHash (root)
// data = abi.encode(uint256 submissionIndex, uint256 startIndex, uint256 length, SubmissionData)
// — so txSeq is the FIRST 32 bytes of data, not topics[3].
const SUBMIT_TOPIC0 = '0x167ce04d2aa1981994d3a31695da0d785373335b1078cec239a1a3a2c7675555';
void ethersId;
const log = rcpt.logs.find(
  (l) => l.address.toLowerCase() === zg.flowContractAddress.toLowerCase() && l.topics[0]?.toLowerCase() === SUBMIT_TOPIC0,
);
if (!log) throw new Error('push-segments: Submit event not found');
const txSeq = BigInt(log.data.slice(0, 66));
if (txSeq === undefined) throw new Error('push-segments: txSeq missing from receipt');
console.log(`   txSeq: ${txSeq}`);

console.log('\n2. uploadSegments → storage nodes');
const upload = await uploadSegments(manifestBytes, {
  indexerUrl: zg.storageIndexerUrl,
  txSeq,
  expectedReplica: 1,
});
console.log(`   nodes: ${upload.storageNodeUrls.join(', ')}`);
console.log(`   finalized: ${upload.finalized}`);
console.log(`   rootHash:  ${upload.rootHash}`);
if (upload.rootHash.toLowerCase() !== built.rootHash.toLowerCase()) {
  console.warn(`   ⚠ pushed rootHash differs from built: ${upload.rootHash} vs ${built.rootHash}`);
}

console.log(`\n✓ pushed segments for rootHash ${upload.rootHash}`);
console.log(`  brain handler should now fetchSnapshot successfully.`);
console.log(`  if rootHash differs from what's in Brain.sol/ENS, run appendStorageRoot + update ENS.`);
