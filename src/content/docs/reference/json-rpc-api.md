---
title: JSON-RPC API
description: How Groundhog's JSON-RPC is shaped and the methods it exposes.
---

:::caution[Draft]
This API is under active development. Method signatures and response formats may change.
:::

:::note[Version checked]
This page was source-checked against `groundhog-rpc` `0.6.3` and JSON-RPC wire format `3.0.0` on August 5, 2026.
:::

The Groundhog JSON-RPC gateway (`groundhog-rpc`) is a separate service that exposes a JSON-RPC 2.0 API over HTTP. It connects to the validator stack (hogd) via internal RPC and provides external access for clients, wallets, and tooling.

For how the gateway fits into the node architecture, see [Networking](/how-it-works/networking/). The first half of this page covers the *shape* of the API and the design choices behind it; the second half is the per-method reference. If you're picking up the API for the first time, read the design section first. If you're looking up a specific method, jump to [Methods](#methods).

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

## Design

The API presents a typed JSON envelope. Responses are objects with named, JSON-native fields. Wallets, explorers, and dapps interpret them directly. Clients only reach for an XDR codec when they need to inspect or construct the bytes inside a specific field, never to decode a whole response.

### Typed JSON, Not XDR Blobs

Three points on the design space:

| Style | Example | What clients need |
|---|---|---|
| **Raw bytes everywhere** | EVM `eth_getStorageAt` returns one `bytes32` per slot | A storage-layout library to know what each slot means |
| **XDR-typed everywhere** | Soroban `ScVal` wraps every value in a tagged XDR enum | An XDR codec for nearly every read |
| **Typed JSON envelope** | Groundhog `getStorageAt` returns `{ kind: "nonnegativeInt", value: "1000000000" }` | Nothing for the common cases; an XDR codec only for byte-typed fields |

The third style, a Horizon-shaped envelope with Groundhog-typed values, is what every method on the public `groundhog_*` namespace uses. It works because Groundhog's storage model is genuinely typed at the protocol level: nonnegative integers, bytestrings, auth data, and retrocausal queues are distinct kinds, not packed words. Returning that type information directly is cheaper for clients than reconstructing it from raw bytes.

### The Shape of a Response

Receipts, events, and statuses are typed objects. Nothing is XDR-encoded except specific byte-typed fields (addresses, hashes, calldata, event topics) which are carried as `0x`-prefixed hex strings.

A transaction receipt:

```json
{
  "txHash": "0xabc1...def0",
  "height": 12345,
  "status": { "result": "ok" },
  "events": [
    {
      "contractAddress": "0x1111...1111",
      "topics": ["0x2222...2222"],
      "data": "0x3333"
    }
  ],
  "returnData": "0x42"
}
```

`status` is a tagged variant, not a binary 0/1. A reverted call returns `{ "result": "reverted", "message": "insufficient balance" }`; a deterministic engine error returns `{ "result": "deterministicError", "kind": "outOfGas" }`. Clients switch on `result` and handle each case directly. Compare to EVM, where a `0` status leaves you guessing why.

Events look familiar to anyone who has worked with `eth_getLogs`: structured records with a `contractAddress`, indexed `topics`, and a `data` payload. The page wrapper carries a cursor for pagination.

### Reading State

`groundhog_getStorageAt` returns the latest committed value at a given address and storage key:

```json
{
  "blockHeight": 4567,
  "item": {
    "kind": "nonnegativeInt",
    "value": "1000000000"
  }
}
```

Two things to notice. First, the response always carries `blockHeight`, even when the key is empty (`item: null`), so clients can compare against `chainTip` to gauge freshness. Second, `item` is a tagged union. Clients switch on `kind` and read the variant's named fields directly:

```json
{ "kind": "nonnegativeInt", "value": "1000000000" }
{ "kind": "bytestring",     "bytes": "0xdeadbeef" }
{ "kind": "deployedContract", "hash": "0x...", "size": 12345, "contractType": 0 }
{ "kind": "authData" }
{ "kind": "retrocausalQueue" }
{ "kind": "replayCacheEntry" }
{ "kind": "unknown", "typeId": 99 }
```

`authData`, `retrocausalQueue`, and `replayCacheEntry` are presence-only. Their on-chain shapes are richer than a single value can express. Auth data is a structured policy record, and retrocausal queues are multi-entry containers. The API reports presence and points clients toward a contract invocation when they need the contents. Same principle as Horizon: headline stats from the read API; deep detail from a typed operation.

`unknown` is a forward-compatibility variant. If a future protocol release adds a new storage kind, clients built against an older spec see `{ "kind": "unknown", "typeId": 99 }` rather than a parse failure.

### Wire Conventions

A few conventions the API follows consistently:

- **camelCase for all field names** in `groundhog_*` and `groundhog_dev_*` JSON-RPC responses. (Internal readiness JSON between hogd-dev and the supervisor uses snake_case; this is process plumbing, not public API.)
- **`0x`-prefixed lowercase hex** for byte-typed fields: addresses, hashes, calldata, event topics, raw bytestrings.
- **Decimal-string encoding for big integers** (`u128`, `i128`, anything that can exceed JavaScript's safe-integer range). Smaller numeric fields like block heights and event counts are JSON numbers.
- **Tagged unions** are encoded with a discriminator field (`kind` for storage items, `result` for execution status). Variants carry their own named fields alongside the tag.
- **Method namespacing**: `groundhog_*` for production methods every backend implements, `groundhog_dev_*` for local-node-only methods (account listing, transaction detail with full traces, reset). Production gateways do not expose `groundhog_dev_*`.

Specific byte-field sizes:

| Field | Format |
|---|---|
| Hashes and addresses | `0x`-prefixed lowercase hex, 64 characters (32 bytes) |
| Event topics | `0x`-prefixed lowercase hex, 64 characters (32 bytes) |
| Event data, calldata, bytestrings | `0x`-prefixed lowercase hex, variable length |

### What's Familiar from EVM

If you've written against `eth_*` JSON-RPC, most of this is muscle memory:

- Structured-JSON responses for receipts, events, blocks, status.
- camelCase field names. Hex-encoded byte fields. Discriminator tags for variants.
- Method namespacing by prefix.
- A cursor-paginated `getEvents` shaped like `eth_getLogs`.

The places Groundhog goes further than EVM: typed status (no binary 0/1 guessing), typed storage reads (no slot-layout reverse engineering), and big numbers as decimal strings rather than hex (same precision-safety reasoning, different convention than Geth).

### Where It Differs from Soroban

Soroban exposed `ScVal`, an XDR-tagged universal value type, as the wire shape for nearly every read and write. The result was that wallets, explorers, and indexer front ends all needed a working XDR codec to make sense of basic responses. Familiar JSON gives way to "decode this XDR blob to find out what type it is, then decode again to read the value."

Groundhog avoids that by exposing typed JSON variants instead. A `nonnegativeInt` arrives as `{ "kind": "nonnegativeInt", "value": "1000000000" }`, not as an XDR-encoded `ScVal::U128(...)`. Clients still need an XDR codec to construct signed transactions and decode XDR-typed payload bytes inside specific fields, but the envelope is JSON-native end to end.

The framing in one line: **Horizon-shaped JSON envelope, EVM-shaped naming and conventions, typed where the protocol is genuinely typed.**

## Methods

Phase 1 methods. See [Future Phases](#future-phases) for what's planned next.

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

**Returns:** `TransactionReceipt` or `null` if not found. The receipt includes execution status, emitted events, and block height. See [The Shape of a Response](#the-shape-of-a-response) for the wire shape.

**Execution status values:**

| Status | Meaning |
|--------|---------|
| `{"result": "ok"}` | Transaction executed and committed |
| `{"result": "reverted", "message": "..."}` | Transaction executed but was reverted |
| `{"result": "deterministicError", "kind": "..."}` | Transaction failed deterministically (e.g., WASM trap) |
| `{"result": "nonDeterministicError"}` | Commit failed due to a race or proposal-time storage conflict |
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
| `Committed` | Transaction has been included in a block (includes `height`) |
| `Invalid` | Transaction was rejected |
| `RecentFailure` | A recent proposal attempt hit a two-phase-commit conflict; includes attempt height and a best-effort conflict diagnostic |
| `Unknown` | Transaction not found in mempool or committed history |
| `Other` | Status tag came from a newer server version |

The gateway checks the mempool (scheduler) first, then the indexer. `RecentFailure` is advisory: reports may be dropped, and a later retry of the same transaction may commit. If the scheduler is unavailable and the indexer has no record, the gateway returns `BACKEND_UNAVAILABLE` rather than incorrectly reporting `Unknown` while the transaction may still be pending.

---

### groundhog_chainTip

Get the current chain tip.

**Parameters:** None.

**Returns:** `ChainTip` with the current block height and block hash.

---

### groundhog_version

Return gateway implementation and JSON-RPC wire-format version information.

**Parameters:** None.

**Returns:** `VersionInfo`.

```json
{
  "wireFormat": "3.0.0",
  "implementation": "groundhog-rpc",
  "commitHash": "abc123"
}
```

`commitHash` may be `null` when the gateway cannot report a build commit.

---

### groundhog_view

Execute a read-only contract invocation against committed state. The invocation is sandboxed and does not enter the mempool.

| Parameter | Type | Description |
|-----------|------|-------------|
| `request` | `ViewRequest` | Contract address, entrypoint ID, calldata, and optional caller |

**Returns:** `ViewResponse` with root output, emitted events, and snapshot height.

`output.result` is one of `return`, `abort`, or `fault`. Successful returns carry `returnData`; aborts carry `abortData`.

:::caution[Backend Dependent]
Deployments without a configured view gateway return error code `-32052`.
:::

---

### groundhog_getBalance

Read the latest committed native HOG balance for an address.

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | `0x`-prefixed hex (64 chars) | Address whose native HOG balance to read |

**Returns:** `BalanceResponse`.

```json
{
  "address": "0x7171...7171",
  "rawBalance": "1000000000",
  "height": 4567
}
```

`rawBalance` is a decimal string in raw protocol units. `height` is the committed block height used for the read.

---

### groundhog_getStorageAt

Read the latest committed storage item at an address/key pair.

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | `0x`-prefixed hex (64 chars) | Contract address whose storage to read |
| `key` | `0x`-prefixed hex | Storage key bytes |

**Returns:** `StorageItemRead { blockHeight, item: StorageItemInfo | null }`. `blockHeight` is always the snapshot the read was performed against; `item` is `null` when no value exists at the key.

See [Reading State](#reading-state) for the full `StorageItemInfo` variant table.

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

### groundhog_getEvents

Query emitted contract events with cursor pagination and topic filters.

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `EventQuery` | Cursor, ordering, anchor, contract-address filters, and topic filters |

**Returns:** `EventPage` with matched events, pagination cursor, latest indexed block, and oldest retained block.

`EventQuery.filters` ORs across filters and ANDs within each filter. Contract address filters are required. Topic filters are positional: `topic0`, `topic1`, and `topic2`.

See [Add Events to a Contract](/tutorials/add-events-to-a-contract/#step-5-query-it-on-chain) for an end-to-end event query example.

---

### groundhog_getTransactionsByAddress

Query paginated transaction history whose root invocation targets one address.

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `AddressTransactionQuery` | Address, order, anchor, cursor, and page limit |

The initial request uses cursor `"0x"`. A limit of `0` selects the server default of 50; values above the server cap, normally 200, are rejected. A non-empty response cursor carries the iteration order and anchor for the next request.

**Returns:** `TransactionRefPage` containing transaction hash and block-height references, the next cursor, latest indexed block, and oldest retained block. Hydrate each reference with `groundhog_getTransactionReceipt`.

This is root-address history. Transactions that only invoke or touch the address below the root do not match.

## Error Codes

Standard JSON-RPC 2.0 error codes apply. The gateway also defines application-specific codes:

| Code | Name | Meaning |
|------|------|---------|
| `-32602` | Invalid params | Standard JSON-RPC: malformed parameters |
| `-32000` | TX_INVALID | Transaction XDR could not be decoded |
| `-32001` | TX_REJECTED | Scheduler rejected the transaction |
| `-32002` | TX_NOT_FOUND | Transaction not found in mempool or history |
| `-32010` | BLOCK_NOT_FOUND | No block at the requested height |
| `-32050` | BACKEND_UNAVAILABLE | Internal backend (indexer, scheduler, or view gateway) is not connected |
| `-32051` | BACKEND_TIMEOUT | Internal backend did not respond in time |
| `-32052` | NOT_IMPLEMENTED | Method exists but is not yet functional |
| `-32053` | OVERLOADED | Gateway or backend is overloaded; retry with backoff |

## Client Libraries

**TypeScript/JavaScript.** The `@groundhogchain/client`, `@groundhogchain/protocol`, and related packages provide TypeScript types, codecs, and helpers for building gateway calls. See [TypeScript SDK](/tools/typescript-sdk/) for details.

**Rust.** The `groundhog-json-rpc-client` crate provides a typed client generated from the same trait that defines the gateway. Import `groundhog_json_rpc_client` and its `GroundhogApiClient` trait.

## Future Phases

- WebSocket subscriptions (new blocks, pending transactions, contract events)
- Production hardening (rate limiting, caching, metrics)

## Related Documentation

- [Architecture](/how-it-works/architecture/): The big-picture design.
- [Networking](/how-it-works/networking/): Where the gateway fits in the node topology.
- [Storage Types Reference](/reference/storage-types/): Protocol-level kinds the JSON-RPC surfaces.
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/): How a submitted transaction moves through the network.
- [EVM & Solidity](/ecosystem/evm/): Coming from Solidity and `eth_*` RPC.
- [Stellar & Soroban](/ecosystem/stellar/): Coming from Soroban and `ScVal`.
