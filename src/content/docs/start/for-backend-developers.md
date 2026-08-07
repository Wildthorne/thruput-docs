---
title: "For Backend Developers"
description: Map your Postgres and database experience to Groundhog's programming model.
---

*If you've used Postgres, MySQL, or any database with snapshot isolation, you already understand how Groundhog works. This guide maps database concepts you know to blockchain concepts you don't need to fear.*

---

## You Already Know This

Here's how snapshot isolation works in Postgres (REPEATABLE READ or SERIALIZABLE):

1. A transaction begins and sees a **consistent snapshot** of the database
2. Other concurrent transactions can't see your uncommitted writes
3. Your reads are stable. You see the same data throughout your transaction
4. At commit time, the database checks for conflicts
5. If your writes conflict with another committed transaction, you get a serialization failure and retry

Groundhog applies a related model at block scale.

Every transaction in a block reads from the **same frozen snapshot** (the state at the end of the previous block). No transaction sees another's writes within the block. Each transaction produces typed changes, called **deltas**, instead of final state. The runtime checks whether those changes can coexist, and the deltas from transactions that land form the new state. This is the [merged-delta model](/programming-model/execution/#merged-deltas).

If you understand `REPEATABLE READ`, you understand Groundhog's execution model. The rest is details.

---

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

That is enough of the model for most contract code. [Merged Deltas](/programming-model/execution/#merged-deltas) explains how storage types decide which concurrent changes can land together. [NNInt In Depth](/programming-model/nnint/) covers the lower-level `set_add` representation behind `Balance`, including base matching and the difference between `strict_inc`, `inc`, and `set`.

**If you'd write it as `SET col = col + ?` in SQL, it parallelizes on Groundhog. If you'd write it as `SET col = ?`, it might conflict.**

---

## Conflicts and the Mempool

When deltas conflict, Groundhog does what Postgres does at serialization check, with one difference: **you don't write retry loops.** The conflicting transaction is excluded from the block and returned to the mempool. The next block picks it up. Zero retry logic in your code.

The balance constraint works the same way. If two concurrent withdrawals together exceed the available balance, one or more transactions are excluded. This is `CHECK (balance >= 0)` enforced by the storage model rather than application code.

---

## What's Different From a Database

- **No ad-hoc queries.** Storage is key-value with typed values. You access data by key, not by query. An indexer provides query capabilities off-chain.
- **No JOINs.** If you need data from two Maps, you read both explicitly.
- **Deterministic execution.** No `NOW()`, no `RANDOM()`, no HTTP calls.
- **Write costs are deposits, not fees.** Storing data locks HOG tokens proportional to bytes stored. Delete the data, get the tokens back.
- **Gas limits exist but cost zero.** Gas meters computation (prevents infinite loops) but no tokens are burned. Your throughput comes from your free HOG balance: schedule your coins, don't burn them.

---

## Next Steps

For storage type details (`Balance`, `NNInt`, `Map`, `Vector`, `Value`, `Bytestring`, `CapacityConstraint`, and `RetrocausalQueue`) and their conflict semantics, see [Programming Model: Storage Types](/programming-model/storage-types/). For the contract-level execution model, see [Merged Deltas](/programming-model/execution/#merged-deltas).

Ready to write code? [Getting Started](/start/getting-started/) walks you through the SDK setup and your first contract.
