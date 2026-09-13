---
title: Architecture
description: How Groundhog achieves parallel execution without making you think about parallelism.
---

Groundhog executes transactions concurrently against a shared block snapshot. Contracts run on RV32 (32-bit RISC-V) and use typed storage whose merge rules determine which changes can land together. Transactions do not declare access lists.

## Typed Storage

Groundhog starts with a storage question: which concurrent changes can safely coexist? Each primitive answers that question for its own data. Contract authors choose a type and write sequential Rust; the runtime checks the resulting changes.

- **Balance**: checked and lazy adjustments for non-negative balances. Compatible deltas combine within the available bounds.
- **NNInt**: signed adjustments and explicit bases. Concurrent changes must resolve to the same base.
- **Map**: different keys use independent storage; changes to the same key follow the value type's rules.
- **CapacityConstraint**: reserves or releases capacity against a shared limit.
- **RetrocausalQueue**: supports concurrent producers with queue-specific finalization rules.
- **Bytestring**: concurrent writes of different values conflict. Identical writes can coexist.

Two compatible balance increases can merge. Different writes to the same bytestring cannot both land; excluded transactions return to the mempool for possible inclusion in a later block. These rules enforce storage invariants. Contracts still need authorization checks and application-specific constraints.

The SDK provides storage abstractions and macros over the raw syscall interface. You can also build your own abstractions using syscalls. See [SDK Surfaces](/start/getting-started/#sdk-surfaces).

## Parallelism and Capacity

Independent storage keys let transactions use shared contracts concurrently. Changes to the same key can also coexist when its merge rules permit them. Conflicting application workflows still need an explicit design, such as a queue for sequencing work.

Execution workers and database shards distribute a node's work across hardware. Throughput depends on workload, contention, and available resources. Gas costs zero tokens, but gas limits and scheduling capacity still bound computation.

For contract-writing rules, see [Merged Deltas](/programming-model/execution/#merged-deltas). For engine internals, see [Execution Model](/how-it-works/execution-model/).

## How a Transaction Moves Through the System

1. A transaction arrives specifying a contract address and method arguments.
2. The runtime creates an [invocation frame](/how-it-works/invocation-frames/) with a read snapshot of the current ledger state.
3. The contract executes, reading from its snapshot and producing storage deltas.
4. If the contract calls other contracts, child frames are created. Each child inherits the parent's view of storage (parent writes are visible), but all transactions in the block share the same underlying snapshot for unmodified keys.
5. After execution, the runtime collects all deltas and checks for conflicts.
6. Non-conflicting deltas merge into the ledger. Conflicting transactions are excluded and returned to the mempool.

Executor workers run steps 2-4 concurrently. Steps 5-6 apply the storage merge rules to determine what lands. See [Transaction Lifecycle](/how-it-works/transaction-lifecycle/) for the full breakdown.

## Related Documentation

- [Merged Deltas](/programming-model/execution/#merged-deltas): Contract-writing rules for concurrent state changes
- [Execution Model](/how-it-works/execution-model/): How the engine implements the programming model
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/): The six stages from submission to commit
- [Storage Types Reference](/reference/storage-types/): Full API for Balance, NNInt, Map, Vector, Value, Bytestring, CapacityConstraint, and RetrocausalQueue
- [Storage & Scheduling Economics](/how-it-works/storage-economics/): The capital-based cost model
