# Brainpedia

> Brainpedia is a network where any human turns any folder of knowledge (markdown, PDF, Word, plain text) into ERC-7857 AI Brains on 0G that other agents pay to query.

- **Live web**: https://brainpedia.up.railway.app
- **Mint a Brain (no CLI)**: https://brainpedia.up.railway.app/create
- **Sample Brain**: https://brainpedia.up.railway.app/yudhi
- **Install MCP server**: `npx -y brainpedia-mcp`
- **0G integration deep-dive**: [docs/0g-integration.md](docs/0g-integration.md)
- **Architecture**: [docs/architecture.md](docs/architecture.md)
- **Security**: [contracts/SECURITY.md](contracts/SECURITY.md) · [contracts/KNOWN_ISSUES.md](contracts/KNOWN_ISSUES.md)

### Prior validation

Brainpedia previously won the **0G Best Autonomous Agents, Swarms & iNFT Innovations** prize and **ENS Best ENS Integration for AI Agents (2nd place)** at ETHGlobal Open Agents. 0G itself [announced the win on X](https://x.com/0G_labs/status/2052362392026108335). The [ethglobal.com showcase entry](https://ethglobal.com/showcase/brainpedia-ctx9g) reflects that earlier build. This submission rebuilds the project on **0G mainnet** with multi-format ingest, a web-native mint flow, a Karpathy-style knowledge framework, and the canonical ERC-7857 contract surface.

---

## The problem

Agents have no legitimate way to buy specialty knowledge. APIs are centralized, OpenAI-priced, and the human expert whose notes feed the answer sees nothing. As autonomous agents do more research, trading, and operations, this gap widens: every agent burns tokens on the same handful of general-purpose models while domain experts capture none of the value their knowledge creates.

## The solution

Brainpedia is the supply side of the agent economy. Any human publishes a folder of knowledge as a specialty AI Brain. Markdown notes, research papers (PDF), case files (Word), plain text, anything. The `@brainpedia/knowledge-compiler` pipeline extracts text per format, segments into article candidates, and compiles a Karpathy-style LLM wiki. Each Brain is an ERC-7857 iNFT minted on 0G with encrypted private metadata sealed for the owner. Other agents discover Brains, pay a per-query sticker price, and run inference against the Brain's snapshot using 0G's TEE-attested compute. A `Mixture-of-Brains` query fans out across multiple Brains and settles royalties in a single on-chain transaction. No central API, no off-chain auth service. The Brain outlives Brainpedia.

Two ways to mint:

1. **Web** at [brainpedia.up.railway.app/create](https://brainpedia.up.railway.app/create). Drag a folder, connect a wallet, sign the mint. No CLI.
2. **Claude Code** via `npx -y brainpedia-mcp`. The MCP server reads your live Obsidian vault and updates the Brain's wiki on every save. Power-user path.

## 0G integration depth: 5 of 5 components

| 0G component | How Brainpedia uses it | Where |
|---|---|---|
| **0G Storage** | KV layer for live wiki edits; Log layer for immutable merkle-rooted snapshots that the iNFT carries | `packages/storage-0g` |
| **0G Compute** | Per-query inference + Mixture-of-Brains synthesis on TEE-attested Qwen 2.5 7B Instruct on a Phala dstack TEE node via `broker.ledger` metering | `packages/compute-0g` |
| **0G Chain** | All Brain iNFT custody, royalty distribution, and minter wrappers deployed on Aristotle (chainId 16661) | `contracts/` |
| **Agent ID (ERC-7857)** | Each Brain is a canonical ERC-7857 iNFT: encrypted manifest sealed for owner, oracle-attested transfers via `BrainOracle`, append-only IntelligentData lineage | `contracts/src/Brain.sol` + `contracts/src/BrainOracle.sol` |
| **Privacy & Security (TEE)** | Every inference response carries a TEE attestation flag (`verified: true`). The TEE attestor is also the upgrade path for the BrainOracle, binding ownership transfer to verifiable key re-sealing | `packages/compute-0g` + `contracts/src/BrainOracle.sol` |

## Roadmap: how the supply side scales

| Stage | Who | What they publish | Why now |
|---|---|---|---|
| **v0.2 today** | Individual experts using Claude Code | Personal Obsidian vault, research notes | The MCP server runs locally; one person, one vault, one wallet. Demo state. |
| **v1 next** | Small specialist firms | Boutique law firms publishing case-law research, clinical research groups publishing trial protocols | Same MCP tooling at firm scale. The existing Obsidian or Notion vault becomes a paid API for other agents inside and outside the firm. |
| **v2 later** | Enterprise knowledge marketplaces | Any company carves out a specialty department's notes (compliance, IP, risk, ops) as a revenue-generating Brain | Internal teams query their own Brains; external partners query at sticker price. Royalty splits become a new revenue line. |
| **v3 vision** | Cross-firm agentic economy | Hundreds of expert Brains compose into agent workflows the way Stripe composes payments | Mixture-of-Brains settlement is already cross-firm settlement. Scaling is plumbing. |

## What's live right now

| Layer | What | Where |
|---|---|---|
| **Web app** | Public site + D3 force-directed network viz + dynamic per-Brain pages + mixture-mode `/api/query` proxy | https://brainpedia.up.railway.app |
| **MCP server** | 7 tools (`setup_brain`, `upload_articles`, `finalize_brain`, `sync_vault`, `query_brain`, `query_mixture`, `settle_mixture`) on npm | [`brainpedia-mcp` on npm](https://www.npmjs.com/package/brainpedia-mcp) |
| **`Brain.sol`** (ERC-7857 canonical) | iNFT contract holding intelligence lineage + sealed key events | mainnet [`0x8C2B…66D6`](https://chainscan.0g.ai/address/0x8c2be2d73876ec7bd8a190f3317f3c6ca91d66d6) · [verified source (API) ↗](https://chainscan.0g.ai/v1/contract/0x8c2be2d73876ec7bd8a190f3317f3c6ca91d66d6) |
| **`BrainOracle`** | EIP-712 attestor for ERC-7857 secure transfers (context-bound proofs) | mainnet [`0xB737…7FD0`](https://chainscan.0g.ai/address/0xb7376a897222da0c4ee61702b797ddfe251f7fd0) · [verified source (API) ↗](https://chainscan.0g.ai/v1/contract/0xb7376a897222da0c4ee61702b797ddfe251f7fd0) |
| **`BrainMinter`** | Permissionless self-mint wrapper, anyone can mint a Brain to themselves | mainnet [`0x1a64…9005`](https://chainscan.0g.ai/address/0x1a64f3296ae427caf760a493f82dc6d786d99005) · [verified source (API) ↗](https://chainscan.0g.ai/v1/contract/0x1a64f3296ae427caf760a493f82dc6d786d99005) |
| **`RoyaltyDistributor`** | Multi-Brain royalty settlement with pull-payment pattern | mainnet [`0x7AF8…0073`](https://chainscan.0g.ai/address/0x7af89556a11fcfe6cf1c3e3d1c36afbcee2f0073) · [verified source (API) ↗](https://chainscan.0g.ai/v1/contract/0x7af89556a11fcfe6cf1c3e3d1c36afbcee2f0073) |
| **`SubnameRegistrar`** + **`AccessTokenRegistrar`** (Sepolia) | ENS-based discovery and TTL-bounded capability tokens (supporting infrastructure) | [sepolia.app.ens.domains/bpedia.eth](https://sepolia.app.ens.domains/bpedia.eth) |
| **Brain #1** | Yudhi's Brain, tokenId 1 on 0G mainnet | [chainscan tx `0x24e7ed5f…`](https://chainscan.0g.ai/tx/0x24e7ed5f408891ee16c538b9ba7f6b57abe6009d89b640baae38a02ac06d5584) |
| **Brain #2** | Brainpedia protocol Brain, tokenId 2 | [chainscan tx `0xf691a113…`](https://chainscan.0g.ai/tx/0xf691a1136214cca48109e373ca1a4632124d5ada6e0547117770029d9f455be9) |
| **Brain #3: 0G Expert** | tokenId 3, populated by running 0G's own docs (`docs.0g.ai/llms-full.txt`) through `@brainpedia/knowledge-compiler`. 428 articles, sticker price 0.001 OG. Brainpedia hosting 0G's knowledge on 0G itself. Mint script: [`scripts/setup/mint-0g-expert-brain.ts`](scripts/setup/mint-0g-expert-brain.ts) | [chainscan tx `0x805a748d…`](https://chainscan.0g.ai/tx/0x805a748dd4d0e811219145e4b6dd85e9e2836a1d256af626c79dac699120e3b4) |
| **3-brain mixture royalty settlement** | Single tx paid all 3 Brains via `RoyaltyDistributor.distribute([1,2,3], [0.002, 0.0015, 0.0035], reason)`. 3 `Distributed` events in one block | [chainscan tx `0x9a503d7c…`](https://chainscan.0g.ai/tx/0x9a503d7c48787d423883c0b05b690c873af1389ee75e27a315ab232e8a57230c) |
| **Sealed-key Brain (ERC-7857 differentiator)** | tokenId 5, minted with non-empty `encryptedURI` + `metadataHash` + `sealedKey`. AES-256-GCM ciphertext lives on 0G Storage; only the holder of the sealed symmetric key can decrypt. Mint script: [`scripts/setup/sealed-key-demo.ts`](scripts/setup/sealed-key-demo.ts) | [chainscan tx `0xde44dcd1…`](https://chainscan.0g.ai/tx/0xde44dcd1078f611d3805b8614b2a742284d58c0ea8ad08106e5dc47a2b4da48c) |
| **Oracle-attested secureTransfer** | Brain tokenId 5 transferred via `Brain.secureTransfer` with an EIP-712 `TransferAttestation` signed by the BrainOracle attestor. Context-bound to `(tokenId, from, to, sealedKeyHash, deadline)` so a valid proof can't replay across transfers. Demo script: [`scripts/setup/secure-transfer-demo.ts`](scripts/setup/secure-transfer-demo.ts) | [chainscan tx `0x63de6e22…`](https://chainscan.0g.ai/tx/0x63de6e228f17d86915728ce3933c98a1a919c79d3fa0c3f89ffac64b4aeb6248) |
| **Brain #6: Brainpedia Security Brain** | tokenId 6, minted end-to-end through the production `/api/create` flow (preview → finalize → mint). Corpus is the project's own `contracts/SECURITY.md` + `contracts/KNOWN_ISSUES.md`. 13 articles, 0.001 OG/query. Validates the web mint path works on mainnet with no CLI. | [chainscan tx `0x83c7abf6…`](https://chainscan.0g.ai/tx/0x83c7abf61713291620b53f13924d7d506ada320d4430e0ed2ffa1d9620850c09) |

> All four Solidity contracts have verified source on `chainscan.0g.ai` with `exactMatch=true`. Confirm in one command:
>
> ```bash
> bun scripts/setup/verify-contracts-on-chainscan.ts
> ```
>
> See [contracts/SECURITY.md](contracts/SECURITY.md) for the audit summary and [contracts/KNOWN_ISSUES.md](contracts/KNOWN_ISSUES.md) for accepted risks.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Discovery & Identity (ENS, Sepolia, supporting)                │
│  *.bpedia.eth subnames + text records + TTL access tokens       │
├─────────────────────────────────────────────────────────────────┤
│  Communication (AXL P2P, supporting)                            │
│  Encrypted Yggdrasil mesh, MCP / A2A envelopes                  │
├─────────────────────────────────────────────────────────────────┤
│  Intelligence (0G Compute, core)                                │
│  TEE-attested Qwen 2.5 7B Instruct (Phala dstack TEE) + Mixture-of-Brains synth  │
├─────────────────────────────────────────────────────────────────┤
│  Persistence & Ownership (0G Storage + 0G Chain, core)          │
│  Storage KV (live wiki) + Log (snapshots) + ERC-7857 iNFT       │
│  RoyaltyDistributor for multi-Brain settlement                  │
└─────────────────────────────────────────────────────────────────┘
```

Two surfaces split by intent: the **MCP server is the write path** (read your vault, sign txs, mint brains, locally hold your key) and the **web app is the read+write path** (browse the network, query brains, settle royalties; plus `/create` for wallet-only mints with no CLI). Full diagram + Mixture-of-Brains flow in [docs/architecture.md](docs/architecture.md).

## Knowledge framework

`@brainpedia/knowledge-compiler` is a format-agnostic pipeline that turns any folder of mixed knowledge into a Karpathy-style LLM wiki ready to be snapshotted onto 0G Storage and minted as an ERC-7857 Brain. Each stage has a stable interface so new file formats and new compile backends slot in without touching downstream code.

```
File (md, txt, pdf, docx, ... )
   ↓ Extractor (one per format, pluggable)
RawDocument { text, structureHints, sourceMeta, format }
   ↓ Segmenter (heading-aware, page-aware, size-bounded)
ArticleCandidate[]
   ↓ Compiler (deterministic by default; opt-in 0G Compute TEE backend)
CompiledArticle[]
   ↓ buildGraph
ArticleGraph (articles + adjacency + backlinks)
   ↓ @brainpedia/storage-0g uploadSnapshot
0G Storage merkle rootHash
   ↓ BrainMinter.mintToSender(rootHash, ...)
ERC-7857 iNFT
```

Today's extractors: `markdown` (.md), `text` (.txt), `pdf` (.pdf via `pdf-parse`), `docx` (.docx via `mammoth`). Adding a new format means adding one Extractor implementation; the segmenter, compiler, graph, snapshot, and mint stages stay untouched. The default compiler is deterministic (kebab-slug + substring cross-references) for fast, cheap mints. An opt-in `createComputeCompiler()` backend (shipped and wired into `/api/create`) rewrites each article through 0G Compute's TEE-attested model, the same one the query path uses, so 0G Compute appears at both ends: creation and inference.

## How a query works

1. **Create a Brain**. Two paths.
   - **Web (no CLI)**: open [brainpedia.up.railway.app/create](https://brainpedia.up.railway.app/create), connect a wallet on 0G mainnet, drop a folder of mixed-format knowledge. The server runs `@brainpedia/knowledge-compiler`, uploads the compiled snapshot to 0G Storage, and returns the merkle rootHash. Your wallet signs `BrainMinter.mintToSender(rootHash, ...)`. The iNFT is owned by you, not the server.
   - **MCP (live vault sync)**: `npx -y brainpedia-mcp` inside Claude Code. Say *"set up my Brain from my Obsidian vault."* The MCP server reads your vault, lets Claude compile pages following the same schema, pushes the snapshot to 0G Storage via `upload_articles`, mints via `finalize_brain`, and writes all `brain.*` ENS text records. Subsequent saves to your vault push new snapshots via `sync_vault`.
2. **Discover**. Agents resolve `<topic>.discover.bpedia.eth`, get a list of Brain ENS names, resolve each, get peer ID, iNFT ref, and per-query sticker price.
3. **Mixture-of-Brains query**. The orchestrator fans out a question to N Brains in parallel. Each runs inference on 0G Compute (TEE-attested), returns citations + per-Brain answer.
4. **Pay-to-read settlement**. Phase 1 returns redacted citations + the on-chain payment plan (each Brain receives its sticker `brain.price_query`). The synthesised answer is gated until the agent settles via `RoyaltyDistributor.distribute(tokenIds[], amounts[], reason)` in a single transaction. The server verifies on-chain `Distributed` events match the cached plan, then releases the synthesis.
5. **Verifiable**. Every response carries `verified: true` from the TEE attestor. Settlement tx is on chain. Brain iNFTs and royalty events are explorer-readable.

## Repository layout

```
brainpedia/
├── apps/                       deployable applications
│   ├── web/                    Next.js 15: public site, D3 viz, /api/query (single + two-phase mixture w/ pay-gate)
│   ├── mcp-server/             stdio MCP for Claude Code, published as `brainpedia-mcp` (7 tools)
│   └── brain/                  Brain-side service (multi-tenant), runs on Railway
├── packages/                   shared libraries (consumed by apps; no app→app deps)
│   ├── knowledge-compiler/     Format-agnostic pipeline: md/pdf/docx/txt → Karpathy LLM wiki
│   ├── obsidian-parser/        Vault → article graph (FS + Local REST API plugin)
│   ├── storage-0g/             0G Storage KV + Log wrappers
│   ├── compute-0g/             0G Compute broker + OpenAI-compat client
│   ├── ens/                    ENS subname / text-record / access-token helpers
│   └── axl/                    AXL HTTP client + Mixture-of-Brains orchestrator types
├── contracts/                  Foundry: Brain, BrainOracle, BrainMinter, RoyaltyDistributor,
│                               SubnameRegistrar, AccessTokenRegistrar + lib/Errors
├── scripts/setup/              prep-deploy, register-parent, wire-ens, setup-compute,
│                               seed-from-vault, settle-royalties, push-segments
└── docs/                       0g-integration.md + architecture.md
```

## For reviewers (60-second onboarding)

The fastest path to verify Brainpedia works end-to-end on 0G mainnet.

1. **Verify the contracts**. Open any of the four mainnet addresses in the table above and click "verified source ↗" to see the Solidity source on `chainscan.0g.ai`. All four pass.
2. **See the hero settlement on chain**. [chainscan.0g.ai tx `0x9a503d7c…`](https://chainscan.0g.ai/tx/0x9a503d7c48787d423883c0b05b690c873af1389ee75e27a315ab232e8a57230c) settled 3 brains in one transaction via `RoyaltyDistributor.distribute([1,2,3], [0.002, 0.0015, 0.0035], reason)`. Three `Distributed` events emitted in one block.
3. **Try the web mint flow**. Open [brainpedia.up.railway.app/create](https://brainpedia.up.railway.app/create), connect a wallet with 0G mainnet (Aristotle, chainId 16661), drop a folder containing any `.md`, `.pdf`, `.docx`, or `.txt` files, and sign the mint. The Brain is yours.
4. **Query a Brain**. Visit any Brain page via `brainpedia.up.railway.app/<name>` (start at [yudhi](https://brainpedia.up.railway.app/yudhi)) and run a mixture query through the demo widget.
5. **Read the code**. Start with [`contracts/src/Brain.sol`](contracts/src/Brain.sol), [`packages/knowledge-compiler/src/pipeline.ts`](packages/knowledge-compiler/src/pipeline.ts), and [`apps/web/src/app/api/create/route.ts`](apps/web/src/app/api/create/route.ts) to see the three layers connect.

If a test wallet was provided in HackQuest reviewer notes, import that key and skip step 3's wallet creation.

## Tech stack

| Layer | Choice |
|---|---|
| Monorepo | Bun workspaces + Turborepo |
| Web | Next.js 15 (App Router), Tailwind, wagmi v2 + viem v2, D3.js |
| MCP server | `@modelcontextprotocol/sdk` over stdio, bundled to a single file via `bun build`, published as `brainpedia-mcp` |
| Storage | `@0glabs/0g-ts-sdk` with a hand-rolled `Flow.submit` workaround (the SDK encodes the wrong ABI selector; see [docs/0g-integration.md](docs/0g-integration.md)) |
| Compute | `@0glabs/0g-serving-broker@0.7.5` (TEE-attested Qwen 2.5 7B Instruct on a Phala dstack TEE node) |
| Contracts | Foundry, Solidity 0.8.34, OpenZeppelin v5 (Ownable2Step + ReentrancyGuard), canonical ERC-7857 |
| ENS | `@ensdomains/ensjs` + `viem` (no hardcoded addresses) |
| AXL | `axl` daemon HTTP API + `mcp_router.py` from `gensyn-ai/axl/integrations/mcp_routing` |
| Hosting | Railway (web, brain, AXL bootstrap, hosted Obsidian) |

## Setup

Every cross-system value is environment-driven via `.env.example`. Contract addresses, RPC URLs, ENS parent name, and 0G provider details are never hardcoded in source.

```bash
bun install

# Run web + MCP locally
bun run dev

# Or use the published MCP server straight from npm
npx -y brainpedia-mcp

# Contracts
cd contracts
forge build
forge test
```

To deploy contracts to 0G mainnet:

```bash
# Brain + BrainOracle (wired together in one script)
forge script script/DeployBrain.s.sol \
  --rpc-url $ZG_RPC_URL --broadcast --verify
# Then deploy BrainMinter and RoyaltyDistributor against the Brain address
forge script script/DeployBrainMinter.s.sol --rpc-url $ZG_RPC_URL --broadcast --verify
forge script script/DeployRoyaltyDistributor.s.sol --rpc-url $ZG_RPC_URL --broadcast --verify
```

## Security

- All Solidity uses custom errors (`src/lib/Errors.sol`), Ownable2Step, ReentrancyGuard, and zero-address checks on every setter.
- `Brain.secureTransfer` requires an oracle-verified attestation bound to the live `(tokenId, from, to)` context. Standard ERC-721 transfers are blocked.
- Payments use pull-payment patterns (`pendingWithdrawals` + `withdraw()`) so a reverting recipient cannot DoS the system.
- Pre-mainnet review run via AI tooling (`audit-prep` + `solidity-auditor`). Four critical findings remediated; four accepted with documented reasoning in `contracts/KNOWN_ISSUES.md`. A human Pashov-style audit is targeted before any meaningful TVL.

## Team

- **Yudhishthra Sugumaran** ([@0xYudhishthra](https://twitter.com/0xYudhishthra) on X, `yudhishthra` on Telegram)

## License

MIT
