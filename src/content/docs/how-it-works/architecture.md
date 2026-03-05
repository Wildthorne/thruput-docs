---
title: Architecture
description: How Groundhog achieves parallel execution without making you think about parallelism.
---

Groundhog executes every transaction in a block simultaneously. Not optimistically, not on separate shards, not with restrictions on what a transaction can do. Every transaction runs in parallel, on full-featured WebAssembly contracts, with no declared access lists.

You don't manage any of this. You write contracts using typed storage primitives. The types know how to merge concurrent modifications. Parallelism is a consequence of the type system, not something you orchestrate.

## Types, Not Locks

Most parallel systems put the burden on the developer: declare your locks, specify your access lists, hope you didn't miss an edge case. One wrong annotation and you get silent data corruption or deadlocks. Solana requires you to declare every account a transaction will touch before submission. Sui requires owned-vs-shared object reasoning. Even database developers with decades of experience routinely ship locking bugs.

Groundhog takes a different approach. Instead of asking developers to manage concurrency, it provides storage types that guarantee correctness under parallel execution:

- **NonnegativeInt**: concurrent increments merge by addition. Two transfers to the same account produce two deltas that combine cleanly.
- **Map**: operations on different keys never interact. Operations on the same key follow the value type's rules.
- **RetrocausalQueue**: multiple producers, always mergeable.
- **Bytestring**: concurrent writes of different values conflict. Use for data written rarely.

If two transactions both increment a balance, the deltas merge. If two transactions write conflicting values to the same bytestring, one is excluded from the block and returned to the mempool. The contract developer doesn't choose a locking strategy or declare access patterns. The system guarantees correctness: balances never go negative, conflicting writes never silently overwrite each other.

This is not an optimization bolted onto a sequential design. It is the design. Every layer of Groundhog, from the ledger format to the syscall interface to the SDK, is built around typed, mergeable storage.

The SDK provides convenience layers (`NNInt`, `Map`, `#[storage]` macros) that make common patterns easy, but these are optional. You can work directly with the raw syscall interface and build your own storage abstractions. The SDK is middleware, not a framework. See [Getting Started](/start/getting-started/#sdk-layers-use-what-you-need) for the full layering.

For the mechanics of how this works (snapshots, deltas, merge rules), see [Execution Model](/how-it-works/execution-model/). For the full type API, see [Storage Types](/reference/storage-types/).

## What Other Chains Do Instead

Other chains achieve parallelism by restricting what you can do or by hoping for the best.

**Optimistic execution** (Solana, Aptos, Sui): run transactions in parallel, detect conflicts after the fact, abort and retry on collision. This works well when contention is low. When contention spikes (a popular mint, a volatile market), throughput collapses to sequential. Worse, a burst of activity on one contract can degrade performance for unrelated contracts sharing the same validator.

**Restricted transaction models** (Bitcoin, Cardano): limit transactions to consuming individual UTXOs. Parallelism is trivial because transactions can't share state. But shared state is what makes contracts useful. Anything that needs coordination (a DEX, a lending pool, a multisig) requires workarounds that approach the complexity of a separate chain.

**Sharding** (Ethereum L2s, Polkadot): split the ledger into independent partitions. Each shard runs sequentially but shards run in parallel. Users on different shards need bridges to interact, introducing latency, trust assumptions, and historical security problems.

Groundhog's typed storage avoids all three tradeoffs. Contention doesn't collapse throughput because conflicts are granular (per storage key, not per contract or per account). Transactions aren't restricted. The ledger isn't split. Every contract lives in one shared state, and parallelism comes from the types, not the topology.

## What This Enables

When execution is parallel and compute costs nothing (you hold HOG for capacity, not pay per operation), entire classes of applications become practical:

**Compute-heavy contracts.** On sequential chains, every microsecond your contract runs is a microsecond no other contract can use. Chains enforce tight compute budgets to keep block times short. On Groundhog, your contract's compute doesn't compete with other contracts. Complex on-chain logic (verification, simulation, analysis) becomes feasible.

**High-throughput shared state.** A DEX orderbook, a lending pool, a game world. These are contracts where thousands of users interact with the same state simultaneously. On Groundhog, independent operations on that state (deposits to different accounts, trades on different pairs) parallelize automatically through the type system.

**Horizontal scaling.** Each Groundhog node is a distributed system that scales by adding hardware. More CPUs means more concurrent transactions. This is an implementation detail that contracts never see, but it means the network's throughput ceiling rises with commodity hardware prices, not with protocol changes.

## How a Transaction Moves Through the System

1. A transaction arrives specifying a contract address and method arguments.
2. The runtime creates an [invocation frame](/how-it-works/invocation-frames/) with a read snapshot of the current ledger state.
3. The contract executes, reading from its snapshot and producing storage deltas.
4. If the contract calls other contracts, child frames are created. Each child reads from the same snapshot.
5. After execution, the runtime collects all deltas and checks for conflicts.
6. Non-conflicting deltas merge into the ledger. Conflicting transactions are excluded and returned to the mempool.

Every transaction in the block runs steps 2-4 simultaneously. Step 5-6 is where the type system's merge rules determine what lands. See [Transaction Lifecycle](/how-it-works/transaction-lifecycle/) for the full breakdown.

## Related Documentation

- [Execution Model](/how-it-works/execution-model/): Snapshots, deltas, and commutativity rules
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/): The five stages from submission to commit
- [Storage Types](/reference/storage-types/): Full API for NNInt, Map, Bytestring, and RetrocausalQueue
- [Storage & Scheduling Economics](/how-it-works/storage-economics/): The capital-based cost model
