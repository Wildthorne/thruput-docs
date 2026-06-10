---
title: JSON-RPC API
description: JSON-RPC 2.0 method reference for the groundhog-rpc gateway.
---

:::caution[Draft]
Wire-format version `1.2.1`. Methods, parameter shapes, and return types are stable across patch releases of the same wire-format major. New variants may be added to non-exhaustive enums without a major bump; clients must accept unknown variants.
:::

The Groundhog JSON-RPC gateway (`groundhog-rpc`) speaks JSON-RPC 2.0 over HTTP. All methods are namespaced under `groundhog_*`; local-node-only methods live under `groundhog_dev_*`.

Source of truth: the `GroundhogApi` trait in `crates/rpc-api/src/lib.rs`. Request and response types live in `crates/api-types/src/`.

For architecture context see [Networking](/how-it-works/networking/). For client-side error handling patterns see [Error Handling](/reference/error-handling/).

## Wire format conventions

| Element | Format |
|---------|--------|
| Hashes (`tx_hash`, block hash, etc.) | `0x`-prefixed lowercase hex, 64 chars (32 bytes) |
| Contract addresses | `0x`-prefixed lowercase hex, 64 chars (32 bytes) |
| Event topics | `0x`-prefixed lowercase hex, 64 chars (32 bytes, exactly) |
| Variable-length bytes | `0x`-prefixed lowercase hex, even length |
| Block heights, counts | JSON integer |
| `NonnegativeInt` storage values | Decimal-encoded JSON string (exceeds JSON number precision) |
| Field naming | `camelCase` on the wire; Rust types use `snake_case` |
| Parameter naming | `snake_case` (by-name params), e.g. `tx_hex`, `tx_hash` |

All methods take a single by-name parameter object unless documented as parameterless. The examples below use named params.

## Transaction submission

### groundhog_sendRawTransaction

Submit a signed transaction to the mempool.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tx_hex` | string | `0x`-prefixed hex-encoded XDR of a signed transaction |

**Returns** — `TxHash`: 32-byte hash serialized as a `0x`-prefixed hex string. Equals `sha256(xdr_serialize(signed_tx.tx))`, covering the inner transaction body, not signatures.

**Example request**

```json
{
  "jsonrpc": "2.0",
  "method": "groundhog_sendRawTransaction",
  "params": { "tx_hex": "0x0000000100000020..." },
  "id": 1
}
```

**Example response**

```json
{
  "jsonrpc": "2.0",
  "result": "0xabc123...def",
  "id": 1
}
```

## Transaction queries

### groundhog_getTransactionReceipt

Full receipt for a committed transaction. Returns `null` until the transaction is committed.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tx_hash` | string | Canonical transaction hash (`0x`-prefixed, 64 hex chars) |

**Returns** — `Option<TransactionReceipt>`:

| Field | Type | Notes |
|-------|------|-------|
| `txHash` | `TxHash` | Canonical hash of the executed transaction |
| `height` | integer | Block height at which the transaction was committed |
| `status` | `ExecStatus` | Discriminated union, see below |
| `events` | array of `EmittedEvent` | Events emitted during execution |
| `returnData` | hex string (optional) | Bytes returned by the root call when `status.result == "ok"` and the chain version recorded a return value |
| `abortData` | hex string (optional) | Bytes passed to `abort`/`revert` when `status.result == "reverted"` and the chain version recorded the payload |

There is no `blockHash`, `gasUsed`, `gasPrice`, `transactionIndex`, or `logsBloom`. SCP gives instant finality, so height alone identifies the block.

Source: `crates/api-types/src/receipt.rs:20-52`.

**`ExecStatus` variants** — tagged union with discriminator `result`:

