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

Groundhog is a blockchain that works exactly like this.

Every transaction in a block reads from the **same frozen snapshot** (the state at the end of the previous block). No transaction sees another's writes within the block. Each transaction produces **deltas** (modifications), not final state. At block close, all deltas are checked for compatibility and merged into the new state.

If you understand `REPEATABLE READ`, you understand Groundhog's execution model. The rest is details.

---

## Deltas, Not Assignments

The core shift from a database: instead of `UPDATE accounts SET balance = 50`, you write `strict_inc(5)`, meaning "adjust this value by +5." This is `UPDATE accounts SET balance = balance + 5`. You express **how the value should change**, not what it should become.

```rust
fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    let diff = amount_to_diff(amount);                       // u128 -> i128
    self.balances.at_mut(&get_caller()).strict_inc(-diff);   // delta: subtract
    self.balances.at_mut(receiver).strict_inc(diff);         // delta: add
}
```

Under the hood, each NNInt (non-negative integer) maintains two pending values: a **set** (absolute base) and an **add** (accumulated delta). The underlying operation is `set_add(set, add)`, and the final committed value is `set + add`. The commutativity rule: two operations commute **if their set values match**. They don't have to be any particular value. They just have to agree.

`strict_inc()` uses the snapshot as the set value. Since every transaction in a block reads the same snapshot, `strict_inc` calls always agree on the base. Commutativity comes for free. There's also `inc()`, an optimization that lets the DB fill in the snapshot base, skipping the client-side read. And `set(value)` for absolute writes, where concurrent calls commute only if they write the same value.

**If you'd write it as `SET col = col + ?` in SQL, it parallelizes on Groundhog. If you'd write it as `SET col = ?`, it might conflict.**

---

## Conflicts and the Mempool

When deltas conflict, Groundhog does what Postgres does at serialization check, with one difference: **you don't write retry loops.** The conflicting transaction is excluded from the block and returned to the mempool. The next block picks it up. Zero retry logic in your code.

The non-negative invariant works the same way. If merged deltas would drive a balance below zero (like two concurrent withdrawals that together exceed the balance), one transaction is excluded. This is `CHECK (balance >= 0)` enforced at the protocol level.

---

## What's Different From a Database

- **No ad-hoc queries.** Storage is key-value with typed values. You access data by key, not by query. An indexer provides query capabilities off-chain.
- **No JOINs.** If you need data from two Maps, you read both explicitly.
- **Deterministic execution.** No `NOW()`, no `RANDOM()`, no HTTP calls.
- **Write costs are deposits, not fees.** Storing data locks HOG tokens proportional to bytes stored. Delete the data, get the tokens back.
- **Gas limits exist but cost zero.** Gas meters computation (prevents infinite loops) but no tokens are burned. Your throughput comes from your free HOG balance: schedule your coins, don't burn them.

---

## Next Steps

For storage type details (NNInt, Map, Vector, Value, Bytestring, RetrocausalQueue) and their conflict semantics, see [Programming Model: Storage Types](/programming-model/storage-types/). For the full execution model, see the [Programming Model](/programming-model/execution/).

Ready to write code? [Getting Started](/start/getting-started/) walks you through the SDK setup and your first contract.
