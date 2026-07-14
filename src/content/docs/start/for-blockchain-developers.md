---
title: "For Blockchain Developers"
description: Map your Ethereum, Solana, or Move experience to Groundhog's programming model.
---

If you've built on Ethereum, Solana, or any smart contract platform, here's what Groundhog looks like: easy things are still easy, whole classes of footguns are gone, the infrastructure tax disappears. 

The same simplicity that makes your code correct is what makes Groundhog incredibly fast and effectively "free" to execute contracts on.

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
    let diff = amount_to_diff(amount);
    self.balances.at_mut(&get_caller()).strict_inc(-diff);
    self.balances.at_mut(receiver).strict_inc(diff);
}
```

Familiar structure. Shorter. Each balance is an [`NNInt`](/programming-model/storage-types/#nnint), Groundhog's integer storage type for balances and counters. `strict_inc(delta)` records a [delta](/programming-model/execution/#merged-deltas), meaning "adjust by this amount," instead of an absolute write meaning "set to this value." That change avoids several common balance and concurrency bugs.

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

That's it. No reentrancy guard: the runtime rejects any `invoke` whose target contract address is already on the active call stack with the `Reentrance` syscall error. The check is per-contract-address and applies to both `invoke` and `try_invoke`. Separately, every contract call also reads from a frozen snapshot, so even allowed call patterns cannot observe partial state. No manual balance check: `strict_inc` rejects balance updates that would go below zero. No ordering discipline: balance changes are recorded as adjustments that concurrent transactions can combine when they are safe to apply.

This isn't just reentrancy. The delta model eliminates several classes of bugs at once:

- **Front-running and MEV.** All transactions read the same snapshot. Order doesn't matter. Nothing to reorder, sandwich, or front-run.
- **The approve() race condition.** ERC-20's `approve(spender, amount)` is an absolute write, creating a race where the spender can extract both the old and new allowance. On Groundhog, allowances are deltas. The race doesn't exist.
- **Integer underflow.** For ordinary balances, NNInt deltas enforce `balance >= 0`. If merged deltas would drive a balance negative, the transaction is excluded and returned to the mempool. No `require()` needed.

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

`NNInt` records signed changes to balances and counters. If two transactions read a balance of 100 and call `strict_inc(-20)` and `strict_inc(-30)`, both can land and the next balance is 50. The operations **commute** because applying them in either order gives the same result. If their combined debits exceed the balance, one or more transactions are excluded. This is the [merged-delta model](/programming-model/execution/#merged-deltas).

Most contract authors only need `strict_inc`. [NNInt In Depth](/programming-model/nnint/) explains the underlying `set_add` representation, resolved bases, and commit-time floor.

NNInt is the workhorse, but it's not the only storage type. `Bytestring` stores up to 1024 bytes of arbitrary data (config, metadata, serialized structs). For higher-level patterns, `Map<K, V>` gives you per-key independence (like `mapping` in Solidity), and `RetrocausalQueue` handles producer-consumer workflows where inserts commute but consumption needs sequencing.

Not everything commutes. Order book matching, unique name registration, and some governance operations need sequencing. Groundhog doesn't force you to do acrobatics for these: `Bytestring` and `RetrocausalQueue` give you the tools to handle serialized workflows cleanly. Meanwhile, payments, transfers, and other balance updates fit the merged-delta model directly. For the full treatment, see [Merged Deltas](/programming-model/execution/#merged-deltas).

---

## Simplicity Is the Performance

On every other chain, correctness and performance are at odds. You optimize gas, pack storage slots, split transactions to fit compute budgets. You fight for performance, and every optimization makes your code harder to audit.

Groundhog's storage rules support both correctness and parallel execution. `strict_inc(5)` and `strict_inc(3)` from different transactions combine to `+8` without coordination. The runtime does not need contracts to declare locks or dependency graphs. The simpler your storage operations, the more work can run in parallel.

Storage types define which concurrent changes can safely coexist, so the three-line transfer above is both easier to audit and able to run alongside other transfers in the block.

---

## Next Steps

For a detailed Solidity-to-Groundhog mapping, see [EVM & Solidity](/ecosystem/evm/). For the contract-level execution model, see [Merged Deltas](/programming-model/execution/#merged-deltas).

Ready to write code? [Getting Started](/start/getting-started/) walks you through the SDK setup and your first contract.
