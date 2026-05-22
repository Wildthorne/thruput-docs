---
title: "For Blockchain Developers"
description: Map your Ethereum, Solana, or Move experience to Groundhog's programming model.
---

If you've built on Ethereum, Solana, or any smart contract platform, here's what Groundhog looks like: easy things are still easy, whole classes of footguns are gone, the infrastructure tax disappears. 

The same simplicity that makes your code correct is what makes Groundhog incredibly fast and effectively "free" to execute contracts on.

---

## Easy Things Are Still Easy

*We may not all write contracts for an EVM-based chain, but for this example we picked Solidity since many folks are at
least familiar with it. We'll have "what you need to know" guides for most popular chains in the near future!*

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
    let diff = amount_to_diff(amount);
    self.balances.at_mut(&get_caller()).strict_inc(-diff);
    self.balances.at_mut(receiver).strict_inc(diff);
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
    let diff = amount_to_diff(amount);
    self.balances.at_mut(&get_caller()).strict_inc(-diff);
    self.token.transfer(&get_caller(), amount);
}
```

That's it. No reentrancy guard: the runtime rejects any `invoke` whose target contract address is already on the active call stack with the `Reentrance` syscall error. The check is per-contract-address and applies to both `invoke` and `try_invoke`. Separately, every contract call also reads from a frozen snapshot, so even allowed call patterns cannot observe partial state. No manual balance check: NNInt enforces `>= 0` at the protocol level. No ordering discipline: deltas are deltas regardless of when they're produced.

This isn't just reentrancy. The delta model eliminates several classes of bugs at once:

- **Front-running and MEV.** All transactions read the same snapshot. Order doesn't matter. Nothing to reorder, sandwich, or front-run.
- **The approve() race condition.** ERC-20's `approve(spender, amount)` is an absolute write, creating a race where the spender can extract both the old and new allowance. On Groundhog, allowances are deltas. The race doesn't exist.
- **Integer underflow.** NNInt enforces non-negative as a protocol invariant. If merged deltas would drive a balance negative, the transaction is excluded and returned to the mempool. No `require()` needed.

---

## The Infrastructure Tax Disappears

Everything on this list exists because other chains execute transactions sequentially and charge for the privilege:

- **Gas price estimation.** Gas limits exist for metering, but gas costs zero. No fee markets, no priority tips, no congestion spikes. Schedule your coins, don't burn them.
- **MEV protection.** All transactions read the same snapshot. Ordering doesn't affect outcomes, so there's nothing to extract, sandwich, or front-run.
- **Nonces.** No sequence numbers. No "nonce too low" errors. Submit transactions and they execute.
- **Compute budgets.** No per-transaction compute limit to fit within. Gas is free, so there's no pressure to minimize instructions.
- **Access lists.** Unlike Solana, where every account a transaction touches must be declared up front, Groundhog discovers storage access during execution. (EVM only requires explicit access lists when opting into EIP-2930.)
- **Storage slot packing.** Typed fields via `#[sdk::storage]`. No manual layout, no packing variables into 256-bit slots.
- **TTL management.** No storage expiry. Data persists as long as its HOG deposit is held. Delete the data, get the deposit back.

---

## The Programming Model in Brief

Under the hood, each NNInt maintains two pending values: a **set** (absolute base) and an **add** (accumulated delta). The underlying operation is `set_add(set, add)`, and the final value is `set + add`. Two operations commute **if their set values match**. `strict_inc()` always uses the snapshot as the set value, so concurrent calls always agree. Commutativity comes for free.

NNInt is the workhorse, but it's not the only storage type. `Bytestring` stores up to 2KB of arbitrary data (config, metadata, serialized structs). For higher-level patterns, `Map<K, V>` gives you per-key independence (like `mapping` in Solidity), and `RetrocausalQueue` handles producer-consumer workflows where inserts commute but consumption needs sequencing.

Not everything commutes. Order book matching, unique name registration, and some governance operations need sequencing. Groundhog doesn't force you to do acrobatics for these: `Bytestring` and `RetrocausalQueue` give you the tools to handle serialized workflows cleanly. Meanwhile, the vast majority of on-chain activity (payments, transfers, balance updates) flows with zero effort, giving you all the compute capacity you need to make your applications as rich as you want them to be. For the full treatment, see the [Programming Model](/programming-model/execution/) section.

---

## Simplicity Is the Performance

On every other chain, correctness and performance are at odds. You optimize gas, pack storage slots, split transactions to fit compute budgets. You fight for performance, and every optimization makes your code harder to audit.

Groundhog inverts this. The same delta model that eliminates reentrancy and race conditions is what enables parallel execution. `strict_inc(5)` and `strict_inc(3)` from different transactions merge to `+8` with no coordination. The runtime doesn't need locks, dependency graphs, or speculative execution. It just merges deltas. The simpler your code, the more it parallelizes.

Getting the primitive right at the most fundamental level (typed deltas with known merge semantics) means you don't choose between correct and fast. The 3-line transfer that eliminated four classes of bugs? It also runs in parallel with every other transfer in the block.

---

## Next Steps

For a detailed Solidity-to-Groundhog mapping, see the [EVM Migration Guide](/migration/evm-migration/). For the full execution model (snapshots, deltas, merge rules), see the [Programming Model](/programming-model/execution/).

Ready to write code? [Getting Started](/start/getting-started/) walks you through the SDK setup and your first contract.
