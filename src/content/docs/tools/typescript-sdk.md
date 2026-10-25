---
title: Client API reference
description: TypeScript client entry points, common operations, and links to focused usage guides and generated API documentation.
---

| Reference | Purpose |
| --- | --- |
| [Generated client API](https://client-ts.thruput.network/) | Complete types, overloads, and exports |
| [Generated protocol API](https://protocol-ts.thruput.network/) | Protocol types and codecs |
| [JSON-RPC API](/reference/json-rpc-api/) | Wire methods and responses |
| [TypeScript overview](/typescript/) | Application model and task guides |

## Install

| Package | Use | Instructions |
| --- | --- | --- |
| `@thruputchain/client` | Application client and contract runtime | [Package setup](/typescript/setup/) |
| `@thruputchain/protocol` | Protocol-only constants and wire types | [Package setup](/typescript/setup/) |
| `@thruputchain/contract-spec` | Schema tooling | [Contract spec](/reference/contract-spec/) |

## Connect to a Cluster

| API | Behavior |
| --- | --- |
| `createThruputClient({ cluster, transport? })` | Async client creation; checks wire format 14, advertised methods, and network identity |
| `devnet(options?)` | Hosted development network; unpinned unless given `networkHash`; declares airdrop support |
| `localnet(options?)` | Local endpoint and default local identity; override with the matching runtime identity |
| `mainnet(options)` | Requires an explicit endpoint |
| `defineCluster(descriptor)` | Custom name, endpoint, hash pin, and expected capabilities |
| `getChainTip()` / `getVersionInfo()` | Tip `blockHeight` and `blockHash`; `wireFormat`, `implementation`, and optional release identity |
| `client.network` | Validated network identity of a cluster client |
| `client.discovery` | Connection-time snapshot of version, network, and optional server limits |
| `RpcCompatibilityError` | Unsupported wire format, network mismatch, or unadvertised method |
| `getChainConfig()` | Stated limits plus optional `execution` with `observedTip`, `configHash`, runtime-resolved limits, and exact `bigint` storage prices; absent execution context is not zero cost |
| Usage | [Connect to a network](/typescript/connect/) |

## Exact Amounts and Common Types

| API | Result / rule |
| --- | --- |
| `parseUnits(text, decimals)` | Exact signed `bigint`; rejects malformed input and excess precision |
| `formatUnits(value, decimals)` | Decimal string |
| `addressFromBase58(text)` / `hashFromBase58(text)` | Typed address or hash from base58 |
| `toBase58(bytes)` | Base58 encoding for addresses and hashes that users see, store, or compare with RPC values |
| `parseAddress(text)` | Typed address from base58 or a `C` StrKey |
| `fromHex0x(text)` / `toHex0x(bytes)` | `0x` hex for signed transaction bytes and calldata |
| `addressFromHex(text)` / `hashFromHex(text)` | Explicit hex conversion; use base58 for RPC and provider identifiers |
| `gasAmount(bigint)` | Typed computation budget |
| `ParseUnitsError` | `code: "malformed" \| "precision"`; invalid decimals throw `RangeError` |
| Usage | [Addresses and amounts](/typescript/values/) |

## Choose an Account Model

<span id="bind-a-wallet-client"></span>

| API | Inputs / behavior |
| --- | --- |
| `createPubkeyAccount({ signer, nonce? })` | Ed25519 or ML-DSA-65 signer; address nonce defaults to `0n` |
| `createSourceAddressAccount({ address, signers, allowedKeys, requiredWeight })` | Existing stored-auth account; does not write auth data |
| `createWalletClient({ client, account, invocationAdapter?, onSigned? })` | Separate signer-bound client; pubkey accounts default to DefaultWallet |
| `networkHash` wallet option | Required for a client without validated network identity; must match the endpoint's network |
| `createProviderWalletClient(...)` | External wallet adapter; see [provider API](/tools/wallet-provider/#sdk-adapter-behavior) |
| Usage | [Accounts and wallet clients](/typescript/wallet-clients/), [script setup](/typescript/accounts/), [browser wallets](/tools/wallet-integration/) |

## Fund and Execute a Call

| API | Result / behavior |
| --- | --- |
| `requestAirdrop(options)` (client) / `wallet.requestAirdrop(options?)` | One faucet call, then read-only observation; returns `AirdropSucceeded` with `transactionHash`, `blockHeight`, and `execution`; throws unless execution succeeds; account-defaulted on a signer wallet |
| `requestAirdropAttempt({ recipient, clientNonce })` | One faucet call; returns a `pending` or `succeeded` attempt without observation |
| `prepareExecution(request)` | Unsigned wallet-root transaction |
| `execute(request)` | Submitted hash; signer-based wallet |
| `executeAndWait(request, options?)` | Successful committed `receipt` and `transactionHash` |
| `executeCallsAndWait({ calls, gasLimit }, options?)` | Successful receipt plus ordered typed child values |
| `walletGasLimit(invocations, overhead)` | Sum invocation budgets, checking u64 bounds; pass `call.invocation` for typed calls; does not estimate usage |
| Usage | [Send transactions](/typescript/transactions/) |

## Typed Calls and Observation Recovery

| API / error | Meaning |
| --- | --- |
| `getTransactionStatus({ transactionHash })` | One status lookup; `committed` always includes `blockHeight` |
| `getTransactionReceipt({ transactionHash })` | One committed-receipt lookup with `blockHeight`, `execution`, `events`, and `gasUsed`; `null` when unavailable |
| `waitForTransactionReceipt(hash, options?)` | Poll until a receipt, including failed execution; reports each status through `onStatus`; never resubmits |
| `waitForCommitment(hash, options?)` | Poll until commitment is known, without requiring a receipt |
| `waitForExecution(client, hash, options?)` | Wait and require successful execution |
| `TransactionReceiptObservationError` / `TransactionReceiptTimeoutError` | Observation stopped; retains `transactionHash`, `knownCommitment`, and `lastStatus` |
| `SchedulerTransactionError` | `source`: `auth`, `scheduler`, `executor`, or `other`; `code`: signed 32-bit number |
| `UnsupportedRpcValue` | A status, result, or source from a newer server; retains `raw` |
| `TransactionExecutionError` | Failed committed `receipt` |
| `TransactionObservationError` | Known `transactionHash`, signed `submission`, `phase`, and causes |
| `ExecutionDecodeError` | Successful receipt whose child return data failed decoding |
| `ExecutionReturnUnavailableError` | Successful receipt without child returns |
| Usage | [Track transaction results](/typescript/transaction-status/) |

## Use a Local Account

<span id="use-a-local-devwallet"></span>

| API | Result / requirement |
| --- | --- |
| `localnet(options?)` | Local endpoint and pinned local network identity |
| `Ed25519Signer.fromSeed(seed)` | Ed25519 signer from a 32-byte seed in the application environment |
| `MlDsa65Signer.fromSeed(seed, { deterministic? })` | ML-DSA-65 signer from a 32-byte FIPS 204 seed; signing is randomized unless `deterministic` is set |
| `createPubkeyAccount({ signer })` | Native pubkey account derived from the signer |
| `wallet.requestAirdrop()` | Fund the account through the local faucet |
| Usage | [Local development accounts](/typescript/accounts/#use-a-local-development-account) |

## Deploy Through a Wallet

| API | Result / requirement |
| --- | --- |
| `prepareContractDeployment({ deployer, contract, deploymentNonce? })` | Contract hash, nonce, and predicted address; no submission |
| `rv32Contract(artifact)` | Protocol wrapper for nonempty artifact bytes |
| `DeploymentOptions` | Required `gasLimit` and native-token `amount` in base units; optional `initializer` |
| `prepareDeployment(deployment, options)` | Unsigned deployment transaction |
| `deployContract(deployment, options)` | Submitted hash and predicted address; signer wallet |
| `deployContractAndWait(deployment, options, controls?)` | Successful deployment with verified address; provider form requires lifecycle controls |
| Usage | [Deploy a contract](/typescript/deployment/) |

## Typed Views

| API | Result / behavior |
| --- | --- |
| `getContract({ binding, address, client })` | Bound method collection |
| `method.view({ client, address, args?, caller?, assumedAuth?, minStateBlockHeight?, signal? })` | Typed `value`, `stateBlockHeight`, `gasUsed`, and `events` |
| `method.viewOutcome(options)` | `return`, `abort`, `fault`, or `unsupported`; same options as `view` |
| `method.viewRequest({ address, args?, caller?, assumedAuth? })` | Prepare a typed read without I/O; arguments follow the method's generated types |
| `client.readViews({ calls, minStateBlockHeight? }, options?)` | Tuple-typed outcomes in input order at one shared `stateBlockHeight`; no splitting or separate-read fallback |
| `client.simulateInvocation(request, options?)` / `client.simulateInvocations({ invocations, minStateBlockHeight? }, options?)` | Raw single/grouped simulations; `minStateBlockHeight` goes on the single request or whole group |
| `minStateBlockHeight` | Optional nonnegative `bigint` freshness floor; no waiting, forced refresh, or automatic client retry |
| `assumedAuth` | Protocol `AuthClaim`, such as `account.authClaim`; simulation does not verify signatures |
| `(await client.getServerLimits()).simulationBatch` | Optional advertised batch limits; required for grouped reads |
| `NativeRpcErrorCode.StateHeightUnavailable` (`-32012`) | RPC freshness error with `requestedStateBlockHeight` and `observedStateBlockHeight`; not a contract outcome |
| `ContractViewError` | Contract abort, fault, or unsupported result |
| `ContractDecodeError` | Malformed contract data |
| Usage | [Read contract data](/typescript/reads/), [bindings](/tools/typescript-bindings/) |

## Cancellation and Read Errors

| API | Rule |
| --- | --- |
| `signal` | Request options for actions; inside view options for generated/bound views |
| `classifyReadError(error, { signal })` | `transient`, `permanent`, `cancelled`, or `unknown`; no automatic retry |
| Cancellation | Cancels observation, not onchain execution |
| Usage | [Read cancellation](/typescript/reads/#cancel-stale-reads) |

## HTTP Batching

| Option | Default / meaning |
| --- | --- |
| `HttpTransport(url, { timeoutMs, headers, batch })` | Configure the HTTP request layer |
| `batch` | Off by default; `true` selects default batching settings |
| `maxSize` | 100 entries; allowed range 1–1,000 |
| `waitMs` | 0ms scheduling window |
| Usage | [Configure HTTP transport](/typescript/transport/) |

## Event Pages

| API | Result / behavior |
| --- | --- |
| `getContractEvents({ event, addresses, topics?, start \| cursor, limit? }, options?)` | One typed page with event identity, `nextCursor`, and indexer bounds |
| `start` | `{ order, anchor }`; anchor kind `atBeginning`, `atEnd`, or `atHeight` with `blockHeight` |
| `nextCursor` | Opaque string for the next page; `null` ends the walk |
| `iterateEventPages({ filters, start, limit? }, options?)` | Raw pages on demand from an explicit `start`; returns `HistoryCompletion` after the last page |
| `iterateTransactionsByRootAddress({ address, start, limit? }, options?)` | Transactions sent by a root address, as a checked walk |
| `HistoryWalkError` | Regressed coverage, lost retention, duplicate or out-of-order rows, or a repeated cursor |
| `Event.filter({ addresses, topics? })` / `Event.decode(raw)` | Generated topic filter and payload decoder |
| `Event.allFromReceipt(receipt, { address })` / `singleFromReceipt(...)` | Matching receipt events, filtered by emitter |
| Usage | [Read events](/typescript/events/) |

## Receipt Decoding

| API | Requirement |
| --- | --- |
| `decodeExecution(receipt, calls, adapter?)` | Successful wallet receipt and retained ordered call descriptors |
| `method.decodeReceipt` / `decodeReceiptOutcome` | Descriptor must identify the root method |
| Usage | [Decode the correct method](/typescript/transaction-status/#decode-the-correct-method) |

## Low-Level Signing

| API | Role |
| --- | --- |
| `prepareTransaction` | Build a root transaction and its authorization claim |
| `signTransaction(transaction, signers, networkHash)` | Sign the network-bound preimage |
| `client.sendTransaction({ signedTransaction: serializeSignedTransaction(signed) })` | Submit signed bytes once; returns `transactionHash` and `admission` |
| `sendTransaction(client, signed)` from `@thruputchain/client/actions` | Serialize, submit once, and require `accepted` admission; returns the hash |
| Transaction hash | SHA-256 of unsigned transaction XDR, separate from the signing preimage |
| Usage | Prefer [wallet execution](/typescript/transactions/) for application calls |

## Public Entry Points

| Import | Use for |
| --- | --- |
| `@thruputchain/client` | Clients, clusters, accounts, actions, amounts, common primitives |
| `@thruputchain/client/contracts` | Standard contract and event descriptors |
| `@thruputchain/client/contract` | Descriptor runtime, codecs, fixed-length helpers |
| `@thruputchain/client/transport` | HTTP/mock transports and errors |
| `@thruputchain/client/actions` | Standalone actions |
| `@thruputchain/client/wallet` | Execution and provider adapters |
| `@thruputchain/client/provider` | Provider wire types, validation, discovery |
| `@thruputchain/client/transaction` | Construction, signing, serialization |
| `@thruputchain/client/signers` | Signer interface, `Ed25519Signer`, `MlDsa65Signer`, `verifyMlDsa65` |
| `@thruputchain/client/signed-op` | Network-bound offchain signed operations |

## Maintained Examples

| Source | Purpose |
| --- | --- |
| [Client examples](https://github.com/thruputchain/thruput-sdk-ts/tree/main/examples) | Runnable SDK examples; use dependencies matching the selected source revision |
| [Guides](/guides/) | Complete contract and application walkthroughs |
