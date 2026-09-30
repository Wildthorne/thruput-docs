---
title: TypeScript Bindings
description: Generate versioned method, event, and type descriptors from a Groundhog contract spec.
---

Bindings describe a contract's API. The client runtime encodes arguments and decodes results using that description. Use CLI 0.19.0 with the [coordinated client 0.12.0 packages](/tools/typescript-sdk/#install).

## Generate Bindings

```bash
groundhog build --bindings ts
# Or choose an output path for an existing canonical spec:
groundhog codegen ts target/groundhog/my_counter.spec.xdr -o web/src/contracts/my-counter.ts
```

Create the output directory first. The default build output for crate `my-counter` is `target/groundhog/my_counter.ts`. Standalone codegen consumes `.spec.xdr`, not `.spec.json` or the executable artifact. Regenerate after changing exported methods, events, exceptions, or reachable contract types. Never edit generated output by hand.

## Select an Interface Version

Methods and their types live under the interface's compatibility major:

```ts
import { Counter as CounterVersions } from "./contracts/my-counter.js";

const Counter = CounterVersions.v0_1;
const args: CounterVersions.v0_1.IncrementArgs = { amount: 1n };
const invocation = Counter.increment.invocation(contract, gasLimit, args);
```

The `const` alias shortens value access; it does not alias a TypeScript type namespace. Use the full versioned path for explicit type annotations. Different versions remain separately accessible. Crate-scoped types and events follow the canonical spec ID's crate, major, module, and declaration path.

The generated code separates type namespaces from runtime value objects so it supports erasable TypeScript and Node type stripping. Reserved names receive the generator's escaped spelling. Use the actual generated exports rather than reconstructing names.

## Method Descriptors

| Operation | Purpose |
| --- | --- |
| `invocation(contract, gasLimit, args)` | Encode an application invocation |
| `call({ contract, gasLimit, args })` | Retain typed result/exception decoders with that invocation |
| `decodeArgs(bytes)` | Inspect complete calldata using generated public argument names |
| `view(options)` | Simulate and return a typed value, height, and events |
| `viewOutcome(options)` | Simulate and return a typed return/abort/fault outcome |
| `decodeReturn(bytes)` / `decodeException(bytes)` | Decode known method output |
| `decodeReceipt(receipt)` / `decodeReceiptOutcome(receipt)` | Decode a receipt for the known root method |

Argumentless invocations omit the last argument; argumentless `call`/`view` options omit `args`. Public argument names use camelCase while metadata retains ABI names.

```ts
const decoded = Counter.increment.decodeArgs(invocation.calldata);
const value = await Counter.get.view({ client, contract, caller, signal });
const outcome = await Counter.get.viewOutcome({ client, contract, signal });
```

Select the descriptor only after identifying the intended method. Decoding does not establish the target contract's behavior. `decodeArgs` rejects incomplete/trailing input and returns `undefined` for no-argument methods. The shared runtime supplies this operation without extra ABI metadata. Moving older flat bindings to the current spec/namespace format is a separate regeneration step.

`view` throws `ContractViewError` for abort/fault. `viewOutcome` returns `kind: "return"`, `"abort"`, or `"fault"`. Malformed contract bytes throw `ContractDecodeError`; RPC/transport failures remain separate. A caller address simulates call context and does not authorize a transaction.

## Execute and Decode

Use a wallet to wrap an application invocation in an authorized root:

```ts
const call = Counter.increment.call({ contract, gasLimit: callGas, args: { amount: 1n } });
const { receipt, values } = await wallet.executeCallsAndWait({
  calls: [call],
  gasLimit: walletGas,
});
```

The wallet must preserve child returns. DefaultWallet does; DevWallet does not. For a void mutation the decoded value is `undefined`. `executeAndWait` is appropriate when only execution success is needed.

For manual decoding, identify the root method first:

