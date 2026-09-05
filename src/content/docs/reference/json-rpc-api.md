---
title: JSON-RPC API
description: Groundhog JSON-RPC methods, wire types, and error codes.
---

:::caution[Draft]
This API is under active development. Method signatures and response formats may change; breaking changes bump the major version of `groundhog_version.wireFormat`.
:::

:::note[Version checked]
This page was source-checked against `groundhog-rpc` `0.11.1` (client bundle `0.1.26`) and JSON-RPC wire format `5.0.0`.
:::

The Groundhog gateway exposes JSON-RPC 2.0 over HTTP. For its place in the node topology, see [Networking](/how-it-works/networking/).

## Request Format

```json
{
  "jsonrpc": "2.0",
  "method": "groundhog_chainTip",
  "params": [],
  "id": 1
}
```

Public response fields use camelCase. Addresses, hashes, calldata, event topics, and other byte fields use `0x`-prefixed lowercase hex. Large protocol quantities such as balances use decimal strings. Block heights and other bounded fields use JSON numbers.

## Wire Design

Groundhog returns JSON-native objects with typed fields. Clients need XDR codecs to construct transactions and decode contract payload bytes, not to interpret an entire RPC response.

Storage reads preserve the protocol value kind:

```json
{
  "blockHeight": 4567,
  "item": {
    "kind": "nonnegativeInt",
    "value": "1000000000"
  }
}
```

Clients switch on tags such as `item.kind` and `status.result`. This avoids reconstructing storage types from packed slots or decoding a universal XDR value for routine reads.

If you are coming from another ecosystem, see [EVM and Solidity](/ecosystem/evm/) or [Stellar and Soroban](/ecosystem/stellar/).

## Methods

### `groundhog_sendRawTransaction`

Submit a signed transaction to the scheduler.

| Parameter | Type | Description |
| --- | --- | --- |
| `tx_hex` | string | `0x`-prefixed XDR encoding of `SignedTransaction` |

**Returns:** `TxHash`, the `0x`-prefixed hash of the inner transaction.

Transactions whose `blockExpiryHeight` is at or below the current chain tip are rejected when the tip is available.

### `groundhog_getTransactionReceipt`

Get a committed transaction's execution result and events.

| Parameter | Type | Description |
| --- | --- | --- |
| `tx_hash` | `TxHash` | `0x`-prefixed transaction hash |

**Returns:** `TransactionReceipt` or `null` if no committed receipt exists.

```json
{
  "txHash": "0x<64 lowercase hex characters>",
  "height": 12345,
  "status": { "result": "ok" },
  "events": [],
  "returnData": "0x42"
}
```

`returnData` is optional and appears for successful transactions when recorded by the executing chain version. `abortData` is optional and may appear for reverted transactions.

**Execution status values:**

| Status | Meaning |
| --- | --- |
| `{"result":"ok"}` | Root execution succeeded |
| `{"result":"reverted","message":"..."}` | The root call reverted; `message` may be `null` |
| `{"result":"deterministicError","kind":"fault"}` | The execution engine reported a deterministic fault |
| `{"result":"nonDeterministicError"}` | Proposal-time storage conflict or race |
| `{"result":"failedGasSponsorship"}` | Gas sponsorship failed |
| `{"result":"other"}` | Unrecognized result from the backend |

A receipt proves that the transaction committed. Only `status.result: "ok"` proves successful execution.

### `groundhog_getTransactionStatus`

Check the scheduler first, then committed history, for a transaction.

| Parameter | Type | Description |
| --- | --- | --- |
| `tx_hash` | `TxHash` | `0x`-prefixed transaction hash |

**Returns:** `TransactionStatus`.

| `status` | Meaning |
| --- | --- |
| `pending` | In the scheduler, not committed |
| `committed` | Included in a block; includes `height` |
| `invalid` | Rejected; includes `reason` |
| `recentFailure` | Recent two-phase-commit conflict; includes `attemptHeight` and `conflict` |
| `unknown` | Absent from both scheduler and committed history |
| `other` | Status from a newer server version |

