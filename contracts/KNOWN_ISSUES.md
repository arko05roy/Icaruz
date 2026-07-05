# Known Issues

> Findings identified during pre-mainnet review (audit-prep + solidity-auditor) that we accept as known risks for the current deployment scope. Each entry includes the original confidence rating, the reasoning for deferral, and the path to remediation.

## I-1. ENS subname registration can be front-run

**Source**: solidity-auditor finding #4 · Confidence 100
**Location**: `SubnameRegistrar.register`
**Status**: Accepted for current deployment

`register(label, owner_)` is fully permissionless. A mempool observer can front-run any legitimate registration call and permanently claim the label for their own address; the first-write-wins mapping has no commit-reveal or admin-override path.

**Why accepted**: `SubnameRegistrar` lives on Sepolia, not on the 0G mainnet submission path. Discovery via ENS subnames is a supporting integration, not part of the core 0G economic flow being deployed. Real-world impact is bounded to Sepolia identity squatting, with no fund loss.

**Remediation path**: v2 of the registrar will gate `register` either via `onlyOwner` (centralized) or via a commit-reveal scheme (decentralized), depending on the discovery model we settle on post-hackathon.

## I-2. Excess ETH not refunded by BrainMinter.mintToSender

**Source**: solidity-auditor finding #5 · Confidence 85
**Location**: `BrainMinter.mintToSender`
**Status**: Accepted for current deployment

`mintToSender` requires `msg.value >= mintFeeWei` but retains the full `msg.value` without refunding surplus. A user who overpays loses the excess to the BrainMinter admin via `sweepFees`.

**Why accepted**: Anti-spam fee is set to 0 wei for the hackathon (`mintFeeWei = 0`), so the overpay vector is dormant. If we raise the fee post-launch, we ship the refund logic with the same release.

**Remediation path**: Add `refund = msg.value - mintFeeWei; if (refund > 0) msg.sender.call{value: refund}("")` to `mintToSender` before raising the fee above zero.

## I-3. RoyaltyDistributor.distribute accepts duplicate tokenIds

**Source**: solidity-auditor finding #6 · Confidence 85
**Location**: `RoyaltyDistributor.distribute`
**Status**: Accepted for current deployment

`distribute` performs no duplicate check on the `tokenIds` array. A malicious or buggy orchestrator could pass duplicates to drain a payer's `msg.value` into a single colluding Brain owner.

**Why accepted**: The orchestrator role is currently filled by Brainpedia's own web service (`apps/web/src/app/api/query`). The trust model in `SECURITY.md` already classifies the orchestrator as authorized to construct payment plans. The mixture-mode flow guarantees per-Brain sticker prices off chain, so duplicates would manifest as on-chain anomalies detectable by indexers.

**Remediation path**: Require strict ascending `tokenIds` order (`require(tokenIds[i] > tokenIds[i-1], "duplicate-or-unsorted")`) in `distribute`. Cheap fix when we extend the contract for a non-Brainpedia orchestrator integration.

## I-4. AccessTokenRegistrar.consume can be called repeatedly on a consumed token

**Source**: solidity-auditor finding #8 · Confidence 75
**Location**: `AccessTokenRegistrar.consume`
**Status**: Accepted for current deployment

`consume` checks `t.agent != address(0)` and `t.expiresAt >= block.timestamp` but never checks `!t.consumed`. After the first call sets `consumed = true`, a second call by any authorized issuer succeeds and emits another `Consumed` event.

**Why accepted**: `AccessTokenRegistrar` lives on Sepolia, not on the 0G mainnet submission. Off-chain consumers should gate access on the returned `Token.consumed` field rather than event count; current Brainpedia integrations already do this.

**Remediation path**: Add `if (t.consumed) revert Errors.TokenAlreadyConsumed();` in `consume`, plus the matching error in `Errors.sol`. Two-line fix scheduled for the next Sepolia redeploy.

---

## Audit-Prep Hygiene Items

Items from `.audit-prep/REPORT.md` that we accept as-is for the hackathon submission:

- **Test coverage for BrainMinter, RoyaltyDistributor, AccessTokenRegistrar, SubnameRegistrar**: 0% coverage on these four. Brain.sol and BrainOracle.sol are covered by the 19-test suite in `test/Brain.t.sol`. Mainnet-bound contracts (Brain, BrainMinter, RoyaltyDistributor) get smoke-test coverage post-deploy via the mainnet hero settlement tx. Full unit-test suites planned post-hackathon.
- **NatSpec gaps**: 11 Brain.sol functions lack `/// @inheritdoc IBrain`. The interface itself has full NatSpec, so docstring generators resolve the documentation; this is a presentation issue, not a security one.
- **Uncommitted working tree**: The audit-prep run was performed on an in-flight branch. All changes are committed prior to mainnet deploy.

---

## Out-of-Scope Pashov-Style Audit

This codebase has NOT been audited by Pashov Audit Group. The findings above were surfaced by AI-driven `audit-prep` and `solidity-auditor` skills. A human Pashov-style audit is targeted for post-hackathon mainnet hardening, before any meaningful TVL flows through the contracts. The hackathon submission deploys to 0G mainnet with the explicit understanding that:

1. Per-query payments are bounded to per-Brain sticker prices (currently `0.001 OG`).
2. The `BrainMinter` admin and `BrainOracle` attestor are single EOAs controlled by the Brainpedia operator. Multisig migration is planned before raising TVL caps.
3. Findings #1, #2, #3, #7 from the AI review have been remediated (oracle proof binding, authorization extend-only, pull-payment patterns).
