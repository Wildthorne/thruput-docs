---
title: TypeScript SDK
description: Connect to Groundhog, manage accounts, and execute typed contract calls with TypeScript.
---

`@groundhogchain/client` connects to JSON-RPC, performs a network identity handshake, manages wallet accounts, and executes invocations built by generated contract bindings.

:::note[Version checked]
This page was source-checked against published `@groundhogchain/client` `0.4.0` and `@groundhogchain/protocol` packages `0.8.0` on August 26, 2026. The public client types structurally align with RPC wire `4.0.0`.
:::

## Install

The packages require Node.js `22.12.0` or newer and are hosted on GitHub Packages. Add the registry and a token with `read:packages` to your npm configuration:

```ini
@groundhogchain:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Install the coordinated package set:

```bash
NODE_AUTH_TOKEN="$(gh auth token)" npm install \
  @groundhogchain/client@0.4.0 \
  @groundhogchain/protocol@0.8.0 \
  @groundhogchain/contract-spec@0.8.0
```

## Connect to a Cluster

Client creation is asynchronous. A cluster-aware client calls `groundhog_networkInfo` before it returns:

```ts
import { createGroundhogClient, devnet, toHex0x } from "@groundhogchain/client";

const client = await createGroundhogClient({
  cluster: devnet(),
});

const [network, tip, version] = await Promise.all([
  client.getNetworkInfo(),
  client.getChainTip(),
  client.getVersion(),
]);

console.log(toHex0x(network.networkHash), tip.height, version.wireFormat);
```

The predefined helpers are `mainnet()`, `devnet()`, and `localnet()`. Use `defineCluster()` for a reusable custom cluster. `devnet()` supplies a default endpoint and declares airdrop support, but it does not pin a network hash. It completes the identity handshake and uses the identity returned by that endpoint for signing.

Pin the identity when the application must reject an endpoint for a different network:

```ts
const client = await createGroundhogClient({
  cluster: devnet({ networkHash: expectedNetworkHash }),
});
```

`localnet()` has a default endpoint and the shared local network hash. Separate local runtimes can use that same hash, so an RPC URL override alone does not identify one runtime. Pair it with the runtime manifest for that node.

Cluster capabilities are declared expectations. They are not server capability discovery. An unqualified client skips the connection-time identity comparison and requires an explicit network hash when bound to a wallet:

```ts
import { createGroundhogClient, HttpTransport } from "@groundhogchain/client";

const client = await createGroundhogClient({
  transport: new HttpTransport("https://rpc.example.com"),
});
```

## Choose an Account Model

Groundhog supports two account models:

- A **pubkey account** derives its address from one public key and a nonce. It can sign transactions immediately and uses the network's DefaultWallet behavior without deploying a wallet contract.
- A **source-address account** is an existing smart-wallet contract at its source address. Its contract defines how application invocations are wrapped and authorized. DevWallet is the smart wallet used by local development accounts.

Create an ephemeral pubkey account:

```ts
import { randomBytes } from "node:crypto";
import { PrivateKeySigner, createPubkeyAccount } from "@groundhogchain/client";

const account = createPubkeyAccount({
  signer: new PrivateKeySigner(randomBytes(32)),
});
```

Persist keys through an application-appropriate secret store. Do not print or commit them.

## Bind a Wallet Client

`createWalletClient()` binds the account, its signers, the signing network, and the wallet invocation adapter to one client instance. A cluster-aware client supplies the network identity learned during its handshake. When the cluster has a network hash pin, client creation compares the two before returning. Pubkey accounts receive `defaultWalletAdapter` automatically:

```ts
import { createWalletClient } from "@groundhogchain/client";

const wallet = createWalletClient({ client, account });
```

Each client instance can be bound once because wallet actions close over account-specific state. Create another client instance for another account.

## Fund and Execute a Call

Development clusters expose a typed airdrop action. The wallet form defaults the recipient to its bound account:

```ts
const airdrop = await wallet.requestAirdrop();

if (airdrop.status.result !== "ok") {
  throw new Error(`Airdrop execution failed: ${airdrop.status.result}`);
}
```

`requestAirdrop()` generates an idempotency nonce, retries pending attempts, and waits for commitment. Commitment does not imply successful execution, so inspect `status.result`. A timeout or cancellation stops polling but does not prove that the transfer failed. Use `requestAirdropAttempt()` to persist the 1-to-32-byte nonce or control polling yourself.

Generated bindings build typed application invocations. Execute the invocation through the bound wallet adapter:

```ts
import { HOG_ADDRESS, gasAmount } from "@groundhogchain/protocol";
import { DefaultWallet, ERC20 } from "@groundhogchain/client/contracts";