`recentFailure` is advisory. A later retry of the same transaction may commit. If the scheduler is unavailable and committed history has no record, the gateway returns `BACKEND_UNAVAILABLE` instead of `unknown`.

### `groundhog_chainTip`

Get the current committed chain tip.

**Parameters:** None.

**Returns:** `{ "height": number, "blockHash": "0x..." }`.

### `groundhog_networkInfo`

Get the network identity used for transaction signing.

**Parameters:** None.

**Returns:**

```json
{
  "networkHash": "0x<64 lowercase hex characters>"
}
```

Clients should compare `networkHash` with the expected network before signing. The hash is part of every transaction signature preimage. See [Authorization](/how-it-works/authorization/).

### `groundhog_requestAirdrop`

Request an idempotent native HOG airdrop.

| Parameter | Type | Description |
| --- | --- | --- |
| `request.recipient` | address | Recipient address as `0x`-prefixed 32-byte hex |
| `request.clientNonce` | string | Caller-selected idempotency nonce as `0x`-prefixed 1-to-32-byte hex |

The same recipient and `clientNonce` identify the same logical attempt on a network. Poll a pending attempt by repeating the exact request. Do not generate a new nonce for that attempt.

**Pending response:**

```json
{
  "attemptStatus": "pending",
  "recipient": "0x<64 lowercase hex characters>",
  "rawAmount": "100000000",
  "txHash": "0x<64 lowercase hex characters>",
  "retryAfterSeconds": 5
}
```

`txHash` is optional while pending.

**Succeeded response:**

```json
{
  "attemptStatus": "succeeded",
  "recipient": "0x<64 lowercase hex characters>",
  "txHash": "0x<64 lowercase hex characters>",
  "rawAmount": "100000000",
  "height": 12345,
  "status": { "result": "ok" }
}
```

`succeeded` means the transaction committed. Inspect `status.result` to confirm execution success. A client timeout does not prove that the airdrop failed. Retry the same request to recover the attempt's state.

### `groundhog_version`

Get wire, implementation, build, and packaging-platform versions.

**Parameters:** None.

**Returns:**

```json
{
  "wireFormat": "5.0.0",
  "implementation": "0.11.1",
  "commitHash": "<commit>",
  "releaseVersion": "0.1.26",
  "bundleManifestDigest": "<sha256>",
  "platformVersion": "0.1.26"
}
```

`releaseVersion` and `bundleManifestDigest` are present only when the serving binary matches an installed release bundle; `platformVersion` is the legacy alias of `releaseVersion` and is omitted when unavailable. `commitHash` may be `null`. Consumers may branch on `wireFormat`. `implementation`, `commitHash`, and the release fields are diagnostic.

### `groundhog_view`

Execute a read-only contract invocation against committed state. The invocation does not enter the scheduler.

| Parameter | Type | Description |
| --- | --- | --- |
| `request` | `ViewRequest` | Contract address, entrypoint ID, calldata, and optional caller |

**Returns:** `ViewResponse` with root output, events, and snapshot height. `output.result` is `return`, `abort`, or `fault`. Returns `-32052` when the deployment has no view backend.

### `groundhog_getBalance`

Read the latest committed native HOG balance.

| Parameter | Type | Description |
| --- | --- | --- |
| `address` | address | `0x`-prefixed 32-byte address |

**Returns:**

```json
{
  "address": "0x<64 lowercase hex characters>",
  "rawBalance": "1000000000",
  "height": 4567
}
```

`rawBalance` is a decimal string in indivisible protocol units.

### `groundhog_getStorageAt`

Read the latest committed storage item at an address and key.

| Parameter | Type | Description |
| --- | --- | --- |
| `address` | address | `0x`-prefixed 32-byte contract address |
| `key` | bytes | `0x`-prefixed 32-byte storage key |

