---
title: "For Distributed Systems Developers"
description: Understand Stellar Thruput's use of commutative updates within consensus blocks.
---

Stellar Thruput uses commutative operations to combine concurrent changes within a block. The storage model supports parallel execution; consensus selects the result validators commit.

## Your Head Start

Additions such as `+5` and `+3` have the same sum in either order. Stellar Thruput's [`Balance`](/programming-model/storage-types/#balance) and [`NNInt`](/programming-model/nnint/) expose relative updates with explicit bounds. `Map<K, V>` gives separate keys independent storage locations.

The similarity to counters and maps in CRDT systems is useful, but the coordination model differs.

## Coordination at Block Boundaries

CRDTs can reconcile independently updated replicas. Stellar Thruput instead executes transactions against a common committed snapshot, reserves compatible typed changes, and uses [consensus](/how-it-works/consensus/) to select a finalized block.

- **Merge rules operate within a proposal.** Applications do not maintain vector clocks to reconcile ordinary balance or map updates.
- **Bounds still apply.** A balance cannot commit below zero. If concurrent debits exceed the available value, an overdrawing transaction is excluded and reported as `retry` for the client to resubmit.
- **Consensus selects one result.** Validators verify the proposed state transition. Nodes that have applied the same finalized block agree on that state.
- **Readers can see different heights.** A node may lag while receiving or replaying blocks. Check the returned read height when freshness matters.

## If You Don't Know Any of This

You can write contracts without implementing a concurrency algorithm. Choose the storage type for the updates your application needs, then use its ordinary Rust methods. The [backend-developer guide](/start/for-backend-developers/) explains the same model through database concepts.

## Next Steps

- [Contract Execution](/programming-model/execution/): snapshots, deltas, and exclusion
- [Storage Types](/programming-model/storage-types/): data-model choices
- [How Conflicts Are Resolved](/how-it-works/execution-model/#how-conflicts-are-resolved): engine reservation details
- [Contract quickstart](/get-started/contract/): build and deploy a counter
