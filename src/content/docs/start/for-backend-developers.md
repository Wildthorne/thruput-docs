---
title: "For Backend Developers"
description: Map your Postgres and database experience to Stellar Thruput's programming model.
---

Database snapshot isolation is a useful starting point for Stellar Thruput. Transactions share a committed block snapshot, but their writes follow typed storage merge rules rather than SQL conflict rules.

## Shared Snapshot

Every transaction in a block starts from the previous block's committed state. Ordinary storage reads include its own changes and successful child calls, but not other transactions' writes. `RetrocausalQueue` has separate rules for observing concurrent inserts. Each transaction produces typed changes, called **deltas**. Compatible deltas form the next committed state. See [Merged Deltas](/programming-model/execution/#merged-deltas).

## Deltas, Not Assignments

The core shift from a database: instead of `UPDATE accounts SET balance = 50`, you call `increase(5)`, meaning "adjust this value by +5." This is `UPDATE accounts SET balance = balance + 5`. You express **how the value should change**, not what it should become.

```rust
fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    let sender = get_caller();
    self.balances.at_mut(&sender).decrease(amount);          // checked debit
    self.balances.at_mut(receiver).lazy_increase(amount);    // deferred bound check
}
```

[`Balance`](/programming-model/storage-types/#balance) is the SDK type for this pattern. Both calls record deltas that can merge with concurrent transactions. `decrease()` loads the sender's balance so an insufficient debit fails during execution. `lazy_increase()` skips the receiver load and defers its bound check until the delta batch is reserved. If two transactions debit 20 and 30 from a balance of 100, both can land and the next balance is 50. Applying the changes in either order gives the same result, so the operations **commute**.

[NNInt and concurrent updates](/programming-model/nnint/) explains the representation behind these balance operations, including base matching and early bound checks.

**Relative updates such as `SET col = col + ?` map naturally to mergeable integer operations.** Compatibility still depends on bounds and the transaction's other changes. Absolute replacements can conflict when they assign different values.

---

## Conflicts and Retries

When deltas conflict, the transaction is excluded and reported as `retry`. Contract code does not retry the operation. The client resubmits the same signed transaction until it commits or expires. It can commit at most once.

The balance constraint works the same way. If two concurrent withdrawals together exceed the available balance, one or more transactions are excluded. This is `CHECK (balance >= 0)` enforced by the storage model rather than application code.

---

## What's Different From a Database

- **No ad-hoc queries.** Storage is key-value with typed values. You access data by key, not by query. An indexer provides query capabilities off-chain.
- **No JOINs.** If you need data from two Maps, you read both explicitly.
- **Deterministic execution.** Use block context rather than the host clock. Contract code cannot make HTTP calls or use the host's random-number generator.
- **Storage deposits.** Stored data locks native tokens according to its type and size. Deleting the data returns the deposit.
- **No conventional gas fees.** Gas meters computation (prevents infinite loops) but no tokens are burned. Your unlocked native-token balance provides scheduling capacity under load. The declared gas limit determines how much capacity the transaction uses.

---

## Next Steps

For storage type details (`Balance`, `NNInt`, `Map`, `Vector`, `Value`, `Bytestring`, `CapacityConstraint`, and `RetrocausalQueue`) and their conflict semantics, see [Programming Model: Storage Types](/programming-model/storage-types/). For the contract-level execution model, see [Merged Deltas](/programming-model/execution/#merged-deltas).

Ready to write code? The [contract quickstart](/get-started/contract/) walks you through building and deploying your first contract.
