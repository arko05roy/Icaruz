import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { JsonRpcProvider, Wallet, Contract, type TransactionReceipt } from 'ethers';
import { http, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { addEnsContracts } from '@ensdomains/ensjs';
import {
  loadEnsConfig,
  createEnsPublicClient,
  resolveBrain,
  writeBrainRecords,
  viemChainForNetwork,
} from '@brainpedia/ens';
import {
  loadZgConfig,
  createBrainKvClient,
  createBrainLogClient,
  streamIdForBrain,
  type ArticleRecord,
} from '@brainpedia/storage-0g';
import { readVault, buildGraph } from '@brainpedia/obsidian-parser';

export const syncVaultTool: Tool = {
  name: 'sync_vault',
  description:
    "Re-read the Brain owner's vault, diff against the current 0G Storage snapshot, " +
    'upload a new snapshot chained to the previous root, append the new merkle root ' +
    "to Brain.sol's IntelligentData[], and update the brain.storage_root ENS text record.",
  inputSchema: {
    type: 'object',
    properties: {
      label: { type: 'string', description: 'ENS subname label (e.g., "yudhi").' },
      brainOwner: {
        type: 'string',
        description: '0x address of the Brain owner — must match Brain.sol ownerOf(tokenId).',
      },
      vaultPath: { type: 'string' },
      compiledArticles: {
        type: 'array',
        description:
          "If the host LLM has already recompiled the vault into articles, pass them here. " +
          "Otherwise the tool returns the diff and asks the host LLM to compile the changes.",
        items: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
            title: { type: 'string' },
            body: { type: 'string' },
            links: { type: 'array', items: { type: 'string' } },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['slug', 'title', 'body'],
        },
      },
    },
    required: ['label', 'brainOwner'],
  },
};

const inputSchema = z.object({
  label: z.string().min(1).max(64),
  brainOwner: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  vaultPath: z.string().optional(),
  compiledArticles: z
    .array(
      z.object({
        slug: z.string(),
        title: z.string(),
        body: z.string(),
        links: z.array(z.string()).optional().default([]),
        sources: z.array(z.string()).optional().default([]),
      }),
    )
    .optional(),
});

const brainAbi = [
  'function appendStorageRoot(uint256 tokenId, bytes32 storageRoot, string description)',
] as const;

export async function handleSyncVault(args: Record<string, unknown>) {
  const parsed = inputSchema.safeParse(args);
  if (!parsed.success) {
    return errResp(`sync_vault: invalid args — ${parsed.error.message}`);
  }
  const wallet = process.env.ZG_WALLET_PRIVATE_KEY;
  const inftAddress = process.env.ZG_INFT_CONTRACT_ADDRESS;
  if (!wallet) return errResp('sync_vault: ZG_WALLET_PRIVATE_KEY required');
  if (!inftAddress) return errResp('sync_vault: ZG_INFT_CONTRACT_ADDRESS required');

  const ens = loadEnsConfig();
  const zg = loadZgConfig();
  const ensPublic = createEnsPublicClient(ens);

  // 1. Resolve current Brain state from ENS.
  const fullName = `${parsed.data.label}.${ens.parentName}`;
  const brain = await resolveBrain({ publicClient: ensPublic, config: ens }, fullName);
  if (!brain.records.inft) return errResp(`sync_vault: ${fullName} has no brain.inft record`);
  const [_addr, tokenIdStr] = brain.records.inft.split(':');
  const tokenId = BigInt(tokenIdStr!);
  const previousRoot = brain.records.storageRoot ?? null;

  // 2. If no compiledArticles passed, return the diff for the host LLM to act on.
  const vaultPath = parsed.data.vaultPath ?? process.env.BRAINPEDIA_DEFAULT_VAULT_PATH;
  if (!parsed.data.compiledArticles) {
    if (!vaultPath) return errResp('sync_vault: vaultPath or compiledArticles required');
    const notes = await readVault(vaultPath);
    const graph = buildGraph(notes);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              currentSnapshotRoot: previousRoot,
              vault: {
                path: vaultPath,
                noteCount: notes.length,
                tagCount: new Set(notes.flatMap((n) => n.tags)).size,
                linkCount: notes.reduce((acc, n) => acc + n.links.length, 0),
              },
              graphSummary: Object.fromEntries(
                Object.entries(graph.adjacency).slice(0, 30),
              ),
              nextStep:
                "Recompile articles for any clusters whose source notes have changed, " +
                "then call sync_vault again with compiledArticles set.",
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  const now = new Date().toISOString();
  const articles: ArticleRecord[] = parsed.data.compiledArticles.map((a) => ({
    ...a,
    links: a.links ?? [],
    sources: a.sources ?? [],
    updatedAt: now,
  }));

  // 3. Push articles into KV (live state).
  const kv = createBrainKvClient(zg, wallet);
  const log = createBrainLogClient(zg, wallet);
  const streamId = streamIdForBrain(parsed.data.brainOwner);
  const kvWrites: Array<{ slug: string; txHash: string }> = [];
  for (const a of articles) {
    const { txHash } = await kv.putArticle(streamId, a);
    kvWrites.push({ slug: a.slug, txHash });
  }

  // 4. Upload new snapshot chained to the previous root.
  const snapshot = await log.uploadSnapshot(parsed.data.brainOwner, articles, previousRoot);

  // 5. Append the new root to Brain.sol's IntelligentData[].
  const provider = new JsonRpcProvider(zg.rpcUrl);
  const signer = new Wallet(wallet, provider);
  const brainContract = new Contract(inftAddress, brainAbi, signer) as unknown as {
    appendStorageRoot: (
      tokenId: bigint,
      root: string,
      desc: string,
    ) => Promise<{ wait: () => Promise<TransactionReceipt> }>;
  };
  const desc = `sync — ${articles.length} articles compiled at ${now}`;
  const tx = await brainContract.appendStorageRoot(tokenId, snapshot.rootHash, desc);
  const receipt = await tx.wait();

  // 6. Update brain.storage_root on ENS.
  const account = privateKeyToAccount(`0x${wallet.replace(/^0x/, '')}`);
  const chain = addEnsContracts(viemChainForNetwork(ens.network));
  const ensWallet = createWalletClient({ account, chain, transport: http(ens.rpcUrl) });
  const ensTx = await writeBrainRecords(
    { publicClient: ensPublic, walletClient: ensWallet, config: ens },
    parsed.data.label,
    { storageRoot: snapshot.rootHash },
  );

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            brainEnsName: fullName,
            previousRoot,
            newRoot: snapshot.rootHash,
            iNFT: {
              tokenId: tokenId.toString(),
              appendTxHash: receipt.hash,
              explorer: `${zg.explorerUrl}/tx/${receipt.hash}`,
            },
            ens: { textRecordUpdate: ensTx.txHash },
            kvWrites,
            articleCount: articles.length,
          },
          null,
          2,
        ),
      },
    ],
  };
}

function errResp(message: string) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}
