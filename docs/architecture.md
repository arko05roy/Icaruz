# Architecture

> The four-layer system that turns a personal note vault into a paid-query iNFT, discoverable by other agents.

## The four layers

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4 — Discovery & Identity (ENS)                       │
│  *.bpedia.eth subnames + text records + access tokens   │
├─────────────────────────────────────────────────────────────┤
│  Layer 3 — Communication (AXL)                              │
│  Encrypted P2P mesh, MCP/A2A envelopes, Ed25519 peer IDs    │
├─────────────────────────────────────────────────────────────┤
│  Layer 2 — Intelligence (0G Compute)                        │
│  OpenAI-compatible inference, broker.ledger metering        │
├─────────────────────────────────────────────────────────────┤
│  Layer 1 — Persistence & Ownership (0G Storage + Chain)     │
│  KV (live wiki) + Log (snapshots) + ERC-7857 iNFT           │
└─────────────────────────────────────────────────────────────┘
```

## Mixture-of-Brains query flow

```
                   ┌──────────────────────┐
                   │  Querying Agent      │
                   │  (runs AXL node)     │
                   └──────────┬───────────┘
                              │ POST /mcp/{orch_peer}/route
                              ▼
                   ┌──────────────────────┐
                   │  Orchestrator        │
                   │  (runs AXL node)     │
                   │  Mixture-of-Brains   │
                   │  router + synthesis  │
                   └──┬────────┬────────┬─┘
        /mcp/{defi}/query  /mcp/{food}/query  /mcp/{mush}/query
                 │          │          │
                 ▼          ▼          ▼
          ┌────────┐ ┌────────┐ ┌────────┐
          │ DeFi   │ │ Malay  │ │ Mush   │
          │ Brain  │ │ Brain  │ │ Brain  │
          │ (AXL)  │ │ (AXL)  │ │ (AXL)  │
          └────────┘ └────────┘ └────────┘
