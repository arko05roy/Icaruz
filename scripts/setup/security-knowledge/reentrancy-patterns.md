# Reentrancy

Reentrancy is the vulnerability class where an external call hands control to
an attacker before the calling contract has finished updating its own state.
The attacker re-enters the same function (single-function reentrancy), a
different function that shares the same state (cross-function reentrancy), or
a different contract in the same system that reads the not-yet-updated state
(cross-contract reentrancy). The classic 2016 DAO drain was single-function
reentrancy on a withdraw path.

## Checks-Effects-Interactions

The checks-effects-interactions pattern is the primary structural defence.
Order every state-changing function as: (1) checks — validate caller, inputs,
and invariants; (2) effects — write all state changes, including zeroing
balances and decrementing accounting variables; (3) interactions — only then
perform external calls or value transfers. If the balance is set to zero
before the `call`, a re-entrant call sees zero and the second withdrawal
reverts on the check. Checks-effects-interactions is necessary but not
sufficient: it does not protect against cross-function reentrancy where the
re-entered function touches different state, nor against read-only reentrancy
where an external view is consumed mid-transaction.

## Reentrancy Guards

A nonReentrant mutex (OpenZeppelin ReentrancyGuard) sets a storage flag on
entry and clears it on exit, reverting any nested entry. Guards must cover
every function that touches the shared state, including the read paths used
by integrators. A guard on `withdraw` but not on `claimRewards` still allows
cross-function reentrancy if both mutate the same accounting. Transient
storage (EIP-1153, `tload`/`tstore`) makes the guard cheaper but the coverage
requirement is identical.

## Read-Only Reentrancy

Read-only reentrancy exploits a view function that returns a value computed
from state that is temporarily inconsistent during an external call. A common
instance: an AMM pool's `get_virtual_price` or an LP token price read by a
lending market while the pool is mid-removal, so a callback observes an
inflated price and borrows against it. The pool itself is never drained; the
victim is the downstream integrator that trusted the view. Mitigation: have
the integrator call a function that itself takes the pool's reentrancy lock
(so the read reverts during a callback), or snapshot prices via a manipulation
-resistant oracle rather than a spot read.

## ERC-777 and Token Callbacks

ERC-777 `tokensReceived` / `tokensToSend` hooks and ERC-721 `onERC721Received`
turn ordinary token transfers into external calls that can reenter. A vault
that does `token.transferFrom(user, this, amt)` then credits shares is
exploitable if the token is ERC-777 and the hook reenters `deposit`. Treat
every token transfer of an unknown asset as an external call: apply
checks-effects-interactions around it, or use a reentrancy guard, and prefer
pull-over-push for value out.

## Cross-Contract Reentrancy

In multi-contract systems, the guard must be shared or the invariant must
hold across the contract boundary. If `Vault` and `Strategy` both mutate the
same accounting and only `Vault` is guarded, an external call from `Strategy`
can reenter `Vault`. Model the system's shared state, enumerate every
external call site, and verify that at each call site every invariant the
re-entrant path could read is already restored. The mitigation is design, not
a single modifier.
