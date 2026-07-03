---
title: TypeScript Bindings
description: Generating typed TypeScript bindings for Groundhog contracts via groundhog codegen.
---

TypeScript bindings are contract-specific files generated from a Groundhog contract spec. They give app code typed entrypoint helpers, contract types, event decoders, and interface metadata for one contract.

Use this page when you have a contract artifact or `.spec.xdr` file and want TypeScript code for that contract.

For the general JSON-RPC client, transports, signing, and package map, see [TypeScript SDK](/tools/typescript-sdk/).

## What Bindings Provide

Generated bindings turn a contract spec into TypeScript code:

- TypeScript types for structs, enums, and unions declared by the contract
- Entrypoint IDs and interface metadata
- Typed helpers that build invocations and encode calldata
- Event decoder helpers when the contract declares events

The generated file is specific to your contract. Re-run codegen after changing exported methods, events, errors, or contract types.

## Generate Bindings

Build the contract first:

```bash
groundhog build
```

For a crate named `my-contract`, the RV32 build writes:

```text
target/groundhog/my_contract.rv32a
target/groundhog/my_contract.spec.xdr
target/groundhog/my_contract.spec.json
```

Generate TypeScript from the canonical spec sidecar:

```bash
groundhog codegen ts \
  ./target/groundhog/my_contract.spec.xdr \
  -o ./web/src/contracts/my-contract.ts
```

You can also pass a `.wasm` file when you intentionally build the legacy WASM artifact with `groundhog build --target wasm`. The shortcut `groundhog build --target wasm --bindings ts` is WASM-only today. For the default RV32 path, run `groundhog codegen ts` against `.spec.xdr`.

See `groundhog codegen ts --help` for the full set of flags.

## What the Output Looks Like

For a counter contract, the generated file imports shared helpers and exposes contract-specific definitions. Abbreviated output:

```typescript
import type {
  ContractAddress,
  GasAmount,
  Invocation,
} from "@groundhogchain/protocol";
import { contractEntrypointID } from "@groundhogchain/protocol";
import { fromHex } from "@groundhogchain/protocol/utils";
import type { ContractSpec } from "@groundhogchain/client";
import { buildNamedCodecs, createInvocation, encodeCalldata } from "@groundhogchain/client";

const entrypoints = {
  Counter: {
    increment: contractEntrypointID(fromHex("...")),
  },
} as const;

export const spec: ContractSpec = {
  interfaces: [
    // Contract interface metadata from the spec.
  ],
  type_defs: [
    // Named structs, enums, and unions.
  ],
  events: [
    // Declared event specs.
  ],
};

const namedCodecs = buildNamedCodecs(spec.type_defs);

export const Counter = {
  increment(
    contract: ContractAddress,
    gasLimit: GasAmount,
    args: { amount: bigint },
  ): Invocation {
    return createInvocation({
      invoked_address: contract,
      entrypoint: entrypoints.Counter.increment,
      gas_limit: gasLimit,
      calldata: encodeCalldata(spec, "Counter", "increment", [args.amount], namedCodecs),
    });
  },
} as const;
```

The exact output depends on the contract spec. Generated helpers are grouped under exported interface objects such as `Counter` or `ERC20`, matching the traits/interfaces declared by the spec. Bindings import shared runtime types and codecs from packages such as `@groundhogchain/client`, `@groundhogchain/protocol`, `@groundhogchain/contract-spec`, and `@groundhogchain/xdr`.

## Type Mapping

The codegen maps Rust contract types to TypeScript as follows:

| Rust contract type | TypeScript type |
|--------------------|-----------------|
| `bool` | `boolean` |
| `u32`, `i32`, `u64`, `i64`, `u128`, `i128` | `bigint` |
| `String` | `string` |
| `Bytes`, `Vec<u8>`, `[u8; N]` | `Uint8Array` |
| `ContractAddress` | `ContractAddress` |
| `Option<T>` | `T \| null` |
| `Vec<T>` (non-`u8`) | `T[]` |
| `(A, B, ...)` | `[A, B, ...]` |
| Named struct | TypeScript interface |
| Named enum | TypeScript enum |
| Named union | Discriminated union |

`u8` is intentionally rejected as a bare type. It must appear inside `Vec`, `Bytes`, or an array so the generated TypeScript can use `Uint8Array`.

## Standard Contract Bindings

`@groundhogchain/client` also ships generated bindings for standard interfaces under the `./contracts` subpath. These are useful when your app talks to well-known contracts without generating local bindings first.

The ERC-20 binding includes helpers such as:

| Helper | Contract method | Notes |
|--------|-----------------|-------|
| `ERC20.getBalance(contract, gasLimit)` | `get_balance()` | Reads the balance of the view caller. |
| `ERC20.getBalanceOf(contract, gasLimit, { addr })` | `get_balance_of(addr)` | Reads an explicit address. Usually easiest for UI balance checks. |
| `ERC20.transfer(contract, gasLimit, { receiver, amount })` | `transfer(receiver, amount)` | Builds a token transfer invocation. |

Example ERC-20 balance invocation:

```typescript
import { gasAmount } from "@groundhogchain/protocol";
import { addressFromHex } from "@groundhogchain/client";
import { ERC20 } from "@groundhogchain/client/contracts";

const token = addressFromHex("0x<64-character-token-address>");
const addr = addressFromHex("0x<64-character-owner-address>");

const invocation = ERC20.getBalanceOf(token, gasAmount(500_000n), {
  addr,
});
```

Pass the resulting `invocation` to `client.view` for a read-only simulation, or wrap it in a transaction when you want to submit a state-changing call. The binding owns contract-specific entrypoint IDs and calldata encoding; the SDK owns transport, signing, and submission.

## Bindings vs SDK

Generated bindings do not replace the SDK. They sit on top of it.

| Need | Use |
|------|-----|
| Connect to JSON-RPC | [TypeScript SDK](/tools/typescript-sdk/) |
| Build a transaction and sign it | [TypeScript SDK](/tools/typescript-sdk/) |
| Build calldata for your contract method | Generated binding |
| Decode your contract event payload | Generated binding |
| Keep TypeScript code aligned with a contract spec | Generated binding |

Most apps use both: generated bindings produce invocations and decode contract-specific values; `@groundhogchain/client` sends views, transactions, and queries to the gateway.

## Related Documentation

- [TypeScript SDK](/tools/typescript-sdk/) for the app-facing client package
- [Groundhog CLI](/tools/groundhog-cli/) for the RV32 build, deploy, and codegen command map
- [Contract Spec](/reference/contract-spec/) for the format consumed by codegen
- [JSON-RPC API](/reference/json-rpc-api/) for the underlying gateway surface
- [Cross-Contract Calls](/reference/cross-contract-calls/) for the Rust client codegen story
