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
| `@groundhogchain/client` | Application client and contract runtime | [Package setup](/typescript/setup/) |
| `@groundhogchain/protocol` | Protocol-only constants and wire types | [Package setup](/typescript/setup/) |
| `@groundhogchain/contract-spec` | Schema tooling | [Contract spec](/reference/contract-spec/) |

## Connect to a Cluster

| API | Behavior |
| --- | --- |
| `createGroundhogClient({ cluster, transport? })` | Async client creation with network identity validation |
| `devnet(options?)` | Hosted development network; unpinned unless given `networkHash`; declares airdrop support |
| `localnet(options?)` | Local endpoint and default local identity; override with the matching runtime identity |
| `mainnet(options)` | Requires an explicit endpoint |
| `defineCluster(descriptor)` | Custom name, endpoint, hash pin, and expected capabilities |
| `getChainTip()` / `getVersion()` | Current tip and release/wire identity |
| `getChainConfig()` | Stated limits plus optional `execution` with `observedTip`, `configHash`, runtime-resolved limits, and exact `bigint` storage prices; absent execution context is not zero cost |
| Usage | [Connect to a network](/typescript/connect/) |

## Exact Amounts and Common Types

| API | Result / rule |
| --- | --- |
| `parseUnits(text, decimals)` | Exact signed `bigint`; rejects malformed input and excess precision |
| `formatUnits(value, decimals)` | Decimal string |
| `addressFromHex(text)` / `hashFromHex(text)` | Typed address or hash from `0x` hex |
| `toHex0x(bytes)` | `0x`-prefixed display encoding |
| `gasAmount(bigint)` | Typed computation budget |
| `ParseUnitsError` | `code: "malformed" \| "precision"`; invalid decimals throw `RangeError` |
| Usage | [Addresses and amounts](/typescript/values/) |

## Choose an Account Model

<span id="bind-a-wallet-client"></span>