const receiver = createPubkeyAccount({
  signer: new PrivateKeySigner(randomBytes(32)),
}).address;
const receiverAirdrop = await client.requestAirdrop({ recipient: receiver });
if (receiverAirdrop.status.result !== "ok") {
  throw new Error(`Receiver airdrop failed: ${receiverAirdrop.status.result}`);
}
const transfer = ERC20.transfer.invocation(HOG_ADDRESS, gasAmount(500_000n), {
  receiver,
  amount: 1_000n,
});

const transferTxHash = await wallet.execute({
  invocation: transfer,
  gasLimit: gasAmount(10_000_000n),
});
```

`execute()` prepares a fresh transaction, wraps the application invocation through DefaultWallet, signs for the connected network, and submits it. Use `prepareExecution()` to inspect the wrapped transaction before signing. Both accept `nonce`, `blockExpiryHeight`, `expiryBlocks`, and `contractsToDeploy` overrides.

Without overrides, `prepareTransaction()` uses a cryptographically random unsigned 64-bit nonce and expires 100 blocks after the current chain tip. Pass either `blockExpiryHeight` or `expiryBlocks`, not both.

## Use a Local DevWallet

Node.js applications can load an account created by `groundhog node`:

```ts
import { bitMap, weight } from "@groundhogchain/protocol";
import {
  createGroundhogClient,
  createSourceAddressAccount,
  createWalletClient,
  devWalletAdapter,
  localnet,
} from "@groundhogchain/client";
import { loadLocalDevAccount } from "@groundhogchain/client/local-dev";

const local = await loadLocalDevAccount();
const client = await createGroundhogClient({
  cluster: localnet({ networkHash: local.networkHash }),
});
const account = createSourceAddressAccount({
  address: local.address,
  signers: [{ signer: local.signer, publicKeyId: 0n }],
  allowedKeys: bitMap(0x01n),
  requiredWeight: weight(1n),
});
const wallet = createWalletClient({
  client,
  account,
  invocationAdapter: devWalletAdapter,
});
```

The loader selects the first `local_user` by default, normally `dev-1`. `roleOffset` selects another account after sorting by derivation index. It reads `GROUNDHOG_RUNTIME_MANIFEST` or the active runtime from Groundhog config and returns the address, signer, role, index, key name, and network hash.

:::caution[Local keys]
Local development signers are deterministic. Never use them on production networks or with funds of value.
:::

Source-address accounts need an explicit invocation adapter before they expose `prepareExecution()` and `execute()`. `devWalletAdapter` wraps ordinary application calls through DevWallet. Custom wallet contracts can use `defineWalletInvocationAdapter()`.

### Deploy Through DevWallet

Deployment is a wallet-specific root operation. Build the generated DevWallet deployment invocation, then use the wallet client's explicit root path:

```ts
import { readFile } from "node:fs/promises";
import {
  ContractType,
  gasAmount,
  sha256Hash,
  type Contract,
} from "@groundhogchain/protocol";
import {
  deriveContractAddress,
  fixedBytes,
  hashContract,
} from "@groundhogchain/client";
import { DevWallet } from "@groundhogchain/client/contracts";

const artifact = await readFile("target/groundhog/counter.rv32a");
const contract: Contract = {
  contract_type: ContractType.kRv32,
  rv32_contract: { data: artifact },
};
const deploymentNonce = sha256Hash(crypto.getRandomValues(new Uint8Array(32)));
const contractHash = hashContract(contract);
const contractAddress = deriveContractAddress(
  account.address,
  deploymentNonce,
  contractHash,
);
const invocation = DevWallet.deploy.invocation(
  account.address,
  gasAmount(10_000_000n),
  {
    nonce: fixedBytes(deploymentNonce, 32),
    contractHash: fixedBytes(contractHash, 32),
  },
);

const txHash = await wallet.sendInvocation({
  invocation,
  contractsToDeploy: [contract],
});
const deployed = DevWallet.deploy.decodeReceipt(
  await wallet.waitForTransactionReceipt(txHash),
);
```

`contractsToDeploy` makes the artifact available to the transaction. DevWallet's `deploy` method performs the deployment. Normal calls to the deployed application use `wallet.execute()` and `devWalletAdapter`.

## Typed Views

Generated method descriptors call `client.view()` and decode the result:

```ts
const result = await Counter.get.view({
  client,
  contract,
  caller,
});

