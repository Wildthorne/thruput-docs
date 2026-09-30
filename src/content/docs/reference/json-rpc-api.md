---
title: JSON-RPC API
description: Groundhog JSON-RPC methods, wire types, and error codes.
---

:::caution[Draft]
This API is under active development. Method signatures and response formats may change; breaking changes bump the major version of `groundhog_version.wireFormat`.
:::

:::note[Version checked]
This page describes `groundhog-rpc` `0.19.0` and JSON-RPC wire format `7.0.0`. Documentation-only corrections do not add methods or change payloads.
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

## JSON-RPC Arrays

| Property | Contract |
| --- | --- |
| Maximum entries | 1,000 per array on the supported embedded node and standalone gateway |
| Correlation | Match responses by request ID; response order is not execution order |
| Errors | Per-entry RPC errors remain independent; transport failures can affect the shared exchange |
| Guarantees | No shared snapshot, ordering, or atomicity between independent requests |
| Other limits | Request/response byte limits and concurrency settings are separate |
| Client defaults | Opt-in HTTP batching uses 100 entries and a 0ms scheduling window; see [client transport](/tools/typescript-sdk/#http-batching) |

## Wire Design

Groundhog returns JSON-native objects with typed fields. Transactions use classic XDR; contract arguments and return values use CXS. Clients use the corresponding codecs for those bytes. RPC responses themselves are JSON. See [XDR Protocol](/reference/xdr-protocol/) for the encoding boundary.

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

A successful response acknowledges scheduler admission, not commitment or execution. Authentication rejection returns `TX_REJECTED`; retryable admission pressure returns `OVERLOADED`. After a timeout, query the original hash before preparing a replacement.

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
  "returnData": "0x42",
  "gasUsed": 1234
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

| Field | Meaning |
| --- | --- |
| `gasUsed` | Consumed root/child execution gas plus pre-execution validation of attached contracts; a JSON integer, parsed as bigint by the TypeScript client |
| Gas billing | No token fee or unused-gas refund; declared root gas remains the scheduling quantity |

### `groundhog_getTransactionStatus`

Check committed history first, then the scheduler mempool when needed.

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

### `groundhog_chainConfig`

| Property | Contract |
| --- | --- |
| Parameters | None |
| Result | `NetworkConfigParams`, the execution parameters explicitly stated by the chain |
| Optional integer fields | `maxSha256Buffers`, `maxCrossInvokeDepth`, `maxNewContractsPerTx`, `maxBytestringLen`, `maxContractSizeBytes`, `maxSavepointDepth`, `maxAuthTokenDepth`, `maxRv32CodeBytes`, `maxRv32MemoryBytes` |
| Missing field | Unspecified by this config, not zero and not an SDK-selected default |
| Scope | Configured execution limits; not a general storage-cost estimator or a complete list of effective runtime defaults |

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
  "wireFormat": "7.0.0",
  "implementation": "0.19.0",
  "commitHash": "<commit>",
  "releaseVersion": null,
  "bundleManifestDigest": null
}
```

`releaseVersion` and `bundleManifestDigest` are present only when the serving binary matches an installed release bundle; `platformVersion` is an optional legacy build-time field. It is independent of the validated release identity and may be absent even when `releaseVersion` is present. `commitHash` may be `null`. Consumers may branch on `wireFormat`. `implementation`, `commitHash`, and the release fields are diagnostic.

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
  "configHash": "0x...",
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
The hosted gateway (`hog-gateway`) has no block query backend yet and returns `-32052` for this method.
:::

### `groundhog_pendingTransactionCount`

Get the number of transactions in the scheduler.

**Parameters:** None.

**Returns:** nonnegative integer.

:::caution[Gateway Only]
The hosted gateway (`hog-gateway`) returns `-32052` for this method. `groundhog node` serves it for the local chain.
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

## Pagination Contract

| Field or case | Rule for event and address-transaction pages |
| --- | --- |
| Initial cursor | Send `"0x"`; TypeScript actions use an empty `Uint8Array` or an omitted initial cursor |
| Non-empty cursor | Continue the same historical walk with the same network, target, and filters |
| `order` and `anchor` | Required raw request fields even when the cursor supplies continuation state |
| Returned `"0x"` | This walk is exhausted; it does not subscribe to future blocks |
| Empty rows, non-empty cursor | Continue; row count alone does not indicate exhaustion |
| `latestBlock` | Indexer's head at response time, not an application coverage checkpoint |
| `oldestBlock` | Retained-history lower bound; detect/report a gap if a checkpoint is older |
| Event identity | Transaction hash plus event sequence number, scoped to the network/query |
| Transaction-ref identity | Transaction hash; address history matches only root invocation targets |
| Later ascending scan | Start a new ascending walk with an empty cursor at the last stored row height from ascending ingestion; deduplicate that block |
| Descending refresh | Start a new descending walk with an empty cursor and `atEnd` anchor; the last (oldest) row is not a forward-ingestion checkpoint |
| Persistence | Save rows and progress together; never advance past a partially processed block |
| Invalid filters | Empty filter lists or empty contract-address lists return invalid params, not all-contract results |
| Cursor validity | Opaque backend format; current malformed-cursor handling can report false exhaustion, so explicit rejection is not guaranteed |

For the executable application pattern and retention limitations, see
[Resume Without Missing Events](/tutorials/add-events-to-a-contract/#resume-without-missing-events).

## Error Codes

Standard JSON-RPC 2.0 errors apply. The gateway also defines:

| Code | Name | Meaning |
| --- | --- | --- |
| `-32602` | Invalid params | Malformed or invalid parameters |
| `-32000` | TX_INVALID | Transaction bytes could not be decoded or validated; resource-limit failures include a typed `data.reason` |
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
