---
title: Consensus
description: "SCP-based consensus, block production, and irrevocable finality."
---

:::caution[Draft]
This page describes the current architecture. Some details may change as the protocol matures.
:::

## Overview

Groundhog uses the Stellar Consensus Protocol (SCP) for agreement. SCP is a federated Byzantine agreement protocol: each validator picks its own **quorum slices** (the sets of validators it trusts), and the network converges on a single value without a fixed committee or rotating leader. Nomination uses a priority function to bias which validator's proposed value is considered first per round, but no validator can unilaterally decide a block; agreement comes from overlapping quorum slices, not from a designated proposer.

The result is **irrevocable finality**. Once a block is confirmed, it cannot be reversed. No reorgs, no probabilistic confirmation, no waiting for additional blocks. A confirmed transaction is final.

## The Coordinator

Consensus is driven by the coordinator (chuckd), which is separate from the execution engine (hogd). The coordinator's job is to get validators to agree on which block to commit. It does not execute transactions or manage storage. That is the mempool's job (see [Networking](/how-it-works/networking/)).

Each coordinator is configured with its own quorum set: the list of other validators it trusts for consensus. This peer configuration is managed by the coordinator, not the mempool. The mempool handles intra-node component registration (executors, DB shards, etc.); the coordinator handles inter-node consensus topology. This separation keeps execution concerns and agreement concerns independent.

It runs a state machine called the **baton** that drives the consensus loop.

## Block Production

The baton runs a drive loop after every event:

```
drive_commit()    →  Commit any externalized block
drive_nominate()  →  Propose next block if idle
drive_catchup()   →  Fetch missing blocks from peers
drive_liveness()  →  Detect stuck consensus
```

### Single-Node Flow

On a single validator (e.g. during development):

1. Baton calls `nominate` on the mempool. The mempool assembles a block from queued transactions.
2. SCP externalizes immediately (single-node quorum).
3. Baton calls `commit` on the mempool. The mempool executes transactions, resolves conflicts, and writes state.
4. Next drive cycle begins.

### Multi-Node Flow

With multiple validators:

1. **Nominate.** A validator asks its mempool for a block nomination. The nomination contains the transactions and metadata.
2. **Disseminate.** The full consensus value (nomination + metadata) is broadcast to peers via Dogwood (see below). A compact hash reference (the "cue") is sent through SCP.
3. **Validate.** Receiving validators ask their own mempool: "is this nomination valid against my state?" Validation runs asynchronously and results are cached.
4. **Converge.** SCP envelope exchange continues until validators agree. The protocol guarantees that all honest validators converge on the same block, even under Byzantine faults (up to the quorum threshold).
5. **Commit.** Once SCP externalizes a value, each validator commits the block locally via its mempool.

### Execution During Block Production

The proposer and validators execute transactions differently.

**The proposer runs concurrent execution.** Transactions are fanned across multiple executors and coroutines in parallel. NNInt capacity locks resolve conflicts via atomic compare-and-swap (see [Execution Model: How Conflicts Are Resolved](/how-it-works/execution-model/#how-conflicts-are-resolved)). Which transaction wins a contested lock depends on thread scheduling. This is non-deterministic: two runs of the same transaction set on the same machine can produce different winners.

**The proposer captures nondeterministic outcomes.** Each transaction's execution produces a `NondeterministicProposalData` payload: a bitstring of decisions made during execution (capacity reservation outcomes, retrocausal queue observations). This payload is packaged alongside the transaction hashes in the consensus nomination.

**Validators replay deterministically.** Validators receive the proposer's nominated transaction list and the nondeterministic data. They reconstruct each transaction from their local mempool, pair it with the proposer's captured decisions, and replay execution using those decisions as input. Validators do not re-run the concurrent race. They verify that the transactions produce the claimed state transitions, recompute the block hash, and confirm it matches.

| | Proposer | Validator |
|---|---|---|
| Execution | Concurrent across executors | Deterministic replay with proposer's data |
| Conflict resolution | Non-deterministic thread race | Reproduced from captured decisions |
| Transaction selection | Discretionary (from local mempool) | Fixed (from nomination) |
| Output | Nomination: tx hashes + nondeterministic data + block hash | Accept or reject the nomination |

The proposer has discretion over which transactions to include and which conflicting transaction wins. Validators verify the math of the proposed result, not the policy that produced it. This is sufficient for consensus safety: the network cannot fork because validators are replaying, not racing. Proposer fairness is an admission-control concern handled at the gateway layer, not in the consensus protocol.

## Dissemination: Dogwood

Validators exchange three types of data during consensus:

| Data | Description |
|------|-------------|
| **Transactions** | Signed transactions gossiped between validators |
| **Consensus values** | Full block nominations (transactions + metadata) |
| **SCP envelopes** | Protocol messages for agreement (nominate, prepare, confirm, externalize) |

Dogwood is the dissemination layer. It uses **erasure-coded multicast**: data is split into chunks, encoded with redundancy, and broadcast over BFS multicast trees. Receivers can reconstruct the original data from a subset of chunks, reducing bandwidth requirements while tolerating packet loss.

Each data type is tagged and demultiplexed on receipt. Transactions are forwarded to the mempool. Consensus values are cached locally for validation. SCP envelopes are fed to the embedded SCP kernel.

## Finality Model

SCP guarantees **safety over liveness**. If validators cannot reach agreement (e.g. too many are offline), the network halts rather than forking. This is a deliberate design choice: a halted network can recover, but a forked ledger cannot be unforked.

Practical implications:

- **No confirmation count.** A confirmed transaction is final. There is no "wait for 6 blocks" or "99.9% probability of finality."
- **No reorgs.** The chain never reorganizes. Once a block is committed, it stays committed.
- **Halt recovery.** If the network halts due to quorum loss, it resumes from the last committed block once enough validators return. No state is lost.

## Catchup and Repair

Validators that fall behind (new nodes, network partitions, restarts) catch up by fetching missing blocks from peers. The catchup agent requests blocks by height, validates them, and replays them locally.

A separate repair agent handles missing data during active consensus: if a validator receives a hash reference it cannot resolve (a consensus value or SCP envelope it hasn't seen), it requests the full data from the originating peer.

## Related Documentation

- [Networking](/how-it-works/networking/): Node topology and how the coordinator connects to the mempool
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/): How a transaction moves from submission to commit
- [Execution Model](/how-it-works/execution-model/): How transactions execute against snapshots
- [Architecture](/how-it-works/architecture/): The big-picture design
