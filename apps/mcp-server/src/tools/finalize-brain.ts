import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  id as ethersId,
  type Log,
  type TransactionReceipt,
} from 'ethers';
import { http, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  loadEnsConfig,
  createEnsPublicClient,
  registerSubname,
  viemChainForNetwork,
  parsePriceQuery,
  formatPriceQuery,
  addBrainToDiscoveryShortcut,
  BRAIN_TEXT_KEYS,
} from '@brainpedia/ens';
import { addEnsContracts } from '@ensdomains/ensjs';
import { loadZgConfig } from '@brainpedia/storage-0g';

export const finalizeBrainTool: Tool = {
  name: 'finalize_brain',
  description:
    'Mint the ERC-7857 Brain iNFT pointing at a 0G Storage merkle root, then ' +
    'register the ENS subname and write all brain.* text records in one shot. ' +
    'Call after upload_articles returned a snapshot rootHash.',
  inputSchema: {
    type: 'object',
    properties: {
      label: { type: 'string', description: 'ENS subname label (e.g., "yudhi")' },
      brainOwner: {
        type: 'string',
        description: '0x address that will own the iNFT and the subname.',
      },
      storageRoot: {
        type: 'string',
        description: '0x-prefixed merkle root from upload_articles.',
      },
      description: { type: 'string' },
      avatar: { type: 'string' },
      specialty: { type: 'string' },
      pricePerQuery: {
        type: 'string',
        description:
          'Price per query, in OG with 18-decimal notation. Examples: "0.001 OG", ' +
          '"0.5 OG", "1 OG". Stored as the brain.price_query ENS text record.',
      },
      computeUrl: {
        type: 'string',
        description:
          '0G Compute provider URL — stored as brain.compute_url so other agents ' +
          'can verify which TEE-attested provider this Brain uses for inference. ' +
          'If omitted, defaults to $ZG_COMPUTE_PROVIDER_URL from the environment.',
      },
      axlPeerId: {
        type: 'string',
        description:
          "Brain's AXL Ed25519 public key (hex). Used as brain.axl_peer_id.",
      },
      discoveryTopics: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Discovery shortcuts to auto-join after mint. The Brain ENS name will be ' +
          'appended to each <topic>.discover.<parent> shortcut\'s brainpedia.brains ' +
          'text record (idempotent — skips topics where the name is already listed). ' +
          'Defaults to ["all"], so every newly-minted Brain joins all.discover.<parent> ' +
          'and is immediately reachable by mixture queries with topic="all" or topic="auto". ' +
          'Pass an empty array to skip auto-discovery entirely. Note: target shortcuts must ' +
          'already exist on chain; this tool does not create new shortcut subnodes.',
      },
    },
    required: ['label', 'brainOwner', 'storageRoot'],
  },
};

const inputSchema = z.object({
  label: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/i),
  brainOwner: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  storageRoot: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  description: z.string().optional(),
  avatar: z.string().optional(),
  specialty: z.string().optional(),
  pricePerQuery: z.string().optional(),
  computeUrl: z.string().optional(),
  axlPeerId: z.string().optional(),
  discoveryTopics: z.array(z.string().min(1)).optional(),
});

// We mint through BrainMinter (a permissionless wrapper that owns Brain.sol)
// so any caller — not just the original deployer — can mint a Brain to
// themselves. The minted iNFT is owned by msg.sender; the BrainMinted event
// is emitted by Brain.sol itself.
const minterAbi = [
  'function mintToSender(bytes32 initialStorageRoot, string description) payable returns (uint256)',
  'function mintFeeWei() view returns (uint256)',
  'event Minted(uint256 indexed tokenId, address indexed minter, bytes32 storageRoot)',
] as const;
const brainAbi = [
  'event BrainMinted(uint256 indexed tokenId, address indexed owner, bytes32 storageRoot)',
] as const;

