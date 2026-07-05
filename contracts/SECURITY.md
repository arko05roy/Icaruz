# Security

## Overview

Brainpedia is a network where humans publish their personal notes as specialty AI Brains that other agents pay to query. The contract suite (one ERC-7857 iNFT plus a minter, a transfer oracle, a royalty distributor, and two ENS registrars) handles **custody, capability tokens, and royalty settlement**. Pricing, citation, and inference logic live off chain in the Brain server and the orchestrator.

The system is deliberately split across two networks:

- **0G mainnet (Aristotle, chainId 16661)**: `Brain`, `BrainMinter`, `BrainOracle`, `RoyaltyDistributor`. Stores intelligence-data references, anti-spam mint wrapper, ERC-7857 transfer attestor, multi-Brain royalty settlement.
- **Sepolia (chainId 11155111)**: `SubnameRegistrar`, `AccessTokenRegistrar`. Discovery and TTL-bounded capability tokens via ENS.

All contracts use `pragma solidity 0.8.34`, `via_ir = true`, and OpenZeppelin v5. Custom errors are consolidated in `src/lib/Errors.sol`.

## Privileged Roles

| Role | Identity | Powers | Trust Model |
|------|----------|--------|-------------|
| **Brain owner** (per-token) | EOA that called `BrainMinter.mintToSender` | Append new snapshots, set per-token min payment, revoke per-agent authorizations, initiate `secureTransfer` | UNTRUSTED. Powers are limited to the iNFT they own. Cannot affect other tokens. |
| **Brain contract owner** | `BrainMinter` (after `transferOwnership`) | `mint`, `setOracle` | TRUSTED-CONTRACT. Brain ownership is moved to `BrainMinter` at deploy time so all minting is permissionless. The `setOracle` admin path is locked behind the BrainMinter admin's escape hatch (`transferBrainOwnership`). |
| **BrainMinter admin** | EOA, recommended multisig for mainnet | `setMintFee`, `sweepFees`, `transferBrainOwnership` | FULLY_TRUSTED. Can re-take Brain ownership (escape hatch for v2 migration) and change anti-spam fee. Currently a single EOA on testnet; should be a multisig before any significant TVL. |
| **BrainOracle owner** | EOA (Brainpedia operator) | `setAttestor` | FULLY_TRUSTED. Controls which EOA signs valid `TransferAttestation` proofs. Rotation is straightforward (no in-flight state to migrate). |
| **BrainOracle attestor** | EOA controlled by Brainpedia operator (later: TEE node) | Signs EIP-712 `TransferAttestation(tokenId, from, to, sealedKeyHash, deadline)` proofs that authorize `Brain.secureTransfer` | SEMI_TRUSTED. A compromised key allows authorizing arbitrary Brain transfers. Damage is bounded: the per-Brain symmetric key for private metadata is not on chain, so a stolen iNFT does not decrypt the seller's prompts unless the seller also leaked the sealed key. Rotation via owner-controlled `setAttestor`. |
| **RoyaltyDistributor caller** | Any EOA (typically the orchestrator paying for a mixture query) | Distribute `msg.value` across `tokenIds[]` proportional to `amounts[]` | UNTRUSTED. Surplus is refunded. Each Brain owner receives exactly `amounts[i]` to their iNFT-owner address. |
| **SubnameRegistrar owner** | Brainpedia operator EOA | Future: pause/revoke registrations | FULLY_TRUSTED on Sepolia. Current implementation has no on-chain pause hook; register is open to any caller. |
| **AccessTokenRegistrar owner** | Brainpedia operator EOA | `setIssuer`, `revoke` | FULLY_TRUSTED. Controls which addresses can mint/consume per-agent access tokens. |
| **AccessTokenRegistrar issuer** | Allow-listed EOAs (Brain servers, payment processor) | `issue`, `consume` per label | SEMI_TRUSTED. A compromised issuer can mint capability tokens but cannot exfiltrate funds; capability tokens only grant query access, payment forwarding is handled separately by `Brain.authorizeUsage` or `RoyaltyDistributor.distribute`. |

