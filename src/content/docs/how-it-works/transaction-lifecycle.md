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
4. **Execution and reservation**: Contract code runs against a snapshot, then its completed delta batch is reserved against the proposal
5. **Block Assembly**: The proposer packages results into a block proposal for consensus
6. **Commit**: Finalized state is written to storage

## Stage 1: Submission

The client signs the domain-separated preimage containing the network hash and inner transaction, then submits the signed wrapper through the JSON-RPC gateway. The network hash prevents replay on another Groundhog network. The gateway submits directly to the hogd scheduler.

## Stage 2: Authorization

The mempool sends the transaction to the auth server, a separate process that verifies the root address, auth claim, and signatures. Pubkey claims use the public key embedded in the claim. Source-address claims use the root address's registered authorization data. This happens before the transaction enters the scheduling queue, not during execution.

- If verification succeeds: the transaction enters the scheduling queue
- If verification fails: the transaction is rejected

See [Authorization](/how-it-works/authorization/) for the signature preimage and admission models.

## Stage 3: Scheduling

Verified transactions are queued by account with balance-proportional scheduling. When the coordinator asks for a block proposal, the mempool selects transactions from accounts whose HOGs have waited longest. See [Storage & Scheduling Economics](/how-it-works/storage-economics/) for how scheduling priority works.

## Stage 4: Execution

Selected transactions execute in parallel against a **consistent snapshot** of the ledger state. All transactions in a block read from the same snapshot taken at the start of block processing.

When contract code executes:
- It reads state values from the snapshot (via syscalls like `BytestringGet`, `NonnegativeIntGet`)
- Ordinary storage reads do not see writes from other transactions in the block; RCQ consumers can observe concurrent inserts
- It produces deltas describing how to modify state
- It runs until termination (return, abort, or fault)

**Conflict checking follows root execution.** Contract code first runs against the snapshot and accumulates a delta batch. Checked `Balance::decrease` and `NNInt::strict_inc` operations load the snapshot base so underflow can fail inside the contract. Lazy balance operations skip that load. If the root call succeeds, the executor submits the complete batch for reservation against the proposal's per-key capacity locks. An incompatible aggregate result excludes the transaction. See [Execution Model: How Conflicts Are Resolved](/how-it-works/execution-model/#how-conflicts-are-resolved) for the full mechanism.

Contract calls run in parallel against the same snapshot, and completed delta batches can be reserved concurrently across executor workers.

See [Invocation Frames](/how-it-works/invocation-frames/) for detailed execution semantics (frame lifecycle, child calls, merge/discard rules).

### Root Frame Completion

When the root frame completes, the runtime checks its status:

- **Return (success)**: the transaction's deltas are submitted for reservation. They are included only if the transaction remains admissible.
- **Abort or Fault**: the transaction is **still included in the block**, but with no state changes. The failure is deterministic, so every validator reaches the same result, and the transaction does not need to be re-evaluated. It is not returned to the mempool.

This is distinct from **conflict exclusion** during reservation (Stage 4): the root frame may return successfully, but its completed delta batch can still fail reservation and be returned to the mempool for a future block. Deterministic abort and non-deterministic conflict exclusion are two different failure modes with different on-chain semantics.

## Stage 5: Block Assembly

The proposer packages the included transaction results into a consensus proposal: transaction hashes, nondeterministic execution data, and the computed block hash. The proposal is sent to validators via SCP. See [Consensus](/how-it-works/consensus/) for how the proposer/validator split works.

## Stage 6: Commit

Once consensus confirms the block, each validator commits the finalized state to its DB shards. All deltas for each key are combined according to type-specific merge rules to produce the new ledger state, which becomes the snapshot for the next block.

Transactions excluded during delta reservation (Stage 4) are returned to the mempool and may be re-evaluated in future blocks. Transactions that aborted or faulted deterministically remain in the block with no state effect.

## Related Documentation

- [Invocation Frames](/how-it-works/invocation-frames/): Execution context
- [Authorization](/how-it-works/authorization/): How signatures are verified
- [Contracts](/how-it-works/contracts/): Contract types and deployment
