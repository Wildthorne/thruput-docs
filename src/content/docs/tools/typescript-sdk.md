---
title: TypeScript SDK
description: Use @groundhogchain/client and related TypeScript packages with Groundhog JSON-RPC.
---

`@groundhogchain/client` provides typed JSON-RPC actions, transaction construction and signing, contract helpers, transports, and generated standard contract bindings.

Use this page for client setup, typed views, receipts, transactions, and deployment. For contract-specific generated APIs, see [TypeScript Bindings](/tools/typescript-bindings/).

:::note[Version checked]
This page was source-checked against `@groundhogchain/client` `0.2.0`, protocol packages `0.7.1`, Groundhog CLI `0.9.6`, and the current source repositories on August 20, 2026. The client's pinned OpenRPC file reports wire `2.3.1`, while the current Rust gateway advertises wire `3.0.0`.
:::

## Install

Packages are hosted on GitHub Packages. Add the scope and a token with `read:packages` to your npm configuration:

```ini
@groundhogchain:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

The client requires Node.js `22.12.0` or newer. Install the client and the direct dependencies used by generated bindings:

```bash
NODE_AUTH_TOKEN="$(gh auth token)" npm install \
  @groundhogchain/client@0.2.0 \
  @groundhogchain/protocol@0.7.1 \
  @groundhogchain/contract-spec@0.7.1
```

## Version Matrix

| Component                    | Version checked | Status                                             |
| ---------------------------- | --------------- | -------------------------------------------------- |
| `@groundhogchain/client`     | `0.2.0`         | Typed method and event descriptor runtime          |
| TypeScript protocol packages | `0.7.1`         | Coordinated generated-binding dependencies         |
| Groundhog CLI codegen        | `0.9.6`         | Generated TypeScript binding shape                 |
| Rust gateway                 | wire `3.0.0`    | Current gateway source                             |
| Client's pinned OpenRPC      | wire `2.3.1`    | Not synchronized with the current gateway document |

## Create a Client

```ts
import { createGroundhogClient, HttpTransport } from "@groundhogchain/client";

const client = createGroundhogClient(
  new HttpTransport("http://127.0.0.1:9545"),
);

const tip = await client.getChainTip();
const version = await client.getVersion();
```

`GroundhogClient` binds the supported actions to one transport. `HttpTransport` sends JSON-RPC requests over HTTP. `MockTransport` provides deterministic responses for tests.

## Transport Options and Errors

```ts
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

JSON-RPC error responses throw `JsonRpcError`. HTTP failures, timeouts, invalid JSON, and malformed response envelopes throw other exceptions. Typed actions also validate the result shape they consume.

## Supported Reads

The current gateway-backed client supports:

- Chain tip and gateway version queries
- Native HOG balances
- Read-only contract views
- Transaction status, committed receipts, and receipt polling
- Event queries
- Transaction history by root invocation address
- Raw committed storage reads

`getBlockByNumber` and `getPendingTransactionCount` exist in client `0.2.0`, but the current gateway returns JSON-RPC error `-32052` for both.

Read a native HOG balance:

```ts
import { addressFromHex } from "@groundhogchain/client";

const address = addressFromHex("0x<64-character-address>");
const balance = await client.getBalance(address);

console.log(balance.rawBalance);
```

`rawBalance` is a `bigint` in raw protocol units. Apply token-specific decimal formatting in display code.

## Typed Views

Generated method descriptors call `client.view()` and decode the method return value:

```ts
const result = await Counter.get.view({
  client,
  contract,
  caller,
});

console.log(result.value, result.height, result.events);
```

Methods with arguments take a generated `args` object. Generated names use camelCase even when the contract ABI uses snake_case:

```ts
import { ERC20 } from "@groundhogchain/client/contracts";

await ERC20.getBalanceOf.view({
  client,
  contract: token,
  caller,
  args: { addr: caller },
});
```

`view()` throws `ContractViewError` when the contract aborts or faults. Use `viewOutcome()` when the application needs to handle those outcomes directly:

```ts
const outcome = await Counter.get.viewOutcome({ client, contract, caller });

switch (outcome.kind) {
  case "return":
    console.log(outcome.value);
    break;
  case "abort":
    console.error(outcome.exception);
    break;
  case "fault":
    console.error("Contract execution faulted");
}
```

Transport and JSON-RPC errors pass through unchanged. Malformed return or abort data throws `ContractDecodeError` from both view APIs.

## Transaction Model

Generated descriptors build application invocations:

```ts
const invocation = Counter.increment.invocation(contract, gasLimit, {
  amount: 1n,
});
```

The client package exports standalone `createTransaction()` and `signTransaction()` helpers. `GroundhogClient` submits signed transactions and polls their status or receipt.

:::caution[Application invocations are not wallet roots]
A generated application invocation is normally an inner invocation. For a wallet-backed account, the transaction root targets the wallet contract, which authorizes and invokes the application contract. The package does not discover network wallet interfaces or construct that wallet-root invocation automatically. Do not submit an inner application invocation as the root unless that application contract is intentionally the authorization root.
:::

The transaction uniqueness key is the root invoked address plus `(block_expiry_height, nonce)`. The nonce is a caller-chosen `u64`, not a sequential account nonce.

See [Wallet Integration](/tools/wallet-integration/) for the signer and wallet-root boundary.

## Root Receipt Decoding

Wait for a committed receipt, then decode the root method result:

