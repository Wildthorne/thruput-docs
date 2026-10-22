---
title: Consensus
description: How SCP coordinates proposals, validation, and finalized blocks.
---

## Overview

Project Thruput uses the Stellar Consensus Protocol (SCP) for agreement. Each validator chooses **quorum slices**: sets of validators whose agreement it considers sufficient. Overlapping quorum slices allow validators to agree on a block.

Nomination uses a priority function to favor a proposed value in each round. Validators still need agreement under the configured quorum rules before finalizing a block.

SCP provides finality under its quorum-intersection and fault assumptions. Applications use the finalized block result rather than a probabilistic confirmation count.

## The Coordinator

Consensus is driven by the coordinator (chuckd), which is separate from the execution engine (hogd). The coordinator's job is to get validators to agree on which block to commit. Contract execution and storage belong to the execution layer, orchestrated by the scheduler. See [System Overview](/how-it-works/architecture/) for the component roles.

Each coordinator is configured with its own quorum set: the list of other validators it trusts for consensus. This peer configuration is managed by the coordinator, not the mempool. The mempool handles intra-node component registration (executors, DB shards, etc.); the coordinator handles inter-node consensus topology. This separation keeps execution concerns and agreement concerns independent.

It runs a state machine called the **baton** that drives the consensus loop.

## Block Production

The baton runs a drive loop after every event:

```
driveCommit()    →  Commit any externalized block
driveNominate()  →  Propose next block if idle
driveCatchup()   →  Fetch missing blocks from peers
driveLiveness()  →  Detect stuck consensus
```

### Single-Node Flow

On a single validator (e.g. during development):

1. Baton calls `propose_block` on the mempool. The execution layer runs queued transactions and assembles a proposal.
2. SCP externalizes immediately (single-node quorum).
3. Baton calls `commit` on the mempool. The execution layer commits the finalized proposal to storage.
4. Next drive cycle begins.

### Multi-Node Flow

With multiple validators:

1. **Propose.** A validator asks its mempool for a block proposal. The proposal contains the transactions and metadata.
2. **Disseminate.** The full consensus value (nomination + metadata) is broadcast to peers via Dogwood (see below). A compact hash reference (the "cue") is sent through SCP.
3. **Validate.** Receiving validators ask their own mempool: "is this nomination valid against my state?" Validation runs asynchronously and results are cached.
4. **Converge.** SCP envelope exchange continues until validators agree. Agreement depends on quorum intersection and the configured trust assumptions.
5. **Commit.** Once SCP externalizes a value, each validator commits the block locally via its mempool.

### Execution During Block Production

The proposer and validators execute transactions differently.

**The proposer runs concurrent execution.** Transactions are fanned across multiple executors and coroutines in parallel. After a root call completes, NNInt capacity locks reserve its delta batch via atomic compare-and-swap (see [Parallel Execution: How Conflicts Are Resolved](/how-it-works/execution-model/#how-conflicts-are-resolved)). Which transaction wins a contested lock depends on thread scheduling. This is non-deterministic: two runs of the same transaction set on the same machine can produce different winners.

**The proposer captures nondeterministic outcomes.** Each transaction produces a `NondeterministicProposalData` payload covering proposal-dependent decisions such as capacity reservation outcomes and retrocausal queue observations. This payload is packaged alongside the transaction hashes in the consensus proposal.

**Validators replay deterministically.** Validators receive the proposer's nominated transaction list and the nondeterministic data. They reconstruct each transaction from their local mempool, pair it with the proposer's captured decisions, and replay execution using those decisions as input. Validators do not re-run the concurrent race. They verify that the transactions produce the claimed state transitions, recompute the block hash, and confirm it matches.

| | Proposer | Validator |
|---|---|---|
| Execution | Concurrent across executors | Deterministic replay with proposer's data |
| Conflict resolution | Non-deterministic thread race | Reproduced from captured decisions |
| Transaction selection | Discretionary (from local mempool) | Fixed (from nomination) |
| Output | Nomination: tx hashes + nondeterministic data + block hash | Accept or reject the nomination |

The proposer has discretion over which transactions to include and which conflicting transaction wins. Validators verify the math of the proposed result, not the policy that produced it. Deterministic replay makes the proposed result verifiable. It does not establish proposer fairness; scheduling and transaction selection are separate from validating state transitions.

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

Under the required quorum assumptions, loss of enough validators can stop progress without invalidating finalized blocks. Incorrect or disjoint trust configurations can violate those assumptions.

Practical implications:

- **No confirmation count.** A confirmed transaction is final. There is no "wait for 6 blocks" or "99.9% probability of finality."
- **Finalized blocks.** Under the consensus safety assumptions, finalized blocks are not replaced by competing blocks.
- **Halt recovery.** If the network halts due to quorum loss, it resumes from the last committed block once enough validators return. Nodes may need to catch up before participating again.

## Catchup and Repair

Validators that fall behind (new nodes, network partitions, restarts) catch up by fetching missing blocks from peers. The catchup agent requests blocks by height, validates them, and replays them locally.

A separate repair agent handles missing data during active consensus: if a validator receives a hash reference it cannot resolve (a consensus value or SCP envelope it hasn't seen), it requests the full data from the originating peer.

## Related Documentation

- [Networking](/how-it-works/networking/): Node topology and how the coordinator connects to the mempool
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/): How a transaction moves from submission to commit
- [Parallel Execution](/how-it-works/execution-model/): How transactions execute against snapshots
- [System Overview](/how-it-works/architecture/): The component map
