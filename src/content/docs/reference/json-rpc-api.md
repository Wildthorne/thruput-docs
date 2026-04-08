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

**Receipt structure:**

```json
{
  "txHash": "0x...",
  "height": 42,
  "status": { "result": "ok" },
  "events": [
    {
      "contractAddress": "0x...",
      "topics": ["0x..."],
      "data": "0x..."
    }
  ]
}
```

**Execution status values:**

| Status | Meaning |
|--------|---------|
| `{"result": "ok"}` | Transaction executed and committed |
| `{"result": "reverted", "message": "..."}` | Transaction executed but was reverted |
| `{"result": "deterministicError", "kind": "..."}` | Transaction failed deterministically (e.g., WASM trap) |
| `{"result": "failedGasSponsorship"}` | Gas sponsorship check failed |
| `{"result": "other"}` | Unclassified execution outcome |

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
| `Committed` | Transaction has been included in a block (includes `height` and `blockHash`) |
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

**Returns:** `BlockInfo` or `null` if the block does not exist.

```json
{
  "networkId": 1,
  "blockHeight": 42,
  "txsetHash": "0x...",
  "dbHash": "0x...",
  "eventsHash": "0x...",
  "prevBlockHash": "0x..."
}
```

:::caution[Not Yet Implemented]
This method returns error code `-32052`. The data source for block headers is being finalized.
:::

---

### groundhog_pendingTransactionCount

Get the number of transactions currently in the mempool.

**Parameters:** None.

**Returns:** integer.

:::caution[Not Yet Implemented]
This method returns error code `-32052`. Requires a scheduler size RPC that is not yet available.
:::

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

## Error Codes

Standard JSON-RPC 2.0 error codes apply. The gateway also defines application-specific codes:

| Code | Name | Meaning |
|------|------|---------|
| `-32602` | Invalid params | Standard JSON-RPC: malformed parameters |
| `-32000` | TX_INVALID | Transaction XDR could not be decoded |
| `-32001` | TX_REJECTED | Scheduler rejected the transaction |
| `-32002` | TX_NOT_FOUND | Transaction not found in mempool or history |
| `-32010` | BLOCK_NOT_FOUND | No block at the requested height |
| `-32011` | RANGE_TOO_LARGE | Event query block range exceeds maximum |
| `-32050` | BACKEND_UNAVAILABLE | Internal backend (indexer or scheduler) is not connected |
| `-32051` | BACKEND_TIMEOUT | Internal backend did not respond in time |
| `-32052` | NOT_IMPLEMENTED | Method exists but is not yet functional |

## Client Libraries

**TypeScript/JavaScript.** The `@groundhog/protocol` and `@groundhog/rpc` packages provide TypeScript type definitions and an ONC-RPC client generated from the same XDR protocol definitions used by hogd. These are lower-level than the JSON-RPC gateway and connect directly to hogd's internal RPC interface. See [TypeScript SDK](/tools/typescript-sdk/) for details.

**Rust.** The `groundhog-rpc` crate includes a typed JSON-RPC client generated from the same trait that defines the gateway. Import `groundhog_rpc_client` for a ready-made client.

## Future Phases

| Phase | Planned |
|-------|---------|
| Phase 2 | WebSocket subscriptions (new blocks, pending transactions, contract events) |
| Phase 3 | SDK client and CLI integration |
| Phase 4 | Production hardening (rate limiting, caching, metrics) |