```ts
const receipt = await client.waitForTransactionReceipt(txHash);
const result = Counter.get.decodeReceipt(receipt);

console.log(result.value, result.txHash, result.height, result.events);
```

`decodeReceipt()` returns the typed value and receipt metadata. It throws `ContractReceiptError` for an abort, execution failure, or missing return data from a non-void method. A successful void method may have no return data.

Use `decodeReceiptOutcome()` to handle a discriminated `return`, `abort`, or `failure` result instead of `ContractReceiptError`:

```ts
const outcome = Counter.get.decodeReceiptOutcome(receipt);

if (outcome.kind === "return") {
  console.log(outcome.value);
}
```

Both receipt APIs can throw `ContractDecodeError` for malformed return or abort data.

The caller must know that the receipt came from a transaction whose root invocation called that method. A receipt does not carry enough method identity for the descriptor to verify this. The decoder does not search nested application invocations inside a wallet call.

## Contract Deployment

The local DevWallet exposes a generated `deploy` method. Given a protocol `Contract`, wallet address, signer, authorization claim, and transaction uniquifier:

```ts
import { randomBytes } from "node:crypto";
import {
  createTransaction,
  deriveContractAddress,
  fixedBytes,
  hashContract,
  signTransaction,
} from "@groundhogchain/client";
import { gasAmount, sha256Hash } from "@groundhogchain/protocol";
import { DevWallet } from "./contracts/dev-wallet";

const deploymentNonce = sha256Hash(randomBytes(32));
const contractHash = hashContract(contract);
const contractAddress = deriveContractAddress(
  wallet,
  deploymentNonce,
  contractHash,
);

const deployInvocation = DevWallet.deploy.invocation(
  wallet,
  gasAmount(10_000_000n),
  {
    nonce: fixedBytes(deploymentNonce, 32),
    contractHash: fixedBytes(contractHash, 32),
  },
);

const transaction = createTransaction({
  invocation: deployInvocation,
  uniquifier,
  contracts_to_deploy: [contract],
  auth_claim: sourceAuthClaim,
});

const signed = await signTransaction(transaction, [
  { signer, publicKeyId: 0n },
]);
const txHash = await client.sendTransaction(signed);
const result = DevWallet.deploy.decodeReceipt(
  await client.waitForTransactionReceipt(txHash),
);

console.log(result.value, contractAddress);
```

`contracts_to_deploy` makes the code available to the transaction. The `DevWallet.deploy` root invocation performs the deployment. Its decoded receipt returns the deployed address.

The deployment nonce derives the contract address. It is separate from the transaction uniquifier's replay-protection nonce. `hashContract()` hashes the complete protocol `Contract`, not only its payload bytes.

`DevWallet` and its funding policy are local-node-specific. See the maintained [contract deployment guide](https://github.com/groundhogchain/client-ts/blob/main/docs/contract-deployment.md) and [Counter deployment example](https://github.com/groundhogchain/client-ts/blob/main/examples/deploy-counter.ts) for setup and a complete runnable flow.

## SDK vs Bindings

| Use case                                                          | Owner                             |
| ----------------------------------------------------------------- | --------------------------------- |
| Connect to JSON-RPC and run chain queries                         | `@groundhogchain/client`          |
| Construct and sign low-level transactions                         | Client transaction helpers        |
| Submit transactions and poll receipts                             | `GroundhogClient`                 |
| Build a contract application invocation                           | Generated method descriptor       |
| Decode method returns and declared exceptions                     | Generated method descriptor       |
| Run typed views and decode root receipts                          | Generated method descriptor       |
| Decode events, build named filters, and extract receipt events    | Generated event descriptor        |
| Discover a network wallet interface and build its root invocation | Application or wallet integration |

## Public Entry Points

| Import                               | Use for                                                       |
| ------------------------------------ | ------------------------------------------------------------- |
| `@groundhogchain/client`             | Common client, action, transaction, signer, and contract APIs |
| `@groundhogchain/client/transaction` | Transaction construction, serialization, and signing          |
| `@groundhogchain/client/transport`   | HTTP and mock transports                                      |
| `@groundhogchain/client/contract`    | Contract descriptor runtime and fixed-length helpers          |
| `@groundhogchain/client/contracts`   | Generated standard contract bindings                          |
| `@groundhogchain/client/signers`     | Signer interface and private-key signer                       |
| `@groundhogchain/client/actions`     | Standalone typed actions                                      |

## Maintained Examples

The client repository maintains examples for:

- [Chain tip](https://github.com/groundhogchain/client-ts/blob/main/examples/chain-tip.ts)
- [HOG balance views](https://github.com/groundhogchain/client-ts/blob/main/examples/view-hog-balance.ts)
- [HOG transfer](https://github.com/groundhogchain/client-ts/blob/main/examples/transfer-hog.ts)
- [Counter deployment](https://github.com/groundhogchain/client-ts/blob/main/examples/deploy-counter.ts)

The maintained example workflow expects a local node. Transfer and deployment also use the local DevWallet interface and bootstrap account material.

## Related Documentation

- [TypeScript Bindings](/tools/typescript-bindings/) for generated method and event descriptors
- [Wallet Integration](/tools/wallet-integration/) for signer and wallet-root integration boundaries
- [Groundhog CLI](/tools/groundhog-cli/) for supported build, deployment, and codegen workflows
- [JSON-RPC API](/reference/json-rpc-api/) for the underlying gateway methods
