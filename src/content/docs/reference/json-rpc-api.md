---
title: JSON-RPC API
description: Stellar Thruput JSON-RPC methods, wire types, and error codes.
---

| API property | Value |
| --- | --- |
| Wire format | `11.1.0` |
| Compatibility | Breaking wire changes increase the major version of `groundhog_version.wireFormat` |
| Schema | [Generated OpenRPC specification](https://github.com/groundhogchain/groundhog-rpc/blob/main/crates/json-rpc/open-rpc-spec/snapshots/groundhog-spec.json) for method signatures and field types |

The Stellar Thruput gateway exposes JSON-RPC 2.0 over HTTP. For its place in the node topology, see [Networking](/how-it-works/networking/).

## Request Format

```json
{
  "jsonrpc": "2.0",
  "method": "groundhog_chainTip",
  "params": [],
  "id": 1
}
```

Public response fields use camelCase. Addresses, hashes, calldata, event topics, and other byte fields use `0x`-prefixed lowercase hex.

| Integer field | JSON representation | TypeScript client representation |
| --- | --- | --- |
| 64-bit and wider integers, including heights, nanosecond timestamps, gas, counts, and balances | Canonical decimal string, including `"0"` and `"42"` | `bigint` |
| Smaller bounded integers, including protocol versions, page limits, and event sequence numbers | JSON number | Protocol-specific type or `number` |

The wide-integer rule applies to requests, responses, and structured error data. Numeric JSON is rejected for wide fields, even for small values. Strings must fit the field's signed or unsigned range and must not contain leading zeros, a leading `+`, negative zero, whitespace, fractions, or exponent notation. CLI JSON reports follow the same precision policy. Binary XDR and CXS encodings are unchanged.

## JSON-RPC Arrays

| Property | Contract |
| --- | --- |
| Maximum entries | 1,000 per array on the supported embedded node and standalone gateway |
| Correlation | Match responses by request ID; response order is not execution order |
| Errors | Per-entry RPC errors remain independent; transport failures can affect the shared exchange |
| Guarantees | No shared snapshot, ordering, or atomicity between independent requests |
| Other limits | Request/response byte limits and concurrency settings are separate |
| Client defaults | Opt-in HTTP batching uses 100 entries and a 0ms scheduling window; see [client transport](/typescript/transport/#http-batching) |

## Wire Design

Stellar Thruput returns JSON-native objects with typed fields. Transactions use classic XDR; contract arguments and return values use CXS. Clients use the corresponding codecs for those bytes. RPC responses themselves are JSON. See [XDR Protocol](/reference/xdr-protocol/) for the encoding boundary.

Storage reads preserve the protocol value kind:

```json
{
  "blockHeight": "4567",
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
  "height": "12345",
  "status": { "result": "ok" },
  "events": [],
  "returnData": "0x42",
  "gasUsed": "1500"
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
| `gasUsed` | Consumed root/child execution gas plus pre-execution validation of attached contracts; an unsigned 64-bit decimal string, parsed as `bigint` by the TypeScript client |
| Gas billing | No token fee or unused-gas refund; declared root gas remains the scheduling quantity |

### `groundhog_getTransactionStatus`

Check committed history first, then the scheduler's retained outcomes when needed.

| Parameter | Type | Description |
| --- | --- | --- |
| `tx_hash` | `TxHash` | `0x`-prefixed transaction hash |

**Returns:** `TransactionStatus`.

| `status` | Meaning |
| --- | --- |
| `pending` | In the scheduler, not committed |
| `committed` | Included in a block; scheduler commitment can omit `height`; indexed commitment includes the actual height as a decimal string, including `"0"` |
| `invalid` | Rejected; includes `reason` |
| `recentFailure` | Recent two-phase-commit conflict; includes `attemptHeight` and `conflict` |
| `retry` | Scheduler processing failed; includes `error`; resubmitting the same signed transaction may succeed |
| `dropped` | Scheduler processing failed permanently; includes `error`; modify the transaction before resubmitting |
| `unknown` | Absent from both scheduler and committed history |
| `other` | Status from a newer server version |

`recentFailure` is advisory. A later retry of the same transaction may commit. If the scheduler is unavailable and committed history has no record, the gateway returns `BACKEND_UNAVAILABLE` instead of `unknown`.

| Scheduler error field | Contract |
| --- | --- |
| `error.source` | `auth`, `scheduler`, `executor`, or `other` |
| `error.code` | Signed 32-bit JSON number from `AuthErrorCode`, `SchedulerErrorCode`, or `ExecResult` for the indicated source |
| Usage | [Handle scheduler processing errors](/typescript/transaction-status/#handle-scheduler-processing-errors) |

### `groundhog_chainTip`

Get the current committed chain tip.

**Parameters:** None.

**Returns:** `{ "height": "42", "blockHash": "0x..." }`. Height is a signed 64-bit decimal string.

### `groundhog_chainConfig`

| Property | Contract |
| --- | --- |
| Parameters | None |
| Result | `ChainConfig`: explicitly stated execution parameters, plus optional authoritative `execution` context |
| Optional integer fields | `maxSha256Buffers`, `maxCrossInvokeDepth`, `maxNewContractsPerTx`, `maxBytestringLen`, `maxContractSizeBytes`, `maxSavepointDepth`, `maxAuthTokenDepth`, `maxRv32CodeBytes`, `maxRv32MemoryBytes` |
| Integer encoding | These bounds are `u32` JSON numbers |
| Missing field | Unspecified by this config, not zero and not an SDK-selected default |
| `execution.observedTip` | Committed `height` and `blockHash` read together with the rules |
| `execution.configHash` | Configuration and storage-model commitment for that reading |
| `execution.effectiveLimits` | Runtime-resolved limits; omitted fields are unavailable, not zero |
| `execution.storageCosts` | `baseDataItemCost`, `bytestringCostPerByte`, `baseContractDeploymentCost`, `contractDeploymentCostPerByte`, `authPerKeyCost`, `rcqCostPerEntry`, `replayCacheCostPerEntry`, and `balanceCost`, in native-token base units as decimal strings |
| Reading freshness | `execution` is fetched during the request without stale-cache fallback; later transaction inclusion may use newer rules |
| Missing `execution` | Backend cannot supply authoritative rules; do not infer zero prices from its absence |
| Usage | [Estimate deployment funding](/cli/deploy-and-call/#estimate-deployment-funding) |

### `groundhog_serverLimits`

| Property | Contract |
| --- | --- |
| Parameters | None |
| Result | Endpoint request limits, returned without contacting a backend |
| Scope | Operator settings; values can differ between endpoints on the same chain |
| `maxViewGas` | Maximum `view` gas limit and default when `gasLimit` is omitted; `u64` decimal string |
| `maxViewCalldataBytes` | Maximum view calldata size in bytes; `u64` decimal string |
| `maxEventsPerPage` | Maximum event-query `limit`; `u32` JSON number |
| `maxTransactionsPerPage` | Maximum address-transaction-query `limit`; `u32` JSON number |
| `maxCursorBytes` | Maximum pagination cursor size in bytes; `u64` decimal string |
| `viewBatch` | Optional batch-limit object; omitted when shared-read limits are not advertised |
| `viewBatch.maxCalls`, `viewBatch.maxCalldataBytes`, `viewBatch.maxResponseBytes` | `u32` JSON numbers; the response bound covers encoded backend results, including events, before JSON encoding |
| `viewBatch.maxGas`, `viewBatch.timeoutMs` | `u64` decimal strings; aggregate gas budget per attempt and response-wait limit; per-call view and transport limits also apply |
| Consensus limits | Reported separately by `groundhog_chainConfig` |

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

Request an idempotent native-token airdrop.

| Parameter | Type | Description |
| --- | --- | --- |
| `request.recipient` | address | Recipient address as `0x`-prefixed 32-byte hex |
| `request.clientNonce` | string | Caller-selected idempotency nonce as `0x`-prefixed 1-to-32-byte hex |

| Availability | Contract |
| --- | --- |
| Configured airdrop backend | Method is registered |
| No airdrop backend | Standard JSON-RPC `Method not found` (`-32601`) |

The same recipient and `clientNonce` identify the same logical attempt on a network. Poll a pending attempt by repeating the exact request. Do not generate a new nonce for that attempt.

**Pending response:**

```json
{
  "attemptStatus": "pending",
  "recipient": "0x<64 lowercase hex characters>",
  "rawAmount": "100000000",
  "txHash": "0x<64 lowercase hex characters>",
  "retryAfterSeconds": "5"
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
  "height": "12345",
  "status": { "result": "ok" }
}
```

`succeeded` means the transaction committed. Inspect `status.result` to confirm execution success. A client timeout does not prove that the airdrop failed. Retry the same request to recover the attempt's state.

### `groundhog_version`

Get wire, implementation, build, and packaging-platform versions.

**Parameters:** None.

| Response field | Contract |
| --- | --- |
| `wireFormat` | Wire-format SemVer, `"11.1.0"` for this contract; clients may use it for compatibility checks |
| `implementation` | Diagnostic implementation version |
| `commitHash` | Diagnostic build commit or `null` |
| `platformVersion` | Optional packaging-platform version, independent of validated release identity |
| `releaseVersion` | Present when the binary matches a validated installed release bundle; otherwise omitted |
| `bundleManifestDigest` | Validated bundle manifest digest; otherwise omitted |

### `groundhog_view`

Execute a read-only contract invocation against committed state. The invocation does not enter the scheduler.

| Parameter | Type | Description |
| --- | --- | --- |
| `request.contract` | address | `0x`-prefixed 32-byte contract address |
| `request.entrypoint` | bytes | `0x`-prefixed 8-byte entrypoint ID |
| `request.calldata` | bytes | `0x`-prefixed call input |
| `request.caller` | address | Optional simulated caller |
| `request.gasLimit` | `u64` decimal string | Optional positive gas budget, at most `serverLimits.maxViewGas`; omission selects that maximum |
| `request.minHeight` | signed 64-bit decimal string | Optional nonnegative minimum committed snapshot height; not an exact-height selector |

| Response field or case | Contract |
| --- | --- |
| `output` | Root output tagged by `result`: `return` with `returnData`, `abort` with `abortData`, or `fault` |
| `events` | Events emitted during the simulation |
| `height` | Committed snapshot height as a signed 64-bit decimal string; requests cannot select a past height |
| `gasUsed` | Required `u64` decimal string for gas consumed by the root and child invocations; equals the selected limit on an out-of-gas fault |
| Invalid gas limit | Zero or above the endpoint maximum returns invalid params (`-32602`) |
| Snapshot below `minHeight` | `-32011` with `{ requested, observed }` decimal-string heights; does not wait or request a refresh |
| No view backend | Returns `-32052` |

### `groundhog_viewBatch`

| Parameter | Contract |
| --- | --- |
| `request.calls` | Nonempty ordered array of independent calls, within the endpoint's advertised batch limits |
| Each call | Required `contract`, 8-byte `entrypoint`, and `calldata`; optional `caller` and positive `gasLimit`, encoded as for `groundhog_view` |
| `request.minHeight` | Optional nonnegative signed 64-bit decimal string; freshness applies to the group, never an individual call |

| Response field or case | Contract |
| --- | --- |
| `height` | One committed snapshot height as a signed 64-bit decimal string |
| `results` | Exactly one result per call, in input order; each contains `output`, `events`, and `gasUsed` |
| `output` | `return`, `abort`, or `fault`, using the single-view output shape |
| `gasUsed` | Per-call consumed gas as a `u64` decimal string |
| Isolation | All calls read the same snapshot; simulated writes do not pass between calls |
| Contract abort or fault | Per-call outcome, not a whole-group RPC failure |
| Insufficient snapshot height | `-32011` with `{ requested, observed }`; no waiting or request-driven refresh |
| Invalid request or exceeded input limits | Invalid params (`-32602`) |
| Exhausted snapshot retries, deadline, or malformed/incomplete response | Fail the group rather than return mixed or partial results; backend work can outlive the response deadline |
| Unsupported backend | `-32052`; a server without the method can return standard `Method not found` (`-32601`) |
| Usage | [Read related values from one snapshot](/typescript/reads/#read-related-values-from-one-snapshot) |

### `groundhog_getBalance`

Read the latest committed native-token balance.

| Parameter | Type | Description |
| --- | --- | --- |
| `address` | address | `0x`-prefixed 32-byte address |

**Returns:**

```json
{
  "address": "0x<64 lowercase hex characters>",
  "rawBalance": "1000000000",
  "height": "4567"
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
| `height` | decimal string | Signed 64-bit block height, for example `"42"` |

**Returns:** `BlockInfo` or `null`.

```json
{
  "blockHash": "0x...",
  "protocol": 1,
  "networkHash": "0x...",
  "configHash": "0x...",
  "proposer": "0x...",
  "blockTimepoint": "1791200000000000001",
  "blockHeight": "42",
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

**Returns:** unsigned 64-bit decimal string, for example `"0"`.

:::caution[Gateway Only]
The hosted gateway (`hog-gateway`) returns `-32052` for this method. `thruput node` serves it for the local chain.
:::

### `groundhog_getEvents`

Query contract events with cursor pagination and topic filters.

| Parameter | Type | Description |
| --- | --- | --- |
| `query` | `EventQuery` | Order, anchor, cursor, limit, contract addresses, and positional topic filters |

**Returns:** `EventPage` with events, the next cursor, latest indexed block, and oldest retained block.

| Pagination field | JSON type |
| --- | --- |
| `anchor.height` for `{"kind":"atHeight","height":"42"}` | Signed 64-bit decimal string |
| `latestBlock`, `oldestBlock`, and event `blockHeight` | Signed 64-bit decimal string |
| `limit` and event `sequenceNumber` | Unsigned 32-bit JSON number |

`query.filters` uses OR across filters and AND within each filter. Contract-address filters are required. Topic filters are positional: `topic0`, `topic1`, and `topic2`. See [Read events](/typescript/events/#query-events) for typed filters and queries.

### `groundhog_getTransactionsByAddress`

Query transactions whose root invocation targets an address.

| Parameter | Type | Description |
| --- | --- | --- |
| `query` | `AddressTransactionQuery` | Address, order, anchor, cursor, and limit |

**Returns:** `TransactionRefPage` with transaction hashes and heights, the next cursor, latest indexed block, and oldest retained block. Hydrate a reference with `groundhog_getTransactionReceipt`.

Anchor heights, reference heights, `latestBlock`, and `oldestBlock` use decimal strings, as in `groundhog_getEvents`.

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
[Resume without missing events](/typescript/events/#resume-without-missing-events).

## Error Codes

Standard JSON-RPC 2.0 errors apply. The gateway also defines:

| Code | Name | Meaning |
| --- | --- | --- |
| `-32602` | Invalid params | Malformed or invalid parameters |
| `-32000` | TX_INVALID | Transaction bytes could not be decoded or validated; resource-limit failures include a typed `data.reason` |
| `-32001` | TX_REJECTED | Scheduler or airdrop backend rejected the transaction |
| `-32002` | TX_NOT_FOUND | Transaction not found |
| `-32010` | BLOCK_NOT_FOUND | Block not found at the requested height |
| `-32011` | VIEW_HEIGHT_UNAVAILABLE | Selected view snapshot is below `minHeight`; `data` carries `requested` and `observed` decimal-string heights |
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
