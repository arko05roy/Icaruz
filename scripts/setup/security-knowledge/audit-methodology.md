# Audit Methodology

A smart-contract audit is a structured search for the gap between what the
code does and what the protocol intends. The output is not a checklist score;
it is a set of concrete, exploitable findings with severity justified by
impact and likelihood.

## Scoping

Fix the commit hash, the exact files in scope, and the trust model before
reading code. Write down who is trusted (governance, multisig, keeper,
oracle) and what each is trusted to do. Most disputes about severity are
actually disputes about an undocumented trust assumption. Identify external
dependencies — oracles, tokens, bridges, AMMs — and treat each as an
adversarial input until proven otherwise.

## Invariant Analysis

Before hunting bugs, state the protocol invariants: properties that must hold
in every reachable state. Examples: total shares times price equals total
assets within rounding; sum of user balances equals contract balance; a
position is always either solvent or liquidatable, never both. For each
invariant, enumerate every function that writes the variables it constrains,
and check the invariant holds at the end of each. Invariants also drive fuzz
and formal harnesses.

## Common Vulnerability Sweep

Pass the codebase against the known classes: reentrancy (single, cross-
function, cross-contract, read-only), access control and initialization,
price oracle manipulation and flash-loan-amplified preconditions, ERC
standard pitfalls, arithmetic and decimal scaling, rounding direction and
who it favours, denial of service via unbounded loops or griefable external
calls, signature replay and malleability, and upgrade/storage-layout safety.
The sweep is breadth; each hit becomes a depth investigation.

## Economic and Game-Theoretic Review

Code-correct protocols still fail economically. Model the actor with a flash
loan and no capital constraint: what is the most profitable sequence? Check
first-depositor and last-withdrawer edge states, fee and reward accrual under
adversarial timing, MEV on every state-changing transaction, and whether any
parameter the admin can set creates an incoherent constraint (a max below an
already-accumulated total, a fee above 100%).

## Depth and Proof

For each candidate, substitute concrete boundary values (zero, one, max,
type bound), vary one parameter at a time, and trace execution to a terminal
state — a revert, a wrong transfer, a broken invariant. A finding is only
confirmed when a written test executes the harm: not "the function can be
called" but "the user receives less than owed" or "the withdrawal reverts
permanently." Unexecuted reasoning is a hypothesis, not a finding.

## Reporting

Each finding states severity (impact times likelihood), the exact location,
a minimal description, the concrete impact with numbers, a proof-of-concept
result, and a minimal fix. Consolidate findings that share one root cause and
one fix. Severity reflects the worst realistic operational state, not the
state that happens to exist at the audited block.