| API | Inputs / behavior |
| --- | --- |
| `createPubkeyAccount({ signer, nonce? })` | Ed25519 signer; address nonce defaults to `0n` |
| `createSourceAddressAccount({ address, signers, allowedKeys, requiredWeight })` | Existing stored-auth account; does not write auth data |
| `createWalletClient({ client, account, invocationAdapter? })` | Separate signer-bound client; pubkey accounts default to DefaultWallet |
| `networkHash` wallet option | Required for a client without validated network identity |
| `createProviderWalletClient(...)` | External wallet adapter; see [provider API](/tools/wallet-provider/#sdk-adapter-behavior) |
| Usage | [Accounts and wallet clients](/typescript/wallet-clients/), [script setup](/typescript/accounts/), [browser wallets](/tools/wallet-integration/) |

## Fund and Execute a Call

| API | Result / behavior |
| --- | --- |
| `requestAirdrop(options?)` | Poll one funding attempt; account-defaulted on an airdrop-capable signer wallet |
| `requestAirdropAttempt(request)` | Single application-controlled funding attempt |
| `prepareExecution(request)` | Unsigned wallet-root transaction |
| `execute(request)` | Submitted hash; signer-based wallet |
| `executeAndWait(request, options?)` | Successful committed receipt and hash |
| `executeCallsAndWait({ calls, gasLimit }, options?)` | Successful receipt plus ordered typed child values |
| `walletGasLimit(invocations, overhead)` | Sum invocation budgets, checking u64 bounds; pass `call.invocation` for typed calls; does not estimate usage |
| Usage | [Send transactions](/typescript/transactions/) |

## Typed Calls and Observation Recovery

| API / error | Meaning |
| --- | --- |
| `getTransactionStatus(hash)` | One status lookup |
| `getTransactionReceipt(hash)` | One committed-receipt lookup; `null` when unavailable |
| `waitForTransactionReceipt(hash, options?)` | Wait for a receipt, including failed execution |
| `waitForExecution(client, hash, options?)` | Wait and require successful execution |
| `TransactionExecutionError` | Failed committed `receipt` |
| `TransactionObservationError` | Known `txHash` plus observation and optional submission causes |
| `ExecutionDecodeError` | Successful receipt whose child return data failed decoding |
| `ExecutionReturnUnavailableError` | Successful receipt without child returns |
| Usage | [Track transaction results](/typescript/transaction-status/) |

## Use a Local Account

<span id="use-a-local-devwallet"></span>

| API | Result / requirement |
| --- | --- |
| `loadLocalDevAccount(options?)` | Node-only manifest-verified native pubkey address, signer, role, and network hash |
| `role` / `roleOffset` | Select role and zero-based position; defaults to first `local_user` |
| Manifest selection | `GROUNDHOG_RUNTIME_MANIFEST`, otherwise active CLI configuration |
| Usage | [Local bootstrap accounts](/typescript/accounts/#use-a-local-bootstrap-account) |

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
| `method.view(options)` | Typed value, height, gas use, and events; supports `minHeight` and `signal` |
| `method.viewOutcome(options)` | `return`, `abort`, or `fault`; also supports `minHeight` |
| `method.viewRequest({ contract, args?, caller? })` | Prepare a typed read without I/O; arguments follow the method's generated types |
| `client.readViews({ calls, minHeight? }, options?)` | Tuple-typed outcomes in input order at one shared `height`; no splitting or separate-read fallback |
| `client.view(request, options?)` / `client.viewBatch({ calls, minHeight? }, options?)` | Raw single/grouped simulations; `minHeight` goes on the single request or whole group |
| `minHeight` | Optional nonnegative `bigint` freshness floor; no waiting, forced refresh, or automatic client retry |
| `(await client.getServerLimits()).viewBatch` | Optional advertised batch limits |
| `ViewHeightUnavailable` (`-32011`) | RPC freshness error with requested and observed heights; not a contract outcome |
| `ContractViewError` | Contract abort or fault |
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
| `getContractEvents({ event, contractAddresses, topics?, ...query }, options?)` | One typed page with event identity and indexer bounds |
| `iterateEventPages(query, options?)` | Raw pages on demand; empty cursor ends the walk |
| `Event.filter(input)` / `Event.decode(raw)` | Generated topic filter and payload decoder |
| `Event.allFromReceipt(...)` / `singleFromReceipt(...)` | Matching receipt events, filtered by emitter |
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
| `sendTransaction(signed)` | Submit signed bytes |
| Transaction hash | SHA-256 of unsigned transaction XDR, separate from the signing preimage |
| Usage | Prefer [wallet execution](/typescript/transactions/) for application calls |

## Public Entry Points

| Import | Use for |
| --- | --- |
| `@groundhogchain/client` | Clients, clusters, accounts, actions, amounts, common primitives |
| `@groundhogchain/client/contracts` | Standard contract and event descriptors |
| `@groundhogchain/client/contract` | Descriptor runtime, codecs, fixed-length helpers |
| `@groundhogchain/client/transport` | HTTP/mock transports and errors |
| `@groundhogchain/client/actions` | Standalone actions |
| `@groundhogchain/client/wallet` | Execution and provider adapters |
| `@groundhogchain/client/provider` | Provider wire types, validation, discovery |
| `@groundhogchain/client/local-dev` | Node-only local account loading |
| `@groundhogchain/client/transaction` | Construction, signing, serialization |
| `@groundhogchain/client/signers` | Signer interface and private-key signer |
| `@groundhogchain/client/signed-op` | Network-bound offchain signed operations |

## Maintained Examples

| Source | Purpose |
| --- | --- |
| [Client examples](https://github.com/groundhogchain/client-ts/tree/main/examples) | Runnable SDK examples; use dependencies matching the selected source revision |
| [Guides](/guides/) | Complete contract and application walkthroughs |
