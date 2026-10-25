---
title: Parallel Execution
description: How the engine executes transactions against snapshots and reserves compatible state changes.
---

## The Core Idea

Every transaction reads from a consistent snapshot and records typed deltas. The storage type determines how those deltas combine.

Commutativity describes operations whose combined result does not depend on their order. Project Thruput still enforces resource limits, including gas limits, bounded return values, and a maximum encoded transaction size.

This page explains the engine: snapshots, concurrent reservation, and conflict selection. For the rules your code relies on, read [Contract Execution](/programming-model/execution/).

## Snapshot Isolation

Each transaction sees the ledger as it was at the start of the block. All transactions in a block read from the same snapshot. Ordinary storage reads do not observe other transactions' writes within that block.

Reads also reflect changes within the current transaction and successful child calls. The database snapshot analogy does not imply identical SQL isolation or conflict rules.

`RetrocausalQueue` also permits observations of concurrent inserts. These are recorded as nondeterministic proposal data and replayed by validators. Its read semantics differ from ordinary snapshot storage.

## Delta Writes

Transactions record typed operations: arithmetic deltas, value replacements, or deletions. Each storage type defines how those operations combine.

Instead of "set balance to 50", a transaction says "increment balance by 10." After each root contract call completes, the runtime reserves its delta batch alongside compatible deltas already admitted to the proposed block. The admitted deltas form the next state at commit.

In Solidity, a transfer looks like this:

```solidity
// Solidity: read balances and assign their updated values.
balances[from] = balances[from] - amount;
balances[to] = balances[to] + amount;
```

In Project Thruput:

```rust
// Project Thruput: write deltas. Two compatible transfers to the same
// account produce two deltas that merge cleanly.
balances.at_mut(&from).decrease(amount);
balances.at_mut(&to).increase(amount);
```

Two compatible increments to the same balance produce the same result regardless of order. `(x + 3) + 5 = (x + 5) + 3`. That is commutativity, and it is why Project Thruput can execute transactions in parallel without declared access lists.

## What Commutes and What Doesn't

Transactions execute concurrently. Storage merge rules determine whether their changes can land together. A conflicting transaction is excluded from that proposal. Exclusion does not guarantee automatic requeue or a `retry` status. See [Exclusion, requeue, and resubmission](/how-it-works/transaction-lifecycle/#exclusion-requeue-and-resubmission) for scheduler behavior and client recovery.

| Operation | Can both changes land? | Why |
|-----------|-----------|-----|
| Two balance changes on the same counter | When compatible | Resolved bases must match and aggregate bounds must hold |
| Two writes to different Map keys | Yes | Independent keys don't interact |
| Two writes to the same bytestring | When identical | Different values conflict |
| Multiple inserts into the same queue | Yes | Entries are sorted; insertion order doesn't matter |
| Two deletions of the same key | Yes | Same outcome regardless of order |
| A deletion and a write to the same key | No | Different operation types conflict; one transaction is excluded |

These rules describe the listed operations. Other changes in either transaction can still cause a conflict.

### What This Means for Your Data Model

Choose storage around the changes your application needs to combine. Mergeable arithmetic still has bounds; absolute writes can coexist when they store identical values. [Storage Types](/programming-model/storage-types/#choosing-a-type) turns these rules into contract-design choices.

## How Conflicts Are Resolved

The programming model describes a transaction as executing first and then attempting to land its deltas. The engine implements that boundary directly: ordinary storage conflicts are checked after the root contract call returns, before the transaction is committed into the proposed block.

### Concurrent Delta Reservation

Contract execution accumulates writes in the transaction's `ItemView`. A checked operation such as `Balance::decrease(30)` first loads the snapshot base and can abort immediately if that transaction alone would underflow. A lazy operation skips that load and therefore cannot report a snapshot-bound failure from contract code. Both forms produce an NNInt delta.

After the root call returns successfully, `try_commit_transaction()` submits the transaction's complete delta batch to hogd. For a lazy `NonnegativeIntAdd`, hogd resolves the set value from the block snapshot. A checked `NonnegativeIntSetAdd` already carries that same snapshot value. Both then use the same NNInt type-class match and aggregate bounds reservation.

For a snapshot balance of 10, the per-key reservation starts with subtraction capacity of 10:

```
Snapshot: Alice balance = 10
          Subtraction budget = 10

Tx A contract returns with delta -8
      Reserve delta batch: capacity 10 → 2 → admitted

Tx B contract returns with delta -5
      Reserve delta batch: capacity would be -3 → excluded
```

Whichever transaction reserves first wins. The lock is per-key, per-block and is initialized from the snapshot. Reservations on different keys use separate locks. Transactions touching the same key contend for the same aggregate bounds. Reservation can happen concurrently across executor workers; atomic capacity accounting ensures the combined admitted delta remains in range.

Compatible operations, such as two increases within the upper bound or two decreases within the available balance, can both reserve successfully. Checked and lazy operations share these merge rules. Checked operations can detect underflow in contract code; lazy operations leave that check to reservation. Credits from other transactions do not increase the snapshot's subtraction budget. A lazy decrease cannot rely on another transaction's same-block credit.

### What Block Close Does

By the time block close runs, all capacity conflicts have been resolved. Block close stages the already-finalized locks into a ChangeSet and computes the block hash. No conflict resolution happens at this stage for Balance, NNInt, Map, Value, or Bytestring operations.

RetrocausalQueue is the exception: it has end-of-block invariant checks that the other storage types do not. RCQ entries from excluded transactions are removed during block finalization.

The proposer records reservation-dependent outcomes so validators can replay and verify the proposed block. Contract code chooses storage operations; it does not manage the engine's reservation locks.

## Related reading

- [Contract Execution](/programming-model/execution/): The contract-author model
- [Storage Types](/programming-model/storage-types/): API choices and merge rules
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/): How a transaction moves from submission to commit
- [Compute, Capacity & Storage](/how-it-works/storage-economics/): Gas limits, scheduling, and deposits
