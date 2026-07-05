# Access Control

Access control bugs are the highest-frequency root cause of large losses:
an unprotected privileged function, a missing modifier on an upgrade or
initializer, or a role that can be silently reassigned. The discipline is to
enumerate every state-changing function and prove who may call it, then prove
the inverse — that no other path reaches the same state.

## Ownable and Two-Step Transfer

Single-step `Ownable.transferOwnership` loses the contract permanently if the
new address is wrong or uncontrolled. Use `Ownable2Step`: the new owner is
recorded as pending and must call `acceptOwnership`, which proves the address
is live and controlled. Any deploy script that does a two-step transfer must
also execute the accept step, or ownership is left pending and privileged
functions are unreachable.

## Role-Based Access Control

`AccessControl` grants granular roles, but every role needs a defined admin
role and a documented holder. The frequent mistake is `DEFAULT_ADMIN_ROLE`
held by an EOA, or `grantRole` reachable by a role that should not be able to
escalate. Audit the role graph: for each role, who can grant it, who can
renounce it, and what each role can do. A role that can pause and a role that
can upgrade are different trust tiers and should not collapse into one.

## Initializer Front-Running

Upgradeable contracts replace constructors with an `initialize` function. If
`initialize` is not protected by `initializer` and not called atomically in
the same transaction as deployment, an attacker front-runs it, becomes owner,
and controls the proxy. Always use OpenZeppelin `Initializable`, call
`_disableInitializers()` in the implementation constructor, and initialize in
the deployment transaction.

## tx.origin and Phishing

Authentication on `tx.origin` lets any contract the victim calls act on their
behalf — a phishing contract calls your function, `tx.origin` is still the
victim, the check passes. Authenticate on `msg.sender`. `tx.origin` is only
ever appropriate for refusing all contract callers, and even that is fragile.

## Signature-Based Authorization

Meta-transactions and permit flows move authorization off-chain into signed
messages. The signature must be bound to: a nonce (replay), a chain id and
verifying contract via EIP-712 domain separator (cross-chain and cross-deploy
replay), an expiry, and the exact parameters being authorized. A missing
nonce allows the same signed action to be replayed; a domain separator that
omits `chainId` allows a signature valid on one chain to be replayed on a
fork or sibling deployment. Use OpenZeppelin ECDSA which rejects the `s`-value
malleability that lets one signature be mutated into a second valid one.

## Privilege Escalation Through Delegatecall

`delegatecall` executes target code in the caller's storage and authority. A
contract that delegatecalls a user-influenced address hands over its entire
state and ownership. Restrict delegatecall targets to immutable, audited
implementations, and never let a parameter choose the target.
