---
title: "For Distributed Systems Developers"
description: Map your distributed systems experience to Groundhog's programming model.
---

*If you've worked with CRDTs, eventual consistency, or conflict-free replication, your intuition transfers. But Groundhog is simpler than what you're used to. This page maps what carries over and what you can stop worrying about.*

---

## Your Head Start

You already think in terms of commutative operations. You know that `x + 5` and `x + 3` produce the same result in any order. You know that operations on independent keys don't interact. You've designed systems around these properties.

That instinct is exactly right for Groundhog. The core storage type, `NNInt`, works like a counter whose increments merge additively. `Map<K, V>` gives you key-level independence. If you've ever reached for a PN-Counter or a per-key CRDT map, you already know why these primitives exist.

The difference: **you don't need to think about any of the hard parts.**

---

## What's Different (Simpler)

**Groundhog has consensus.** CRDTs solve the problem of replicas that diverge and must eventually agree without coordination. Groundhog has a consensus protocol. Every block is agreed upon by the network. The types don't exist to achieve convergence across unsynchronized replicas. They exist to enable parallel execution *within* a single consensus round.

All transactions in a block execute against the same frozen snapshot. They produce deltas. At block close, the deltas merge atomically. There's no divergence to reconcile.

This means:

- **No causal metadata.** No vector clocks, no dot stores, no version vectors. The block boundary is the synchronization point. There's no partial order to resolve.
- **Invariants are enforced.** A PN-Counter can go negative. `NNInt` can't. If merged deltas would drive the value below zero, the offending transaction is excluded and returned to the mempool. No tombstones, no compensating operations.
- **Merge happens once.** Not continuously through anti-entropy or gossip. All deltas merge atomically at block close. After finalization, every node has identical state.
- **No convergence latency.** No "eventually" in "eventually consistent." State is consistent at every block boundary.

---

## If You Don't Know Any of This

That's fine. Groundhog doesn't require distributed systems knowledge. Use `strict_inc()` for anything that accumulates (balances, counters, votes). Use `Map` for per-key data. The types handle commutativity for you. The [For Backend Developers](/start/for-backend-developers/) guide maps the same concepts from database experience, which may be a better starting point.

---

## Next Steps

For the full execution model (snapshots, deltas, merge rules, reservation), see [Execution Model](/how-it-works/execution-model/). For the storage type API, see [Storage Types](/reference/storage-types/).

Ready to write code? [Getting Started](/start/getting-started/) walks you through the SDK setup and your first contract.