| `result` | Extra fields | Meaning |
|----------|--------------|---------|
| `ok` | — | Transaction executed successfully |
| `reverted` | `message` (optional string) | Root call called `abort`/`revert` |
| `deterministicError` | `kind` (string) | Engine-deterministic failure (out of gas, stack overflow, etc.) |
| `failedGasSponsorship` | — | Gas sponsorship check failed |
| `nonDeterministicError` | — | Proposal-time storage conflict or other race |
| `other` | — | Unrecognized `ExecResult` from the indexer; check for gateway update |

`ExecStatus` is `#[non_exhaustive]`. Clients must handle unknown variants gracefully.

**Example response**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "txHash": "0xabc123...",
    "height": 42,
    "status": { "result": "ok" },
    "events": [
      {
        "contractAddress": "0x1111...",
        "topics": ["0xdead...beef"],
        "data": "0xcafebabe"
      }
    ],
    "returnData": "0x01"
  },
  "id": 2
}
```

### groundhog_getTransactionStatus

Lightweight status check that consults the mempool, then the indexer.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `tx_hash` | string | Canonical transaction hash |

**Returns** — `TransactionStatus`, tagged union with discriminator `status`:

| `status` | Extra fields | Meaning |
|----------|--------------|---------|
| `pending` | — | In the mempool, not yet committed |
| `committed` | `height` (integer) | Included in a committed block; no `blockHash`, height alone identifies |
| `invalid` | `reason` (string) | Scheduler rejected the transaction |
| `unknown` | — | Not found in mempool or indexer |

Source: `crates/api-types/src/transaction.rs:22-38`.

**Example response**

```json
{
  "jsonrpc": "2.0",
  "result": { "status": "committed", "height": 42 },
  "id": 3
}
```

## Block queries

### groundhog_chainTip

Current chain tip.

**Parameters** — none.

**Returns** — `ChainTip`:

| Field | Type | Notes |
|-------|------|-------|
| `height` | integer | Latest committed block height |
| `blockHash` | hex string | SHA-256 hash of the tip block |

### groundhog_getBlockByNumber

Block header data at a given height. Returns `null` when the height is beyond the indexed tip or otherwise unavailable.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `height` | integer | Block height to fetch |

**Returns** — `Option<BlockInfo>`:

| Field | Type | Notes |
|-------|------|-------|
| `networkId` | integer (u64) | Network identifier |
| `blockHeight` | integer | Block height |
| `txsetHash` | hex string | Hash over the committed transaction set |
| `dbHash` | hex string | Database state hash at this block |
| `eventsHash` | hex string | Hash over emitted events |
| `prevBlockHash` | hex string | Predecessor block hash |

### groundhog_pendingTransactionCount

Number of transactions currently in the mempool.

**Parameters** — none.

**Returns** — integer (u64).

## Event queries

### groundhog_getEvents

Paginated, filterable event stream. Cursor-driven; the server-authored `cursor` carries `order` and `anchor` once pagination has started.

**Parameters** — single `query` object of shape `EventQuery`:

| Field | Type | Notes |
|-------|------|-------|
| `filters` | array of `EventFilter` (max 16) | OR across filters, AND within each filter |
| `order` | string enum: `ascending` \| `descending` | Walk direction |
| `anchor` | `BlockAnchor` | `{ "kind": "atBeginning" }`, `{ "kind": "atEnd" }`, or `{ "kind": "atHeight", "height": <int> }` |
| `cursor` | hex string | `"0x"` on initial call; pass back the prior response's `cursor` to continue |
| `limit` | integer | Clamped to `[1, 200]`; `0` means server default (50) |

**`EventFilter`**

| Field | Type | Notes |
|-------|------|-------|
| `contractAddresses` | array of contract address (max 16; must be non-empty) | Required: the indexer has no topic-only scan |
| `topics` | `EventTopicFilter` | Positional topic predicate |

**`EventTopicFilter`** — for each position (`topic0`, `topic1`, `topic2`), supply an array of up to 16 topic values. Empty = "match anything at this position". Non-empty = "topic at this position must be in the list". Filters with fewer specified positions partial-match events with more topics (Ethereum `getLogs` / stellar-rpc post-#358 semantics).

**Returns** — `EventPage`:

| Field | Type | Notes |
|-------|------|-------|
| `events` | array of `IdentifiedEvent` | May be empty even when `cursor` is non-empty: keep paginating |
| `cursor` | hex string | `"0x"` when the stream is exhausted in the requested direction |
| `latestBlock` | integer | Highest block height the indexer has processed |
| `oldestBlock` | integer | Oldest block height the indexer still retains (currently always 0) |

**`IdentifiedEvent`**

| Field | Type | Notes |
|-------|------|-------|
| `txHash` | hex string | Transaction that emitted the event |
| `blockHeight` | integer | Height at which the event was emitted |
| `sequenceNumber` | integer | Position within the transaction's event log |
| `event` | `EmittedEvent` | `{ contractAddress, topics, data }` |

**`EmittedEvent`** — up to 3 topics (each exactly 32 bytes) plus opaque `data`; topics and data together are capped at 1 KB. The gateway parses hogd's wire-format `serialized_event` into the split form on the way out.

Source: `crates/api-types/src/events.rs:186-275`.

**Example request**

```json
{
  "jsonrpc": "2.0",
  "method": "groundhog_getEvents",
  "params": {
    "query": {
      "filters": [
        {
          "contractAddresses": ["0x1111..."],
          "topics": {
            "topic0": ["0xdead...beef"],
            "topic1": [],
            "topic2": []
          }
        }
      ],
      "order": "descending",
      "anchor": { "kind": "atEnd" },
      "cursor": "0x",
      "limit": 50
    }
  },
  "id": 4
}
```

## State queries

### groundhog_getStorageAt

Read the latest committed storage item at a contract address + key. `blockHeight` in the response always reflects the snapshot the read ran against, even when no item exists at the key, so wallets can compare against `chainTip` to gauge freshness.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `address` | hex string (32 bytes) | Contract address |
| `key` | hex string (32 bytes) | Storage key |

**Returns** — `StorageItemRead`:

| Field | Type | Notes |
|-------|------|-------|
| `blockHeight` | integer | Snapshot height the read was performed against |
| `item` | `StorageItemInfo` \| `null` | `null` when the key has no committed value at this snapshot |

**`StorageItemInfo`** — tagged union with discriminator `kind`:

| `kind` | Extra fields | Meaning |
|--------|--------------|---------|
| `nonnegativeInt` | `value` (decimal string) | Non-negative `int128`, e.g. HOG balance; string-encoded because i128 exceeds JSON number precision |
| `bytestring` | `bytes` (hex string) | Raw byte array |
| `authData` | — | Authorization data registered at this address (presence indicator) |
| `retrocausalQueue` | — | RCQ registered at this address (presence indicator; invoke a contract to read contents) |
| `replayCacheEntry` | — | Replay-cache entry exists; presence is the signal |
| `deployedContract` | `hash` (hex), `size` (integer), `contractType` (integer) | Deployed-contract metadata |
| `unknown` | `typeId` (integer) | Protocol shipped a variant this build was not regenerated against |

Source: `crates/api-types/src/state.rs:17-80`.

### groundhog_view

Execute a sandboxed contract simulation against the latest committed state. No transaction is submitted; no state is mutated.

**Parameters** — single `request` object of shape `ViewRequest`:

| Field | Type | Notes |
|-------|------|-------|
| `contract` | hex string | Contract address to execute |
| `entrypoint` | hex string | Entrypoint id; exactly 8 bytes |
| `calldata` | hex string | Opaque call input bytes |
| `caller` | hex string (optional) | Simulated `get_msg_sender` value |

**Returns** — `ViewResponse`:

| Field | Type | Notes |
|-------|------|-------|
| `output` | `RootInvocationOutput` | See below |
| `events` | array of `EmittedEvent` | Events the simulated frame emitted |
| `height` | integer | Committed snapshot height the view ran against |

**`RootInvocationOutput`** — tagged union with discriminator `result`:

| `result` | Extra fields | Meaning |
|----------|--------------|---------|
| `return` | `returnData` (hex string) | Contract returned normally |
| `abort` | `abortData` (hex string) | Contract aborted/reverted deterministically |
| `fault` | — | Execution faulted before producing a return or abort payload |

Source: `crates/api-types/src/view.rs:11-60`.

## System

### groundhog_version

Version dimensions for this JSON-RPC server.

**Parameters** — none.

**Returns** — `VersionInfo`:

| Field | Type | Notes |
|-------|------|-------|
| `wireFormat` | string | SemVer of the OpenRPC wire format implemented (e.g. `"1.2.1"`). Branch on this. |
| `implementation` | string | Diagnostic-only binary version. Do not branch on this. |
| `commitHash` | string \| null | Diagnostic-only build commit, when available. Do not branch on this. |

## Dev-only methods

Implemented only by the local node (`groundhog node` / `--dev-node`). Production gateways return `-32052 NotImplemented`.

### groundhog_dev_getAccounts

List pre-funded dev accounts with addresses and well-known keys.

**Parameters** — none.

**Returns** — array of `DevAccount`:

| Field | Type | Notes |
|-------|------|-------|
| `address` | hex string | Dev account/wallet contract address |
| `publicKey` | hex string | Ed25519 public key bytes |
| `privateKey` | hex string | Ed25519 secret key bytes (dev-only; well-known) |
| `initialStorageTokens` | integer (u64) | Storage-token balance snapshot taken at local-node start. Not refreshed; use a live balance read for current funding. |

Source: `crates/api-types/src/dev.rs:21-33`.

## Error codes

Standard JSON-RPC 2.0 codes apply. Groundhog-specific codes follow Substrate's per-module pattern.

| Code | Name | Meaning |
|------|------|---------|
| `-32602` | `InvalidParams` | One or more parameters are malformed, out of range, or otherwise invalid |
| `-32000` | `TxInvalid` | Submitted transaction is malformed, has invalid XDR, or fails local validation before backend submission |
| `-32001` | `TxRejected` | Well-formed transaction was rejected by the scheduler or execution backend |
| `-32002` | `TxNotFound` | Requested transaction hash was not found in mempool or committed index |
| `-32010` | `BlockNotFound` | Requested block height is out of range or beyond the current indexed tip |
| `-32050` | `BackendUnavailable` | Gateway could not reach a required backend (hogd, scheduler, indexer) |
| `-32051` | `BackendTimeout` | Request timed out waiting for a backend response; outcome may be ambiguous |
| `-32052` | `NotImplemented` | Method exists but is not implemented by this gateway/backend |
| `-32053` | `Overloaded` | Gateway or backend rejected the request before it reached side-effecting backend execution; safe to retry with backoff |

Codes `-32020` through `-32029` are reserved for subscription errors in a future phase.

Source: `crates/api-types/src/error.rs:8-52`.

## Rust client

The `groundhog-rpc-client` crate provides a typed, async JSON-RPC client generated from the same trait that defines the server.

```rust
use groundhog_rpc_client::{GroundhogApiClient, HttpClientBuilder};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = HttpClientBuilder::default().build("http://localhost:8545")?;

    let tip = client.chain_tip().await?;
    println!("tip height: {}", *tip.height);

    let tx_hash = client
        .send_raw_transaction("0x0000000100000020...".to_string())
        .await?;
    println!("submitted: {tx_hash:?}");

    Ok(())
}
```

Local-node deployments additionally expose `GroundhogDevApiClient`:

```rust
use groundhog_rpc_client::{GroundhogDevApiClient, HttpClientBuilder};

let client = HttpClientBuilder::default().build("http://localhost:8545")?;
let accounts = client.get_accounts().await?;
```

The client re-exports the request and response types under `groundhog_rpc_client::types` (alias for `groundhog-rpc-api-types`).
