---
title: TypeScript Bindings
description: Generate typed TypeScript method and event descriptors for Groundhog contracts.
---

TypeScript bindings turn a contract spec into typed method descriptors, event descriptors, declared exceptions, and contract-specific TypeScript types.

For JSON-RPC transports, transaction helpers, deployment, and package setup, see [TypeScript SDK](/tools/typescript-sdk/).

:::note[Version checked]
This page was source-checked against published `@groundhogchain/client` `0.4.0`, protocol packages `0.8.0`, and CLI codegen `0.10.3` source on August 26, 2026.
:::

## What Bindings Provide

Generated bindings include:

- TypeScript types for contract structs, enums, and unions
- Method descriptors for invocations, typed views, return values, exceptions, and root receipts
- Event descriptors for decoding, filtering, and receipt extraction
- Entrypoint IDs, interface metadata, and the contract spec

Re-run codegen after changing exported methods, events, exceptions, or contract types.

## Generate Bindings

Generate the TypeScript binding as part of the project build:

```bash
groundhog build --bindings ts
```

With Cargo's default target directory, a crate named `my-contract` writes:

```text
target/groundhog/my_contract.ts
```

Use standalone codegen when the binding belongs elsewhere:

```bash
mkdir -p web/src/contracts
groundhog codegen ts \
  target/groundhog/my_contract.spec.xdr \
  -o web/src/contracts/my-contract.ts
```

Standalone TypeScript codegen consumes the canonical `.spec.xdr` contract spec.

Depending on the contract, generated bindings import from these public modules:

- `@groundhogchain/client/contract`
- `@groundhogchain/contract-spec`
- `@groundhogchain/protocol`
- `@groundhogchain/protocol/utils`

