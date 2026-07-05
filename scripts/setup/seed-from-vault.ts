#!/usr/bin/env bun
/**
 * Seed a Brain end-to-end from a real Obsidian vault — exercises the full
 * onboarding path described in the spec:
 *
 *   1. readVault(path)  → ObsidianNote[]   (frontmatter + body + wikilinks)
 *   2. buildGraph(notes) → adjacency + backlinks (used for "this article links to…")
 *   3. Convert each note into an ArticleRecord (no Claude compile step here —
 *      the spec asks the host LLM to compile clusters into wiki articles, but
 *      for a script-driven proof we treat each note as an article. This still
 *      proves the parser → 0G storage → iNFT pipeline works end-to-end.)
 *   4. Hand-roll Flow.submit on Galileo (SDK 0.3.3 ABI mismatch workaround) +
 *      uploadSegments so the indexer can serve the manifest back.
 *   5. Brain.mint(deployer, rootHash, description) on the new Brain.sol.
 *   6. setMinPayment.
 *   7. registerSubname(label, deployer) on SubnameRegistrar.
 *   8. writeBrainRecords (8 brain.* fields) on the new subname.
 *
 * Usage:
 *   bun run scripts/setup/seed-from-vault.ts \
 *     --vault scripts/demo/sample-vault \
 *     --label vaultdemo \
 *     --specialty agentic-web-knowledge
 *
 * The label/specialty are fully overridable so this works against any vault,
 * not just our sample. Keeps the existing yudhi/malaysia/rwa brains intact —
 * mints a new tokenId rather than mutating any of them.
 */
import { parseArgs } from 'node:util';
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  id as ethersId,
  keccak256,
  toUtf8Bytes,
  type Log,
} from 'ethers';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256 as viemKeccak256,
  stringToBytes,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, mainnet } from 'viem/chains';
import { addEnsContracts } from '@ensdomains/ensjs';
import { readVault, readVaultFromRest, buildGraph } from '@brainpedia/obsidian-parser';
import {
  loadZgConfig,
  buildSubmissionFromBytes,
  uploadSegments,
  type SnapshotManifest,
  type ArticleRecord,
} from '@brainpedia/storage-0g';
import {
  loadEnsConfig,
  registerSubname,
  writeBrainRecords,
  subnameRegistrarAbi,
  formatPriceQuery,
} from '@brainpedia/ens';

const { values } = parseArgs({
  options: {
    vault: { type: 'string' },
    label: { type: 'string', default: 'vaultdemo' },
    specialty: { type: 'string', default: 'agentic-web-knowledge' },
    'price-wei': { type: 'string', default: '1000000000000000' }, // 0.001 OG
    'axl-peer-id': {
      type: 'string',
      default: '03e61956b02e12b028b6d34376fbdec962a0ac08bfcc087a594070493738ef2a',
    },
  },
});

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`seed-from-vault: missing env ${name}`);
    process.exit(1);
  }
  return v;
}

const pk = must('PRIVATE_KEY') as Hex;
const inftAddress = must('ZG_INFT_CONTRACT_ADDRESS');
const ensRpcUrl = must('ENS_RPC_URL');
const ensNetwork = (process.env.ENS_NETWORK ?? 'sepolia') as 'mainnet' | 'sepolia';
const restUrl = process.env.OBSIDIAN_REST_API_URL;
const restKey = process.env.OBSIDIAN_REST_API_KEY;
const restRootPath = process.env.OBSIDIAN_VAULT_PATH;
const vaultPath = values.vault ?? process.env.BRAINPEDIA_DEFAULT_VAULT_PATH;

if (!restKey && !vaultPath) {
  console.error(
    'seed-from-vault: provide either OBSIDIAN_REST_API_KEY (with optional OBSIDIAN_REST_API_URL + OBSIDIAN_VAULT_PATH) ' +
      'for REST mode, or --vault / BRAINPEDIA_DEFAULT_VAULT_PATH for filesystem mode.',
  );
  process.exit(1);
}

console.log(`seed-from-vault: ${values.label}.${process.env.ENS_PARENT_NAME}`);
if (restKey) {
  console.log(`                 source=rest ${restUrl ?? 'http://localhost:27123'} path=${restRootPath ?? '/'}`);
} else {
  console.log(`                 source=fs ${vaultPath}`);
}
console.log(`                 specialty=${values.specialty}`);

