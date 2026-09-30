---
title: TypeScript SDK
description: Connect to Groundhog, read typed contract data, and execute and observe wallet transactions.
---

`@groundhogchain/client` provides RPC actions, accounts, wallet execution, and the runtime used by generated contract bindings.

This page shows individual operations. For a complete runnable app, follow
[Work with Groundhog from TypeScript](/tutorials/work-with-groundhog-from-typescript/).

## Install

Use Node.js 22.12.0 or newer. The packages are hosted on GitHub Packages; configure a token with `read:packages`:

```ini
@groundhogchain:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

This guide targets client 0.12.0 with CLI 0.19.0 codegen.

If using `gh auth token`, first grant that login package-read access once with
`gh auth refresh -h github.com -s read:packages`. A GitHub login that can read
repositories does not necessarily have permission to download packages.

Install the coordinated packages:

```bash
NODE_AUTH_TOKEN="$(gh auth token)" npm install \
  @groundhogchain/client@0.12.0 \
  @groundhogchain/protocol@0.12.0 \
  @groundhogchain/contract-spec@0.12.0
```

The CLI uses SDK 0.41.1 and standard interfaces 0.1.41. Its managed local node is 0.1.29-rc.4. These are component versions, not a new packaging-bundle version. Check [Devnet identity](/tutorials/develop-on-devnet/#2-configure-devnet-identity) before using a hosted endpoint.

## Connect to a Cluster

```ts
import { createGroundhogClient, devnet, toHex0x } from "@groundhogchain/client";

const client = await createGroundhogClient({ cluster: devnet() });
const [tip, version] = await Promise.all([client.getChainTip(), client.getVersion()]);
console.log(toHex0x(client.network.networkHash), tip.height, version.wireFormat);
console.log(version.releaseVersion, version.bundleManifestDigest);
```

Client creation is asynchronous. A cluster-aware client fetches `groundhog_networkInfo` and compares it with a configured hash pin. `devnet()` supplies an endpoint and airdrop capability but no hash pin. Use `devnet({ networkHash: expectedNetworkHash })` when you must reject a different network.

`localnet()` supplies the local endpoint and shared local hash; pair URL overrides with that node's runtime manifest. `mainnet()` has no default endpoint. `defineCluster()` creates a reusable custom descriptor. Declared cluster capabilities are expectations, not server capability discovery.

Release fields can be `null`. They identify an installation for diagnosis; use `wireFormat` for RPC compatibility. An unqualified client skips identity validation and needs an explicit `networkHash` when bound to a wallet:

```ts
import { HttpTransport } from "@groundhogchain/client";
const client = await createGroundhogClient({
  transport: new HttpTransport("https://rpc.example.com"),
});
```

## Exact Amounts and Common Types

Common types and constructors such as `ContractAddress`, `gasAmount`, hashes, and entrypoint IDs are exported by the client. Protocol-only symbols such as `HOG_ADDRESS`, `bitMap`, and `weight` remain in `@groundhogchain/protocol`.

```ts
import { parseUnits, formatUnits } from "@groundhogchain/client";

const amount = parseUnits("12.05", 2); // 1205n
console.log(formatUnits(amount, 2)); // "12.05"
```

Both functions accept 0–255 decimals and signed amounts. Parsing rejects whitespace, exponents, and excess precision without rounding. `ParseUnitsError.code` is `malformed` or `precision`; invalid decimal counts throw `RangeError`. Applications check positivity, ABI bounds, and display rounding separately. HOG uses seven decimal places.

## Choose an Account Model

- A **pubkey account** derives an address from a public key and nonce. It uses native-compatible DefaultWallet behavior without deploying a wallet.
- A **source-address account** is an existing smart-wallet contract. Local bootstrap accounts use DevWallet.

### Bind a Wallet Client

```ts
import { randomBytes } from "node:crypto";
import { PrivateKeySigner, createPubkeyAccount, createWalletClient } from "@groundhogchain/client";

const account = createPubkeyAccount({ signer: new PrivateKeySigner(randomBytes(32)) });
const wallet = createWalletClient({ client, account });
```

This example's key is ephemeral. Applications need appropriate secret storage. Wallet binding creates an independent object without changing the public client; multiple accounts can share that client.

## Fund and Execute a Call

```ts
import { gasAmount, parseUnits } from "@groundhogchain/client";
import { HOG_ADDRESS } from "@groundhogchain/protocol";
import { ERC20 } from "@groundhogchain/client/contracts";

const airdrop = await wallet.requestAirdrop();
if (airdrop.status.result !== "ok") throw new Error("Airdrop execution failed");

