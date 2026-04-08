---
title: Transaction Lifecycle
description: How a transaction moves from submission to committed state.
---

This page describes how a transaction moves through the system, from client submission to committed ledger state.

## Overview

A transaction passes through six stages:

1. **Submission**: Client submits a signed transaction
2. **Authorization**: Signatures are verified before the transaction enters the mempool
3. **Scheduling**: The transaction is queued and selected for a block
4. **Execution**: Contract code runs against a snapshot, producing deltas with incremental conflict checking
5. **Block Assembly**: The proposer packages results into a nomination for consensus
6. **Commit**: Finalized state is written to storage

## Stage 1: Submission

The client signs a transaction and submits it via the wallet endpoint or JSON-RPC gateway. The coordinator receives it and forwards it to the mempool.

## Stage 2: Authorization

The mempool sends the transaction to the auth server, a separate process that verifies signatures against the target address's authorization data. This happens before the transaction enters the scheduling queue, not during execution.

- If verification succeeds: the transaction enters the scheduling queue
- If verification fails: the transaction is rejected

See [Authorization](/how-it-works/authorization/) for details on the authorization system.

## Stage 3: Scheduling

Verified transactions are queued by account with balance-proportional scheduling. When the coordinator asks for a block nomination, the mempool selects transactions from accounts whose HOGs have waited longest. See [Storage & Scheduling Economics](/how-it-works/storage-economics/) for how scheduling priority works.

## Stage 4: Execution

Selected transactions execute in parallel against a **consistent snapshot** of the ledger state. All transactions in a block read from the same snapshot taken at the start of block processing.

When contract code executes:
- It reads state values from the snapshot (via syscalls like `BytestringGet`, `NonnegativeIntGet`)
- It never sees writes from other transactions in the same block
- It produces deltas describing how to modify state
- It runs until termination (return, abort, or fault)

**Conflict checking is incremental.** As each delta is produced during execution, it is checked against capacity locks derived from the snapshot. For NNInt operations, this means subtraction capacity is reserved atomically via compare-and-swap. If a reservation fails (another transaction already consumed the capacity), the transaction is excluded immediately. See [Execution Model: How Conflicts Are Resolved](/how-it-works/execution-model/#how-conflicts-are-resolved) for the full mechanism.

Because all transactions read from the same snapshot and conflicts are resolved per-key during execution, transactions run in parallel across all available CPU cores.

See [Invocation Frames](/how-it-works/invocation-frames/) for detailed execution semantics (frame lifecycle, child calls, merge/discard rules).

### Root Frame Completion

When the root frame completes, the runtime checks its status:

- **Fault or Abort**: transaction fails, no state changes are committed, transaction is excluded from the block and returned to the mempool
- **Return (success)**: the transaction's deltas are included in the block

## Stage 5: Block Assembly

The proposer packages all successfully executed transactions into a consensus nomination: transaction hashes, nondeterministic execution data, and the computed block hash. This nomination is sent to validators via SCP. See [Consensus](/how-it-works/consensus/) for how the proposer/validator split works.

## Stage 6: Commit

Once consensus confirms the block, each validator commits the finalized state to its DB shards. All deltas for each key are combined according to type-specific merge rules to produce the new ledger state, which becomes the snapshot for the next block.

Excluded transactions (those that failed conflict checking during execution) are returned to the mempool and may be re-evaluated in future blocks.

## Related Documentation

- [Invocation Frames](/how-it-works/invocation-frames/): Execution context
- [Authorization](/how-it-works/authorization/): How signatures are verified
- [Contracts](/how-it-works/contracts/): Contract types and deployment
