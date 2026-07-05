# ERC Standard Pitfalls

Token standards look uniform and behave differently in the ways that matter
for security. The recurring failure is integrating "an ERC-20" while assuming
behaviour the standard never guaranteed.

## ERC-20 Return Values and Fee-On-Transfer

ERC-20 predates a consistent return-value convention. USDT and others do not
return a bool, so a raw `transfer` reverts under a strict interface or, worse,
the caller ignores a silent failure. Use OpenZeppelin `SafeERC20`
(`safeTransfer`, `safeTransferFrom`, `forceApprove`). Fee-on-transfer and
rebasing tokens break the assumption that received amount equals requested
amount: always measure `balanceOf(this)` before and after and credit the
delta, never the requested value.

## Approval Race and Permit

`approve` has the well-known race: changing a non-zero allowance to another
non-zero value lets the spender front-run and spend both. Prefer
`increaseAllowance`/`decreaseAllowance` or set to zero first. EIP-2612
`permit` moves approval into a signature but introduces signature replay
surface — it must carry a nonce, deadline, and EIP-712 domain — and a
front-runnable `permit` whose failure is not tolerated lets a griefer revert
the user's transaction by submitting the permit first.

## ERC-721 and ERC-1155 Safe-Transfer Callbacks

`safeTransferFrom` invokes `onERC721Received` / `onERC1155Received` on the
recipient. That callback is an external call and a reentrancy vector: an NFT
marketplace that transfers the NFT before finalizing accounting can be
reentered from the receiver hook. `_safeMint` is the same hazard during
minting — a permissionless mint with a receiver callback enables supply
inflation if state is not written first.

## ERC-4626 First-Depositor Inflation

The canonical 4626 vault bug: the first depositor mints 1 wei of shares, then
donates a large amount of the underlying directly to the vault, inflating the
share price so the next depositor's deposit rounds to zero shares and is
captured. Mitigations: seed the vault at deployment with dead shares, use
virtual shares/assets offsets (OpenZeppelin 4626 with a decimals offset), or
enforce a minimum initial deposit. Any vault that prices shares from
`balanceOf` is also exposed to direct-donation accounting attacks.

## ERC-2771 and Trusted Forwarders

Meta-transaction support via `_msgSender()` over a trusted forwarder is safe
only if the forwarder is genuinely trusted and the contract never uses raw
`msg.sender` for authorization in a forwarded path. A contract that mixes
`_msgSender()` and `msg.sender` in authorization checks has an inconsistent
identity model and is usually exploitable.

## ERC-165 and Interface Assumptions

Do not assume a counterparty implements an interface because it claims to.
`supportsInterface` is a hint, not a guarantee; the call can still revert,
return wrong data, or consume unbounded gas. Defensive integration treats
external contracts as adversarial: bounded gas, checked returns, no
reliance on unspecified behaviour.