const invocation = ERC20.v0_1.transfer.invocation(HOG_ADDRESS, gasAmount(500_000n), {
  receiver, // an already funded recipient in this small-transfer example
  amount: parseUnits("0.0001", 7),
});
const { txHash, receipt } = await wallet.executeAndWait({
  invocation,
  gasLimit: gasAmount(1_000_000n),
});
console.log(txHash, receipt.gasUsed);
```

Gas is not burned, but declared root gas reserves scheduling capacity against the sender's free HOG. Storage deposits are separate and charged at the address that owns the data. These transfer budgets are workload-specific, not universal defaults. `gasUsed` reports consumed gas, not a token fee or unused-gas refund.

A sufficient first HOG credit can fund a new recipient's balance-item deposit. A small first credit can fail; a prior airdrop is not universally required. Deposit amounts depend on runtime configuration. See [Storage Economics](/how-it-works/storage-economics/).

`executeAndWait()` requires successful committed execution. `execute()` returns a submitted hash; `waitForTransactionReceipt()` only waits for a receipt, so inspect its execution result. `prepareExecution()` exposes the wrapped transaction before signing. Expiry defaults to 100 blocks after the tip and the transaction nonce is random. Explicit overrides remain available.

`requestAirdrop()` retains one idempotency nonce while polling pending attempts. Preserve `clientNonce` to recover across restarts; use `requestAirdropAttempt()` for application-controlled polling. A timeout does not prove the funding failed.

## Typed Calls and Observation Recovery

DefaultWallet preserves child return buffers. Retain their generated decoders with `call()`:

```ts
const call = ERC20.v0_1.transfer.call({
  contract: tokenAddress,
  gasLimit: gasAmount(500_000n),
  args: { receiver, amount: 1_000n },
});
const execution = await wallet.executeCallsAndWait({
  calls: [call],
  gasLimit: gasAmount(1_000_000n),
});
```

The returned `values` retain call order and types. `TransactionExecutionError` contains a failed committed receipt. `ExecutionDecodeError` contains a successful receipt whose return data could not be decoded. Neither warrants resubmission. DevWallet discards child returns, so use successful execution plus a view or events with that wallet.

If `TransactionObservationError` is thrown, keep its `txHash` and causes. Query that hash on the original network instead of automatically creating a replacement transaction. A receipt proves commitment, while its execution result determines success; `recentFailure` is advisory and `unknown` is inconclusive.

External-wallet helpers require an `onSigned` callback that durably saves signed evidence before broadcast. See [Wallet Integration](/tools/wallet-integration/) for that flow and the explicit prepare/sign/persist/submit path.

## Use a Local DevWallet

Use a client connected to the same local node as the account's runtime manifest:

```ts
import { bitMap, weight } from "@groundhogchain/protocol";
import { createSourceAddressAccount, createWalletClient, devWalletAdapter } from "@groundhogchain/client";
import { loadLocalDevAccount } from "@groundhogchain/client/local-dev";

const local = await loadLocalDevAccount();
const account = createSourceAddressAccount({
  address: local.address,
  signers: [{ signer: local.signer, publicKeyId: 0n }],
  allowedKeys: bitMap(0x01n),
  requiredWeight: weight(1n),
});
const wallet = createWalletClient({ client, account, invocationAdapter: devWalletAdapter });
```

The loader selects the first `local_user`, normally `dev-1`, from `GROUNDHOG_RUNTIME_MANIFEST` or active config. A Localnet URL override must identify the same node as the manifest. These deterministic keys are for local testing only.

### Deploy Through a Wallet

```ts
import { prepareContractDeployment } from "@groundhogchain/client";

const planned = prepareContractDeployment({ deployer: account.address, contract: artifact });
const deployed = await wallet.deployContractAndWait(planned, rootGas);
console.log(deployed.address, deployed.txHash);
```

`artifact` is the RV32 file's bytes or a protocol `Contract`. Preparation predicts the address without creating an expiring transaction. The wallet attaches code, executes its deploy method, waits for success, and verifies the returned address.

- **DefaultWallet** accepts `funding` and an optional `initializer` targeting the
  predicted address. These steps share one transaction; failure rolls them back.
  The initializer's caller is the wallet, and root gas must cover its execution.
- **Local DevWallet** transfers 10 HOG during deploy as wallet policy. It accepts
  neither option and requires a separate initialization call. That amount is not
  a universal storage price.

See the [deployment example](https://github.com/groundhogchain/client-ts/blob/v0.12.0/examples/deploy-counter.ts).

## Typed Views

```ts
import { getContract } from "@groundhogchain/client";
import { ERC20 } from "@groundhogchain/client/contracts";

const token = getContract({ binding: ERC20.v0_1, address: tokenAddress, client });
const balance = await token.getBalanceOf.view({ args: { addr: owner }, signal });
```

Views return `value`, `height`, and `events`. Independent views can use different committed snapshots or lag a recent receipt. `view()` throws `ContractViewError` on abort/fault; `viewOutcome()` returns `return`, `abort`, or `fault`. Malformed contract data throws `ContractDecodeError`.

For argument inspection and output decoding with a known method, see
[method descriptors](/tools/typescript-bindings/#method-descriptors).

## Cancellation and Read Errors

```ts
import { classifyReadError } from "@groundhogchain/client";

