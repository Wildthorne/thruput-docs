---
title: TypeScript SDK
description: Use @groundhogchain/client and related TypeScript packages with Groundhog JSON-RPC.
---

`@groundhogchain/client` wraps the Groundhog JSON-RPC gateway with typed actions, transports, transaction primitives, signer interfaces, and contract calldata helpers.

Use this page for current package setup and supported chain reads. For contract-specific invocation builders, see [TypeScript Bindings](/tools/typescript-bindings/).

:::caution[No current published client]
The published client `0.1.4` tag was generated against RPC `0.5.10` and lacks several APIs shown on this page. The current `client-ts` source has unreleased support for more of gateway `0.5.17`, but still lacks `getTransactionsByAddress` and the newer `recentFailure` transaction status. The examples below target the current source checkout, not published `0.1.4`. Use the CLI for production transaction submission until an aligned client release is published.
:::

## Install

Dependencies are hosted on GitHub Packages. Add the scope and a token with `read:packages` to your npm configuration:

```ini
@groundhogchain:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Clone and build the current client source:

```bash
gh auth refresh -h github.com -s read:packages
git clone https://github.com/groundhogchain/client-ts.git
cd client-ts
NODE_AUTH_TOKEN="$(gh auth token)" npm install
npm run build
```

Install that built checkout into your application, then add the direct dependencies used by generated bindings:

```bash
NODE_AUTH_TOKEN="$(gh auth token)" npm install \
  /path/to/client-ts \
  @groundhogchain/protocol@0.4.2 \
  @groundhogchain/contract-spec@0.4.2 \
  @groundhogchain/xdr@0.4.2
```

Generated bindings import `contract-spec` directly and import `xdr` when event decoders are present. Declare them in applications that compile generated files, especially with pnpm's strict dependency layout.

## Version Matrix

| Component | Version checked | Status |
|-----------|-----------------|--------|
| `@groundhogchain/client` | current `client-ts` source | Unreleased APIs used by this page; manifest still says `0.1.4` |
| Published `@groundhogchain/client` | `0.1.4` | Legacy API generated from RPC `0.5.10` |
| TypeScript protocol packages | `0.4.2` | Published binding dependencies |
| Groundhog gateway | `0.5.17`, wire `2.3.1` | Current Devnet surface |
| Rust SDK | `0.17.1` | Current contract template baseline |

## Minimal Client

```typescript
import { createGroundhogClient, HttpTransport } from "@groundhogchain/client";

const client = createGroundhogClient(
  new HttpTransport("http://127.0.0.1:9545"),
);

const tip = await client.getChainTip();
const version = await client.getVersion();
```

`HttpTransport` sends JSON-RPC 2.0 requests over HTTP. `MockTransport` provides deterministic in-memory responses for tests.

## Transport Options and Errors

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

## Supported Reads

The published convenience client supports:

- Chain tip and gateway version
- Native HOG balances
- Read-only contract views
- Transaction status and committed receipts, subject to the status compatibility warning above
- Event queries
- Raw committed storage reads

`getBlockByNumber` and `getPendingTransactionCount` exist on current `client-ts` main, but the gateway returns JSON-RPC error `-32052` for both. The gateway also exposes `groundhog_getTransactionsByAddress`, which current client source does not yet wrap.

Read a native HOG balance:

```typescript
import { addressFromHex } from "@groundhogchain/client";

const address = addressFromHex("0x<64-character-address>");
const balance = await client.getBalance(address);

console.log(balance.rawBalance);
```

`rawBalance` is a `bigint` in raw protocol units. Apply token-specific decimal formatting in display code.

## View Calls

Generated bindings build an `Invocation`. Convert its fields into the `ViewRequest` expected by the client:

```typescript
const invocation = Counter.get(contract, gasLimit);

const response = await client.view({
  contract: invocation.invoked_address,
  entrypoint: invocation.entrypoint,
  calldata: invocation.calldata,
  caller,
});

if (response.output.result !== "return") {
  throw new Error(`view failed: ${response.output.result}`);
}

const returnData = response.output.returnData;
```

`returnData` is raw CXS bytes. Current generated bindings build arguments and decode declared events, but they do not generate method return-value decoders.

## Transaction Model

A generated contract invocation is normally the **inner application invocation**. It is not usually the root invocation that should be signed and submitted.

For a wallet-backed account, the root invocation targets the user's wallet contract. The application invocation is encoded into the wallet's `do_action` call, then the transaction is authorized using the wallet's configured key. Wallet entrypoint IDs come from the active runtime manifest or hosted network descriptor and should not be hard-coded.

:::caution[No high-level wallet builder yet]
Current `client-ts` exposes low-level `createTransaction`, `signTransaction`, `PrivateKeySigner`, and `Signer` primitives, but it does not provide the descriptor-driven wallet transaction builder used by the current CLI. Do not pass a generated application invocation directly to `createTransaction` and assume it is wallet-authorized. Use `groundhog call` for supported transaction submission today.
:::

The transaction uniqueness key is the root invoked address plus the `(block_expiry_height, nonce)` pair. The nonce is a caller-chosen `u64`, not a sequential account nonce.

When reading a committed receipt through the SDK, use `execResult`, not the JSON wire field name `status`:

```typescript
import { ExecResult } from "@groundhogchain/protocol";

const receipt = await client.getTransactionReceipt(txHash);
if (receipt?.execResult === ExecResult.ExecResultOK) {
  console.log(receipt.returnData, receipt.events);
}
```

## SDK vs Bindings

| Use case | Tool |
|----------|------|
| Connect to JSON-RPC | `@groundhogchain/client` |
| Read tip, version, balances, storage, views, receipts, or events | `@groundhogchain/client` |
| Build calldata for a contract method | generated TypeScript binding |
| Decode a declared contract event | generated TypeScript binding |
| Decode method return bytes | contract-specific CXS codec code |
| Submit a wallet-backed transaction today | Groundhog CLI |

## Package Map

| Package | Source repository | Use for |
|---------|-------------------|---------|
| `@groundhogchain/client` | `groundhogchain/client-ts` | JSON-RPC client, transaction primitives, standard contract bindings |
| `@groundhogchain/protocol` | `groundhogchain/protocol-ts` | Core protocol types, branded byte types, and codecs |
| `@groundhogchain/contract-spec` | `groundhogchain/protocol-ts` | Contract spec AST types used by generated bindings |
| `@groundhogchain/xdr` | `groundhogchain/protocol-ts` | Low-level XDR and CXS readers, writers, and codecs |
| `@groundhogchain/gateway` | `groundhogchain/protocol-ts` | Gateway and indexer protocol types |
| `@groundhogchain/rpc` | `groundhogchain/protocol-ts` | Lower-level ONC-RPC and internal RPC types |

## Generate API Docs Locally

The repositories contain TypeDoc configuration, but no public TypeDoc deployment was available when this page was checked. Generate the references locally:

```bash
cd /path/to/client-ts
NODE_AUTH_TOKEN="$(gh auth token)" npm install
npm run docs
```

```bash
git clone https://github.com/groundhogchain/protocol-ts.git
cd protocol-ts
NODE_AUTH_TOKEN="$(gh auth token)" npm install
npm run docs
```

Use `npm run docs:check` to validate TypeDoc without writing output.

## Related Documentation

- [TypeScript Bindings](/tools/typescript-bindings/) for generated contract-specific bindings
- [Wallet Integration](/tools/wallet-integration/) for the current signer and browser-wallet support boundary
- [Groundhog CLI](/tools/groundhog-cli/) for supported transaction submission
- [JSON-RPC API](/reference/json-rpc-api/) for the current gateway method surface
