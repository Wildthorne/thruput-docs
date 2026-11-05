---
title: JSON-RPC API
description: Project Thruput native JSON-RPC methods, wire types, and error codes for wire format 14.
---

| API property | Value |
| --- | --- |
| Wire format | `14.x`. Tools `0.33.0` serves `14.0.0`; `14.1.0` adds `stated.maxTxGas` and the `gasLimitTooHigh` transaction detail |
| Compatibility | Breaking wire changes increase the major version of `getVersionInfo.wireFormat`. Clients accept one major version and do not fall back |
| Schema | [Generated OpenRPC specification](https://github.com/thruputchain/thruput-tools/blob/main/crates/json-rpc/open-rpc-spec/snapshots/thruput-spec.json) for exact method signatures and field types |
| Transport | JSON-RPC 2.0 over HTTP. For the node topology, see [Networking](/how-it-works/networking/) |

## Request Format

```json
{
  "jsonrpc": "2.0",
  "method": "getTransactionStatus",
  "params": { "transactionHash": "<base58 transaction hash>" },
  "id": 1
}
```

| Request rule | Contract |
| --- | --- |
| Parameter shape | One named-parameter object. Positional arrays, wrapped objects, and unknown fields return `-32602` |
| No-parameter methods | Accept `{}`, `[]`, `null`, or omitted `params`; clients send `{}` |
| Method names | Unprefixed core names. Optional groups use `faucet_` and `dev_` prefixes |
| Discovery | `getVersionInfo.supportedMethods` lists the methods that this endpoint registered. An unlisted method returns `Method not found` (`-32601`) |
| Field names | camelCase in requests, responses, and error data |

## Value Encoding

| Value | JSON encoding |
| --- | --- |
| Addresses, transaction hashes, block and network hashes, config hashes, public keys, public-key hashes, validator IDs | Unprefixed, case-sensitive base58 (Bitcoin/Solana alphabet). Must decode to exactly 32 bytes. `0x` hex is rejected |
| Signed transactions, calldata, entrypoints, return and abort data, storage keys and bytes, event topics and data, cursors, client nonces, upgrade entries | `0x`-prefixed lowercase hex with an even number of digits |
| 64-bit and wider integers: heights, nanosecond timestamps, gas, counts, balances, amounts | Canonical decimal string, including `"0"` |
| Smaller bounded integers: protocol versions, page limits, event sequence numbers, key IDs, weights | JSON number |
| Encoding choice | By field meaning, not byte length. A raw event topic stays hex even when its decoded value is an address or hash |
| Decimal string rejects | Numeric JSON, leading zeros, `+`, negative zero, whitespace, fractions, exponents, overflow |
| Binary payloads | Transactions use classic XDR; contract arguments and return values use CXS. See [XDR Protocol](/reference/xdr-protocol/) |
| Tagged unions | Discriminator field such as `status`, `result`, `kind`, or `attemptStatus`. Accept unknown tag values (for example `other` or `unknown`) without treating them as success or absence |

## JSON-RPC Arrays

| Property | Contract |
| --- | --- |
| Maximum entries | 1,000 per array on the gateway and local node |
| Correlation | Match responses by request ID; response order is not execution order |
| Errors | Per-entry RPC errors remain independent; transport failures can affect the shared exchange |
| Guarantees | No shared snapshot, ordering, or atomicity between independent requests |
| Other limits | Request and response byte limits and concurrency settings are separate |
| Client defaults | Opt-in HTTP batching uses 100 entries and a 0ms scheduling window; see [client transport](/typescript/transport/#http-batching) |

## Discovery Methods

### `getVersionInfo`

**Parameters:** None.

| Response field | Contract |
| --- | --- |
| `wireFormat` | Wire-format SemVer, for example `"14.1.0"`. The only field that selects client codecs |
| `supportedMethods` | Sorted names of the methods registered on this endpoint |
| `implementation` | Diagnostic implementation version |
| `commitHash`, `platformVersion`, `releaseVersion`, `bundleManifestDigest` | Optional diagnostics; omitted when unavailable |

### `getNetworkInfo`

**Parameters:** None.

```json
{ "networkHash": "<base58, 32 bytes>" }
```

`networkHash` is the signing network identity. It is part of every transaction signature preimage. Compare it with the expected network before signing. See [Authorization](/how-it-works/authorization/).

### `getServerLimits`

**Parameters:** None. Answered without contacting a backend.

| Response field | Contract |
| --- | --- |
| `maxSimulationGas` | Maximum simulation `gasLimit`, and the default when `gasLimit` is omitted; decimal string |
| `maxSimulationCalldataBytes` | Maximum simulation calldata size in bytes; decimal string |
| `maxEventsPerPage` | Maximum `getEvents` `limit`; JSON number |
| `maxTransactionsPerPage` | Maximum transaction-page `limit`; JSON number |
| `maxCursorBytes` | Maximum decoded cursor size in bytes; decimal string |
| `simulationBatch` | Optional: `maxInvocations`, `maxCalldataBytes`, `maxBackendResponseBytes` (JSON numbers), `maxGas`, `timeoutMs` (decimal strings) |

These are operator settings, not consensus parameters. Values can differ between endpoints on the same chain.

### `getChainTip`

**Parameters:** None.

```json
{ "blockHeight": "42", "blockHash": "<base58 block hash>" }
```

### `getChainConfig`

**Parameters:** None.

| Response field | Contract |
| --- | --- |
| `stated` | Explicit configuration values. A missing field is unspecified, not zero |
| `stated.max*` | `maxSha256Buffers`, `maxCrossInvokeDepth`, `maxNewContractsPerTx`, `maxBytestringLen`, `maxContractSizeBytes`, `maxSavepointDepth`, `maxAuthTokenDepth`, `maxRv32CodeBytes`, `maxRv32MemoryBytes`: JSON numbers. `maxTxGas` (wire `14.1.0`): decimal string |
| `execution` | Optional authoritative reading. A missing `execution` means the backend cannot supply it; do not infer zero prices |
| `execution.observedTip` | `blockHeight` and `blockHash` that the rules were read with |
| `execution.configHash` | Base58 configuration and storage-model commitment |
| `execution.effectiveLimits` | Runtime-resolved limits, same fields as `stated` |
| `execution.storageCosts` | `baseDataItemCost`, `bytestringCostPerByte`, `baseContractDeploymentCost`, `contractDeploymentCostPerByte`, `authPerKeyCost`, `rcqCostPerEntry`, `replayCacheCostPerEntry`, `balanceCost`: native-token base units as decimal strings |

Later transactions can execute under newer rules. Usage: [Estimate deployment funding](/cli/deploy-and-call/#estimate-deployment-funding).

## Transaction Methods

### `sendTransaction`

| Parameter | Type | Description |
| --- | --- | --- |
| `signedTransaction` | hex | `0x` hex of the `SignedTransaction` XDR |

```json
{ "transactionHash": "<base58 transaction hash>", "admission": "accepted" }
```

| Case | Contract |
| --- | --- |
| Success | Scheduler admission only, not commitment or execution |
| `transactionHash` | `sha256` of the inner `Transaction` XDR; excludes signatures |
| `-32000` | Invalid encoding, envelope, size, or executor bound. `data.detail.reason` can be `tooManyContracts`, `contractTooLarge`, `duplicateContract`, `rv32MemoryTooLarge`, `rv32CodeTooLarge`, or `gasLimitTooHigh` (wire `14.1.0`) |
| `-32001` | `data.reason` is `expired` (`blockExpiryHeight` at or below the tip) or `authenticationRejected` |
| `data.admission` | `notAttempted`, `rejected`, or `unknown` for this attempt |
| `-32051` or `-32050` | Admission can be unknown. Query `getTransactionStatus` with the hash before you prepare a replacement |
| `-32053` | Retryable refusal; optional `data.retryAfterMs` |

### `getTransactionStatus`

| Parameter | Type | Description |
| --- | --- | --- |
| `transactionHash` | base58 | Transaction hash |

| `status` | Fields and meaning |
| --- | --- |
| `pending` | In the scheduler, not committed. Optional `recentFailure` |
| `committed` | `blockHeight` of the block that included it, including `"0"` |
| `retry` | Retained scheduler processing failure; `error`; optional `recentFailure`. Another submission of the same signed transaction may succeed while valid. This status does not promise automatic requeue |
| `dropped` | Retained scheduler failure; `error`; optional `recentFailure`. For insufficient native tokens (`SchedulerErrorInsufficientNativeTokens`), fund the sender before resubmitting the same signed transaction while valid. For errors that require changing the transaction, resolve the original outcome before signing a replacement. See [Resubmission and replacement](/typescript/transaction-status/#resubmission-and-replacement) |
| `recentFailure` | Scheduler miss with a recent indexed failure: `attemptBlockHeight`, `cause` |
| `unknown` | Both the scheduler and committed history reported a miss |
| `other` | Status from a newer server version |

| Field | Contract |
| --- | --- |
| `error.source` | `auth`, `scheduler`, `executor`, or `other` |
| `error.code` | Signed 32-bit JSON number from `AuthErrorCode`, `SchedulerErrorCode`, or `ExecResult` |
| `recentFailure` | Advisory `{ attemptBlockHeight, cause }`. It can describe a different attempt. It does not authorize resubmission |
| `cause.kind` | `dbConflict` with `conflict { address, key, code }`, `contractRejected` with `contractIndex` and `code`, or `other` |

Indexed commitment takes priority. No negative status proves nonexecution, and a failed backend lookup returns an error, not `unknown`. Exclusion from one proposal does not guarantee a `retry` status. Usage: [Handle scheduler processing errors](/typescript/transaction-status/#handle-scheduler-processing-errors) and [Resubmission and replacement](/typescript/transaction-status/#resubmission-and-replacement).

### `getTransactionReceipt`

| Parameter | Type | Description |
| --- | --- | --- |
| `transactionHash` | base58 | Transaction hash |

**Returns:** `TransactionReceipt`, or `null` if no receipt is available.

```json
{
  "transactionHash": "<base58 transaction hash>",
  "blockHeight": "12345",
  "execution": { "result": "return", "returnData": "0x42" },
  "events": [],
  "gasUsed": "1500"
}
```

| `execution.result` | Meaning |
| --- | --- |
| `return` | Root call returned; `returnData` is required, possibly `"0x"` |
| `abort` | Root call aborted; `abortData` is required, possibly `"0x"` |
| `fault` | Deterministic execution fault |
| `nonDeterministicError` | Proposal-time storage conflict or race |
| `failedGasSponsorship` | Gas sponsorship failed |
| `other` | Result from a newer server version |

A receipt proves commitment. Only `execution.result: "return"` proves successful execution. `gasUsed` is metered work, not a fee: gas has no token cost and no refund.

## State Methods

### `getBalance`

| Parameter | Type | Description |
| --- | --- | --- |
| `address` | base58 | Account or contract address |

```json
{ "address": "<base58 address>", "stateBlockHeight": "4567", "rawBalance": "1000000000" }
```

`rawBalance` is free native-token base units as a decimal string. Storage collateral is separate.

### `getStorage`

| Parameter | Type | Description |
| --- | --- | --- |
| `address` | base58 | Contract address |
| `key` | hex | Serialized storage key |

```json
{ "stateBlockHeight": "4567", "item": { "kind": "nonnegativeInt", "value": "1000000000" } }
```

| `item.kind` | Fields |
| --- | --- |
| `nonnegativeInt` | `value`: decimal string |
| `bytestring` | `bytes`: hex |
| `deployedContract` | `hash` (base58), `size`, `contractType` |
| `authData`, `retrocausalQueue`, `replayCacheEntry` | None |
| `unknown` | `typeId` for a storage kind newer than the client |

`item` is `null` when the key has no value. `stateBlockHeight` names the snapshot for both cases.

### `getRegisteredAuth`

| Parameter | Type | Description |
| --- | --- | --- |
| `address` | base58 | Account address |

| Response field | Contract |
| --- | --- |
| `address`, `stateBlockHeight` | Echoed address and snapshot height |
| `configuration` | `null`, or `{ signers, requiredWeight }` |
| `signers[]` | `keyId`, `maxWeight`, and `publicKey`: `{ "scheme": "ed25519", "key": "<base58>" }` or `{ "scheme": "unknown", "schemeId": n }` |

`null` does not prove that the account is absent. It does not recover the key of a pubkey-derived account.

## Simulation Methods

### `simulateInvocation`

| Parameter | Type | Description |
| --- | --- | --- |
| `address` | base58 | Contract address |
| `entrypoint` | hex | 8-byte entrypoint ID |
| `calldata` | hex | Call input |
| `caller` | base58 | Optional parent contract |
| `assumedAuth` | object | Optional assumed claim; see below |
| `gasLimit` | decimal string | Optional, positive, at most `maxSimulationGas`; omission selects that maximum |
| `minStateBlockHeight` | decimal string | Optional freshness floor; not a historical selector |

| `assumedAuth.kind` | Fields |
| --- | --- |
| `sourceAddress` | `allowedKeys`, `requiredWeight`: JSON numbers |
| `pubkeySignature` | `pubkeyHash` (base58), `accountNonce` (decimal string; account derivation nonce) |

No signature is verified. Contract checks still run, and writes never commit. Omission supplies a zero-key, zero-weight source-address claim.

| Response field or case | Contract |
| --- | --- |
| `stateBlockHeight` | Committed state height H. Execution uses context H+1 |
| `output` | `{ "result": "return", "returnData" }`, `{ "result": "abort", "abortData" }`, or `{ "result": "fault" }` |
| `events` | Events emitted during the simulation |
| `gasUsed` | Decimal string. Equals the selected limit on an out-of-gas fault |
| Snapshot below `minStateBlockHeight` | `-32012` with `requestedStateBlockHeight` and `observedStateBlockHeight`; no wait or refresh |

### `simulateInvocations`

| Parameter | Contract |
| --- | --- |
| `invocations` | Nonempty array. Each entry takes `address`, `entrypoint`, `calldata`, and optional `caller`, `assumedAuth`, `gasLimit` |
| `minStateBlockHeight` | Optional floor for the whole group. A per-entry floor is rejected |

| Response field or case | Contract |
| --- | --- |
| `stateBlockHeight` | One snapshot height for all invocations |
| `results` | One `{ output, events, gasUsed }` per invocation, in input order |
| Isolation | Invocations do not see each other's simulated writes |
| Abort or fault | Per-invocation outcome, not a group failure |
| Limits | `getServerLimits.simulationBatch` plus per-call limits; violations return `-32602` |
| Snapshot failure or deadline | The group fails; no partial results. Backend work can outlive the deadline |

Usage: [Read related values from one snapshot](/typescript/reads/#read-related-values-from-one-snapshot).

## History Methods

### `getEvents`

| Parameter | Type | Description |
| --- | --- | --- |
| `filters` | array | 1 to 5 filters. OR across filters |
| `filters[].addresses` | base58 array | 1 to 5 contract addresses |
| `filters[].topics` | object | Optional `topic0`, `topic1`, `topic2`: up to 16 32-byte hex values each. AND across positions, OR within one. Omitted or empty is a wildcard |
| `start` | object | First page only; see [Pagination](/reference/json-rpc-api/#pagination) |
| `cursor` | hex | Later pages only |
| `limit` | number | Optional page size |

**Returns:** `EventPage`.

| Field | Contract |
| --- | --- |
| `events[]` | `{ transactionHash, blockHeight, sequenceNumber, event }` |
| `event` | `address` (base58), `topics` (up to 3 hex values), `data` (hex) |
| `nextCursor` | Hex, or `null` when the walk is complete |
| `oldestIndexedBlockHeight`, `latestIndexedBlockHeight` | Serving bounds as decimal strings; not checkpoints |

Event identity is `transactionHash` plus `sequenceNumber`. Usage: [Read events](/typescript/events/#query-events).

### `getTransactionsByRootAddress`

| Parameter | Type | Description |
| --- | --- | --- |
| `address` | base58 | Root invocation target |
| `start`, `cursor`, `limit` | | See [Pagination](/reference/json-rpc-api/#pagination) |

**Returns:** `TransactionRefPage` with `transactions[]` of `{ transactionHash, blockHeight }`, plus `nextCursor` and the serving bounds. Internal calls and incoming transfers do not match. Hydrate a reference with `getTransactionReceipt`.

### `getBlockByHeight`

| Parameter | Type | Description |
| --- | --- | --- |
| `blockHeight` | decimal string | Nonnegative block height |

**Returns:** `BlockInfo`, or `null` outside indexed coverage (including genesis).

```json
{
  "blockHash": "<base58>",
  "protocol": 1,
  "networkHash": "<base58>",
  "configHash": "<base58>",
  "proposer": "<base58 validator ID>",
  "blockTimepoint": "1791200000000000001",
  "blockHeight": "42",
  "txsHash": "<base58>",
  "storageHash": "<base58>",
  "eventsHash": "<base58>",
  "prevBlockHash": "<base58>",
  "proposalTxsHash": "<base58>",
  "upgrades": ["0x..."]
}
```

An unavailable or corrupt index returns an error, not `null`. The index can lag behind `getChainTip`.

### `getTransactionsByBlock`

| Parameter | Type | Description |
| --- | --- | --- |
| `blockHeight` | decimal string | Committed block height |
| `start` | object | First page only: `{ "order": "ascending" }` or `{ "order": "descending" }` |
| `cursor`, `limit` | | See [Pagination](/reference/json-rpc-api/#pagination) |

**Returns:** `TransactionRefPage`. References are ordered by unsigned transaction-hash bytes, not execution order. An empty page does not prove that the block exists; use `getBlockByHeight`.

## Pagination

| Rule | Contract |
| --- | --- |
| First page | Send `start` and no `cursor` |
| `start` for range history | `{ "order": "ascending", "anchor": { "kind": "atBeginning" } }`, `{ "order": "descending", "anchor": { "kind": "atEnd" } }`, or either order with `{ "kind": "atHeight", "blockHeight": "42" }` (inclusive) |
| Later pages | Send the returned `cursor` verbatim with the same query fields and no `start`. The cursor owns direction and its snapshot bound |
| `start` and `cursor` | Exactly one is required |
| `limit` | Omission selects the smaller of 50 and the page cap. `0` or values above the cap return `-32602`. The cap is at most 200 |
| Completion | `nextCursor: null`. An empty page with a non-null cursor is not the end |
| Invalid cursor | Empty or oversized cursors return `-32602`. Rejected tokens return `-32602` with `data.kind: "invalidCursor"` and `reason` `malformed`, `unsupportedVersion`, or `queryMismatch` |
| Retention | `-32013` with `reason: "outsideRetention"` and optional indexed bounds |
| Subscriptions | A walk does not follow new blocks. Start a new walk to check for new activity |

For an application pattern, see [Resume without missing events](/typescript/events/#resume-without-missing-events).

## Optional Methods

These methods appear in `supportedMethods` only when the endpoint configures them.

### `faucet_requestAirdrop`

| Parameter | Type | Description |
| --- | --- | --- |
| `recipient` | base58 | Recipient address |
| `clientNonce` | hex | Caller-selected 1-to-32-byte nonce |

| `attemptStatus` | Fields |
| --- | --- |
| `pending` | `recipient`, `rawAmount`, `retryAfterSeconds`, optional `transactionHash` |
| `succeeded` | `recipient`, `rawAmount`, `transactionHash`, `blockHeight`, `execution: { "result": "return", "returnData" }` |

Each call advances one attempt bound to `recipient` and `clientNonce`. Do not repeat it automatically. Poll a returned `transactionHash` with `getTransactionStatus` and `getTransactionReceipt`. `pending` does not prove admission. `-32030` means the faucet stopped the attempt; it does not prove nonexecution.

### `dev_fundAccount`

Local node only.

| Parameter | Type | Description |
| --- | --- | --- |
| `recipient` | base58 | Recipient address |
| `rawAmount` | decimal string | Positive amount in base units |
| `clientNonce` | hex | 1-to-32-byte nonce |
| `faucet` | base58 | Expected local faucet address |

**Returns:** `{ recipient, rawAmount, transactionHash, signedTransaction }`. Check the receipt before you treat the transfer as successful. `-32031` means signed evidence exists without a resolved outcome. Retry with the same request.

### `dev_getPendingTransactionCount`

Local node only. **Parameters:** None. **Returns:** `{ "count": "0" }`, the local scheduler's pending count as a decimal string.

## Method Availability

| Methods | Registered when the endpoint has |
| --- | --- |
| `getVersionInfo`, `getNetworkInfo`, `getServerLimits` | Always |
| `sendTransaction` | Scheduler |
| `getTransactionStatus` | Scheduler and indexer |
| `getTransactionReceipt`, `getEvents`, `getTransactionsByRootAddress`, `getBlockByHeight`, `getTransactionsByBlock` | Indexer |
| `getChainTip`, `getChainConfig`, `getBalance`, `getStorage`, `getRegisteredAuth` | State database |
| `simulateInvocation`, `simulateInvocations` | Simulation backend |
| `faucet_requestAirdrop` | Hosted faucet, or local node funding |
| `dev_fundAccount` | Local node funding |
| `dev_getPendingTransactionCount` | Local node only |

A configured backend that is down returns a backend error. It does not remove the method.

## Error Codes

Standard JSON-RPC 2.0 errors also apply, including `-32601` for unregistered methods. Error `data` carries a `kind` discriminator in camelCase.

| Code | `data.kind` | Meaning |
| --- | --- | --- |
| `-32602` | `invalidParams`, `invalidCursor` | Invalid named request or continuation token; optional `reason` and JSON-pointer `path` |
| `-32000` | `transactionInvalid` | Invalid transaction framing, envelope, or executor bound |
| `-32001` | `transactionRejected` | Expiry or scheduler authentication refusal for this attempt |
| `-32012` | `stateHeightUnavailable` | Simulation snapshot below the requested floor |
| `-32013` | `historyUnavailable` | Required history cannot be served |
| `-32030` | `fundingAttemptStopped` | Funding service stopped this attempt |
| `-32031` | `localFundingUnresolved` | Local funding has signed evidence without a resolved outcome |
| `-32050` | `backendUnavailable` | Required backend is unavailable |
| `-32051` | `backendTimeout` | Deadline exceeded; writes may have been dispatched |
| `-32053` | `overloaded` | Temporary refusal; retry with backoff |
| `-32054` | `backendDataInvalid` | Backend data cannot satisfy the method contract |

## Client Libraries

| Language | Package | Wire selection |
| --- | --- | --- |
| TypeScript | `@thruputchain/client` `0.25` | Calls `getVersionInfo` once at connect and requires major `14`. See [TypeScript SDK](/tools/typescript-sdk/) |
| Rust | `thruput-json-rpc-client` (`NativeClient`) | `thruput-client`'s `check_endpoint` requires major `14` and the methods you name |

## Related Documentation

- [Networking](/how-it-works/networking/)
- [Authorization](/how-it-works/authorization/)
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/)
- [Storage Types](/reference/storage-types/)
