# Incident Case Studies

Post-mortems of real exploit mechanics. Each is reduced to root cause and the
fix that would have prevented it.

## Reentrancy Drain

A lending or vault contract sends ETH out with a low-level `call` before it
zeroes the caller's recorded balance. The recipient is a contract whose
`receive` calls back into `withdraw`; because the balance is still non-zero,
the check passes again and the loop repeats until the contract is empty. This
is the 2016 DAO pattern and it has recurred dozens of times since (Lendf.Me
via ERC-777 hook, Cream, Fei/Rari). Root cause: interaction before effect.
Fix: checks-effects-interactions — zero the balance before the external call —
plus a nonReentrant guard covering every function over the shared accounting,
and treat token callbacks (ERC-777, ERC-721) as external calls.

## Oracle Manipulation Via Flash Loan

A protocol prices collateral from the spot reserves of an on-chain pool. The
attacker flash-borrows, swaps to skew the pool, opens or liquidates a
position at the manipulated price, unwinds the swap, and repays the loan — all
atomically, with no capital at risk (bZx, Harvest, Cheese Bank, countless
forks). Root cause: a price taken from a source the attacker can move within
the transaction. Fix: never price from spot reserves; use a TWAP sized to
liquidity or a staleness-checked aggregator feed, cross-check independent
sources, and assume any flash-loan-reachable precondition is at its worst.

## Access-Control Misconfiguration

An upgradeable contract is deployed but its `initialize` is left callable
because it lacks the `initializer` modifier, or a privileged function ships
without its access modifier. Anyone calls it, takes ownership or the mint
right, and drains or bricks the system (Parity multisig self-destruct, many
proxy initializer front-runs). Root cause: a state-changing privileged path
with no enforced caller restriction. Fix: `initializer` plus
`_disableInitializers()` in the implementation, initialize atomically in the
deploy transaction, and a test that asserts every privileged function reverts
for an unauthorized caller.

## Signature Replay

A contract authorizes an action from an EIP-712 signature but omits a nonce,
or omits `chainId` from the domain separator. The same signature is replayed
to repeat the action, or a signature valid on one chain is replayed on a fork
or sibling deployment. Root cause: a signed message not bound to a unique,
chain-scoped, single-use context. Fix: per-signer nonce, deadline, full
EIP-712 domain including `chainId` and `verifyingContract`, and reject
malleable `s` values via OpenZeppelin ECDSA.

## First-Depositor Share Inflation

A new ERC-4626-style vault: the attacker deposits 1 wei for 1 share, then
transfers a large amount of the underlying directly to the vault. Share price
is now enormous; the next honest deposit rounds to zero shares and the
attacker redeems the victim's funds. Root cause: share price derived from
raw `balanceOf` with no inflation defence. Fix: dead shares seeded at deploy,
virtual offset accounting, or an enforced minimum first deposit.