## Trust Boundaries

1. **Brain custody, off-chain pricing.** Brain.sol stores `IntelligentData[]` references and authorization expiries. It does not enforce per-query pricing semantics beyond `minPaymentOf[tokenId]`. Sticker prices, citation weights, and mixture-mode synthesis all live off chain in the Brain server and orchestrator. The contracts only enforce the property that whoever the orchestrator chose to pay actually receives the on-chain `amounts[i]` from `RoyaltyDistributor.distribute`.

2. **ERC-7857 transfer requires oracle.** Standard ERC-721 `transferFrom` and `safeTransferFrom` are blocked and revert with `Errors.UseSecureTransfer`. The only path to move ownership is `Brain.secureTransfer(to, tokenId, sealedKey, oracleProof)`, which requires the configured oracle to attest that `sealedKey` is a correctly re-encrypted form of the per-Brain symmetric key for the recipient. Without this, a transferred Brain would be undecryptable by its new owner.

3. **Independent attestor and admin keys.** `BrainOracle.attestor` (the signing key) and `BrainOracle.owner` (the rotation key) are independent. Leaking the attestor key allows minting fake transfer attestations but not changing the attestor identity. Leaking the owner key allows replacing the attestor but does not retroactively forge attestations against an old digest.

4. **Per-token Brain owner isolation.** Each Brain iNFT's owner can only modify state for their tokenId. `appendStorageRoot`, `setMinPayment`, `revokeAuthorization`, and `secureTransfer` all require `ownerOf(tokenId) == msg.sender`. There is no cross-token admin path on Brain.sol once `BrainMinter` owns it.

5. **Payment forwarding via raw call.** `Brain.authorizeUsage` and `RoyaltyDistributor.distribute` forward native value via low-level `call`. This is intentional so contract-wallet Brain owners can receive payments. Each payment is wrapped in a success check; a reverting recipient bubbles up as `Errors.PaymentForwardFailed` or `Errors.TransferFailed` and the entire call reverts.

6. **Surplus refund on royalty over-pay.** `RoyaltyDistributor.distribute` refunds `msg.value - Σ amounts` to `msg.sender` at the end of the call. The refund is also wrapped in a success check; if the refund fails (caller is a contract that reverts on receive) the whole call reverts so funds never get stuck in the distributor.

7. **Access tokens are capability, not custody.** `AccessTokenRegistrar` tokens encode `(agent, brainNameHash, ttl)` and grant the named agent query access for the TTL window. They do not move funds. Issuance and consumption are gated by the issuer allow-list; the owner can revoke any token.

## Security Invariants

These are the properties the contracts enforce. Each is testable from the test suite.

| # | Invariant | Enforcement |
|---|-----------|-------------|
| **B-1** | `mint` is only callable by the Brain contract owner (post-deploy: `BrainMinter`). | `onlyOwner` on `Brain.mint`. |
| **B-2** | `appendStorageRoot`, `setMinPayment`, `revokeAuthorization`, `secureTransfer` require per-token ownership. | `ownerOf(tokenId) == msg.sender` check. |
| **B-3** | Standard `transferFrom` / `safeTransferFrom` always revert. The only transfer path is `secureTransfer`. | Override reverts with `Errors.UseSecureTransfer`. |
| **B-4** | `secureTransfer` succeeds only if the configured oracle returns true for `oracleProof`. | `_oracle.verifyProof(oracleProof)` check before `_transfer`. |
| **O-1** | `BrainOracle.verifyProof` accepts only EIP-712 signatures recovered to the configured `attestor`. | `ECDSA.recover` + equality check. |
| **O-2** | `BrainOracle.verifyProof` rejects expired attestations. | `block.timestamp > deadline` check before signature recovery. |
| **M-1** | `BrainMinter.mintToSender` requires `msg.value >= mintFeeWei`. | `require` with `Errors.InsufficientFee`. |
| **R-1** | `RoyaltyDistributor.distribute` reverts if `msg.value < Σ amounts`. | `require` with `Errors.InsufficientValue`. |
| **R-2** | `RoyaltyDistributor.distribute` refunds surplus to `msg.sender` and reverts the whole call if the refund fails. | Refund check at end of function. |
| **R-3** | Each Brain owner in `tokenIds[]` receives exactly `amounts[i]` (the contract never partially settles). | Each forward is wrapped in `if (!ok) revert TransferFailed`. |
| **A-1** | `AccessTokenRegistrar.issue` is callable only by allow-listed issuers. | `issuers[msg.sender]` check. |
| **A-2** | An access token's `expiresAt` is honored on consume. | `t.expiresAt < block.timestamp` check on consume. |

