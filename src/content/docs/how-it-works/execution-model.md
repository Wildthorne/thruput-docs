---
title: Execution Model
description: How Groundhog executes transactions with snapshots, deltas, and commutative storage.
---

## The Core Idea

Every transaction reads from a consistent snapshot and writes deltas (changes), not final values. That is the whole design.

You learn one new concept: commutativity (which operations can run in parallel and which conflict). In return, you stop thinking about gas fees, storage expiration, and sequence numbers. Groundhog still enforces resource limits, including gas limits, bounded return values, and a maximum encoded transaction size.

For the contract-writing model, start with [Merged Deltas](/programming-model/execution/#merged-deltas) and [Storage Types](/programming-model/storage-types/). This page is the next layer down. It covers how the engine implements those rules, including delta encodings, concurrent reservation, and conflict selection.

## Snapshot Isolation

Each transaction sees the ledger as it was at the start of the block. All transactions in a block read from the same snapshot. No dirty reads. No phantom reads. No transaction ever sees another transaction's writes within the same block.

This is the same isolation guarantee as Postgres `REPEATABLE READ`, applied to an entire blockchain block.

## Delta Writes

Transactions do not write final values. They produce deltas: descriptions of how to change a value.

Instead of "set balance to 50", a transaction says "increment balance by 10." After each root contract call completes, the runtime reserves its delta batch alongside compatible deltas already admitted to the proposed block. The admitted deltas form the next state at commit.

In Solidity, a transfer looks like this:

```solidity
// Ethereum: write final values. Two concurrent transfers to the same
// account produce a race condition.
balances[from] = balances[from] - amount;
balances[to] = balances[to] + amount;
```

In Groundhog:

```rust
// Groundhog: write deltas. Two concurrent transfers to the same
// account produce two deltas that merge cleanly.
balances.at_mut(&from).decrease(amount);
balances.at_mut(&to).increase(amount);
```

Two compatible increments to the same balance produce the same result regardless of order. `(x + 3) + 5 = (x + 5) + 3`. That is commutativity, and it is why Groundhog can execute transactions in parallel without declared access lists.

## What Commutes and What Doesn't

Operations that commute run in parallel. Operations that don't commute cause the conflicting transaction to be excluded from the block and returned to the mempool.

| Operation | Parallel? | Why |
|-----------|-----------|-----|
| Two balance changes on the same counter | Yes | Addition is commutative |
| Two writes to different Map keys | Yes | Independent keys don't interact |
| Two writes to the same bytestring | No | Different values conflict; one transaction is excluded |
| Multiple inserts into the same queue | Yes | Entries are sorted; insertion order doesn't matter |
| Two deletions of the same key | Yes | Same outcome regardless of order |
| A deletion and a write to the same key | No | Different operation types conflict; one transaction is excluded |

### What This Means for Your Data Model

Your data model determines your throughput.

**High parallelism** (design for this):
- Balances as `Balance`: concurrent credits merge, and debits reserve available capacity.
- Independent records as separate `Map` keys: user profiles, token metadata, order records.
- Event streams as `RetrocausalQueue`: multiple producers, entries merge automatically.

**Conflicting** (fine for infrequent operations, one transaction per block wins):
- A config bytestring that multiple transactions update. Only one writer per block; others are excluded and returned to the mempool.
- Any two transactions writing the same bytestring key with different values.

The rule of thumb: if you'd use a CRDT in a distributed system, it will parallelize on Groundhog. If you'd use a mutex, concurrent writes will conflict and only one will land per block. Internal analysis of 195 million real transactions across six chains found that 82% of operations are natively commutative or easily adaptable.[^commutativity-study]

[^commutativity-study]: This analysis covered Ethereum, Solana, Polygon, Arbitrum, Optimism, and Base. See the Groundhog whitepaper for methodology and per-chain breakdowns.

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

Whichever transaction reserves first wins. The lock is per-key, per-block and is initialized from the snapshot. Two transactions touching different keys never interact. Two transactions touching the same key contend for the same aggregate bounds. Reservation can happen concurrently across executor workers; atomic capacity accounting ensures the combined admitted delta remains in range.

For operations that commute (two increases, or two decreases that fit within the balance), both reservations succeed and both transactions land. Checked and lazy operations share this merge behavior. The difference is that checked operations may fail earlier in contract code, while lazy operations leave the snapshot-bound decision to reservation. A lazy adjustment that is invalid against the snapshot can still be admitted if a compatible offsetting delta has already been admitted before its batch is reserved. If the lazy adjustment reserves first, it is excluded. This possibility depends on reservation order, not eventual block-wide netting.

### What Block Close Does

By the time block close runs, all capacity conflicts have been resolved. Block close stages the already-finalized locks into a ChangeSet and computes the block hash. No conflict resolution happens at this stage for Balance, NNInt, Map, Value, or Bytestring operations.

RetrocausalQueue is the exception: it has end-of-block invariant checks that the other storage types do not. RCQ entries from excluded transactions are removed during block finalization.

### Why the Simplified Model Still Holds

From a contract developer's perspective, the result is the same: your transaction either lands or is excluded. You don't manage locks, budgets, or reservation order. The programming model ("compatible deltas merge; incompatible transactions are excluded") is accurate for deciding how to structure your storage. The proposer records reservation-dependent outcomes so validators can replay and verify the proposed block.

## Storage Primitives

The protocol defines three contract-data storage primitives: **NNInt** (commutative integer), **Bytestring** (raw bytes), and **RetrocausalQueue** (multi-producer queue). Each has its own merge rules for concurrent writes.

The SDK layers typed conveniences on top: **Balance** for checked debit and credit operations, **CapacityConstraint** for reservable capacity, **Map** for keypath-prefixed child storage, **Value** for typed bytestring values, **Vector** for indexed values, and **Node** for compound storage. These are not separate protocol primitives. They inherit the conflict semantics of the items they use.

For the full treatment of each type, conflict semantics, and how to choose between them, see [Programming Model: Storage Types](/programming-model/storage-types/). For the underlying commutativity model, see [NNInt In Depth](/programming-model/nnint/). For API signatures, see [Storage Types Reference](/reference/storage-types/).

## HOG and the Capital Model

Groundhog's costs are capital-based, not usage-based. You hold HOG tokens to get capacity. No tokens are burned for execution or storage.

Every HOG in your account is either **free** (contributing to your throughput share) or **locked** (backing on-chain storage). Free HOGs entitle you to a proportional share of network throughput through age-weighted scheduling. Locked HOGs are returned when you delete the data they back.

Transactions declare a gas limit for computational metering (bounding cross-contract calls, preventing infinite loops), but gas costs zero. For root transactions, the declared limit is the scheduling quantity. The engine measures gas so it can fault an over-limit transaction, not so it can compute a refund. Actual gas consumed does not write refund deltas or create balance updates.

See [Storage & Scheduling Economics](/how-it-works/storage-economics/) for the full cost model, including storage deposits, sponsorship, and Balance-Proportional Scheduling.

## How This Compares

### vs. Ethereum

| Ethereum | Groundhog |
|----------|-----------|
| Gas fees per transaction | No per-operation fees; free HOG balance determines throughput share |
| `SSTORE` / `SLOAD` for 256-bit slots | Typed key-value store with commutativity rules |
| Sequential execution within a block | Parallel execution; conflicts detected at merge |
| State persists forever after one-time gas payment | State persists while refundable HOG deposit is held; delete data, get deposit back |
| Gas price auction for priority | Age-weighted fair scheduling; no bidding |

**What you can stop doing:** gas price estimation, fee market mechanics, and storage slot packing.

**What you need to learn:** which of your operations commute.

### vs. Solana

| Solana | Groundhog |
|--------|-----------|
| Must declare read/write account sets upfront | No upfront declaration; conflicts detected at merge |
| Fixed-size program accounts; `realloc` to resize | Dynamic key-value entries; cost adjusts automatically |
| Rent-exempt balance required per account | HOG deposit per storage item; conceptually similar |
| Compute unit budget + priority fees | No per-operation fees; free HOG balance determines throughput share |

**What you can stop doing:** account sizing, `realloc` management, upfront access-list declarations, compute budget tuning.

**What you need to learn:** commutativity instead of access lists. You get more composability in exchange: no need to know a transaction's full read/write set before submitting it.

### vs. Soroban

| Soroban | Groundhog |
|---------|-----------|
| Three storage tiers (Instance, Persistent, Temporary) | One storage model, no tiers |
| TTLs on persistent storage; must extend or data expires | Permanent storage, no TTLs, no expiration |
| Resource limits constrain transaction complexity | Gas and encoded-size limits without per-operation fees |
| Sequence numbers enforce serial execution per account | No sequence numbers; transactions parallelize by default |
| Fees per transaction (inclusion + resource fees) | No per-operation fees; free HOG balance determines throughput share |

For Soroban developers, the main shift is not contract expressiveness; it is where the runtime asks you to pay attention. Groundhog makes storage permanence and transaction capacity part of the base model, then uses commutativity to decide which operations can merge safely in parallel.

## Related Documentation

- [Merged Deltas](/programming-model/execution/#merged-deltas): Contract-writing model for concurrent state changes
- [Architecture](/how-it-works/architecture/): The big-picture design
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/): How a transaction moves from submission to commit
- [Contracts](/how-it-works/contracts/): Contract types, deployment, and address derivation
- [Storage Types Reference](/reference/storage-types/): Full API for all storage primitives