export async function handleFinalizeBrain(args: Record<string, unknown>) {
  const parsed = inputSchema.safeParse(args);
  if (!parsed.success) {
    return errorResp(`finalize_brain: invalid args — ${parsed.error.message}`);
  }

  const inftAddress = process.env.ZG_INFT_CONTRACT_ADDRESS;
  if (!inftAddress) {
    return errorResp(
      'finalize_brain: ZG_INFT_CONTRACT_ADDRESS not set. ' +
        'Deploy contracts first (see scripts/setup/prep-deploy.ts + contracts/script/Deploy.s.sol).',
    );
  }
  const minterAddress = process.env.BRAIN_MINTER_ADDRESS;
  if (!minterAddress) {
    return errorResp(
      'finalize_brain: BRAIN_MINTER_ADDRESS not set. ' +
        'BrainMinter wraps Brain.sol and lets any wallet mint to itself permissionlessly.',
    );
  }
  const wallet = process.env.ZG_WALLET_PRIVATE_KEY;
  if (!wallet) {
    return errorResp('finalize_brain: ZG_WALLET_PRIVATE_KEY env var is required.');
  }

  const zg = loadZgConfig();
  const ens = loadEnsConfig();

  // Canonicalise the price input: accept "0.001 OG", "0.001", or legacy raw
  // wei integer; always write the canonical "0.001 OG" form on chain.
  let canonicalPrice: string | undefined;
  if (parsed.data.pricePerQuery) {
    const wei = parsePriceQuery(parsed.data.pricePerQuery);
    if (wei === null) {
      return errorResp(
        `finalize_brain: pricePerQuery "${parsed.data.pricePerQuery}" is not a valid OG amount (e.g. "0.001 OG")`,
      );
    }
    canonicalPrice = formatPriceQuery(wei);
  }

  // Auto-fill compute provider URL from env when the caller didn't pass one,
  // so the brain.compute_url ENS record is never empty by accident — the same
  // provider the Brain runtime uses for inference is stored as its public
  // attestation surface.
  const resolvedComputeUrl =
    parsed.data.computeUrl ?? process.env.ZG_COMPUTE_PROVIDER_URL ?? undefined;

  // 1. Mint the iNFT on 0G chain — via BrainMinter (permissionless).
  const provider = new JsonRpcProvider(zg.rpcUrl);
  const signer = new Wallet(wallet, provider);
  const minter = new Contract(minterAddress, minterAbi, signer) as unknown as {
    mintFeeWei: () => Promise<bigint>;
    mintToSender: (
      initialStorageRoot: string,
      description: string,
      overrides?: { value?: bigint },
    ) => Promise<{ wait: () => Promise<TransactionReceipt> }>;
  };
  const fee = await minter.mintFeeWei();
  // BrainMinter mints to msg.sender. The signer's address ends up owning the
  // iNFT — no `to` argument; the Brain owner is the wallet that signed this tx.
  const tx = await minter.mintToSender(
    parsed.data.storageRoot,
    parsed.data.description ?? `Brainpedia Brain: ${parsed.data.label}`,
    { value: fee },
  );
  const receipt = (await tx.wait()) as TransactionReceipt;
  const tokenId = extractTokenId(receipt);
  if (tokenId === null) {
    return errorResp(
      `finalize_brain: BrainMinted event not found in receipt ${receipt.hash}`,
    );
  }

  // 2. Register the ENS subname + write all text records.
  const ensPublic = createEnsPublicClient(ens);
  const account = privateKeyToAccount(`0x${wallet.replace(/^0x/, '')}`);
  const ensWallet = createWalletClient({
    account,
    chain: addEnsContracts(viemChainForNetwork(ens.network)),
    transport: http(ens.rpcUrl),
  });

  const inftPair = `${inftAddress}:${tokenId}`;
  const ensResult = await registerSubname(
    { publicClient: ensPublic, walletClient: ensWallet, config: ens },
    {
      label: parsed.data.label,
      owner: parsed.data.brainOwner as `0x${string}`,
      records: {
        description: parsed.data.description,
        avatar: parsed.data.avatar,
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://brainpedia.up.railway.app'}/${parsed.data.label}`,
        inft: inftPair,
        storageRoot: parsed.data.storageRoot,
        axlPeerId: parsed.data.axlPeerId,
        specialty: parsed.data.specialty,
        priceQuery: canonicalPrice,
        computeUrl: resolvedComputeUrl,
      },
    },
  );

  // Auto-join discovery shortcuts so the new Brain is immediately reachable
  // by mixture queries. Default to ["all"] (universal shortcut). Each join is
  // idempotent — if the Brain is already listed, the on-chain write is skipped.
  const topicsToJoin = parsed.data.discoveryTopics ?? ['all'];
  const discoveryResults: Array<{
    topic: string;
    txHash: string | null;
    alreadyListed: boolean;
    brainCount: number;
    error?: string;
  }> = [];
  for (const topic of topicsToJoin) {
    try {
      const r = await addBrainToDiscoveryShortcut(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { publicClient: ensPublic as any, walletClient: ensWallet as any, config: ens },
        topic,
        ensResult.fullName,
      );
      discoveryResults.push({
        topic,
        txHash: r.txHash,
        alreadyListed: r.alreadyListed,
        brainCount: r.brains.length,
      });
    } catch (err) {
      discoveryResults.push({
        topic,
        txHash: null,
        alreadyListed: false,
        brainCount: 0,
        error: (err as Error).message,
      });
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            iNFT: {
              contract: inftAddress,
              tokenId: tokenId.toString(),
              mintTxHash: receipt.hash,
              explorer: `${zg.explorerUrl}/tx/${receipt.hash}`,
            },
            ens: {
              fullName: ensResult.fullName,
              registerTxHash: ensResult.registerTxHash,
              textRecordsTxHash: ensResult.textRecordsTxHash,
            },
            discovery: {
              topicsJoined: discoveryResults,
              note: 'Brain is now listed in the discovery shortcuts above and reachable by mixture queries. Pass discoveryTopics=[] on a future call to skip this step.',
            },
            textRecords: {
              [BRAIN_TEXT_KEYS.inft]: inftPair,
              [BRAIN_TEXT_KEYS.storageRoot]: parsed.data.storageRoot,
              [BRAIN_TEXT_KEYS.specialty]: parsed.data.specialty ?? null,
              [BRAIN_TEXT_KEYS.priceQuery]: canonicalPrice ?? null,
              [BRAIN_TEXT_KEYS.computeUrl]: resolvedComputeUrl ?? null,
            },
            brainPageUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://brainpedia.up.railway.app'}/${parsed.data.label}`,
            ensExplorerUrl: `https://sepolia.app.ens.domains/${ensResult.fullName}`,
            wrapUpForUser: [
              `Your Brain is live: ${parsed.data.label}.bpedia.eth (tokenId ${tokenId.toString()}).`,
              `Brain page: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://brainpedia.up.railway.app'}/${parsed.data.label}`,
              `ENS records: https://sepolia.app.ens.domains/${ensResult.fullName}`,
              `Mint tx: ${zg.explorerUrl}/tx/${receipt.hash}`,
              'Show the user these three links and tell them their Brain is now reachable to other agents.',
            ],
          },
          null,
          2,
        ),
      },
    ],
  };
}

function extractTokenId(receipt: TransactionReceipt): bigint | null {
  // BrainMinted(uint256 indexed tokenId, address indexed owner, bytes32 storageRoot)
  const topic = ethersId('BrainMinted(uint256,address,bytes32)');
  const log = receipt.logs.find((l: Log) => l.topics[0] === topic);
  if (!log || !log.topics[1]) return null;
  return BigInt(log.topics[1]);
}

function errorResp(message: string) {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}