## Reporting Vulnerabilities

Coordinated disclosure: open a private security advisory on GitHub (`https://github.com/0xYudhishthra/brainpedia/security/advisories/new`) or DM the author. Please do not file public issues for exploitable bugs.

This codebase is targeted for a Pashov-style audit prior to high-value mainnet usage. The 0G APAC Hackathon submission is the first mainnet deploy; mainnet TVL is bounded by the anti-spam mint fee and per-Brain sticker prices.

## Out-of-Scope

- The Brain server (off-chain). Compromising the brain server does not directly grant on-chain access; the server cannot mint, transfer, or settle royalties without the corresponding wallet keys.
- The MCP server (off-chain). Same trust model as the Brain server.
- The 0G Storage indexer (external). Brain.sol stores merkle roots; storage availability is the 0G network's responsibility.
- The 0G Compute broker and TEE attestor for inference (external). The TEE attestation surfaced in API responses is the broker's responsibility, not the contracts'.
- LayerZero, Uniswap V4, or any DEX integration (none used in brainpedia).
- The ENS registry on Sepolia (external, well-known).
- The frontend / wallet integrations.

## Centralization Risks

1. **Single-EOA BrainMinter admin (pre-mainnet).** The `BrainMinter` admin is currently a single EOA. This EOA can change the mint fee, sweep accumulated fees, and re-take Brain ownership (`transferBrainOwnership`). For meaningful mainnet TVL the admin should be migrated to a multisig with a timelock.

2. **Single-EOA BrainOracle attestor (initial).** The attestor key signs every valid transfer. A compromise allows authorizing arbitrary Brain transfers. Production migration: move the attestor identity to a 0G Compute TEE node that signs only after verifying off-chain key re-sealing. The on-chain rotation surface (`setAttestor`) is already in place.

3. **No on-chain enforcement of correct key re-sealing.** `BrainOracle` verifies that the attestor signed a struct containing `sealedKeyHash`, but the contract has no way to verify that the hashed key actually decrypts the iNFT's encrypted metadata. This is by design: the verification happens inside the TEE attestor (off-chain). A buggy or malicious attestor could sign a `TransferAttestation` for an incorrect sealed key, leaving the new owner with a Brain they cannot decrypt. This is recoverable by the original owner re-running `secureTransfer` with a correct sealed key.

4. **`BrainMinter` admin can rotate Brain ownership.** The `transferBrainOwnership` escape hatch lets the admin migrate to BrainMinter v2 without redeploying Brain.sol. The trade-off is that the admin can also rotate Brain ownership to a malicious contract. The mitigation is the same as 1: move the admin to a multisig.

5. **No `renounceOwnership` lock.** The `Ownable` admin slots can be renounced, locking the contract permanently. This is not blocked at the contract level; operators must be aware that calling `renounceOwnership` on Brain (post-BrainMinter), BrainMinter, BrainOracle, or the ENS registrars is an irreversible action.