```ts
import { DefaultWallet } from "@groundhogchain/client/contracts";

const root = DefaultWallet.v0_1.execute.decodeReceipt(receipt);
const childReturn = root.value[0];
if (childReturn === undefined) throw new Error("Expected one child return");
const value = Counter.increment.decodeReturn(childReturn);
```

The receipt does not supply enough method identity to select arbitrary child ABIs. Keep submitted call descriptors if you need later decoding. Never assume a wallet-root abort came from a particular child.

`decodeReceipt` throws `ContractReceiptError` for an abort, execution failure, or missing required return data. `decodeReceiptOutcome` returns `return`, `abort`, or `failure`. These operate on a known root receipt, not nested calls.

## Exceptions

Each interface version exposes `DeclaredException` and `Exception` types. A declared exception includes `kind: "declared"`, selector, name, and decoded value, plus a symbolic enum variant when available. An unknown selector preserves `{ kind: "unknown", selector, data }` with the complete raw buffer.

Return and declared-exception decoders reject trailing bytes. Unknown selectors preserve bytes they cannot interpret. Error objects retain their outcome or original receipt so applications can distinguish execution failure from decode failure.

## Events

Standard events use crate/version paths:

```ts
import { groundhog_erc20_if } from "@groundhogchain/client/contracts";
const { TransferEvent } = groundhog_erc20_if.v0_1.events;

const filter = TransferEvent.filter({
  contractAddresses: [token], topics: { to: owner },
});
const decoded = TransferEvent.decode(event);
const matches = TransferEvent.allFromReceipt(receipt, { contractAddress: token });
```

`decode` returns `null` for a different signature, and throws for malformed matching data. `singleFromReceipt` requires exactly one matching event from the selected emitter. A matching event must have the declared topic count, 32-byte topics, valid payload, and no trailing bytes. The protocol limit is three topics including the signature and 1,024 bytes for topics plus payload.

Directly filterable topics include addresses, fixed 32-byte values, `u32`, `u64`, `u128`, `i32`, `i64`, `i128`, `U256`, `I256`, and `bool`. Integers are fixed 32-byte big-endian values with zero/sign extension, not CXS scalar encodings. Strings and byte slices retain only a hash, not the original value. Follow generated filter types; do not invent a preimage filter.

Filters require one to five contract addresses. Named topic constraints accept one value or `{ oneOf: [...] }` with 1–16 values. Empty filters are not all-contract scans. `decodeEvent` decodes events known to a generated module; standard modules expose named aliases such as `decodeERC20Event`.

Use [typed event pages and durable restart](/tutorials/add-events-to-a-contract/#step-5-query-it-on-chain) for historical queries.

## Type Mapping

| Contract type | TypeScript type |
| --- | --- |
| Void | `void` |
| Bool | `boolean` |
| Integer types | `bigint` |
| String | `string` |
| Address | `ContractAddress` |
| Bytes / Vec of u8 | `Uint8Array` |
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

`fixedBytes(bytes, length)` validates and brands caller-owned mutable bytes without copying. `fixedArray(values, length)` returns a frozen copy. `signedToken<T>()` supplies the zero-byte placeholder; it does not create authorization.

## Standard Bindings

Client 0.12.0 ships versioned `DefaultWallet`, `DevWallet`, `ERC20`, `ERC20Metadata`, `ERC20Permit`, and `SignedOp` descriptors. Use generated types and events under their exported crate namespaces; old flat exports such as `ERC20TransferEvent` and `ERC20ApprovalEvent` are not the current API.

The ERC-20 interface 0.1.41 uses signed `difference` and `exclusive` for allowance changes, `AllowanceChangeEvent`, and explicit cleanup methods. See the [token workflow](/tutorials/work-with-groundhog-from-typescript/#8-work-with-erc-20-tokens).

## Related Documentation

- [TypeScript SDK](/tools/typescript-sdk/) for accounts, transport, reads, and execution
- [Groundhog CLI](/tools/groundhog-cli/) for build and codegen
- [Contract Spec](/reference/contract-spec/) for canonical metadata
- [Wallet Integration](/tools/wallet-integration/) for external wallets and recovery
