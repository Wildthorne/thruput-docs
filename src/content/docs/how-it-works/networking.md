---
title: Networking
description: "Node topology, component registration, and how transactions reach the mempool."
---

## Topology

A Groundhog node is not a single process. It is a set of components organized in two layers.

The **coordinator** (chuckd, written in Go) sits above the execution layer. It drives consensus with other validators, manages peer topology, and tells the local mempool when to produce and commit blocks.

The **mempool** (scheduler, part of hogd) is the hub of the execution layer. All execution components register with it: executors, DB shards, event server, auth server. The mempool orchestrates block production, transaction execution, and state commits.

Separately, the **RPC gateway** (groundhog-rpc) provides external API access. It connects to the scheduler, indexer, database gateway, and view gateway but does not participate in consensus. It can be scaled independently of the validator.

```
                    ┌─────────────────┐
                    │   Coordinator   │    ← consensus, peer gossip
                    │    (chuckd)     │
                    └────────┬────────┘
                             │
    ┌────────────────────────┼────────────────────────┐
    │                        v                        │
    │               ┌──────────────┐                  │
    │               │   Mempool    │                  │
    │               │  (scheduler) │                  │
    │               └──────┬───────┘                  │
    │    ┌────────┬────────┼────────┬─────────┐       │
    │    v        v        v        v         v       │
    │ Executors  DB     Event     Auth     Indexer    │
    │ (N procs) Shards  Server   Server               │
    │           (N procs)                             │
    │                                          hogd   │
    └─────────────────────────────────────────────────┘

    ┌─────────────────┐
    │  RPC Gateway    │    ← external JSON-RPC API
    │ (groundhog-rpc) │──── connects to scheduler + read backends
    └─────────────────┘
```

Within the execution layer, no component discovers peers independently. The mempool is the registry for intra-node communication. When a component registers, it gets back the addresses of everything else it needs to talk to.

Inter-node communication (consensus, transaction gossip) is managed by the coordinator, which maintains its own peer topology via configured quorum sets. The mempool knows nothing about other validators. See [Consensus](/how-it-works/consensus/) for how coordinators find and talk to each other.

## Component Registration

Each component connects to the mempool and performs an "intro" RPC handshake, passing a card with its protocol version, process ID, and network addresses. The mempool waits for all required components before accepting work.

Startup order:

1. **DB shards** register via `scheddb_intro_shard`. Multiple shards can register (horizontal storage scaling).
2. **Event server** registers via `schedevent_intro_event`. One per node.
3. **Executors** register via `schedexec_intro_exec`. Multiple executors can register (parallel transaction execution).
4. **Auth server** registers via `mempoolauth_intro_auth`. Handles transaction signature verification.
5. **Coordinator** registers via `schedulercoord_intro_coord`. Drives consensus and block production.

All internal communication uses XDR-RPC over TCP. Protocol definitions live in `.x` files (XDR IDL) and are compiled to C++ (hogd), Rust (groundhog-rpc), TypeScript, and Go bindings.

## The Mempool as Orchestrator

The mempool (scheduler) is more than a transaction pool. It orchestrates the block lifecycle:

- Receives client transactions directly from the RPC gateway and peer transactions from the coordinator
- Verifies transactions through the auth server
- Maintains per-account transaction queues with balance-proportional scheduling
- Assembles block nominations when the coordinator requests them
- Dispatches transactions to executors for parallel execution
- Collects deltas and performs reservation (conflict checking)
- Notifies DB shards of state changes at commit

The coordinator does not execute transactions or manage storage. It asks the mempool "give me a block to propose" and "commit this block." The mempool handles everything else.

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

**JSON-RPC gateway.** A separate service (`groundhog-rpc`) that exposes a JSON-RPC 2.0 API over HTTP. It submits transactions directly to the hogd scheduler. Reads use the scheduler, indexer, database gateway, or view gateway according to the method. The gateway is architecturally separate from the validator. It does not participate in consensus and can be scaled independently. See [JSON-RPC API](/reference/json-rpc-api/) for the method reference.

**Wallet integration.** Wallets sign transactions client-side (helpers live in `groundhog-rpc/crates/tools/signing`) and submit them through the JSON-RPC gateway. The gateway is the only supported external entry point for transaction submission.

## Transaction Flow

A transaction moves through the system like this:

1. Client signs and submits via the RPC gateway
2. The gateway submits the transaction directly to the hogd scheduler as unvetted input
3. Mempool sends the transaction to the auth server for signature verification
4. Verified transactions are queued by account with balance-proportional scheduling
5. Coordinator asks the mempool to build a proposal (`propose_block`)
6. Mempool selects transactions, dispatches them to executors for parallel execution, collects deltas, and resolves conflicts. The result is a block nomination.
7. Coordinator runs consensus with peers (see [Consensus](/how-it-works/consensus/))
8. On consensus, coordinator tells mempool to commit (`commit_block`)
9. Committed state is written to DB shards

## Related Documentation

- [Consensus](/how-it-works/consensus/): How the coordinator reaches agreement with peers
- [Execution Model](/how-it-works/execution-model/): How transactions execute against snapshots and produce deltas
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/): The six stages from submission to commit
- [Architecture](/how-it-works/architecture/): The big-picture design