console.log(result.value, result.height, result.events);
```

Methods with arguments take a generated `args` object:

```ts
import { ERC20 } from "@groundhogchain/client/contracts";

const balance = await ERC20.getBalanceOf.view({
  client,
  contract: token,
  caller,
  args: { addr: caller },
});
```

`view()` throws `ContractViewError` when the contract aborts or faults. Use `viewOutcome()` to handle each outcome directly:

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

Transport and JSON-RPC errors pass through unchanged. Malformed return or abort data throws `ContractDecodeError`.

## Receipt Decoding

Decode a receipt with the descriptor for the transaction's root method:

```ts
const receipt = await client.waitForTransactionReceipt(transferTxHash);
const outcome = DefaultWallet.execute.decodeReceiptOutcome(receipt);

if (outcome.kind === "return") {
  console.log(outcome.height, outcome.events);
}
```

`decodeReceipt()` returns the typed value with `txHash`, `height`, and `events`. It throws `ContractReceiptError` for an abort, execution failure, or missing return data from a non-void method. `decodeReceiptOutcome()` returns a discriminated `return`, `abort`, or `failure` result.

A receipt does not identify the root method well enough for the descriptor to verify it. Root receipt decoders do not search nested application calls inside a wallet invocation. Read application state with a typed view or decode application events from the receipt.

## Low-Level Signing

Custom signer integrations can use the transaction helpers directly. `signTransaction()` sends each signer the domain-separated, network-bound transaction signature preimage, not bare transaction bytes:

```ts
import { signTransaction } from "@groundhogchain/client/transaction";

const signed = await signTransaction(
  transaction,
  [{ signer, publicKeyId: 0n }],
  networkHash,
);
const txHash = await client.sendTransaction(signed);
```

The network hash prevents replay of the same signature on another Groundhog network. The transaction hash identifies the inner transaction and is distinct from both the signature preimage and the signed wrapper.

## Transport Errors

```ts
import { HttpTransport, JsonRpcError } from "@groundhogchain/client";

const transport = new HttpTransport("https://rpc.example.com", {
  timeoutMs: 10_000,
  headers: { Authorization: "Bearer <token>" },
});

try {
  await transport.request("groundhog_chainTip");
} catch (error) {
  if (error instanceof JsonRpcError) {
    console.error(error.code, error.method, error.message);
  }
}
```

JSON-RPC error responses throw `JsonRpcError`. HTTP failures, timeouts, invalid JSON, and malformed envelopes throw other exceptions. Typed actions validate the response shapes they consume.

## Public Entry Points

| Import                               | Use for                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `@groundhogchain/client`             | Clients, clusters, accounts, wallet adapters, actions, and common helpers |
| `@groundhogchain/client/local-dev`   | Node.js-only local runtime account loading                                |
| `@groundhogchain/client/contracts`   | `DefaultWallet`, `DevWallet`, ERC-20, and metadata bindings               |
| `@groundhogchain/client/transaction` | Low-level transaction construction, serialization, and signing            |
| `@groundhogchain/client/transport`   | HTTP and mock transports                                                  |
| `@groundhogchain/client/contract`    | Descriptor runtime and fixed-length helpers                               |
| `@groundhogchain/client/signers`     | Signer interface and private-key signer                                   |
| `@groundhogchain/client/actions`     | Standalone typed actions                                                  |

## Maintained Examples

- [Chain tip](https://github.com/groundhogchain/client-ts/blob/main/examples/chain-tip.ts) connects to Devnet.
- [HOG transfer](https://github.com/groundhogchain/client-ts/blob/main/examples/transfer-hog.ts) uses Devnet airdrops, pubkey accounts, and DefaultWallet.
- [HOG balance](https://github.com/groundhogchain/client-ts/blob/main/examples/view-hog-balance.ts) loads `dev-1` and reads Localnet.
- [Counter deployment](https://github.com/groundhogchain/client-ts/blob/main/examples/deploy-counter.ts) deploys and calls through DevWallet on Localnet.

See [TypeScript Bindings](/tools/typescript-bindings/) for generated descriptor APIs and [Wallet Integration](/tools/wallet-integration/) for signer and browser-wallet boundaries.