```

Every node in the picture is its own AXL daemon process (separate
Ed25519 keypair, separate port). The orchestrator's "fan out" is three
concurrent `POST /mcp/{brain_peer_id}/brainpedia.brain` calls.

## Onboarding: vault → Brain

1. User runs one `claude mcp add-json brainpedia '{...}' --scope user` command in Claude Code.
2. User says: *"Set up my Brain from `/Users/yudhi/Documents/SecondBrain`"*.
3. The MCP server (`apps/mcp-server`):
   - Walks the vault via `@brainpedia/obsidian-parser`
   - Asks the host LLM (Claude) to compile clusters of notes into wiki articles
   - Streams compiled articles to 0G Storage **KV layer** (mutable working copy)
   - On finalize, takes a **Log layer** snapshot → merkle root
   - Mints `Brain.sol` with `initialStorageRoot = merkleRoot`
   - Calls `SubnameRegistrar.register(label, owner)` → `<name>.bpedia.eth`
   - Writes ENS text records: `brain.inft`, `brain.storage_root`, `brain.axl_peer_id`, `brain.specialty`, `brain.price_query`, `brain.compute_url`, plus standard `description`/`avatar`/`url`.

## Discovery: agent → Brain

1. Agent resolves a topic shortcut, e.g. `defi.discover.bpedia.eth`, to a list of Brain ENS names (text record `brainpedia.brains`).
2. For each Brain, agent reads text records → gets peer ID, price, iNFT address.
3. Agent calls `Brain.authorizeUsage{value: pricePerQuery}(tokenId, agent, ttl)` — payment forwards to Brain owner, `UsageAuthorized` event fires.
4. (Optional) `AccessTokenRegistrar.issue("agent7af2", agent, brainNameHash, ttl)` mints a one-time-use subname `agent7af2.client.bpedia.eth` for the session.
5. Agent calls `POST /mcp/{brain_peer_id}/brainpedia.brain` with `{prompt, accessToken: "agent7af2.client.bpedia.eth"}`.
6. Brain validates the access token (ENS resolution + `AccessTokenRegistrar.isValid`), retrieves articles from 0G Storage, runs inference on 0G Compute, returns `{answer, citations, confidence}`.

## Mixture: pay-to-read with sticker pricing

`/api/query?mode=mixture` is **two-phase** to make the payment a real
gate, not a suggestion:

**Phase 1** — fan out + cache:
1. `topic=auto` → orchestrator's LLM router picks a discovery shortcut
   from the registry (or pass `research`/`frameworks`/`all` directly).
2. Resolve the shortcut's `brainpedia.brains` ENS text record → list of
   brain ENS names.
3. Fan out to each Brain in parallel (over AXL when `AXL_API_URL` is
   set, otherwise direct HTTPS).
4. For successful responders, run a TEE-attested 0G Compute call to
   fuse the per-brain answers + citations into one coherent synthesis.
5. Compute the payment plan: each responder owes its sticker
   `brain.price_query` (canonical record format `"0.001 OG"`).
6. Cache the full result (answers + synthesis + plan) under a fresh
   `sessionId` (10 min TTL).
7. Return a **redacted** response: per-brain metadata (citations,
   verified flag), the payment plan, the `RoyaltyDistributor` address,
   and the `sessionId`. **No answers, no synthesis.**

**Phase 1.5** — agent settles:
- `RoyaltyDistributor.distribute(tokenIds[], amounts[], reason)` (one
  tx) — looks up `Brain.ownerOf(tokenId)` for each brain and forwards
  via raw `.call`, emitting a `Distributed` event per recipient.
  Surplus `msg.value` refunded to the agent.

**Phase 2** — unlock:
1. Agent posts `{sessionId, txHash}` back to `/api/query?mode=mixture`.
2. Server loads the receipt via viem, decodes the `Distributed` events,
   confirms each `(tokenId, amount)` from the cached plan was paid by
   the agent (rejects on underpayment, wrong contract, or missing
   events).
3. Returns the cached full response — synthesis + per-brain answers +
   `settlement: { txHash, payer, blockNumber, explorer }`.

The MCP `query_mixture` tool (`brainpedia-mcp@0.1.5`) drives the whole
flow in one call using the agent's wallet.

Live on 0G Aristotle mainnet (chainId 16661) at
[`0x7AF89556A11FCfE6cF1c3e3D1c36AfBcee2f0073`](https://chainscan.0g.ai/address/0x7af89556a11fcfe6cf1c3e3d1c36afbcee2f0073).
Hero settlement on chain: [tx `0x9a503d7c…`](https://chainscan.0g.ai/tx/0x9a503d7c48787d423883c0b05b690c873af1389ee75e27a315ab232e8a57230c)
distributed 0.002 OG to tokenId 1, 0.0015 OG to tokenId 2, and 0.0035 OG
to tokenId 3 (the 0G Expert Brain) in a single call. Three
`Distributed` events emitted in one block.

## Surfaces — MCP write path vs web read path

Brainpedia is split into two user-facing surfaces by intent:

```
                       ┌────────────────────────────────────┐
                       │  MCP server (apps/mcp-server)      │
   Brain owner         │  — runs locally inside Claude       │
   (has the PK,        │    Desktop / Claude Code            │
    has a vault)  ───▶ │  — 5 tools: setup_brain,            │
                       │    upload_articles, finalize_brain, │
                       │    sync_vault, query_brain          │
                       │  — signs 0G mainnet + Sepolia txs   │
                       │    with ZG_WALLET_PRIVATE_KEY       │
                       │    in its env. PK never leaves the  │
                       │    user's machine.                  │
                       └────────────────────────────────────┘
                                        │
                              writes to chain + 0G storage
                                        ▼
            ┌────────────────────────────────────────────────────┐
            │   Brain.sol (4) · ENS subnames (5+) · 0G snapshots │
            └────────────────────────────────────────────────────┘
                                        ▲
                                  read-only resolution
                                        │
                       ┌────────────────────────────────────┐
   Visitor / agent     │  Web app (apps/web on Railway)     │
   (no wallet,         │  — homepage D3 viz (live ENS read   │
    no setup)     ───▶ │    via all.discover.bpedia.eth)     │
                       │  — /[name] per-Brain pages          │
                       │  — /api/query single + mixture mode │
                       │    (multi-tenant brain handler)     │
                       │  — /status read-only health checks  │
                       │  Holds *no* user keys.              │
                       └────────────────────────────────────┘
```

**Why the split**: setting up a Brain is itself agent work (Claude reads
your vault, compiles articles, calls the chain). That has to run in the
agent's environment with FS access + a signing key. The web is a
block-explorer-style surface for humans to browse what agents have done
— shareable URLs, no wallet popup, no onboarding gate.

**One important consequence**: a visitor can hit `/api/query?mode=mixture`
without a wallet and get a TEE-attested cited answer, but they can't
*create* a Brain through the web. To monetize a vault, you go through the
MCP path (`npx -y brainpedia-mcp` in Claude Code; see the Setup section
of the project README). The web app holds zero user PKs; only the Railway
brain process has its own signing key for paying 0G Compute and verifying
TEE attestations.

## Related reading

- [0g-integration.md](0g-integration.md) — Storage, Compute, iNFT, Agent ID, TEE attestation
- Project [README](../README.md) — overview, 5/5 0G integration table, roadmap, setup
- [../contracts/SECURITY.md](../contracts/SECURITY.md) — privileged roles, trust boundaries, invariants
- [../contracts/KNOWN_ISSUES.md](../contracts/KNOWN_ISSUES.md) — deferred audit findings with remediation paths
