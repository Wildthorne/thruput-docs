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

## The Database Mapping

Let's make this concrete. Here's how database operations map to Groundhog:

| Database (Postgres) | Groundhog | What happens |
|---|---|---|
| `BEGIN TRANSACTION` | Transaction starts executing | Snapshot is frozen at block boundary |
| `SELECT balance FROM accounts WHERE id = ?` | `self.balances.get(&account).try_get()` | Read from snapshot |
| `UPDATE accounts SET balance = balance + 5 WHERE id = ?` | `self.balances.get(&account).strict_inc(5)` | Produce a delta (+5) |
| `INSERT INTO accounts (id, data) VALUES (?, ?)` | `self.accounts.set(&id, &data)` | Store a value at a new Map key |
| `COMMIT` | Block close: reservation phase | Test all deltas against invariants |
| Serialization failure -> retry | Transaction excluded, returned to mempool | Mempool resubmits next block |

The key difference from a database: **you don't write retry loops.** When a Groundhog transaction's deltas conflict with another transaction's, it's excluded from the block and returned to the mempool. The next block picks it up. The user experiences sub-second latency. The developer writes no retry logic.

### Reading

```rust
// Groundhog: read a balance (returns 0 if never set)
let balance = self.balances.get(&account).try_get().unwrap_or(0);
```

This reads from the block snapshot, just like a Postgres `SELECT` within a transaction reads from the transaction's snapshot. The value is frozen. Even if another transaction in the same block modifies this account, your read returns the snapshot value.

### Writing

```rust
// Groundhog: increment a balance
self.balances.get(&account).strict_inc(5);
```

This is equivalent to `UPDATE accounts SET balance = balance + 5`. Note that it's `+5`, not `= new_value`. You're expressing **how the value should change**, not what it should become. This is what makes concurrent execution safe. Two `+5` operations always produce `+10`, regardless of execution order.

Under the hood, each NNInt maintains two pending values during a transaction: a **set** value (the absolute base) and an **add** value (the accumulated delta). The underlying operation is `set_add(set, add)`, and the final committed value is `set + add`. The commutativity rule is simple: two operations commute **if their set values match**. They don't have to be any particular value. They just have to agree.

`strict_inc(5)` reads the snapshot base, keeps it as the set value, and accumulates `+5` into the add value. Since every transaction in a block reads the same snapshot, `strict_inc` calls always agree on the base. This is the common case: use `strict_inc()` and commutativity comes for free. `strict_inc(5)` and `strict_inc(3)` on the same key merge to `+8` on top of the shared base. There's also `inc()`, which tells the DB to fill in the snapshot base automatically, skipping the client-side read. Same commutativity, fewer DB lookups.

NNInt also has a `set(value)` method for absolute writes (like `UPDATE ... SET col = ?`). It replaces the base and clears the delta. Two concurrent `set(100)` calls commute (same base), but `set(100)` vs `set(200)` conflicts (different bases). Use `strict_inc()` on hot paths; reserve `set()` for initialization or admin operations.

### The Commit Phase

When the block closes, Groundhog's reservation system does what Postgres's serialization check does: it verifies that all deltas are compatible.

- Two transactions both did `+5` on the same balance? **Compatible.** Both land. Balance increases by 10.
- Two transactions wrote different values to the same raw storage key? **Conflict.** One is excluded.
- Two transactions operated on different accounts entirely? **Independent.** No check needed.

---

## Storage Types as Column Types

Think of Groundhog's [storage primitives](/reference/storage-types/) as column types with built-in merge semantics:

| Groundhog Type | Database Analogy | Concurrent Behavior |
|---|---|---|
| `NNInt` | `INTEGER CHECK (>= 0)` with increment ops | Concurrent increments merge: `+5` and `+3` -> `+8` |
| `Map<K, V>` | Table with composite primary key | Different keys are independent rows, no interaction |
| `RetrocausalQueue` | FIFO queue table (`INSERT` commutes, `SELECT ... FOR UPDATE SKIP LOCKED` sequences) | Parallel inserts, sequential consumers |
| `Bytestring` | `BYTEA` column with last-write-wins | Concurrent writes conflict, only one succeeds per block |

If you'd use `UPDATE ... SET col = col + ?` in SQL, use `NNInt`. If you'd use `INSERT INTO ... VALUES (key, value)` where keys don't collide, use `Map`. If you'd use a raw `UPDATE ... SET col = ?` (absolute write), use `Bytestring`, and know that concurrent writes will conflict.

For the full API of each type, see [Storage Types](/reference/storage-types/).

---

## "But What About Conflicts?"

Let's walk through every scenario:

### Two transfers to the same account (no conflict)

```
Tx A: Alice sends 10 to Charlie  -> delta on Charlie's balance: +10
Tx B: Bob sends 20 to Charlie    -> delta on Charlie's balance: +20
```

Charlie's balance is an `NNInt`. Both deltas are increments. They merge: `+30`. No conflict. Both transactions land. This is exactly like two concurrent `UPDATE accounts SET balance = balance + ? WHERE id = 'charlie'` in Postgres. Both succeed.

