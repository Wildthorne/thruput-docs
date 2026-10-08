---
title: System Overview
description: How Stellar Thruput's public gateway, execution services, storage, and consensus coordinator fit together.
---

Stellar Thruput separates three responsibilities: serving applications, executing transactions and storing state, and agreeing on blocks. This page maps those responsibilities to the services that handle them.

## Components

```text
Applications and wallets
      |
      v
JSON-RPC gateway
      |
      +-- Reads
      |   State / Views / History
      |
   submits
      v
  Scheduler <--> Coordinator
      |               |
      |         Other validators
      |
      +-- Auth server
      +-- Executors <--> DB shards
      +-- Event server
```

The diagram shows the main service relationships. [Networking](/how-it-works/networking/) covers registration and communication between them.

| Component | Responsibility |
| --- | --- |
| **JSON-RPC gateway** (`groundhog-rpc`) | Accepts application requests, submits transactions to the scheduler, and routes reads to the relevant service |
| **Scheduler / mempool** (`hogd`) | Queues transactions, coordinates authorization, dispatches execution, and orchestrates block production and commits |
| **Auth server** | Checks transaction authorization claims and signatures before scheduling |
| **Executors** | Run contract code and submit its state changes for reservation against the proposed block |
| **DB shards** | Serve state snapshots, enforce storage merge rules, and store committed state |
| **Event server and indexer** | Collect execution results and make transaction history, receipts, and events available for queries |
| **Coordinator** (`chuckd`) | Drives consensus with other validators and asks the execution layer to propose, validate, and commit blocks |

<span id="how-a-transaction-moves-through-the-system"></span>

## Two paths through the gateway

**Transactions** enter through the gateway and reach the scheduler. The scheduler arranges signature checks, selects work, and dispatches it to executors. The execution layer produces a block proposal; the coordinator handles agreement with other validators.

**Reads** use the service appropriate to the request. State and balance queries use the database gateway, read-only contract calls use the view gateway, and receipt and event queries use the indexer. The scheduler supplies information such as the chain tip and pending transaction status.

The public gateway does not participate in consensus. Applications use its [JSON-RPC API](/reference/json-rpc-api/) rather than the internal service interfaces.

<span id="typed-storage"></span>

## Execution and agreement

The execution layer determines what a proposed block would do. Contracts run against a shared snapshot and produce typed state changes. Executors and DB shards check which changes can be reserved together.

The coordinator drives agreement on which valid proposal to commit. It uses the Stellar Consensus Protocol (SCP); it does not run the contracts itself. Each validator checks the proposed result through its own execution layer before committing it.

<span id="parallelism-and-capacity"></span>

Multiple execution workers and database shards distribute work within a node. Consensus coordinates agreement between validators. These are different responsibilities; adding execution capacity does not change the consensus rules.

## Explore the details

- [Parallel Execution](/how-it-works/execution-model/): Snapshots, compatible updates, and conflict reservation
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/): Submission, execution outcomes, and commit
- [Compute, Capacity & Storage](/how-it-works/storage-economics/): Scheduling and storage deposits
- [Consensus](/how-it-works/consensus/): Proposals, validation, and finality
- [Networking](/how-it-works/networking/): Component registration and internal interfaces

For the behavior your contract relies on, read [Contract Execution](/programming-model/execution/).