// 1. Walk the vault. REST takes precedence so the demo flow that uses the
//    Railway-hosted Obsidian doesn't require a filesystem path.
console.log('\n1. parsing vault');
const notes = restKey
  ? await readVaultFromRest({
      baseUrl: restUrl ?? 'http://localhost:27123',
      apiKey: restKey,
      rootPath: restRootPath,
    })
  : await readVault(vaultPath!);
const graph = buildGraph(notes);
console.log(`   ${notes.length} notes, ${Object.keys(graph.backlinks).length} backlink targets`);

// 2. Convert notes → articles. Each note's slug becomes the article slug; we
//    keep the note's frontmatter title (or fall back to slug-as-title) and
//    the note body. The links array is the parser's wikilink output.
const articles: ArticleRecord[] = notes.map((n) => ({
  slug: n.slug,
  title: (n.frontmatter?.title as string | undefined) ?? n.slug,
  body: n.body,
  links: n.links,
  sources: ['obsidian-vault'],
  updatedAt: new Date().toISOString(),
}));

// 3. Build the snapshot manifest (same shape seed-brain.ts produces).
const zg = loadZgConfig();
const provider = new JsonRpcProvider(zg.rpcUrl);
const signer = new Wallet(pk, provider);

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

const flowAbi = [
  { type: 'function', name: 'submit', stateMutability: 'payable',
    inputs: [{ name: 'submission', type: 'tuple', components: [
      { name: 'data', type: 'tuple', components: [
        { name: 'length', type: 'uint256' }, { name: 'tags', type: 'bytes' },
        { name: 'nodes', type: 'tuple[]', components: [
          { name: 'root', type: 'bytes32' }, { name: 'height', type: 'uint256' }] }] },
      { name: 'submitter', type: 'address' }] }],
    outputs: [{ name: '', type: 'uint256' }, { name: '', type: 'bytes32' }, { name: '', type: 'uint256' }, { name: '', type: 'uint256' }] },
  { type: 'function', name: 'market', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;
const marketAbi = [
  { type: 'function', name: 'pricePerSector', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

const snapshotManifest: SnapshotManifest = {
  brainOwner: signer.address.toLowerCase(),
  createdAt: new Date().toISOString(),
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
console.log(`   manifest: ${manifestBytes.length} bytes`);

// 4. Flow.submit + uploadSegments. The Submit event's submissionIndex lives
//    in data[0:32], not topics[3] — see seed-brain.ts comment.
console.log('\n2. Flow.submit (hand-rolled 2-field tuple via viem)');
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
const flowFee = sectors * pricePerSector;

const submitTx = await ogWallet.writeContract({
  address: zg.flowContractAddress as Address, abi: flowAbi, functionName: 'submit',
  args: [{
    data: { length: BigInt(built.length), tags: '0x' as Hex,
      nodes: built.nodes.map((n) => ({ root: n.root, height: BigInt(n.height) })) },
    submitter: ogAccount.address,
  }], value: flowFee,
});
// Galileo's RPC frequently 404s on the first poll for ~30-60s after submit.
// viem's default timeout (~30s) and 4s retry are too tight; bump generously.
const submitReceipt = await ogPublic.waitForTransactionReceipt({
  hash: submitTx,
  timeout: 240_000,
  retryDelay: 6_000,
  retryCount: 40,
});
if (submitReceipt.status !== 'success') throw new Error(`Flow.submit reverted: ${submitTx}`);
console.log(`   txHash: ${submitTx}`);

const SUBMIT_TOPIC0 = '0x167ce04d2aa1981994d3a31695da0d785373335b1078cec239a1a3a2c7675555';
const submitLog = submitReceipt.logs.find(
  (l) => l.address.toLowerCase() === zg.flowContractAddress.toLowerCase() && l.topics[0]?.toLowerCase() === SUBMIT_TOPIC0,
);
if (!submitLog) throw new Error('seed-from-vault: Submit event not found');
const txSeq = BigInt(submitLog.data.slice(0, 66));
console.log(`   txSeq: ${txSeq}`);

console.log('\n3. uploadSegments → storage nodes');
const upload = await uploadSegments(manifestBytes, {
  indexerUrl: zg.storageIndexerUrl,
  txSeq,
  expectedReplica: 1,
});
console.log(`   nodes: ${upload.storageNodeUrls.join(', ')}`);
console.log(`   finalized: ${upload.finalized}`);
if (upload.rootHash.toLowerCase() !== built.rootHash.toLowerCase()) {
  throw new Error(`rootHash mismatch: built=${built.rootHash}, pushed=${upload.rootHash}`);
}

// 5. Mint via BrainMinter (permissionless wrapper) + setMinPayment.
//    BrainMinter owns Brain.sol; mintToSender(root, desc) lets ANY caller
//    mint a Brain to themselves (msg.sender). No deployer privilege needed —
//    your teammate runs the same script and gets their own iNFT.
console.log('\n4. BrainMinter.mintToSender');
const minterAddress = process.env.BRAIN_MINTER_ADDRESS;
if (!minterAddress) {
  console.error('seed-from-vault: BRAIN_MINTER_ADDRESS env var required');
  process.exit(1);
}
const minterAbi = [
  'function mintToSender(bytes32,string) payable returns (uint256)',
  'function mintFeeWei() view returns (uint256)',
] as const;
const brainAbi = [
  'function setMinPayment(uint256,uint256)',
  'event BrainMinted(uint256 indexed,address indexed,bytes32)',
] as const;
const minter = new Contract(minterAddress, minterAbi, signer) as unknown as {
  mintFeeWei: () => Promise<bigint>;
  mintToSender: (root: string, desc: string, overrides?: { value?: bigint }) => Promise<{ wait: () => Promise<{ hash: string; logs: Log[] }> }>;
};
const brain = new Contract(inftAddress, brainAbi, signer) as unknown as {
  setMinPayment: (id: bigint, amount: bigint) => Promise<{ wait: () => Promise<unknown> }>;
};
const fee = await minter.mintFeeWei();
const mintTx = await minter.mintToSender(
  built.rootHash,
  `${values.specialty} brain — ${notes.length} compiled vault notes`,
  { value: fee },
);
const mintRcpt = await mintTx.wait();
const mintTopic = ethersId('BrainMinted(uint256,address,bytes32)');
const mintLog = mintRcpt.logs.find((l) => l.topics[0] === mintTopic);
if (!mintLog?.topics[1]) throw new Error('BrainMinted event missing');
const tokenId = BigInt(mintLog.topics[1]);
console.log(`   tokenId: ${tokenId}`);
console.log(`   tx: ${mintRcpt.hash}`);

const priceWei = BigInt(values['price-wei']!);
console.log(`\n5. setMinPayment(${tokenId}, ${priceWei})`);
const setTx = await brain.setMinPayment(tokenId, priceWei);
await setTx.wait();
console.log('   ok');

// 6. Register ENS subname + write text records.
const ens = loadEnsConfig();
const chain = addEnsContracts(ensNetwork === 'mainnet' ? mainnet : sepolia);
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex));
const ensPublic = createPublicClient({ chain, transport: http(ensRpcUrl) });
const ensWallet = createWalletClient({ account, chain, transport: http(ensRpcUrl) });

console.log(`\n6. ensure ${values.label}.${ens.parentName} registered`);
const labelHash = viemKeccak256(stringToBytes(values.label!));
const labelOwner = (await ensPublic.readContract({
  address: ens.subnameRegistrarAddress, abi: subnameRegistrarAbi,
  functionName: 'ownerOfLabel', args: [labelHash],
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
  throw new Error(`${values.label}.${ens.parentName} owned by ${labelOwner}`);
}

console.log(`\n7. writeBrainRecords`);
const records = {
  description: `${values.specialty} — compiled from ${notes.length} Obsidian notes (${graph.notes.length} cross-linked)`,
  url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://brainpedia.up.railway.app'}/${values.label}`,
  inft: `${inftAddress}:${tokenId}`,
  storageRoot: built.rootHash,
  axlPeerId: values['axl-peer-id']!,
  specialty: values.specialty!,
  priceQuery: formatPriceQuery(priceWei),
  computeUrl: process.env.ZG_COMPUTE_PROVIDER_URL ?? '',
};
const result = await writeBrainRecords(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { publicClient: ensPublic as any, walletClient: ensWallet as any, config: ens },
  values.label!,
  records,
);
console.log(`   tx: ${result.txHash}`);

console.log(`\n✓ ${values.label}.${ens.parentName} live`);
console.log(`  iNFT:         ${inftAddress}:${tokenId}`);
console.log(`  storage root: ${built.rootHash}`);
console.log(`  view: https://brainpedia.up.railway.app/${values.label}`);
console.log(`  notes:`);
for (const n of notes) console.log(`    - ${n.slug} (${n.links.length} links → [${n.links.slice(0, 3).join(', ')}${n.links.length > 3 ? '…' : ''}])`);
