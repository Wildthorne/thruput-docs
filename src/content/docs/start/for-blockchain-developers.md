---
title: "For Blockchain Developers"
description: Map your Ethereum, Solana, or Move experience to Groundhog's programming model.
---

*If you've built on Ethereum, Solana, or any smart contract platform, here's what Groundhog looks like: easy things are still easy, whole classes of footguns are gone, the infrastructure tax disappears, and the same simplicity that makes your code correct is what makes it fast.*

---

## Easy Things Are Still Easy

A token transfer on Solidity:

```solidity
function transfer(address to, uint256 amount) public {
    require(balances[msg.sender] >= amount, "insufficient");
    balances[msg.sender] -= amount;
    balances[to] += amount;
}
```

The same transfer on Groundhog:

```rust
fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    self.balances.get(&get_caller()).strict_inc(-amount);
    self.balances.get(receiver).strict_inc(amount);
}
```

Familiar structure. Shorter. Each balance is an `NNInt` (non-negative integer): Groundhog's core storage primitive. `strict_inc(delta)` produces a **delta** ("adjust by this amount") instead of an absolute write ("set to this value"). That one change eliminates entire classes of bugs.

---

## Whole Classes of Footguns, Gone

Here's a withdrawal function on the EVM, written safely:

```solidity
// Solidity: the ceremony required to avoid reentrancy
bool locked;
modifier nonReentrant() {
    require(!locked);
    locked = true;
    _;
    locked = false;
}

function withdraw(uint256 amount) public nonReentrant {
    require(balances[msg.sender] >= amount);  // manual underflow check
    balances[msg.sender] -= amount;           // must update BEFORE external call
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);
}
```

Reentrancy guard. Checks-effects-interactions ordering. Manual balance check. Get any of it wrong and you lose funds.

On Groundhog:

```rust
fn withdraw(&mut self, amount: Amount) {
    self.balances.get(&get_caller()).strict_inc(-amount);
    self.token.transfer(&get_caller(), amount);
}
```

That's it. No reentrancy guard: every contract call reads from a frozen snapshot, so a callback can't observe partial state. No manual balance check: NNInt enforces `>= 0` at the protocol level. No ordering discipline: deltas are deltas regardless of when they're produced.

This isn't just reentrancy. The delta model eliminates several classes of bugs at once:

- **Front-running and MEV.** All transactions read the same snapshot. Order doesn't matter. Nothing to reorder, sandwich, or front-run.
- **The approve() race condition.** ERC-20's `approve(spender, amount)` is an absolute write, creating a race where the spender can extract both the old and new allowance. On Groundhog, allowances are deltas. The race doesn't exist.
- **Integer underflow.** NNInt enforces non-negative as a protocol invariant. If merged deltas would drive a balance negative, the transaction is excluded and returned to the mempool. No `require()` needed.

---

## The Infrastructure Tax Disappears

Everything on this list exists because other chains execute transactions sequentially and charge for the privilege:

- **Gas price estimation.** The hard part isn't knowing how much gas your transaction uses. It's predicting what gas will *cost* when it lands: fee markets, priority tips, congestion spikes. On Groundhog, gas limits exist for metering but gas costs zero tokens. No fee markets. No price volatility. Schedule your coins, don't burn them.
- **MEV protection.** Ordering doesn't matter. Nothing to extract.
- **Nonces.** No sequence numbers, no "nonce too low" errors.
- **Compute budgets.** No per-transaction compute budget to fit within.
- **Access lists.** No need to declare which accounts a transaction touches.
- **Storage slot packing.** Typed fields via `#[sdk::storage]`. No manual layout.
- **TTL management.** No storage expiry. Data persists as long as its HOG deposit is held. Delete the data, get the deposit back.

---

## The Programming Model in Brief

Under the hood, each NNInt maintains two pending values: a **set** (absolute base) and an **add** (accumulated delta). The underlying operation is `set_add(set, add)`, and the final value is `set + add`. Two operations commute **if their set values match**. `strict_inc()` always uses the snapshot as the set value, so concurrent calls always agree. Commutativity comes for free.

Not everything commutes. Order book matching, unique name registration, and some governance operations have ordering dependencies. But **82% of blockchain operations are natively commutative or easily adaptable**, based on analysis of 195 million real transactions across six chains.[^commutativity-study]

[^commutativity-study]: See the Groundhog whitepaper for methodology and per-chain breakdowns.

---

## Simplicity Is the Performance

On every other chain, correctness and performance are at odds. You optimize gas, pack storage slots, split transactions to fit compute budgets. You fight for performance, and every optimization makes your code harder to audit.

Groundhog inverts this. The same delta model that eliminates reentrancy and race conditions is what enables parallel execution. `strict_inc(5)` and `strict_inc(3)` from different transactions merge to `+8` with no coordination. The runtime doesn't need locks, dependency graphs, or speculative execution. It just merges deltas. The simpler your code, the more it parallelizes.

Getting the primitive right at the most fundamental level (typed deltas with known merge semantics) means you don't choose between correct and fast. The 3-line transfer that eliminated four classes of bugs? It also runs in parallel with every other transfer in the block.

---

## Next Steps

For a detailed Solidity-to-Groundhog mapping, see the [EVM Migration Guide](/migration/evm-migration/). For the full execution model (snapshots, deltas, merge rules), see [Execution Model](/how-it-works/execution-model/).

Ready to write code? [Getting Started](/start/getting-started/) walks you through the SDK setup and your first contract.
