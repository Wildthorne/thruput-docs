---
title: Networking
description: "Node topology, component registration, and how transactions reach the mempool."
---

:::caution[Draft]
This page describes the current architecture. Some details (particularly the RPC gateway) are still being finalized.
:::

## Topology

A Groundhog node is not a single process. It is a set of components that register with a central scheduler (the mempool). The mempool acts as the hub: every component connects to it, registers itself, and receives the network addresses of all other components.

```
                         ┌──────────────┐
                         │   Mempool    │
                         │  (scheduler) │
                         └──────┬───────┘
           ┌────────┬───────┬───┴───┬──────────┐
           v        v       v       v          v
       Executors  DB      Event   Auth     Coordinator
       (N procs) Shards  Server  Server     (chuckd)
                 (N procs)
```

Within a node, no component discovers peers independently. The mempool is the registry for intra-node communication. When a component registers, it gets back the addresses of everything else it needs to talk to.

Inter-node communication (consensus, transaction gossip) is managed by the coordinator, which maintains its own peer topology via configured quorum sets. The mempool knows nothing about other validators. See [Consensus](/how-it-works/consensus/) for how coordinators find and talk to each other.

## Component Registration

Each component connects to the mempool and performs an "intro" RPC handshake, passing a card with its protocol version, process ID, and network addresses. The mempool waits for all required components before accepting work.

Startup order:

1. **DB shards** register via `scheddb_intro_shard`. Multiple shards can register (horizontal storage scaling).
2. **Event server** registers via `schedevent_intro_event`. One per node.
3. **Executors** register via `schedexec_intro_exec`. Multiple executors can register (parallel transaction execution).
4. **Auth server** registers via `mempoolauth_intro_auth`. Handles transaction signature verification.
5. **Coordinator** registers via `schedulercoord_intro_coord`. Drives consensus and block production.

All internal communication uses XDR-RPC over TCP. Protocol definitions live in `.x` files (XDR IDL) and are compiled to both C++ (hogd), Go (chuckd), and Rust (groundhog-rpc) bindings.

## The Mempool as Orchestrator

The mempool (scheduler) is more than a transaction pool. It orchestrates the block lifecycle:

- Receives submitted transactions from the coordinator
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
| `schedulercoord_nominate` | "Give me a block to propose" |
| `schedulercoord_validate` | "Is this peer's proposed block valid?" |
| `schedulercoord_commit_block` | "Finalize this block" |
| `schedulercoord_submit_unvetted` | Forward client transactions to the mempool |
| `schedulercoord_submit_vetted` | Forward peer-gossiped transactions to the mempool |

The mempool also calls back to the coordinator via a reverse RPC channel to notify it when transactions pass vetting (triggering dissemination to peers).

## External Access

Clients submit transactions and query state through two paths:

**Wallet (current).** The coordinator includes an HTTP/REST wallet endpoint. Clients submit signed transactions, which the coordinator forwards to the mempool via `submit_unvetted`. This exists for testing, not real public usage.

**JSON-RPC gateway (in progress).** A separate service (`groundhog-rpc`) that exposes a JSON-RPC 2.0 API. It connects to the mempool and indexer via x23 RPC. Phase 1 methods:

| Method | What it does |
|--------|-------------|
| `groundhog_sendRawTransaction` | Submit a signed transaction |
| `groundhog_getTransactionReceipt` | Get execution result and events |
| `groundhog_getTransactionStatus` | Check if pending, committed, or unknown |
| `groundhog_chainTip` | Current block height and hash |
| `groundhog_getBlockByNumber` | Block header by height |
| `groundhog_getContractEvents` | Query events by contract address and block range |

The gateway is architecturally separate from the validator. It does not participate in consensus and can be scaled independently.

## Transaction Flow

A transaction moves through the system like this:

1. Client signs and submits via wallet or RPC gateway
2. Coordinator receives the transaction and forwards it to the mempool (`submit_unvetted`)
3. Mempool sends the transaction to the auth server for signature verification
4. Verified transactions are queued by account with balance-proportional scheduling
5. Coordinator asks mempool for a nomination (`nominate`)
6. Mempool assembles a block from queued transactions and returns it
7. Coordinator runs consensus with peers (see [Consensus](/how-it-works/consensus/))
8. On consensus, coordinator tells mempool to commit (`commit_block`)
9. Mempool dispatches transactions to executors, collects deltas, resolves conflicts
10. Committed state is written to DB shards

## Related Documentation

- [Consensus](/how-it-works/consensus/): How the coordinator reaches agreement with peers
- [Execution Model](/how-it-works/execution-model/): How transactions execute against snapshots and produce deltas
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/): The five stages from submission to commit
- [Architecture](/how-it-works/architecture/): The big-picture design
