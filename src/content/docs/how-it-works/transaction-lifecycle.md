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
| **Excluded from a proposal** | That attempt did not land in the proposal. Exclusion does not consume its replay nonce or establish its outcome in another proposal. Requeue and reported status depend on later processing |

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

The client signs the domain-separated preimage containing the network hash and inner transaction, then submits the signed wrapper through the JSON-RPC gateway. The network hash prevents replay on another Project Thruput network. The gateway submits directly to the hogd scheduler.

## Stage 2: Authorization

The mempool sends the transaction to the auth server, which verifies the root address, auth claim, and signatures. Pubkey claims use the public key attached to the signed transaction (`SignedTransaction.pubkey_claim_key`). Its hash must equal the claim's `pubkey_hash`. Source-address claims use the root address's registered authorization data. This happens before the transaction enters the scheduling queue, not during execution.

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

This is distinct from **conflict exclusion** during reservation (Stage 4): the root frame may return successfully, but its completed delta batch can still fail reservation and be excluded. Deterministic abort and non-deterministic conflict exclusion are two different failure modes with different on-chain semantics.

## Stage 5: Block Assembly

The proposer packages the included transaction results into a consensus proposal: signed transaction hashes (`SignedTransactionHash`), nondeterministic execution data, and the computed block hash. The proposal is sent to validators via SCP. See [Consensus](/how-it-works/consensus/) for how the proposer/validator split works.

## Stage 6: Commit

Once consensus confirms the block, each validator commits the verified result to its DB shards. The new ledger state becomes the snapshot for the next block.

Committed aborts and faults remain in the block with their contract changes discarded. Their replay nonces are consumed.

## Exclusion, requeue, and resubmission

Exclusion applies to one proposal. It does not guarantee that the transaction will return to the mempool or that the client will observe `retry`.

| What happens to the node's proposal | What its scheduler does |
| --- | --- |
| Its own proposal commits | Removes the attempted transactions, including excluded ones. Records retryable execution failures as `retry` |
| A different proposal commits | Can requeue transactions from its nomination that are absent from the committed block |
| Its nomination is rolled back | Requeues its cached transactions |

Automatic requeue in the last two cases does not guarantee later inclusion. After removal in the first case, that scheduler needs another submission to attempt the transaction again.

`retry` is a retained scheduler outcome. The indexer can separately report an advisory `recentFailure`, either as a status or alongside `pending`, `retry`, or `dropped`. It can describe an earlier attempt. Indexed commitment takes priority over these observations. A timeout, `unknown`, or `recentFailure` alone does not prove that the transaction never executed.

Clients retain the signed bytes, transaction hash, and original network. Receipt polling observes the outcome and does not resubmit. When retrying is appropriate, resubmit the same signed transaction while it remains valid. Expiration prevents future inclusion; it does not prove that an earlier attempt never committed. See [Resubmission and replacement](/typescript/transaction-status/#resubmission-and-replacement) for the application workflow.

Sources (repository access required): engine `0.1.31-rc.16` [commit handling](https://github.com/thruputchain/hogd/blob/fff489c82d0ff28594e9dc8694aa5571787be7fd/hogd/hog_mempool/rpc_from_coord.cc#L3251-L3335) and [nomination rollback](https://github.com/thruputchain/hogd/blob/fff489c82d0ff28594e9dc8694aa5571787be7fd/hogd/hog_mempool/rpc_from_coord.cc#L1246-L1258), and tools `0.40.0` [status composition](https://github.com/thruputchain/thruput-tools/blob/774ea4be4287b096eb38a57aa4aa952b038f5c7b/crates/x23/hogd-backend/src/native/transaction/status.rs#L4-L54).

## Related Documentation

- [Invocation Frames](/how-it-works/invocation-frames/): Execution context
- [Authorization](/how-it-works/authorization/): How signatures are verified
- [Contract artifacts and addresses](/how-it-works/contracts/): Code hashes and deployment identities
