---
title: Transaction Lifecycle
description: How a transaction moves from submission to committed state.
---

Submitting a transaction is the start of the process. A successful submission does not prove that the contract call succeeded. Check the committed receipt's execution result.

## Outcomes to distinguish

| Outcome | What it means |
| --- | --- |
| **Rejected before execution** | Admission or authorization failed; the transaction did not reach contract execution |
| **Committed success** | The transaction is in a finalized block and its contract changes were applied |
| **Committed abort or fault** | The failure is recorded in the block, but the contract changes are discarded |
| **Excluded from a proposal** | The transaction did not land in that proposal; conflicting transactions return to the mempool for possible later inclusion |

A pending or `unknown` status, a timeout, or an advisory `recentFailure` is not proof of a committed failure. Keep the original network and transaction hash, and resume observation instead of automatically signing a replacement. See [Track transaction results](/typescript/transaction-status/) for the application workflow.

## Overview

A transaction passes through six stages:

1. **Submission**: Client submits a signed transaction
2. **Authorization**: Signatures are verified before the transaction enters the scheduling queue
3. **Scheduling**: The transaction is queued and selected for a block
4. **Execution and reservation**: Contract code runs against a snapshot, then its completed delta batch is reserved against the proposal
5. **Block Assembly**: The proposer packages results into a block proposal for consensus
6. **Commit**: Finalized state is written to storage

## Stage 1: Submission

The client signs the domain-separated preimage containing the network hash and inner transaction, then submits the signed wrapper through the JSON-RPC gateway. The network hash prevents replay on another Stellar Thruput network. The gateway submits directly to the hogd scheduler.

## Stage 2: Authorization

The mempool sends the transaction to the auth server, which verifies the root address, auth claim, and signatures. Pubkey claims use the public key embedded in the claim. Source-address claims use the root address's registered authorization data. This happens before the transaction enters the scheduling queue, not during execution.

- If verification succeeds: the transaction enters the scheduling queue
- If verification fails: the transaction is rejected

See [Authorization](/how-it-works/authorization/) for the signature preimage and admission models.

## Stage 3: Scheduling

Verified transactions are queued by account with balance-proportional scheduling. When the coordinator asks for a block proposal, the mempool selects transactions from accounts whose token-backed capacity has waited longest. See [Compute, Capacity & Storage](/how-it-works/storage-economics/) for how scheduling priority works.

## Stage 4: Execution

Selected transactions execute in parallel against a **consistent snapshot** of the ledger state. All transactions in a block read from the same snapshot taken at the start of block processing.

When contract code executes:
- It reads state values from the snapshot (via syscalls like `BytestringGet`, `NonnegativeIntGet`)
- Ordinary storage reads do not see writes from other transactions in the block; RCQ consumers can observe concurrent inserts
- It produces deltas describing how to modify state
- It runs until termination (return, abort, or fault)

**Conflict checking follows root execution.** If the root call succeeds, the executor submits its completed delta batch for reservation against the proposed block. An incompatible batch is excluded. Contract execution and reservation can both proceed concurrently across executor workers. See [Parallel Execution: How Conflicts Are Resolved](/how-it-works/execution-model/#how-conflicts-are-resolved) for the mechanism and the distinction between checked and lazy operations.

See [Invocation Frames](/how-it-works/invocation-frames/) for detailed execution semantics (frame lifecycle, child calls, merge/discard rules).

### Root Frame Completion

When the root frame completes, the runtime checks its status:

- **Return (success)**: the transaction's deltas are submitted for reservation. They are included only if the transaction remains admissible.
- **Deterministic Abort or Fault**: the failure can be included in the block with the contract's writes discarded. Protocol bookkeeping, including replay protection, is still recorded. Once committed, this is a final execution result, not a transaction waiting to be retried.

This is distinct from **conflict exclusion** during reservation (Stage 4): the root frame may return successfully, but its completed delta batch can still fail reservation and be returned to the mempool for a future block. Deterministic abort and non-deterministic conflict exclusion are two different failure modes with different on-chain semantics.

## Stage 5: Block Assembly

The proposer packages the included transaction results into a consensus proposal: transaction hashes, nondeterministic execution data, and the computed block hash. The proposal is sent to validators via SCP. See [Consensus](/how-it-works/consensus/) for how the proposer/validator split works.

## Stage 6: Commit

Once consensus confirms the block, each validator commits the verified result to its DB shards. The new ledger state becomes the snapshot for the next block.

Transactions excluded during delta reservation (Stage 4) are returned to the mempool and may be re-evaluated in future blocks, subject to scheduling and expiry. Committed aborts and faults remain in the block with their contract changes discarded.

## Related Documentation

- [Invocation Frames](/how-it-works/invocation-frames/): Execution context
- [Authorization](/how-it-works/authorization/): How signatures are verified
- [Contract artifacts and addresses](/how-it-works/contracts/): Code hashes and deployment identities