**Returns:** `StorageItemRead { blockHeight, item }`. `item` is `null` when the key has no value. `blockHeight` identifies the snapshot used for either result.

`item.kind` is one of `nonnegativeInt`, `bytestring`, `deployedContract`, `authData`, `retrocausalQueue`, `replayCacheEntry`, or `unknown`. Large integer values use decimal strings. `unknown` includes `typeId` for a storage kind added after the client's wire version.

### `groundhog_getBlockByNumber`

Get block information by height.

| Parameter | Type | Description |
| --- | --- | --- |
| `height` | integer | Block height |

**Returns:** `BlockInfo` or `null`.

```json
{
  "blockHash": "0x...",
  "protocol": 1,
  "networkHash": "0x...",
  "proposer": "0x...",
  "blockTimepoint": 123,
  "blockHeight": 42,
  "txsHash": "0x...",
  "storageHash": "0x...",
  "eventsHash": "0x...",
  "prevBlockHash": "0x...",
  "proposalTxsHash": "0x...",
  "upgrades": ["0x..."]
}
```

:::caution[Not Yet Implemented]
The current gateway returns `-32052` for this method.
:::

### `groundhog_pendingTransactionCount`

Get the number of transactions in the scheduler.

**Parameters:** None.

**Returns:** nonnegative integer.

:::caution[Not Yet Implemented]
The current gateway returns `-32052` for this method.
:::

### `groundhog_getEvents`

Query contract events with cursor pagination and topic filters.

| Parameter | Type | Description |
| --- | --- | --- |
| `query` | `EventQuery` | Order, anchor, cursor, limit, contract addresses, and positional topic filters |

**Returns:** `EventPage` with events, the next cursor, latest indexed block, and oldest retained block.

`query.filters` uses OR across filters and AND within each filter. Contract-address filters are required. Topic filters are positional: `topic0`, `topic1`, and `topic2`. See [Add Events to a Contract](/tutorials/add-events-to-a-contract/#step-5-query-it-on-chain) for an example.

### `groundhog_getTransactionsByAddress`

Query transactions whose root invocation targets an address.

| Parameter | Type | Description |
| --- | --- | --- |
| `query` | `AddressTransactionQuery` | Address, order, anchor, cursor, and limit |

**Returns:** `TransactionRefPage` with transaction hashes and heights, the next cursor, latest indexed block, and oldest retained block. Hydrate a reference with `groundhog_getTransactionReceipt`.

The initial cursor is `"0x"`. A limit of `0` selects the server default of 50. Values above the configured cap, normally 200, are rejected. Nested calls to the address do not match.

## Error Codes

Standard JSON-RPC 2.0 errors apply. The gateway also defines:

| Code | Name | Meaning |
| --- | --- | --- |
| `-32602` | Invalid params | Malformed or invalid parameters |
| `-32000` | TX_INVALID | Transaction bytes could not be decoded or validated |
| `-32001` | TX_REJECTED | Scheduler or airdrop backend rejected the transaction |
| `-32002` | TX_NOT_FOUND | Transaction not found |
| `-32010` | BLOCK_NOT_FOUND | Block not found at the requested height |
| `-32050` | BACKEND_UNAVAILABLE | Required backend is unavailable |
| `-32051` | BACKEND_TIMEOUT | Backend did not respond before the deadline |
| `-32052` | NOT_IMPLEMENTED | Method is not implemented by the backend |
| `-32053` | OVERLOADED | Gateway or backend is overloaded; retry with backoff |

## Client Libraries

The `@groundhogchain/client` packages provide TypeScript transports, codecs, and higher-level actions. See [TypeScript SDK](/tools/typescript-sdk/).

Rust clients can use `groundhog-json-rpc-client` and its `GroundhogApiClient` trait.

## Related Documentation

- [Networking](/how-it-works/networking/)
- [Authorization](/how-it-works/authorization/)
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/)
- [Storage Types](/reference/storage-types/)
