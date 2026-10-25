---
title: Use contract bindings
description: Select a generated interface, bind a deployment address, and work with typed arguments and results.
---

Bindings describe a contract's API. The client runtime uses them to encode arguments and decode results, exceptions, and events. A binding does not select a network or deployment address.

## Obtain the binding

The client supplies standard bindings such as `ERC20` through `@thruputchain/client/contracts`. For a custom contract, obtain its generated `.ts` file, address, and network from the contract author.

Generate a binding yourself only when you have its build or canonical spec. See [CLI code generation](/cli/codegen/) and [the contract-side handoff](/contracts/client-bindings/).

<span id="generate-bindings"></span>

Regenerate when methods, argument or return types, declared exceptions, or events change. Keep the generated file and deployment from the same interface build. Put application wrappers in separate files.

## Select an Interface Version

```ts
import { ERC20 } from "@thruputchain/client/contracts";

const tokenInterface = ERC20.v0_1;
```

Methods and their types live under an interface's compatibility major. A generated counter might export `Counter.v0_1`; use the actual exports in its generated file rather than reconstructing names.

```ts
import { Counter as CounterVersions } from "./contracts/my-counter.js";

const Counter = CounterVersions.v0_1;
const args: CounterVersions.v0_1.IncrementArgs = { amount: 1n };
```

The value alias does not create a TypeScript type namespace. Keep the full path for explicit type annotations.

## Bind a deployment

```ts
import { getContract } from "@thruputchain/client";
import { ERC20 } from "@thruputchain/client/contracts";
import { NATIVE_TOKEN_ADDRESS } from "@thruputchain/protocol";
import { client } from "./client.js";

const nativeToken = getContract({ binding: ERC20.v0_1, address: NATIVE_TOKEN_ADDRESS, client });
const supply = await nativeToken.totalSupply.view({ args: undefined });
```

`getContract` binds the descriptor to an address and client. It does not deploy or authorize anything. Use [Read contract data](/typescript/reads/) for view behavior and caller context.

## Method Descriptors

| API | Purpose |
| --- | --- |
| `method.invocation(contract, gasLimit, args)` | Build calldata and the target invocation |
| `method.call({ address, gasLimit, args })` | Retain result and exception decoders with the invocation |
| `method.view({ client, address, args, caller?, assumedAuth?, minStateBlockHeight?, signal? })` | Read a typed value with `stateBlockHeight`, gas use, and events; optional freshness floor |
| `method.viewOutcome(...)` | Return a typed return/abort/fault/unsupported outcome |
| `method.viewRequest({ address, args, caller?, assumedAuth? })` | Prepare an independent read with its decoder for `client.readViews`; no I/O, and freshness belongs to the group |
| `method.decodeArgs(bytes)` | Decode complete calldata |
| `method.decodeReturn(bytes)` / `decodeException(bytes)` | Decode known method output |
| `method.decodeReceipt(receipt)` / `decodeReceiptOutcome(receipt)` | Decode a receipt for that root method |

Direct descriptor calls can omit absent arguments. Bound argumentless views use `{ args: undefined }`. Public argument names use camelCase; ABI names remain in metadata. Contract integers use `bigint`.

Existing generated bindings gain `viewRequest()` through the client runtime; this feature needs no new codegen metadata. See [shared-snapshot reads](/typescript/reads/#read-related-values-from-one-snapshot) for grouped calls and [minimum heights](/typescript/reads/#read-after-confirmation) for single reads.

## Execute and Decode

Build calls with `.call(...)` when the application needs typed return values, then pass them to a wallet's `executeCallsAndWait`. Returned values follow call order. See [Send transactions](/typescript/transactions/).

Receipt decoders require the known root method. For wallet-wrapped calls, use the wallet execution helpers or `decodeExecution(receipt, calls)` instead of treating the receipt as the child's receipt. See [Track transaction results](/typescript/transaction-status/#decode-the-correct-method).

## Exceptions

Each interface exposes declared and unknown exception types. A declared exception has `kind: "declared"`, selector, name, decoded value, and a symbolic variant for enum errors. An unknown selector has `kind: "unknown"`, selector, and its raw data.

Return and declared-exception decoders reject trailing bytes. Unknown exceptions retain the bytes they cannot interpret. A successful transaction whose result cannot be decoded is still a successful execution.

## Events

<span id="query-events"></span>

Events use their defining crate, version, module, and type path. A descriptor builds topic filters, decodes event rows, and selects events from receipts. See [Read events](/typescript/events/) for examples and pagination.

## Type Mapping

Bindings describe structs, enum variants, unions, tuples, and optional values. Use the generated types rather than rebuilding their shapes or encoding calldata manually.

| Contract type | TypeScript type |
| --- | --- |
| Void | `void` |
| Bool | `boolean` |
| Integer | `bigint` |
| String | `string` |
| Address | `ContractAddress` |
| Bytes / vector of u8 | `Uint8Array` |
| Other vectors | `T[]` |
| Fixed bytes | `FixedBytes<N>` |
| Fixed arrays of length 0–3 | Exact readonly tuple |
| Longer fixed arrays | `FixedArray<T, N>` |
| Tuple | Readonly tuple |
| Option | `T \| null` |
| Named struct | Interface in its spec-ID namespace |
| Enum | Bigint value union and const object |
| Union | Discriminated `{ case, value? }` union |
| SignedToken | `SignedToken<T>` placeholder |

`fixedBytes` validates and brands mutable bytes; `fixedArray` returns a frozen copy. `signedToken<T>()` supplies a zero-byte placeholder, not authorization. See [Addresses and amounts](/typescript/values/) for input conversion.

## Standard Bindings

The client includes versioned DefaultWallet and ERC-20 interfaces, plus related metadata, permit, and signed-operation interfaces. Use the [generated client API](https://client-ts.thruput.network/) for the complete export list.
