---
title: "For Blockchain Developers"
description: Map your Ethereum, Solana, or Move experience to Groundhog's programming model.
---

*If you've built on Ethereum, Solana, or any smart contract platform, this guide maps what you know to how Groundhog works. The short version: use deltas instead of assignments, and the types handle concurrency for you.*

---

## The Pain You Already Know

You're a smart contract developer. You write business logic: tokens, swaps, lending protocols. But how much of your time is actually spent on business logic?

Here's the list of things that eat your time on every other chain:

- **Gas estimation.** Will this transaction land? How much buffer do I need?
- **MEV protection.** Am I going to get sandwiched? Do I need Flashbots?
- **Storage optimization.** Packing variables into 256-bit slots, minimizing SLOADs.
- **Sequence numbers.** Managing nonces, handling the "nonce too low" dance.
- **Compute budgets.** Will this fit in a Solana transaction? Do I need to split it?
- **Access lists.** Declaring which accounts a Solana transaction will touch, up front.
- **TTL management.** Soroban's storage expiry, cron jobs to extend, data disappearing.
- **Fee spikes.** Handling 100x fee increases during congestion.

None of this is your business logic. All of it exists for one reason: **the chain executes transactions one at a time, in order.** When everything must be sequenced, resources are scarce, and the system needs elaborate mechanisms to manage that scarcity.

Consider the classic `approve()` race condition in ERC-20. Alice approves Bob to spend 100 tokens. She wants to change it to 50. She calls `approve(bob, 50)`. But Bob sees the pending transaction and quickly spends the original 100 before the new approval lands. Then he spends the new 50 too. Alice lost 150 tokens instead of 50.

This bug exists because `approve()` is an absolute write (`allowance = 50`), and ordering determines who wins. The entire community has worked around it for years with `increaseAllowance()`/`decreaseAllowance()`, but the underlying problem is the programming model.

---

## The One Change

Groundhog contracts use **deltas instead of assignments**.

Here's a token transfer on Ethereum:

```solidity
// Solidity: absolute writes
function transfer(address to, uint256 amount) public {
    require(balances[msg.sender] >= amount, "insufficient");
    balances[msg.sender] -= amount;   // write: set to new value
    balances[to] += amount;           // write: set to new value
}
```

Both lines are absolute writes. They read the current balance, compute a new value, and store it. If two transfers from the same sender execute concurrently, the second one reads stale state and produces a wrong result. That's why EVM transactions execute sequentially.

Here's the same thing on Groundhog:

```rust
// Groundhog: delta operations
fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    let owner = get_caller();
    let diff = amount_to_diff(amount);

    self._adjust_balance(&owner, -diff);   // delta: subtract amount
    self._adjust_balance(receiver, diff);  // delta: add amount

    log_transfer_event(&owner, receiver, amount);
}

fn _adjust_balance(&mut self, owner: &ContractAddress, diff: Difference) {
    let mut balance = self.balances.get(owner);
    balance.strict_inc(diff)  // abort if result would go negative
}
```

`strict_inc(diff)` doesn't read-then-write. It says: "adjust this value by `diff`." The diff can be positive (add) or negative (subtract), and both directions commute with each other. Two concurrent transfers from the same account both produce negative deltas. A transfer in and a transfer out produce deltas with opposite signs. At block close, all deltas merge: the balance reflects every operation. If the combined result would be negative, one transaction is excluded from the block. No stale reads. No race condition. No ordering required.

NNInt does have a low-level `set()` method for absolute writes. It's there if you need it, but using it destroys commutativity: any concurrent `strict_inc()` on the same key conflicts with a `set()`, and one transaction gets excluded. Every contract in the SDK uses `strict_inc()` exclusively.

All transactions in a block read the same frozen snapshot. Your code produces deltas against that snapshot. At block close, all deltas merge deterministically. This is why ordering doesn't matter, and why you don't need to think about it. For the full details on this model, see [Execution Model](/how-it-works/execution-model/).

---

## Storage Types at a Glance

