---
title: TypeScript Bindings
description: Generating typed TypeScript bindings for Groundhog contracts via `groundhog codegen`.
---

:::caution[Early Access]
The TypeScript packages are available during early access through the private `@groundhogchain/*` registry. Published API docs are not online yet. Use the emitted `.d.ts` files and package source as the current API reference.
:::

:::note[Version checked]
This page was last checked against Groundhog CLI `0.5.10`, SDK `0.15.4`, `@groundhogchain/client` `0.1.4`, and `protocol-ts` packages `0.4.1` on June 26, 2026.
:::

## Overview

The Groundhog CLI emits TypeScript bindings from a contract [spec](/reference/contract-spec/). The normal RV32 path is:

1. Build the contract with `groundhog build`.
2. Generate bindings from `target/groundhog/<name>.spec.xdr`.
3. Use the generated file with the `@groundhogchain/*` TypeScript packages.

The generated module gives you:

- TypeScript types for every struct, enum, and union declared by the contract
- Entrypoint IDs and interface metadata
- Typed helpers that build invocations and encode calldata
- Event decoder helpers when the contract declares events

The output is contract-specific code. It imports shared runtime types and codecs from `@groundhogchain/protocol`, `@groundhogchain/contract-spec`, `@groundhogchain/client`, and `@groundhogchain/xdr`.

## Standard Contract Bindings

`@groundhogchain/client` also ships generated bindings for standard interfaces under the `./contracts` subpath. The ERC-20 binding includes helpers such as:

| Helper | Contract method | Notes |
|--------|-----------------|-------|
| `ERC20.getBalance(contract, gasLimit)` | `get_balance()` | Reads the balance of the view caller. |
| `ERC20.getBalanceOf(contract, gasLimit, { owner })` | `get_balance_of(owner)` | Reads an explicit address. Usually easiest for UI balance checks. |
| `ERC20.transfer(contract, gasLimit, { receiver, amount })` | `transfer(receiver, amount)` | Builds a token transfer invocation. |

Example local HOG balance view:

```typescript
import { CxsReader, Uint128Codec, gasAmount } from "@groundhogchain/protocol";
import {
  HttpTransport,
  addressFromHex,
  createGroundhogClient,
} from "@groundhogchain/client";
import { ERC20 } from "@groundhogchain/client/contracts";

const client = createGroundhogClient(
  new HttpTransport("http://127.0.0.1:9545"),
);

const hogToken = addressFromHex(
  "0x0000000000000000000000000000000000000000000000000000000000000001",
);
const owner = addressFromHex(
  "0x7171717171717171717171717171717171717171717171717171717171717171",
);

const invocation = ERC20.getBalanceOf(hogToken, gasAmount(500_000n), {
  owner,
});

const response = await client.view({
  contract: invocation.invoked_address,
  entrypoint: invocation.entrypoint,
  calldata: invocation.calldata,
  caller: owner,
});

if (response.output.result !== "return") {
  throw new Error(`balance view failed: ${response.output.result}`);
}

const reader = new CxsReader(response.output.returnData);
const balance = Uint128Codec.decode(reader);
```

For `getBalance`, set `caller` on the `view` request to the account whose balance you want. `getBalanceOf` avoids that coupling by taking `owner` as an argument.

## Install Runtime Packages

Configure the private registry, then install the packages used by generated bindings and common app code:

```bash
npm config set @groundhogchain:registry https://npm.pkg.github.com
GH_NPM_TOKEN="$(gh auth token)" npm install \
  @groundhogchain/client \
  @groundhogchain/protocol \
  @groundhogchain/contract-spec \
  @groundhogchain/xdr
```

Your onboarding instructions may provide a different token flow. The important part is that `@groundhogchain/*` resolves through the private registry.

## Package Map

The TypeScript packages come from two repos:

| Package | Source repo | Use for |
|---------|-------------|---------|
| `@groundhogchain/client` | `client-ts` | JSON-RPC client, transaction helpers, generated standard contract bindings |
| `@groundhogchain/protocol` | `protocol-ts` | Core protocol types, branded byte types, codecs, `gasAmount`, `contractEntrypointID`, and the `./utils` subpath |
| `@groundhogchain/contract-spec` | `protocol-ts` | Contract spec AST types used by generated bindings |
| `@groundhogchain/xdr` | `protocol-ts` | Low-level XDR/CXS readers, writers, and codecs |
| `@groundhogchain/gateway` | `protocol-ts` | Gateway/indexer protocol types |
| `@groundhogchain/rpc` | `protocol-ts` | Lower-level ONC-RPC client and internal RPC type definitions |

Most app code should start with `@groundhogchain/client`. Use `@groundhogchain/rpc` only when you specifically need the lower-level internal RPC surface rather than the JSON-RPC gateway.

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

You can also pass a `.wasm` file when you intentionally build the legacy WASM artifact with `groundhog build --target wasm`. The shortcut `groundhog build --target wasm --bindings ts` is WASM-only today. For the RV32 path, run `groundhog codegen ts` against `.spec.xdr`.

See `groundhog codegen ts --help` for the full set of flags.

## What the Output Looks Like

For a counter contract, the generated file imports shared helpers and exposes contract-specific definitions:

```typescript
import type { ContractAddress, GasAmount, Invocation } from "@groundhogchain/protocol";
import { encodeCalldata, createInvocation } from "@groundhogchain/client";

export const spec = {
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

export function increment(
  contract: ContractAddress,
  amount: bigint,
  gasLimit?: GasAmount,
): Invocation {
  // builds an invocation for the contract entrypoint
}
```

The exact shape depends on the contract spec. Re-run `groundhog codegen ts` after changing exported methods, events, or contract types.

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

## When You'd Use This

- A web frontend that calls a contract you control.
- A Node.js script that signs and submits transactions.
- An indexer or backend service that wants typed event decoding.

For pure read access without generated bindings, see the [JSON-RPC API](/reference/json-rpc-api/) reference.

## Related Documentation

- [Groundhog CLI](/tools/groundhog-cli/) for the RV32 build, deploy, and codegen command map
- [Contract Spec](/reference/contract-spec/) for the format consumed by codegen
- [JSON-RPC API](/reference/json-rpc-api/) for the underlying gateway surface
- [Cross-Contract Calls](/reference/cross-contract-calls/) for the Rust client codegen story
- [Getting Started](/start/getting-started/) for the RV32 CLI workflow
