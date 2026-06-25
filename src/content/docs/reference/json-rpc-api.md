---
title: JSON-RPC API
description: How Groundhog's JSON-RPC is shaped and the methods it exposes.
---

:::caution[Draft]
This API is under active development. Method signatures and response formats may change.
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

The API presents a typed JSON envelope. Responses are objects with named, JSON-native fields. Wallets, explorers, and dapps interpret them directly. Clients only reach for an XDR codec when they need to inspect or construct the bytes inside a specific field — never to decode a whole response.

### Typed JSON, Not XDR Blobs

Three points on the design space:

| Style | Example | What clients need |
|---|---|---|
| **Raw bytes everywhere** | EVM `eth_getStorageAt` returns one `bytes32` per slot | A storage-layout library to know what each slot means |
| **XDR-typed everywhere** | Soroban `ScVal` wraps every value in a tagged XDR enum | An XDR codec for nearly every read |
| **Typed JSON envelope** | Groundhog `getStorageAt` returns `{ kind: "nonnegativeInt", value: "1000000000" }` | Nothing for the common cases; an XDR codec only for byte-typed fields |

The third style — Horizon-shaped envelope, Groundhog-typed values — is what every method on the public `groundhog_*` namespace uses. It works because Groundhog's storage model is genuinely typed at the protocol level: nonnegative integers, bytestrings, auth data, and retrocausal queues are distinct kinds, not packed words. Returning that type information directly is cheaper for clients than reconstructing it from raw bytes.

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

Two things to notice. First, the response always carries `blockHeight` — even when the key is empty (`item: null`) — so clients can compare against `chainTip` to gauge freshness. Second, `item` is a tagged union. Clients switch on `kind` and read the variant's named fields directly:

```json
{ "kind": "nonnegativeInt", "value": "1000000000" }
{ "kind": "bytestring",     "bytes": "0xdeadbeef" }
{ "kind": "deployedContract", "hash": "0x...", "size": 12345, "contractType": 0 }
{ "kind": "authData" }
{ "kind": "retrocausalQueue" }
{ "kind": "replayCacheEntry" }
{ "kind": "unknown", "typeId": 99 }
```

`authData`, `retrocausalQueue`, and `replayCacheEntry` are presence-only. Their on-chain shapes are richer than a single value can express — auth data is a structured policy record, retrocausal queues are multi-entry containers — so the API reports presence and points clients toward a contract invocation when they need the contents. Same principle as Horizon: headline stats from the read API; deep detail from a typed operation.

`unknown` is a forward-compatibility variant. If a future protocol release adds a new storage kind, clients built against an older spec see `{ "kind": "unknown", "typeId": 99 }` rather than a parse failure.

#### Wallet Balance, End to End

The HogToken precompile stores HOG balances under per-address storage keys. To read a wallet's balance, a client calls `groundhog_getStorageAt(hogTokenAddress, walletBalanceKey)` and pattern-matches on the response:

```js
const { item } = await rpc.getStorageAt(HOG_TOKEN_ADDRESS, balanceKey(wallet));
if (item?.kind === "nonnegativeInt") {
  return BigInt(item.value);
}
return 0n;  // key absent or different kind
```

No XDR codec, no storage-layout library, no `keccak256(abi.encode(...))` slot derivation in the client. The wallet derives its own balance key, asks the chain, and reads a decimal string.

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

Soroban exposed `ScVal` — an XDR-tagged universal value type — as the wire shape for nearly every read and write. The result was that wallets, explorers, and indexer-front-ends all needed a working XDR codec to make sense of basic responses. Familiar JSON gives way to "decode this XDR blob to find out what type it is, then decode again to read the value."

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

### groundhog_getStorageAt

Read the latest committed storage item at an address/key pair.

| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | `0x`-prefixed hex (64 chars) | Contract address whose storage to read |
| `key` | `0x`-prefixed hex | Storage key bytes |

**Returns:** `StorageItemRead { blockHeight, item: StorageItemInfo | null }`. `blockHeight` is always the snapshot the read was performed against; `item` is `null` when no value exists at the key.

See [Reading State](#reading-state) for the full `StorageItemInfo` variant table and the wallet-balance walkthrough.

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

## Related Documentation

- [Architecture](/how-it-works/architecture/): The big-picture design.
- [Networking](/how-it-works/networking/): Where the gateway fits in the node topology.
- [Storage Types Reference](/reference/storage-types/): Protocol-level kinds the JSON-RPC surfaces.
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/): How a submitted transaction moves through the network.
- [EVM Migration](/migration/evm-migration/): Coming from Solidity and `eth_*` RPC.
- [Stellar Migration](/migration/stellar-migration/): Coming from Soroban and `ScVal`.