See [TypeScript SDK installation](/tools/typescript-sdk/#install) for the required package versions.

## Generated Method Descriptors

Generated interface objects expose method descriptors, not callable functions. Abbreviated output looks like this:

```ts
import {
  createContractCodecContext,
  defineContractMethod,
  type ContractException,
  type ContractSpec,
} from "@groundhogchain/client/contract";

export interface CounterIncrementArgs {
  amount: bigint;
}

export type CounterIncrementResult = void;
export type CounterException = ContractException<CounterDeclaredException>;

const codecs = createContractCodecContext(spec.type_defs);

export const Counter = {
  increment: defineContractMethod<
    CounterIncrementArgs,
    CounterIncrementResult,
    CounterDeclaredException
  >({
    entrypoint: entrypoints.Counter.increment,
    args: [
      {
        abiName: "amount",
        publicName: "amount",
        type: spec.interfaces[0]!.methods[0]!.args[0]!.ty,
      },
    ],
    returnType: spec.interfaces[0]!.methods[0]!.return_type,
    throws: [
      {
        selector: 0xeb2cf72be75a4c62n,
        name: "CounterError",
        type: spec.interfaces[0]!.throws[0]!.ty,
      },
    ],
    codecs,
  }),
} as const;
```

The generated file contains the complete spec and metadata omitted above.

### Build an Invocation

```ts
const invocation = Counter.increment.invocation(contract, gasLimit, {
  amount: 1n,
});
```

The descriptor builds an application invocation. Execute it through a wallet client so the configured DefaultWallet, DevWallet, or custom adapter can construct the authorized root invocation:

```ts
const txHash = await wallet.execute({
  invocation,
  gasLimit: walletGasLimit,
});
```

See the [TypeScript SDK wallet flow](/tools/typescript-sdk/#bind-a-wallet-client) for account setup and receipt handling.

Argumentless methods omit the final argument object. Generated argument names use camelCase, while descriptor metadata retains the original ABI name. For example, `initial_value` becomes `initialValue`.

Every descriptor also exposes its entrypoint ID as a defensive copy:

```ts
const entrypoint = Counter.increment.entrypoint;
```

### Decode Returns and Exceptions

```ts
const value = Counter.get.decodeReturn(returnData);
const exception = Counter.increment.decodeException(abortData);
```

Return decoders and declared-exception decoders consume the complete buffer and reject trailing bytes with `ContractDecodeError`. An unknown exception preserves its selector and complete raw abort buffer. It does not interpret or reject bytes after the selector.

### Run a Typed View

```ts
const result = await Counter.get.view({
  client,
  contract,
  caller,
});

console.log(result.value, result.height, result.events);
```

`caller` is optional. Methods with arguments require `args`; argumentless views reject it at the type level.

`view()` throws `ContractViewError` for a typed abort or execution fault. `viewOutcome()` returns a discriminated `return`, `abort`, or `fault` result:

```ts
const outcome = await Counter.get.viewOutcome({ client, contract, caller });
```

Transport and JSON-RPC errors pass through unchanged. Malformed return or abort data throws `ContractDecodeError` from both APIs.

### Decode a Root Receipt

```ts
const receiptResult = Counter.get.decodeReceipt(receipt);
const receiptOutcome = Counter.get.decodeReceiptOutcome(receipt);
```

`decodeReceipt()` returns the typed value with `txHash`, `height`, and `events`. It throws `ContractReceiptError` for an abort, execution failure, or missing return data from a non-void method. `decodeReceiptOutcome()` returns a discriminated `return`, `abort`, or `failure` result. Both can throw `ContractDecodeError` for malformed data.

These APIs require a receipt known to come from a transaction whose root invocation called that method. The descriptor cannot verify the root method identity.

For a DefaultWallet transaction, decode the root `DefaultWallet.execute` receipt first. It returns one raw return buffer per child call. Then use each child method's generated `decodeReturn()` method:

```ts
import { DefaultWallet } from "@groundhogchain/client/contracts";

const root = DefaultWallet.execute.decodeReceipt(receipt);
const childReturn = root.value[0];

if (!childReturn) {
  throw new Error("Expected one child return");
}

const childValue = Counter.get.decodeReturn(childReturn);
```

This deserialization is generated from the Rust contract specification. It is not necessary to construct an XDR reader or codec manually. The application selects the descriptor because it knows which child calls it submitted; the receipt does not contain enough TypeScript method identity for the client to choose one automatically.

## Generated Exceptions

Bindings generate a union for exceptions declared by the interface:

```ts
export type CounterDeclaredException = {
  kind: "declared";
  name: "CounterError";
  selector: 0xeb2cf72be75a4c62n;
  value: CounterError;
};
```

A declared exception contains:

- `kind: "declared"`
- Its selector
- Its typed decoded value
- Its declared name, which is `null` when the spec does not name the exception type

An unknown selector returns `{ kind: "unknown", selector, data }`, preserving the complete abort buffer.

`ContractViewError` and `ContractReceiptError` retain the typed failure outcome on their `outcome` property. `ContractDecodeError` identifies malformed contract data. Transport and JSON-RPC errors are not wrapped as contract errors.

## Generated Event Descriptors

Each declared event gets a descriptor for strict decoding, named filters, and receipt extraction:

```ts
const signature = ChangedEvent.signature;
const decoded = ChangedEvent.decode(event);

const filter = ChangedEvent.filter({
  contractAddresses: [contract],
  topics: { actor },
});

const matches = ChangedEvent.allFromReceipt(receipt, {
  contractAddress: contract,
});

const match = ChangedEvent.singleFromReceipt(receipt, {
  contractAddress: contract,
});
```

`signature` returns a defensive copy. `decode()` returns `null` when topic 0 has a different event signature. A matching signature is decoded strictly:

- The event must have the exact declared topic count, up to the protocol maximum of three topics including the signature.
- Every topic must contain exactly 32 bytes.
- Topics plus data must not exceed 1,024 bytes.
- The payload must contain no trailing bytes.

A malformed event with the matching signature throws `ContractDecodeError`.

Named topic filters are generated only for directly represented topics: addresses and fixed 32-byte values. Hashed topic preimages are not available as generated named filters.

Filters require one to five contract addresses. A named topic accepts one value or a non-empty `{ oneOf: [...] }` constraint containing at most 16 values.

`allFromReceipt()` returns every matching event emitted by the selected contract, in receipt order. Each match retains its emitting `contractAddress`. `singleFromReceipt()` requires exactly one match.

Module-level `decodeEvent()` decodes any event declared by that binding:

```ts
const event = decodeEvent(emittedEvent);
```

## Type Mapping

The TypeScript generator maps contract-spec types as follows:

| Contract type                            | TypeScript representation                          |
| ---------------------------------------- | -------------------------------------------------- |
| `Void`                                   | `void`                                             |
| `Bool`                                   | `boolean`                                          |
| Integer types, including bare `u8`       | `bigint`                                           |
| `String`                                 | `string`                                           |
| `Address`                                | `ContractAddress`                                  |
| `Bytes`, `Vec<u8>`                       | `Uint8Array`                                       |
| Other `Vec<T>`                           | `T[]`                                              |
| `[u8; N]`                                | `FixedBytes<N>`                                    |
| Other fixed arrays of length 0 through 3 | Exact readonly tuple                               |
| Other fixed arrays longer than 3         | `FixedArray<T, N>`                                 |
| Tuple                                    | Readonly tuple                                     |
| `Option<T>`                              | `T \| null`                                        |
| Named struct                             | Interface                                          |
| Enum                                     | Bigint const object and value-union type           |
| Union                                    | `{ case: "..."; value?: ... }` discriminated union |

Construct branded fixed-length values with the client contract helpers:

```ts
import { fixedArray, fixedBytes } from "@groundhogchain/client/contract";

const id = fixedBytes(rawBytes, 32);
const values = fixedArray(rawValues, 4);
```

Encoding and decoding enforce the declared lengths. `fixedBytes()` validates and brands the caller-owned mutable `Uint8Array` without copying it. `fixedArray()` returns a frozen copy.

`SignedToken` exists in the contract-spec schema but is not supported by the current TypeScript generator.

## Standard Contract Bindings

Client `0.4.0` ships `DefaultWallet`, `DevWallet`, `ERC20`, and `ERC20Metadata` bindings. The wallet bindings use interface `0.1.0`; the ERC-20 bindings use interface `0.1.9`:

```ts
import { ERC20 } from "@groundhogchain/client/contracts";

const balance = await ERC20.getBalanceOf.view({
  client,
  contract: token,
  args: { addr },
});

const transfer = ERC20.transfer.invocation(token, gasLimit, {
  receiver,
  amount,
});
```

The standard entrypoint also exports `ERC20Error`, `ERC20Spec`, `ERC20TransferEvent`, `ERC20ApprovalEvent`, and `decodeERC20Event`. Generated argument, result, exception, and filter types are available from the same subpath.

Wallet bindings expose the root methods used by wallet clients and explicit wallet operations:

```ts
import { DefaultWallet, DevWallet } from "@groundhogchain/client/contracts";

const defaultWalletResult = DefaultWallet.execute.decodeReceipt(defaultWalletReceipt);
const devWalletResult = DevWallet.doAction.decodeReceipt(devWalletReceipt);
```

`DefaultWalletSpec`, `DevWalletSpec`, and their generated argument, result, and exception types are exported from the same entrypoint. Pubkey accounts use DefaultWallet behavior automatically. Source-address accounts can use a deployed smart wallet such as DevWallet with `devWalletAdapter`.

Root receipt decoding does not inspect a nested application call. Decode the root with its wallet descriptor, then use typed views or event descriptors for the application-level result.

## Bindings vs SDK

Generated bindings sit on top of the client runtime:

| Need                                                      | Use                                                        |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| Connect to JSON-RPC                                       | [TypeScript SDK](/tools/typescript-sdk/)                   |
| Bind an account and execute an application invocation     | [TypeScript SDK](/tools/typescript-sdk/#bind-a-wallet-client) |
| Construct, sign, submit, and poll a low-level transaction | [TypeScript SDK](/tools/typescript-sdk/#low-level-signing) |
| Build a typed application invocation                      | Generated method descriptor                                |
| Decode a typed method return or exception                 | Generated method descriptor                                |
| Run a typed view or decode a root receipt                 | Generated method descriptor                                |
| Decode events, build filters, or extract receipt events   | Generated event descriptor                                 |

## Related Documentation

- [TypeScript SDK](/tools/typescript-sdk/) for the app-facing client package
- [Groundhog CLI](/tools/groundhog-cli/) for CLI codegen commands
- [Contract Spec](/reference/contract-spec/) for the canonical codegen input
- [Wallet Integration](/tools/wallet-integration/) for account, signer, and browser-wallet boundaries
- [JSON-RPC API](/reference/json-rpc-api/) for the underlying gateway surface
