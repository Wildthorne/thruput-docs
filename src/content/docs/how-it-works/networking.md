---
title: Networking
description: "Node topology, component registration, and how transactions reach the mempool."
---

The [System Overview](/how-it-works/architecture/#components) maps the main components. This page explains how they find each other and communicate.

## Topology

Project Thruput's services are organized into an execution layer and a consensus layer.

The **coordinator** (chuckd, written in Go) sits above the execution layer. It drives consensus with other validators, manages peer topology, and tells the local mempool when to produce and commit blocks.

The **mempool** (scheduler, part of hogd) is the hub of the execution layer. All execution components register with it: executors, DB shards, event server, auth server. The mempool orchestrates block production, transaction execution, and state commits.

Separately, the **RPC gateway** (`hog-gateway`) provides external API access. It connects to the scheduler, indexer, database gateway, and view gateway but does not participate in consensus. It can be scaled independently of the validator.

Within the execution layer, no component discovers peers independently. The mempool is the registry for intra-node communication. When a component registers, it gets back the addresses of everything else it needs to talk to.

The coordinator manages inter-node consensus and transaction gossip using its configured peers and quorum sets. See [Consensus](/how-it-works/consensus/) for how coordinators reach agreement.

## Component Registration

Components register their addresses and readiness with the scheduler. Most use an "intro" RPC; the event server uses a prepare/activate handshake. The scheduler waits for the required components before dispatching work.

Registration interfaces:

1. **DB shards** register via `scheddb_intro_shard`. Multiple shards can register (horizontal storage scaling).
2. **Event server** registers via `schedevent_prepare_event` and `schedevent_activate_event`. One per node.
3. **Executors** register via `schedexec_intro_exec`. Multiple executors can register (parallel transaction execution).
4. **Auth server** registers via `mempoolauth_intro_auth`. Handles transaction signature verification.
5. **Coordinator** registers via `schedulercoord_intro_coord`. Drives consensus and block production.

The listed execution-layer interfaces use XDR-RPC over TCP. Protocol definitions live in `.x` files (XDR IDL) and are compiled to C++ (hogd), Rust (thruput-protocol-rs crates such as `thruput-xdr`), TypeScript, and Go bindings.

## The Mempool as Orchestrator

The mempool (scheduler) is more than a transaction pool. It orchestrates the block lifecycle:

- Receives client transactions directly from the RPC gateway and peer transactions from the coordinator
- Verifies transactions through the auth server
- Maintains per-account transaction queues with balance-proportional scheduling
- Assembles block nominations when the coordinator requests them
- Dispatches transactions to executors for parallel execution
- Collects execution results after executors have submitted their deltas to the database for reservation
- Notifies DB shards of state changes at commit

The coordinator requests proposals and commits. The scheduler coordinates the execution services that perform the work.

## Coordinator Connection

The coordinator (chuckd) is the consensus participant. It connects to the mempool and drives block production through these RPC calls:

| Call | Purpose |
|------|---------|
| `schedulercoord_propose_block` | "Build a proposal for this block" |
| `schedulercoord_validate_block` | "Is this peer's proposed block valid?" |
| `schedulercoord_commit_block` | "Finalize this block" |
| `schedulercoord_submit_vetted` | Forward peer-gossiped transactions to the mempool |

The mempool also calls back to the coordinator via a reverse RPC channel to notify it when transactions pass vetting (triggering dissemination to peers).

## External Access

Clients submit transactions and query state through the public gateway.

**JSON-RPC gateway.** Exposes JSON-RPC 2.0 over HTTP and routes requests to the relevant execution-layer service. See [JSON-RPC API](/reference/json-rpc-api/) for the method reference.

**Wallet integration.** Wallets sign transactions client-side and submit them through the JSON-RPC gateway. See [Wallet Integration](/tools/wallet-integration/) for the application-facing flow.

## Transaction Flow

Client submissions reach the scheduler through the gateway; peer-gossiped transactions arrive through the coordinator. The coordinator then drives proposal, validation, and commit through the interfaces above. Follow [Transaction Lifecycle](/how-it-works/transaction-lifecycle/) for the complete sequence and its possible outcomes.

## Related Documentation

- [Consensus](/how-it-works/consensus/): How the coordinator reaches agreement with peers
- [Parallel Execution](/how-it-works/execution-model/): How transactions execute against snapshots and produce deltas
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/): The six stages from submission to commit
- [System Overview](/how-it-works/architecture/): The component map
