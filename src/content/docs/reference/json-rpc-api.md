---
title: JSON-RPC API
description: API endpoints for interacting with a Groundhog node.
---

:::caution[Draft]
This API is under active development. Method signatures and response formats may change.
:::

The Groundhog JSON-RPC gateway (`groundhog-rpc`) is a separate service that exposes a JSON-RPC 2.0 API over HTTP. It connects to the validator stack (hogd) via internal RPC and provides external access for clients, wallets, and tooling.

For how the gateway fits into the node architecture, see [Networking](/how-it-works/networking/).

## Connection

The gateway listens on a configurable HTTP port. All methods use the standard JSON-RPC 2.0 request format:

```json
{
  "jsonrpc": "2.0",
  "method": "groundhog_chainTip",
  "params": [],
  "id": 1
}
```

## Phase 1 Methods

### groundhog_sendRawTransaction

Submit a signed transaction to the mempool.

| Parameter | Type | Description |
|-----------|------|-------------|
| `bytes` | `0x`-prefixed hex | The signed transaction bytes |

**Returns:** `TxHash` (the transaction hash).

---

### groundhog_getTransactionReceipt

Get the execution result and emitted events for a committed transaction.

| Parameter | Type | Description |
|-----------|------|-------------|
| `hash` | `0x`-prefixed hex (64 chars) | The transaction hash |

**Returns:** `TransactionReceipt` or `null` if not found. The receipt includes execution status, emitted events, and block height.

**Execution status values:**

| Status | Meaning |
|--------|---------|
| `Ok` | Transaction executed and committed |
| `Reverted` | Transaction executed but was reverted |
| `DeterministicError` | Transaction failed deterministically |
| `FailedGasSponsorship` | Gas sponsorship check failed |

---

### groundhog_getTransactionStatus

Check whether a transaction is pending, committed, or unknown.

| Parameter | Type | Description |
|-----------|------|-------------|
| `hash` | `0x`-prefixed hex (64 chars) | The transaction hash |

**Returns:** One of:

| Status | Meaning |
|--------|---------|
| `Pending` | Transaction is in the mempool, not yet committed |
| `Committed` | Transaction has been included in a block |
| `Invalid` | Transaction was rejected |
| `Unknown` | Transaction not found in mempool or committed history |

The gateway checks the mempool (scheduler) first, then the indexer. If the scheduler is unavailable, it returns best-effort results from the indexer only.

---

### groundhog_chainTip

Get the current chain tip.

**Parameters:** None.

**Returns:** `ChainTip` with the current block height and block hash.

---

### groundhog_getBlockByNumber

Get block information by height.

| Parameter | Type | Description |
|-----------|------|-------------|
| `height` | integer | Block height |

**Returns:** `BlockInfo` or `null` if the block does not exist. Includes block hash, parent hash, timestamp, and transaction count.

---

### groundhog_pendingTransactionCount

Get the number of transactions currently in the mempool.

**Parameters:** None.

**Returns:** integer.

---

### groundhog_getContractEvents

Query events emitted by a contract within a block range.

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | `0x`-prefixed hex (64 chars) | Contract address |
| `fromBlock` | integer | Start of block range (inclusive) |
| `toBlock` | integer | End of block range (inclusive) |

**Returns:** Array of `IdentifiedEvent` objects, each containing the event data, topics, block height, and transaction hash.

The gateway enforces a maximum block range per request (default: 1000 blocks).

---

## Wire Format Conventions

| Type | Format |
|------|--------|
| Hashes and addresses | `0x`-prefixed lowercase hex, 64 characters |
| Event topics | `0x`-prefixed lowercase hex, 64 characters |
| Event data | `0x`-prefixed hex, variable length |
| Block height, counts | Decimal JSON numbers |

## Future Phases

| Phase | Planned |
|-------|---------|
| Phase 2 | WebSocket subscriptions (new blocks, pending transactions, contract events) |
| Phase 3 | SDK client and CLI integration |
| Phase 4 | Production hardening (rate limiting, caching, metrics) |
