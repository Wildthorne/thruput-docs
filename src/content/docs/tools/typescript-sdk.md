---
title: TypeScript SDK
description: Using @groundhogchain/client and related TypeScript packages with Groundhog JSON-RPC.
---

`@groundhogchain/client` is the TypeScript SDK for apps that interact with Groundhog. It wraps the JSON-RPC gateway with typed actions, transports, transaction helpers, signer interfaces, and contract calldata helpers.

Use this page when you are building a web app, script, wallet integration, indexer, or test harness that interacts with a Groundhog JSON-RPC endpoint.

For contract-specific generated files from `groundhog codegen ts`, see [TypeScript Bindings](/tools/typescript-bindings/).

:::note[Generated API references]
Generated TypeDoc API references are published from the TypeScript source repos. Use them for exact API signatures.

- Client API reference: `https://groundhogchain.github.io/groundhog-client-ts/`
- Protocol packages API reference: `https://groundhogchain.github.io/groundhog-protocol-ts/`
:::

## Install

Install the client package in your app:

```bash
npm install @groundhogchain/client @groundhogchain/protocol
```

`@groundhogchain/protocol` provides lower-level protocol helpers used by transaction code, generated bindings, and examples in this page.

## Minimal Client

Create a client by binding the SDK to an HTTP JSON-RPC transport:

```typescript
import { createGroundhogClient, HttpTransport } from "@groundhogchain/client";

const client = createGroundhogClient(
  new HttpTransport("http://127.0.0.1:9545"),
);

const tip = await client.getChainTip();
const version = await client.getVersion();
```

`HttpTransport` sends JSON-RPC 2.0 requests over HTTP. For tests, use `MockTransport` to get deterministic in-memory responses without running a node.

## Transport Options and Errors

`HttpTransport` supports request timeouts, custom headers, and a custom `fetch` implementation for tests or non-standard runtimes:

```typescript
import { HttpTransport, JsonRpcError } from "@groundhogchain/client";

const transport = new HttpTransport("http://127.0.0.1:9545", {
  timeoutMs: 10_000,
  headers: { Authorization: "Bearer <token>" },
});

try {
  const tip = await transport.request("groundhog_chainTip");
  console.log(tip);
} catch (error) {
  if (error instanceof JsonRpcError) {
    console.error(error.code, error.method, error.message);
  }
}
```

JSON-RPC error responses throw `JsonRpcError`. HTTP failures, timeouts, and malformed responses throw other exceptions.

## What the Client Provides

| Area | What it provides |
|------|------------------|
| Client | `createGroundhogClient`, a typed wrapper around Groundhog JSON-RPC actions |
| Transport | `HttpTransport`, `MockTransport`, and the `Transport` interface |
| Actions | Typed JSON-RPC actions for chain, blocks, balance, events, storage, views, and transactions |
| Transactions | Helpers to create invocations, create transactions, serialize, deserialize, and sign |
| Signers | `Signer` interface and `PrivateKeySigner` for Ed25519 signing |
| Contracts | Calldata encoding and decoding helpers for contract specs |
| Standard bindings | Generated helpers for standard interfaces under `@groundhogchain/client/contracts` |

Most app code should start with `createGroundhogClient`. Lower-level exports are available when you are building custom tooling or integrating the SDK into another client abstraction.

## Common Reads

```typescript
const tip = await client.getChainTip();
const version = await client.getVersion();
```

Read the native HOG balance for an address:

```typescript
import { addressFromHex } from "@groundhogchain/client";

const address = addressFromHex("0x<64-character-address>");
const balance = await client.getBalance(address);

console.log(balance.rawBalance);
```

`rawBalance` is a `bigint` in raw protocol units. Display code should apply token-specific decimal formatting separately.

## View Calls

Use `view` for read-only contract simulation. It does not submit a transaction.

```typescript
const response = await client.view({
  contract: invocation.invoked_address,
  entrypoint: invocation.entrypoint,
  calldata: invocation.calldata,
  caller,
});

if (response.output.result !== "return") {
  throw new Error(`view failed: ${response.output.result}`);
}
```

Generated bindings are the usual way to build the `invocation` object for a contract method. See [TypeScript Bindings](/tools/typescript-bindings/).

## Transactions

Transactions follow a build, sign, submit flow:

1. Build an `Invocation` for the contract entrypoint.
2. Wrap it in a `Transaction` with authorization and uniqueness metadata.
3. Sign the transaction.
4. Submit it through `client.sendTransaction`.

Generated bindings usually build the invocation for you. The SDK provides the transaction and signing helpers:

```typescript
import {
  createTransaction,
  PrivateKeySigner,
  signTransaction,
} from "@groundhogchain/client";
import { blockHeight } from "@groundhogchain/protocol";

const tip = await client.getChainTip();

const uniquifier = {
  block_expiry_height: blockHeight(tip.height + 100n),
  nonce: BigInt(Date.now()),
};

const tx = createTransaction({
  invocation,
  uniquifier,
  contracts_to_deploy: [],
  auth_claim,
});

const signer = new PrivateKeySigner(secretKey);
const signedTx = await signTransaction(tx, [
  { signer, publicKeyId: 0n },
]);

const txHash = await client.sendTransaction(signedTx);
```

The `uniquifier` gives the transaction a nonce and an expiry height. Use a future block height for `block_expiry_height`, usually the current chain tip plus a safety margin. Use any `u64` nonce value that will not collide with another unexpired transaction from the same address. The nonce is not a sequential account nonce.

Use `client.getTransactionStatus(txHash)` for lightweight polling, or `client.getTransactionReceipt(txHash)` when you need execution status, return data, and emitted events:

```typescript
const status = await client.getTransactionStatus(txHash);

if (status.status === "committed") {
  const receipt = await client.getTransactionReceipt(txHash);
  console.log(receipt?.status, receipt?.events);
}
```

## SDK vs Bindings

The SDK is chain-level infrastructure. Generated bindings are contract-level adapters.

| Use case | Tool |
|----------|------|
| Connect to a JSON-RPC endpoint | `@groundhogchain/client` |
| Read chain tip, version, block data, balance, storage, or events | `@groundhogchain/client` |
| Submit a signed transaction | `@groundhogchain/client` |
| Encode a specific contract method call | generated TypeScript binding |
| Decode a contract return value or event | generated TypeScript binding |
| Keep app code aligned with a contract spec | generated TypeScript binding |

Most apps use both: the SDK owns transport, signing, and chain interaction; bindings own contract-specific types, entrypoint IDs, and calldata.

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

Most application code should start with `@groundhogchain/client`. Use protocol packages when you need lower-level serialization, branded protocol values, generated binding dependencies, or gateway/indexer protocol types.

## Generate API Docs Locally

You can also generate the TypeDoc reference locally from the source repos:

```bash
cd ~/Work/groundhog-client-ts
npm run docs
```

```bash
cd ~/Work/groundhog-protocol-ts
npm run docs
```

Use `npm run docs:check` in either repo to validate TypeDoc without writing output.

## Related Documentation

- [TypeScript Bindings](/tools/typescript-bindings/) for generated contract-specific bindings
- [Groundhog CLI](/tools/groundhog-cli/) for build, deploy, local-node, and codegen commands
- [JSON-RPC API](/reference/json-rpc-api/) for the gateway method surface
- [Contract Spec](/reference/contract-spec/) for the format consumed by generated bindings
