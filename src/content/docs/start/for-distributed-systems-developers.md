---
title: "For Distributed Systems Developers"
description: Map your CRDT and distributed systems experience to Groundhog's programming model.
---

*If you've worked with CRDTs, eventual consistency, or conflict-free replication, the intuition transfers. But Groundhog is not a CRDT system. This guide maps what you know to what's actually happening, including where the analogy breaks.*

---

## The Familiar Part

You already think in terms of commutative operations. You know that `x + 5` and `x + 3` produce the same result in any order. You know that set union is commutative but set intersection depends on what's in each replica. You've designed systems around this.

Groundhog's storage types encode the same intuition:

| CRDT you know | Groundhog type | What's similar |
|---|---|---|
| G-Counter / PN-Counter | `NNInt` | Increments merge by addition |
| OR-Set (add-only) | `Map<K, V>` | Independent keys never conflict |
| Append-only log | `RetrocausalQueue` | Multi-producer insert, order resolved later |
| LWW-Register | `Bytestring` | Last writer wins, concurrent writes conflict |

If your instinct is "this is just CRDTs on a blockchain," slow down. The execution model is fundamentally different, and the differences matter for how you design contracts.

---

## Where the Analogy Breaks

### CRDTs converge without consensus. Groundhog has consensus.

CRDTs solve a specific problem: replicas that diverge and must eventually agree without coordination. They sacrifice invariant enforcement for availability. A PN-Counter can go negative. An OR-Set can't enforce a maximum size. That's the price of coordination-freedom.

Groundhog has a consensus protocol. Every block is agreed upon by the network. The types don't exist to achieve convergence across unsynchronized replicas. They exist to enable parallel execution *within* a single consensus round. All transactions in a block execute against the same snapshot, produce deltas, and merge at a well-defined synchronization point: block close.

This means Groundhog can do something CRDTs can't: enforce invariants during merge. `NNInt` rejects deltas that would drive the value below zero. The transaction is excluded from the block. No tombstones, no compensating operations, no "fix it later." The invariant holds at every block boundary.

### No causal metadata.

CRDTs need vector clocks, dot stores, or version vectors to track causality across replicas. That metadata is the mechanism that makes convergence possible without coordination.

Groundhog types carry no causal metadata. They don't need it. The block boundary is the synchronization point. Every transaction reads the same snapshot (the previous block's state). Every delta is produced against that snapshot. There's no divergence to reconcile, no partial orders to resolve. The merge function takes a set of deltas and a base state, not a set of divergent replica states.

If you're used to reasoning about "happens-before" relationships between operations, you can stop. Within a block, there is no ordering between transactions. They all read the same state. They all produce deltas. The deltas either merge or they don't.

### Merge happens once, not continuously.

In a CRDT system, state propagates through anti-entropy protocols, gossip, or explicit sync. Merge is continuous and incremental. Replicas can be arbitrarily far behind.

In Groundhog, merge happens exactly once per block. All deltas from all transactions in the block are collected and merged atomically. The result is the new ledger state. There's no partial merge, no stale replica, no "this node hasn't seen that update yet." After a block is finalized, every node has identical state.

This simplifies your mental model considerably. You don't think about convergence latency, read-your-writes consistency, or causal consistency levels. You think about one thing: will my deltas conflict with other deltas in this block?

For the full execution model (snapshot reads, delta production, merge rules, reservation), see [Execution Model](/how-it-works/execution-model/).

---

## Designing Contracts with This Model

Your distributed systems instinct will serve you well here, but recalibrate for the block-synchronous context.

### Think "per-block batch merge," not "continuous replication"

In a CRDT system, you might worry about operation ordering, delivery guarantees, or replica divergence windows. None of that applies. All operations in a block are unordered with respect to each other. They all see the same base state. The merge is total and atomic.

Your design question is: given N concurrent operations against the same base state, will their deltas merge cleanly?

### Use NNInt for anything that accumulates

Balances, counters, vote tallies, supply tracking. Concurrent increments always merge. This is your PN-Counter, but with an enforced non-negativity invariant that PN-Counters can't provide. `strict_inc(delta)` is the only mutation operation, and it works like an op-based counter with a floor constraint.

For a complete counter contract with tests, see [Build a Counter](/tutorials/build-a-counter/). For a full token implementation with transfers, allowances, and minting, see [Build a Token](/tutorials/build-a-token/).

### Use Map for partitioned state

If your data is naturally keyed (user profiles, token balances, order records), `Map` gives you key-level independence. Two operations on different keys are as parallel as two operations on different CRDTs. Same key follows the value type's rules.

Maps don't support enumeration. No `keys()`, no iteration. This is the same constraint you'd see in a partition-tolerant system: you can't efficiently enumerate across partitions. If you need a list of keys, maintain a separate index.

### Use RetrocausalQueue for producer-consumer patterns

Multiple producers can insert into the same queue in the same block. All inserts merge. Consumption is sequenced: one consumer per block reads from the head, and consumed items are processed in a subsequent block.

This is closest to a replicated log with multi-producer append, but consumption is deferred by one block. The "retrocausal" name reflects this: the decision to consume is made before the consumed items are finalized.

### Use Bytestring sparingly

`Bytestring` is your LWW-Register equivalent. Concurrent writes of different values conflict. Unlike a LWW-Register, Groundhog doesn't silently pick a winner. It excludes the conflicting transaction and retries it next block.

When you reach for `Bytestring`, you're declaring: "this state can't be updated concurrently." That's fine for config, metadata, or data written rarely. Use it intentionally.

For the full API of each type, see [Storage Types](/reference/storage-types/).

---

## What You Stop Thinking About

Things from distributed systems that don't apply here:

- **Causal ordering.** No vector clocks. No happens-before. Transactions in a block are unordered.
- **Convergence latency.** Merge is instantaneous at block close. No anti-entropy protocol.
- **Read-your-writes consistency.** You read the previous block's state. Your writes land in the current block. There's a one-block delay, but it's deterministic, not "eventually."
- **Conflict resolution strategies.** The type determines resolution. You don't write custom merge functions.
- **Replica management.** Consensus handles replication. You write contract logic, not replication logic.

## What You Start Thinking About

- **Which type to use.** This is the whole game. `NNInt` for accumulators. `Map` for keyed data. `RetrocausalQueue` for event streams. `Bytestring` for rarely-written state.
- **Delta compatibility.** Will concurrent operations on the same key merge? If you're using `NNInt`, yes. If you're using `Bytestring`, only if they write the same value.
- **One-block-delayed reads.** Your transaction reads the previous block's state. Another transaction's writes in the same block are invisible to you. Design accordingly.

---

## Next Steps

Groundhog is a strongly consistent replicated state machine where typed deltas replace state-based merge and the block boundary replaces continuous anti-entropy. For the full technical details, see [Execution Model](/how-it-works/execution-model/).

Ready to write code? [Getting Started](/start/getting-started/) walks you through the SDK setup and your first contract.
