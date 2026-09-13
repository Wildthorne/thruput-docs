---
title: "For Blockchain Developers"
description: Map your Ethereum, Solana, or Move experience to Groundhog's programming model.
---

Groundhog uses familiar contract calls with a different storage model. Transactions read a shared block snapshot and record typed changes whose merge rules determine which transactions can land together.

The same storage rules that make your code easier to reason about also let compatible transactions execute in parallel without per-operation fees.

---

## Token Transfers

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
    let sender = get_caller();
    self.balances.at_mut(&sender).decrease(amount);
    self.balances.at_mut(receiver).lazy_increase(amount);
}
```

Groundhog builds each block from a shared snapshot. Every transaction reads the same committed starting state and records changes to that state, called deltas. After contract execution, the runtime determines which transaction deltas can land together and uses them to produce the next state.

The code stays familiar. `balances` is a `Map<ContractAddress, Balance>`. Calling `at_mut(address)` selects the balance that will change and returns a mutable handle. Selecting it does not load the balance.

`decrease(amount)` loads the sender's snapshot balance because the contract needs to fail immediately when funds are insufficient. `lazy_increase(amount)` skips the receiver load because the contract does not need an immediate overflow result. Its bound is checked when the transaction's completed delta batch is admitted. Both calls produce deltas that can merge with compatible transactions. `Balance` accepts only nonnegative amounts and exposes no absolute `set` operation.

That is enough of the model for this transfer. [Build a Token](/tutorials/build-a-token/) uses this pattern in a complete contract. [Merged Deltas](/programming-model/execution/#merged-deltas) explains how Groundhog combines changes across a block.

---

## Reentrancy and Balance Checks

Here's a withdrawal function on the EVM, written safely:

```solidity
// Solidity: guard against reentrant withdrawal calls
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

This version checks the balance and guards the external call against reentrant withdrawals.

On Groundhog:

```rust
fn withdraw(&mut self, amount: Amount) {
    self.balances.at_mut(&get_caller()).decrease(amount);
    self.token.transfer(&get_caller(), amount);
}
```

The runtime rejects an `invoke` whose target address is already on the active call stack with the `Reentrance` syscall error. This also applies to `try_invoke`, so contracts do not need a reentrancy guard for this call pattern.

`Balance::decrease` checks the transaction's current balance view. The runtime also checks aggregate bounds when concurrent deltas are reserved. Other application constraints still need explicit checks.

Compatible deltas produce the same merged result regardless of execution order. Conflicting transaction selection remains proposer policy. Likewise, an allowance API using relative adjustments avoids replacing an allowance with a stale absolute value; the storage type does not choose that API for the application.

---

## Resource and Transaction Rules

Groundhog exposes these rules to contract developers:

- **Gas price estimation.** Gas limits exist for metering, but gas costs zero. The declared gas limit still consumes scheduling capacity.
- **Ordering-sensitive balance updates.** Commutative balance deltas have the same merged outcome in any execution order. Application flows that conflict still need protocol-aware design.
- **Nonces.** Replay protection uses a unique expiry-height and nonce pair, without a sequential account counter.
- **Fee-driven compute tuning.** Gas limits still bound each transaction and child call, but using more gas does not increase a token fee.
- **Access lists.** Unlike Solana, where every account a transaction touches must be declared up front, Groundhog discovers storage access during execution. (EVM only requires explicit access lists when opting into EIP-2930.)
- **Storage slot packing.** Typed fields via `#[sdk::storage]`. No manual layout, no packing variables into 256-bit slots.
- **TTL management.** No storage expiry. Data persists as long as its HOG deposit is held. Delete the data, get the deposit back.

---

## The Programming Model in Brief

`Balance` wraps Groundhog's mergeable integer storage with a nonnegative API. If two transactions read a balance of 100 and call `decrease(20)` and `decrease(30)`, both can land and the next balance is 50. The operations **commute** because applying them in either order gives the same result. If their combined debits exceed the balance, one or more transactions are excluded. This is the [merged-delta model](/programming-model/execution/#merged-deltas).

Use `Balance` for ordinary balances and allowances. All four adjustment methods produce deltas that can merge with concurrent transactions. The checked `increase` and `decrease` methods first load the snapshot value so overflow or underflow can fail during contract execution. The `lazy_` variants skip that load and defer the bound check until the transaction's deltas are reserved against the proposed block. [`NNInt`](/programming-model/storage-types/#nnint) is the lower-level choice when a state model needs signed adjustments or an absolute `set`. [NNInt In Depth](/programming-model/nnint/) explains the shared `set_add` representation, resolved bases, and commit-time floor.

`Balance` and `NNInt` are not the only storage types. `Bytestring` stores arbitrary data up to the network-configured limit (1024 bytes by default) (config, metadata, serialized structs). For higher-level patterns, `Map<K, V>` gives you per-key independence (like `mapping` in Solidity), and `RetrocausalQueue` handles producer-consumer workflows where inserts commute but consumption needs sequencing.

Not everything commutes. Order book matching, unique name registration, and some governance operations need sequencing. Groundhog doesn't force you to do acrobatics for these: `Bytestring` and `RetrocausalQueue` give you the tools to handle serialized workflows cleanly. Meanwhile, payments, transfers, and other balance updates fit the merged-delta model directly. For the full treatment, see [Merged Deltas](/programming-model/execution/#merged-deltas).

---

## Storage Choices and Parallelism

Groundhog's storage rules support both correctness and parallel execution. `increase(5)` and `increase(3)` from different transactions can combine to `+8` without coordination. The runtime does not need contracts to declare locks or dependency graphs. Compatible operations can share a block, subject to resource limits.

Storage types define which concurrent changes can safely coexist, so the three-line transfer above is both easier to audit and able to run alongside other transfers in the block.

---

## Next Steps

Continue in layers:

1. [Getting Started](/start/getting-started/) sets up the SDK and builds your first contract.
2. [Build a Token](/tutorials/build-a-token/) applies checked and lazy balance operations in a complete ERC-20-style contract.
3. [Merged Deltas](/programming-model/execution/#merged-deltas) and [Storage Types](/programming-model/storage-types/) give the full contract-author model.
4. [How Conflicts Are Resolved](/how-it-works/execution-model/#how-conflicts-are-resolved) explains the engine's reservation machinery.

For a detailed Solidity-to-Groundhog mapping, see [EVM & Solidity](/ecosystem/evm/).
