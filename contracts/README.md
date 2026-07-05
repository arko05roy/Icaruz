# Brainpedia contracts

Foundry project — three contracts:

| Contract | Purpose |
|---|---|
| `Brain.sol` | ERC-7857-style iNFT. Each tokenId binds to an append-only list of `IntelligentData` (0G Storage merkle roots) + per-agent `authorizeUsage` with TTL + a `BrainPayment` event for Mixture-of-Brains royalty splits. |
| `SubnameRegistrar.sol` | Issues `<label>.<parent>` subnames for Brain owners. Parent node + ENS Registry + Resolver are constructor params — no hardcoded chain assumptions. |
| `AccessTokenRegistrar.sol` | Issues `agent<hash>.client.<parent>` one-time-use subnames as capability tokens (the "Most Creative Use of ENS" angle). TTL enforced on chain. |

## Setup

```bash
cd contracts
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts
forge install ensdomains/ens-contracts
```

## Test

```bash
forge test -vvv
```

## Deploy

```bash
PRIVATE_KEY=0x...                         # dev wallet only
ENS_REGISTRY=0x...                        # from ensjs for the chosen network
ENS_PUBLIC_RESOLVER=0x...                 # from ensjs
ENS_PARENT_NODE=0x...                     # namehash("brainpedia.eth")
ENS_CLIENT_PARENT_NODE=0x...              # namehash("client.brainpedia.eth")
ZG_RPC_URL=https://evmrpc-testnet.0g.ai

forge script script/Deploy.s.sol \
    --rpc-url $ZG_RPC_URL \
    --broadcast
```

After deploy, paste the addresses into the project root `.env`:

```
ZG_INFT_CONTRACT_ADDRESS=0x...
ENS_SUBNAME_REGISTRAR_ADDRESS=0x...
ENS_ACCESS_TOKEN_REGISTRAR_ADDRESS=0x...
```
