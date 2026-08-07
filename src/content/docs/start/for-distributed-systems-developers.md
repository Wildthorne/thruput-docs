---
title: "For Distributed Systems Developers"
description: Map your distributed systems experience to Groundhog's programming model.
---

*If you've worked with CRDTs, eventual consistency, or conflict-free replication, your intuition transfers. But Groundhog is simpler than what you're used to. This page maps what carries over and what you can stop worrying about.*

---

## Your Head Start

You already think in terms of commutative operations. You know that `x + 5` and `x + 3` produce the same result in any order. You know that operations on independent keys don't interact. You've designed systems around these properties.

That instinct is exactly right for Groundhog. [`Balance`](/programming-model/storage-types/#balance) exposes checked and lazy increases and decreases for non-negative values. Lower-level [`NNInt`](/programming-model/storage-types/#nnint) works like a counter whose signed changes combine additively. `Map<K, V>` gives you key-level independence. If you've ever reached for a PN-Counter or a per-key CRDT map, you already know why these primitives exist.

The difference: **you don't need to think about any of the hard parts.**

---

## What's Different (Simpler)

**Groundhog has consensus.** CRDTs solve the problem of replicas that diverge and must eventually agree without coordination. Groundhog has a consensus protocol. Every block is agreed upon by the network. The types don't exist to achieve convergence across unsynchronized replicas. They exist to enable parallel execution *within* a single consensus round.

All transactions in a block execute against the same frozen snapshot. They produce typed changes, called [deltas](/programming-model/execution/#merged-deltas). The runtime checks which changes can coexist, and each finalized block contains one committed result. There's no divergence to reconcile.

This means:

- **No causal metadata.** No vector clocks, no dot stores, no version vectors. The block boundary is the synchronization point. There's no partial order to resolve.
- **Balance limits are enforced.** A PN-Counter can go negative. Groundhog's `Balance` API keeps ordinary balances non-negative, and the runtime checks the combined result when lazy deltas commit. If debits exceed the available value, one or more transactions are excluded and returned to the mempool. No tombstones, no compensating operations.
- **Each block has one result.** There is no continuous merge through anti-entropy or gossip. After finalization, every node has identical state.
- **No convergence latency.** No "eventually" in "eventually consistent." State is consistent at every block boundary.

---

## If You Don't Know Any of This

That's fine. Groundhog doesn't require distributed systems knowledge. Use `Balance` for balances and allowances, `NNInt` for signed counters or votes, and `Map` for per-key data. The types handle commutativity for you. The [For Backend Developers](/start/for-backend-developers/) guide maps the same concepts from database experience, which may be a better starting point.

---

## Next Steps

For the contract-level model, see [Merged Deltas](/programming-model/execution/#merged-deltas). For the storage type API, see [Storage Types](/programming-model/storage-types/). For concurrent delta reservation and the engine's actual conflict timing, see [How Conflicts Are Resolved](/how-it-works/execution-model/#how-conflicts-are-resolved).

Ready to write code? [Getting Started](/start/getting-started/) walks you through the SDK setup and your first contract.