### Two transfers from the same account (might conflict)

```
Snapshot: Alice has 100
Tx A: Alice sends 80  -> delta on Alice's balance: -80
Tx B: Alice sends 80  -> delta on Alice's balance: -80
```

Both deltas are decrements on the same NNInt. They merge: `-160`. But Alice only has 100. The NNInt invariant (non-negative) catches this during reservation. One transaction is excluded.

This is Groundhog's equivalent of `CHECK (balance >= 0)` catching a constraint violation. The difference: no serialization failure to handle in your code. The excluded transaction goes back to the mempool automatically.

### Two writes to the same config value (conflict)

```
Tx A: Set owner to Alice  -> Bytestring delta: "alice"
Tx B: Set owner to Bob    -> Bytestring delta: "bob"
```

Different values for the same key. Conflict. One is excluded. This is like two concurrent `UPDATE config SET owner = ?` with different values. Under serializable isolation, one gets a serialization failure.

### Operations on different keys (always independent)

```
Tx A: Modify Alice's balance
Tx B: Modify Bob's balance
```

Different `Map` keys. Completely independent. No conflict possible. Like operating on different rows in Postgres. They never interact.

### The Punchline

**If you'd write it as `SET col = col + ?` in SQL, it parallelizes on Groundhog. If you'd write it as `SET col = ?`, it might conflict.**

This is the entire mental model for conflict behavior.

---

## Schema Mapping

If you can design a Postgres schema, you can design Groundhog storage. Here's how the concepts translate:

| SQL | Groundhog | Notes |
|-----|-----------|-------|
| `CREATE TABLE counter (value INTEGER CHECK (>= 0))` | `#[sdk::storage] struct Counter { value: NNInt }` | Type includes the constraint |
| `UPDATE counter SET value = value + 5` | `self.value.strict_inc(5)` | Delta operation |
| `UPDATE counter SET value = value - 3` | `self.value.strict_inc(-3)` | Aborts if result < 0 |
| `SELECT value FROM counter` | `self.value.try_get().unwrap_or(0)` | Reads from snapshot |
| Table with primary key | `Map<K, NNInt>` | One "row" per key |
| Composite primary key | `Map<K, Map<K, NNInt>>` | Nested maps |

For complete contract examples with tests, see the [Build a Counter](/tutorials/build-a-counter/) and [Build a Token](/tutorials/build-a-token/) tutorials.

---

## What You Don't Need to Learn

Coming from backend development, here's what you might expect to learn about blockchains that **doesn't apply to Groundhog**:

- **Gas as a cost center.** Transactions specify a gas limit for metering (bounding loops and cross-contract calls), but gas costs zero tokens. No gas is burned. Your free HOG token balance determines your throughput share through Balance-Proportional Scheduling: schedule your coins, don't burn them. Think of it like a database where CPU is free but disk space requires a refundable deposit.
- **Fee markets.** No bidding. No priority lanes. No "pay more to go faster." Under congestion, capacity is allocated proportionally to your free HOG balance. Under normal load, everything lands.
- **Storage tiers.** One storage model. No hot/cold/archive distinction. No TTLs. Data persists as long as its HOG deposit is held. Delete the data, get the deposit back.
- **Transaction ordering.** There is no meaningful ordering within a block. All transactions are peers. If you're used to database isolation levels handling this for you, Groundhog does the same.
- **Nonces / sequence numbers.** No nonce management. No "transaction nonce too low" errors. Submit transactions and they execute.
- **Compute budgets as cost centers.** Gas limits exist for safety (preventing infinite loops), but since gas is free, there is no economic pressure to minimize instructions. A complex computation runs alongside thousands of simple transfers without blocking them.

### What IS Different From a Database

Let's be honest about what changes:

- **No ad-hoc queries.** You can't `SELECT * FROM balances WHERE balance > 100`. Storage is key-value with typed values. You access data by key, not by query. (An indexer/block explorer provides query capabilities off-chain.)
- **No JOINs.** If you need data from two "tables" (Maps), you read both explicitly. No query optimizer.
- **No `UPDATE ... SET col = absolute_value` as the default.** The delta model (`col = col + ?`) is the primary write pattern. You can do absolute writes with `Bytestring`, but concurrent absolute writes conflict. This is the core shift.
- **Deterministic execution.** No `NOW()`, no `RANDOM()`, no HTTP calls. Everything must produce the same result on every machine that replays the block.
- **Write costs are deposits, not fees.** Storing data on-chain requires locking HOG tokens proportional to the bytes stored. Delete the data, get the tokens back. Every HOG locked for storage is one less HOG contributing to your throughput share. Think of it as reserving disk space with a refundable deposit.

---

## Next Steps

Groundhog is a globally-replicated database with snapshot isolation, where typed deltas replace absolute writes. You get the guarantees you care about (no double spends, no negative balances, no dirty reads) with less code. The bonus: the same simplicity that makes your code correct also makes it parallel. For the full technical details, see [Execution Model](/how-it-works/execution-model/).

Ready to write code? [Getting Started](/start/getting-started/) walks you through the SDK setup and your first contract.
