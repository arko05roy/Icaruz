# brainpedia-mcp

> Turn any folder of personal knowledge (Obsidian vault, markdown notes, research archive) into a paid AI Brain on **0G mainnet** that other agents pay to query. ERC-7857 iNFT. Mixture-of-Brains royalty settlement. No central API.

[![npm version](https://img.shields.io/npm/v/brainpedia-mcp.svg)](https://www.npmjs.com/package/brainpedia-mcp)
[![mainnet contracts](https://img.shields.io/badge/0G-mainnet%20Aristotle-5e6ad2)](https://chainscan.0g.ai/address/0x8c2be2d73876ec7bd8a190f3317f3c6ca91d66d6)

The Brainpedia MCP server gives Claude Code (and any MCP host) a 7-tool surface that mints, syncs, queries, and settles Brains on 0G. The web counterpart at [brainpedia.up.railway.app/create](https://brainpedia.up.railway.app/create) covers the no-CLI path; this package is for power users who want their live vault to keep updating their Brain on every save.

## Install on Claude Code in one command

```bash
claude mcp add-json brainpedia '{
  "command": "npx",
  "args": ["-y", "brainpedia-mcp@latest"],
  "env": {
    "ZG_WALLET_PRIVATE_KEY": "0x<your 0G mainnet private key>",
    "ZG_RPC_URL": "https://evmrpc.0g.ai",
    "ZG_CHAIN_ID": "16661",
    "ZG_FLOW_CONTRACT_ADDRESS": "0x62D4144dB0F0a6fBBaeb6296c785C71B3D57C526",
    "ZG_STORAGE_INDEXER_URL": "https://indexer-storage-turbo.0g.ai",
    "ZG_EXPLORER_URL": "https://chainscan.0g.ai",
    "ZG_INFT_CONTRACT_ADDRESS": "0x8C2BE2D73876ec7BD8A190f3317f3C6cA91d66D6",
    "BRAIN_MINTER_ADDRESS": "0x1a64F3296aE427CaF760A493F82Dc6D786d99005",
    "ROYALTY_DISTRIBUTOR_ADDRESS": "0x7AF89556A11FCfE6cF1c3e3D1c36AfBcee2f0073",
    "ENS_NETWORK": "sepolia",
    "ENS_PARENT_NAME": "bpedia.eth",
    "ENS_RPC_URL": "https://ethereum-sepolia.publicnode.com",
    "ENS_SUBNAME_REGISTRAR_ADDRESS": "0xBb921bFFBbbE2219D1EC365213a74097348F28F0",
    "ENS_ACCESS_TOKEN_REGISTRAR_ADDRESS": "0x3e7D22150d6b883a89703d760d66743D2223456b",
    "BRAINPEDIA_API_URL": "https://brainpedia.up.railway.app",
    "OBSIDIAN_REST_API_KEY": "<paste from Local REST API plugin settings>",
    "OBSIDIAN_VAULT_PATH": "users/<your handle>"
  }
}' --scope user
```

Restart Claude Code after running. The 7 Brainpedia tools appear in the `/mcp` menu.

### What each env var means

| Var | Meaning |
|---|---|
| `ZG_WALLET_PRIVATE_KEY` | The deployer/operator key for your Brain. Holds the 0G iNFT, signs storage uploads, signs the mint tx. **Use a fresh wallet with a small amount of 0G; do not paste a key you care about.** |
| `ZG_RPC_URL` | 0G Aristotle mainnet JSON-RPC. Override with a paid provider if you hit rate limits. |
| `ZG_FLOW_CONTRACT_ADDRESS` | 0G Storage Log layer contract. Same for every Brain. |
| `ZG_STORAGE_INDEXER_URL` | 0G Storage indexer for the Log layer. |
| `ZG_INFT_CONTRACT_ADDRESS` | The deployed canonical `Brain.sol` ERC-7857 contract on 0G mainnet. |
| `BRAIN_MINTER_ADDRESS` | The permissionless mint wrapper that owns Brain.sol. Any wallet can call `mintToSender`. |
| `ROYALTY_DISTRIBUTOR_ADDRESS` | Multi-Brain royalty settlement contract. One tx pays N Brains. |
| `ENS_*` | Sepolia ENS resolver setup so your Brain gets a `<label>.bpedia.eth` discovery name with all `brain.*` text records (inft, peer_id, price_query, storage_root). |
| `BRAINPEDIA_API_URL` | URL of the public Brainpedia web app (used for discovery + mixture orchestration). |
| `OBSIDIAN_REST_API_KEY` | API key from the [Obsidian Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api). Lets the MCP server read your live vault. |
| `OBSIDIAN_VAULT_PATH` | Folder inside your hosted Obsidian where this Brain's notes live (e.g. `users/yourhandle`). |

### Tools the server exposes

| Tool | What it does |
|---|---|
| `setup_brain` | Parses your vault, returns the compile schema Claude should follow when writing wiki articles |
| `upload_articles` | Pushes the compiled wiki snapshot to 0G Storage Log, returns the merkle rootHash |
| `finalize_brain` | Calls `BrainMinter.mintToSender(rootHash, ...)`, then writes all `brain.*` text records to your ENS subname |
| `sync_vault` | Re-parses the vault, re-compiles changed articles, appends a new storage root via `Brain.appendStorageRoot` |
| `query_brain` | Run inference against a single Brain (yours or someone else's) via 0G Compute (TEE-attested gpt-5.4-mini on a Phala dstack TEE node) |
| `query_mixture` | Fan out a query to N Brains under a discovery topic; returns redacted citations + the on-chain payment plan |
| `settle_mixture` | Build + send the `RoyaltyDistributor.distribute(tokenIds[], amounts[], reason)` tx that unlocks the synthesized answer |

## How a Brain is created

Once the MCP server is installed, tell Claude something like:

> *Set up my Brain from my Obsidian vault. Specialty: AI x Web3 protocol design. Sticker price: 0.001 OG per query.*

Claude calls `setup_brain` (returns the parse + compile schema), compiles a Karpathy-style LLM wiki following that schema, calls `upload_articles` (pushes the snapshot to 0G Storage and gets a merkle root), then `finalize_brain` (mints the iNFT and writes ENS records). Your wallet owns the iNFT. The whole flow is one conversation.

## Live mainnet contracts

| Contract | Address | Source |
|---|---|---|
| `Brain.sol` (ERC-7857) | [`0x8C2B…66D6`](https://chainscan.0g.ai/address/0x8c2be2d73876ec7bd8a190f3317f3c6ca91d66d6) | [source ↗](https://chainscan.0g.ai/v1/contract/0x8c2be2d73876ec7bd8a190f3317f3c6ca91d66d6) |
| `BrainOracle` | [`0xB737…7FD0`](https://chainscan.0g.ai/address/0xb7376a897222da0c4ee61702b797ddfe251f7fd0) | [source ↗](https://chainscan.0g.ai/v1/contract/0xb7376a897222da0c4ee61702b797ddfe251f7fd0) |
| `BrainMinter` | [`0x1a64…9005`](https://chainscan.0g.ai/address/0x1a64f3296ae427caf760a493f82dc6d786d99005) | [source ↗](https://chainscan.0g.ai/v1/contract/0x1a64f3296ae427caf760a493f82dc6d786d99005) |
| `RoyaltyDistributor` | [`0x7AF8…0073`](https://chainscan.0g.ai/address/0x7af89556a11fcfe6cf1c3e3d1c36afbcee2f0073) | [source ↗](https://chainscan.0g.ai/v1/contract/0x7af89556a11fcfe6cf1c3e3d1c36afbcee2f0073) |

Hero mixture settlement (2 Brains paid in one tx): [`0x50bbb323…`](https://chainscan.0g.ai/tx/0x50bbb323eacb42e59b4bd617f6e2486d4cc402cd6f9aaf11fc71b16af8e506ba).

## Don't use the MCP server? Use the web flow.

If you don't run Claude Code, or you don't want to touch a CLI, mint your Brain from [brainpedia.up.railway.app/create](https://brainpedia.up.railway.app/create). Drag a folder of markdown/PDF/Word/text. Connect a wallet. Sign one transaction.

## Links

- **Source**: https://github.com/0xYudhishthra/brainpedia
- **Web**: https://brainpedia.up.railway.app
- **Sample Brain**: https://brainpedia.up.railway.app/yudhi
- **0G mainnet explorer**: https://chainscan.0g.ai

## License

MIT