On most chains, you control parallelism through annotations, access lists, or compiler hints. On Groundhog, **the [storage type](/reference/storage-types/) you choose determines whether operations are parallel-safe.** There's nothing else to declare.

| I need to... | Use | Parallel-safe? |
|---|---|---|
| Track a balance or counter | `NNInt` | Yes, increments and decrements both commute |
| Store data per account/key | `Map<K, V>` | Yes, different keys are independent |
| Buffer items for later processing | `RetrocausalQueue` | Yes for inserts, sequenced for consumes |
| Store a single record (owner, config) | `Bytestring` | No, concurrent writes conflict |

`NNInt` is the workhorse. It replaces `uint256` balances, counters, and vote tallies. `Map<K, V>` replaces `mapping(address => uint)`. `Bytestring` is the escape hatch for absolute writes. When you reach for it, ask: could I use `NNInt` or `Map` instead?

For the full API and behavior of each type, see [Storage Types](/reference/storage-types/).

---

## What About Operations That Can't Be Deltas?

Let's be honest: not everything commutes.

- **Order book matching.** Which buy meets which sell depends on order. This is sequenced.
- **Unique name registration.** Two people claiming the same name must have a winner. This is sequenced.
- **Some governance operations.** Proposals that cancel other proposals have ordering dependencies.

But here's the measured reality: **82% of blockchain operations are natively commutative or easily adaptable.** This comes from analyzing 195 million real transactions across six chains (Ethereum, Solana, Polygon, Arbitrum, Optimism, and Base). The number isn't theoretical. It's what people actually do on blockchains.[^commutativity-study]

[^commutativity-study]: See the Groundhog whitepaper for methodology and per-chain breakdowns.

For DEX activity specifically: 95% is resting orders (commutative), only 5% is trade execution (sequenced). So even "sequencing-heavy" use cases are mostly parallelizable.

For the operations that genuinely need ordering, Groundhog still works. Those transactions are included in blocks like any other. They just can't execute in parallel *with each other* on the same contested state. They still benefit from:

- **Free compute.** No per-operation gas. You hold HOG for capacity, not pay to execute.
- **Snapshot isolation.** Clean reads, no dirty state.
- **Irrevocable finality.** Confirmed means confirmed, no 25-second window.

The `Bytestring` type is your indicator. When you're writing a Bytestring, you're saying: "This operation might not parallelize." Use it intentionally.

---

## Quick Reference

| Solidity | Groundhog | Notes |
|----------|-----------|-------|
| `msg.sender` | `get_caller()` | Returns `ContractAddress` |
| `mapping(K => V)` | `Map<K, V>` | Auto-persisted via `#[sdk::storage]` |
| `uint256` (for balances) | `NNInt` | Delta-only; can't go negative |
| `balance = x` | `balance.strict_inc(diff)` | Deltas, not assignments |
| `require(condition)` | `ensure(condition, err)` | Aborts transaction on failure |
| `revert("msg")` | `abort(&err)` / `panic!()` | Aborts transaction, discards all state changes |
| `event Transfer(...)` | `log_transfer_event(...)` | Events work similarly |
| `approve(addr, amount)` | `adjust_allowance(addr, diff)` | Delta-based, no race condition |
| `onlyOwner` modifier | `ensure(&caller == self.owner, err)` | No modifier syntax; inline check |
| Gas fees | None | Compute costs nothing; storage requires a refundable HOG deposit |
| Storage slots | Typed fields | `#[sdk::storage]` macro handles layout |

---

## Next Steps

See a complete token contract side by side with ERC-20 in the [Build a Token](/tutorials/build-a-token/) tutorial. For the full execution model (snapshots, deltas, merge rules, conflict behavior), see [Execution Model](/how-it-works/execution-model/). For everything that disappears from your workflow (gas, MEV, nonces, compute budgets), see the [comparison tables](/how-it-works/execution-model/#how-this-compares).

Ready to write code? [Getting Started](/start/getting-started/) walks you through the SDK setup and your first contract.
