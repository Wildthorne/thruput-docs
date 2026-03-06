---
title: Execution Model
description: How Groundhog executes transactions with snapshots, deltas, and commutative storage.
---

## The Core Idea

Every transaction reads from a consistent snapshot and writes deltas (changes), not final values. That is the whole design.

You learn one new concept: commutativity (which operations can run in parallel and which conflict). In return, you stop thinking about gas fees, storage expiration, transaction size limits, and sequence numbers. Those problems do not exist here.

This page is the canonical reference for Groundhog's execution model. The background guides in [Start Here](/start/) explain these concepts through the lens of specific developer backgrounds. Everything below is the full, authoritative description.

## Snapshot Isolation

Each transaction sees the ledger as it was at the start of the block. All transactions in a block read from the same snapshot. No dirty reads. No phantom reads. No transaction ever sees another transaction's writes within the same block.

This is the same isolation guarantee as Postgres `REPEATABLE READ`, applied to an entire blockchain block.

## Delta Writes

Transactions do not write final values. They produce deltas: descriptions of how to change a value.

Instead of "set balance to 50", a transaction says "increment balance by 10." The runtime collects deltas from all transactions in the block and merges them after execution completes.

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
from_balance.strict_inc(-(amount as i128));
to_balance.strict_inc(amount as i128);
```

Two increments to the same balance always produce the same result regardless of order. `(x + 3) + 5 = (x + 5) + 3`. That is commutativity, and it is why Groundhog can execute transactions in parallel without declared access lists.

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
- Balances as `NonnegativeInt`: concurrent transfers to different accounts all parallelize.
- Independent records as separate `Map` keys: user profiles, token metadata, order records.
- Event streams as `RetrocausalQueue`: multiple producers, entries merge automatically.

**Conflicting** (fine for infrequent operations, one transaction per block wins):
- A config bytestring that multiple transactions update. Only one writer per block; others are excluded and returned to the mempool.
- Any two transactions writing the same bytestring key with different values.

The rule of thumb: if you'd use a CRDT in a distributed system, it will parallelize on Groundhog. If you'd use a mutex, concurrent writes will conflict and only one will land per block. Internal analysis of 195 million real transactions across six chains found that 82% of operations are natively commutative or easily adaptable.[^commutativity-study]

[^commutativity-study]: This analysis covered Ethereum, Solana, Polygon, Arbitrum, Optimism, and Base. See the Groundhog whitepaper for methodology and per-chain breakdowns.

## Storage Primitives

Groundhog provides typed storage primitives at the protocol level. You work with a flat key-value store where each value is one of these types.

### NonnegativeInt

Non-negative integer with two operation modes.

**Add mode** (`strict_inc`): increment or decrement by a delta. Pass a positive value to add, a negative value to subtract. Concurrent additions always commute. The transaction aborts if the value would drop below zero.

Use this for token balances, vote counts, supply tracking.

**SetAdd mode**: specify both a base value and a delta. Commutes only when all concurrent writers supply the same base value. Use this for constraint-tracking patterns like lending, where a contract needs to enforce an invariant against a specific collateral value.

Use Add mode by default. Reach for SetAdd only when you need constraint tracking.

### Map

SDK-level abstraction over `Bytestring` storage. Each key is SHA256-hashed internally, so operations on different keys always commute.

Maps do not support enumeration. There is no `keys()` method and no iteration. If you need to list entries, maintain a separate index alongside the map. This is a known limitation the team is working to improve.

### Bytestring

Arbitrary bytes, up to 1,024 bytes per item. Concurrent writes of the same value commute. Concurrent writes of different values conflict. Use bytestrings for data that is read often and written rarely: config, serialized records, metadata.

### RetrocausalQueue

Multi-producer, single-consumer queue. Inserts always commute. Consumption is serialized: only one transaction can consume from a given queue per block.

Production and consumption happen in separate blocks. In block N, any number of transactions insert entries. In block N+1, a consumer transaction dequeues and processes those entries. This two-phase design keeps the insert path conflict-free.

Deleting a queue destroys it. A delete is not a consume: it removes the queue and all its entries. Concurrent deletes of the same queue commute (both produce an empty key). A delete conflicts with concurrent inserts or consumes on the same queue.

Use queues for event streams, message passing, and task distribution.

See [Storage Types](/reference/storage-types/) for the full API reference.

## HOG and the Capital Model

Groundhog's costs are capital-based, not usage-based. You hold HOG tokens to get capacity. No tokens are burned for execution or storage.

Every HOG in your account is either **free** (contributing to your throughput share) or **locked** (backing on-chain storage). Free HOGs entitle you to a proportional share of network throughput through age-weighted scheduling. Locked HOGs are returned when you delete the data they back.

Transactions declare a gas limit for computational metering (bounding cross-contract calls, preventing infinite loops), but gas costs zero. There are no per-operation fees.

See [Storage & Scheduling Economics](/how-it-works/storage-economics/) for the full cost model, including dynamic pricing, sponsorship, and Balance-Proportional Scheduling.

## How This Compares

### vs. Ethereum

| Ethereum | Groundhog |
|----------|-----------|
| Gas fees per transaction | No per-operation fees; free HOG balance determines throughput share |
| `SSTORE` / `SLOAD` for 256-bit slots | Typed key-value store with commutativity rules |
| Sequential execution within a block | Parallel execution; conflicts detected at merge |
| State persists forever after one-time gas payment | State persists while refundable HOG deposit is held; delete data, get deposit back |
| Gas price auction for priority | Age-weighted fair scheduling; no bidding |

**What you can stop doing:** gas price estimation, fee market mechanics, MEV protection strategies, storage slot packing.

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
| Resource limits constrain transaction complexity | No transaction size limits |
| Sequence numbers enforce serial execution per account | No sequence numbers; transactions parallelize by default |
| Fees per transaction (inclusion + resource fees) | No per-operation fees; free HOG balance determines throughput share |

**What you can stop doing:** TTL management, storage tier selection, building cron jobs to extend data lifetimes, managing channel accounts for parallelism, working within resource limits.

**What you need to learn:** commutativity. In Soroban, you think about storage tiers and TTLs. In Groundhog, you think about whether your operations commute. That is the new axis of complexity, and it is the only one.

## Related Documentation

- [Architecture](/how-it-works/architecture/): The big-picture design
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/): How a transaction moves from submission to commit
- [Contracts](/how-it-works/contracts/): Contract types, deployment, and address derivation
- [Storage Types](/reference/storage-types/): Full API for all storage primitives