const controller = new AbortController();
const { signal } = controller;
try {
  await client.getBalance(owner, { signal });
} catch (error) {
  console.error(classifyReadError(error, { signal }), error);
}
// The application's cleanup handler calls controller.abort().
```

Actions take request options; generated/bound views take `signal` inside their options object. One cancellation does not cancel other reads. Canceling observation does not cancel on-chain execution.

Classification returns `transient`, `permanent`, `cancelled`, or `unknown` without replacing the original error. Pass the same signal to distinguish caller cancellation from timeout. A bare `TypeError` is not proof of a network error; custom transports should use `HttpRequestError`. Contract/decoding errors are not classified as infrastructure retries. Applications own retry budgets and preserve transaction-not-found handling specific to the operation.

## HTTP Batching

```ts
const client = await createGroundhogClient({
  transport: new HttpTransport("https://rpc.example.com", {
    batch: { maxSize: 100, waitMs: 0 },
    timeoutMs: 10_000,
  }),
});
const [tip, version] = await Promise.all([client.getChainTip(), client.getVersion()]);
```

Batching is off by default; `batch: true` uses the defaults shown. Concurrent
requests are grouped and split at `maxSize`.

- Responses match by ID, not array position. Per-call RPC errors stay separate;
  shared network, HTTP, or malformed-batch failures reject affected calls.
- Timeout covers the dispatched exchange, including its response body.
- Canceling one caller leaves neighbors running. Canceling all dispatched callers
  cancels shared network work.
- There is no automatic retry or deduplication, and no shared-state, execution-order,
  or atomicity guarantee. Await dependent calls separately.

The server's [array and byte limits](/reference/json-rpc-api/#json-rpc-arrays) still apply.

## Event Pages

```ts
import { groundhog_erc20_if } from "@groundhogchain/client/contracts";
const { TransferEvent } = groundhog_erc20_if.v0_1.events;
const page = await client.getContractEvents({
  event: TransferEvent,
  contractAddresses: [tokenAddress],
  topics: { to: owner },
  limit: 20,
}, { signal });
```

One request returns typed topics/fields, emitter, transaction hash, block height, event sequence number, cursor, and indexer bounds. `iterateEventPages(query, { signal })` yields raw pages on demand. It follows empty pages with continuation cursors, rejects repeated cursors, and propagates errors. It does not prefetch, retry, poll, subscribe, or persist.

An empty returned cursor ends one historical walk. New blocks require a new walk. Applications own checkpoints, deduplication, and retention checks; `latestBlock` is not proof of consumed history. Follow [Resume Without Missing Events](/tutorials/add-events-to-a-contract/#resume-without-missing-events).

## Receipt Decoding

`DefaultWallet.v0_1.execute.decodeReceiptOutcome(receipt)` decodes the known wallet
root. It returns typed `return`, `abort`, or `failure` outcomes. The throwing
`decodeReceipt` variant returns the root value, height, hash, and events on success.
Use retained child descriptors for ordered child return buffers. Root errors do
not identify a child ABI. See [manual receipt decoding](/tools/typescript-bindings/#execute-and-decode).

## Low-Level Signing

Custom signers can use `prepareTransaction`, `signTransaction`, and
`sendTransaction` directly. The signing helper signs a domain-separated,
network-bound preimage, not raw transaction bytes:

```ts
import { signTransaction } from "@groundhogchain/client/transaction";
const signed = await signTransaction(transaction, [{ signer, publicKeyId: 0n }], networkHash);
const txHash = await client.sendTransaction(signed);
```

The transaction hash identifies the inner transaction and differs from the
signature preimage and signed wrapper. Preserve the original hash for recovery.

## Public Entry Points

| Import | Use for |
| --- | --- |
| `@groundhogchain/client` | Clients, clusters, accounts, actions, amounts, common primitives, and helpers |
| `@groundhogchain/client/contracts` | Versioned standard contract and event descriptors |
| `@groundhogchain/client/contract` | Descriptor runtime, codecs, and fixed-length helpers |
| `@groundhogchain/client/transport` | HTTP/mock transports and infrastructure errors |
| `@groundhogchain/client/actions` | Standalone typed actions |
| `@groundhogchain/client/wallet` | Wallet execution and provider adapters |
| `@groundhogchain/client/provider` | Provider wire types, validation, and discovery |
| `@groundhogchain/client/local-dev` | Node-only local runtime account loading |
| `@groundhogchain/client/transaction` | Low-level construction, signing, and serialization |
| `@groundhogchain/client/signers` | Signer interface and private-key signer |
| `@groundhogchain/client/signed-op` | Network-bound off-chain signed operations |

## Maintained Examples

- [Chain and release identity](https://github.com/groundhogchain/client-ts/blob/v0.12.0/examples/chain-tip.ts)
- [HOG transfer](https://github.com/groundhogchain/client-ts/blob/v0.12.0/examples/transfer-hog.ts)
- [Local HOG view](https://github.com/groundhogchain/client-ts/blob/v0.12.0/examples/view-hog-balance.ts)
- [Counter deployment](https://github.com/groundhogchain/client-ts/blob/v0.12.0/examples/deploy-counter.ts)

For raw requests, see [JSON-RPC API](/reference/json-rpc-api/).
