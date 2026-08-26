---
title: Work with Groundhog from TypeScript
description: Build a contract, generate TypeScript bindings, connect to a local node, and use typed contract APIs.
---

This tutorial connects the Groundhog CLI, a Rust contract, generated TypeScript bindings, and `@groundhogchain/client` in one local workflow.

You will:

1. Build and deploy the generated counter with the CLI.
2. Generate a contract-specific TypeScript binding from its spec.
3. Connect a TypeScript application to the local node.
4. Read contract state through a typed view.
5. Execute a typed state-changing invocation through a pubkey account and the default wallet.
6. Use the standard ERC-20 bindings and follow a normal token call sequence.

:::note[Version checked]
This tutorial was source-checked against Groundhog CLI and codegen `0.10.3`, `@groundhogchain/client` `0.4.0`, and protocol packages `0.8.0` on August 26, 2026.
:::

## How the Pieces Fit

The CLI and TypeScript packages have different jobs:

```text
Rust contract and #[contract] metadata
                  |
                  | groundhog build
                  v
    .rv32a artifact + .spec.xdr API
                  |
                  | groundhog build --bindings ts
                  | or groundhog codegen ts
                  v
       generated TypeScript binding
                  |
                  | imports @groundhogchain/client/contract
                  v
 typed views, invocations, events, and receipt decoding
```

The generated binding contains the contract-specific API: method names, arguments, returns, declared exceptions, events, and entrypoint IDs. The client package provides the shared runtime, JSON-RPC transport, transaction helpers, and standard contract bindings.

| Job | Owner |
|---|---|
| Build and deploy a Rust contract | Groundhog CLI |
| Produce the canonical contract API | `.spec.xdr` generated during the build |
| Generate contract-specific TypeScript | Groundhog CLI codegen |
| Connect to JSON-RPC and run chain actions | `@groundhogchain/client` |
| Encode calls and decode contract values | Generated binding plus client contract runtime |
| Authorize an application write | Wallet contract and signer |

This split is similar to an EVM ABI plus an application client, but Groundhog bindings contain typed method and event descriptors instead of dynamically calling methods by name.

## Before You Start

Complete [Develop Locally with the CLI](/tutorials/develop-locally/) first. You need:

- Groundhog CLI `0.10.3` or newer
- A compatible `hog-devnode` with pubkey authorization and the native DefaultWallet fallback
- Node.js `22.12.0` or newer
- Access to the Groundhog Cargo and GitHub Packages registries

Keep `groundhog node` running in a separate terminal throughout this tutorial.

## 1. Create and Build the Contract

Create the generated counter project and select the local development account:

```bash
groundhog new my-counter
cd my-counter

groundhog config set default-key dev-0 \
  --profile local \
  --project
```

Run the native tests, then build the RV32 artifact and TypeScript binding together:

```bash
cargo test
groundhog build --bindings ts --profile local
```

The build writes these application-facing artifacts:

```text
target/groundhog/my_counter.rv32a
target/groundhog/my_counter.spec.xdr
target/groundhog/my_counter.spec.json
target/groundhog/my_counter.ts
```

The `.rv32a` file is deployable code. The `.spec.xdr` file is the canonical contract API consumed by codegen. The `.ts` file is the generated application binding.

Re-run codegen whenever you change an exported method, argument, return type, declared exception, event, or reachable contract type.

## 2. Deploy and Initialize

With the local node running, deploy the contract:

```bash
groundhog deploy --profile local
```

The CLI prints the deployed address and saves `my-counter` as a project alias. Keep the printed `0x...` address for the TypeScript application.

Deployment and initialization are separate calls. Initialize the counter once:

```bash
groundhog call my-counter initialize 10 --profile local
groundhog view my-counter get --profile local
```

The view should return `10`.

## 3. Create the TypeScript Application

Create an application directory inside the contract project and copy the generated binding into it:

```bash
mkdir -p web/src/contracts
cp target/groundhog/my_counter.ts web/src/contracts/my-counter.ts
cd web

npm init -y
npm pkg set type=module
npm pkg set scripts.view="tsx src/view.ts"
npm pkg set scripts.write="tsx src/write.ts"
```

Configure GitHub Packages as described in [TypeScript SDK installation](/tools/typescript-sdk/#install), then install the coordinated package versions:

```bash
npm install \
  @groundhogchain/client@0.4.0 \
  @groundhogchain/protocol@0.8.0 \
  @groundhogchain/contract-spec@0.8.0

npm install --save-dev typescript tsx @types/node
```

Generated bindings import the client contract runtime and the protocol packages directly. Keep these versions coordinated with the CLI that generated the file.

## 4. Run a Typed View

Create `web/src/view.ts`:

```ts
import {
  HttpTransport,
  addressFromHex,
  createGroundhogClient,
} from "@groundhogchain/client";
import { loadLocalDevAccount } from "@groundhogchain/client/local-dev";
import { Counter } from "./contracts/my-counter.js";

const rpcUrl = process.env.GROUNDHOG_RPC_URL ?? "http://127.0.0.1:9545";
const contractHex = process.env.GROUNDHOG_CONTRACT_ADDRESS;

if (!contractHex) {
  throw new Error("Set GROUNDHOG_CONTRACT_ADDRESS to the deployed counter");
}

const client = await createGroundhogClient({
  transport: new HttpTransport(rpcUrl),
});
const contract = addressFromHex(contractHex);
const { address: caller } = await loadLocalDevAccount();

const result = await Counter.get.view({
  client,
  contract,
  caller,
});

console.log({
  value: result.value.toString(),
  height: result.height.toString(),
  events: result.events.length,
});
```

Run it with the address printed by `groundhog deploy`:

```bash
GROUNDHOG_CONTRACT_ADDRESS="0x..." npm run view
```

The generated `Counter.get` descriptor knows from the Rust contract spec that `get()` returns `u64`. Its `view()` method decodes the returned bytes into a TypeScript `bigint`. Application code does not need to create an XDR reader or inspect raw `returnData`.

Change the contract through the CLI, then run the application again:

```bash
groundhog call my-counter increment 5 --profile local
GROUNDHOG_CONTRACT_ADDRESS="0x..." npm run view
```

The TypeScript view should now print `15`.

## 5. Build a Typed Invocation

Views simulate a contract call against committed state and do not submit a transaction. A state-changing application starts by building a typed invocation:

```ts
import { gasAmount } from "@groundhogchain/protocol";

const increment = Counter.increment.invocation(
  contract,
  gasAmount(500_000n),
  { amount: 5n },
);
```

The descriptor validates the argument object and encodes its calldata from the contract spec. `increment` is an application invocation, not yet an authorized transaction.

## 6. Execute Through the Default Wallet

A generated application invocation is not a signed transaction. A wallet client supplies the account's authorization claim, creates the wallet-root invocation, binds the signature to the connected network, submits the transaction, and polls its receipt.

The simplest account type is a pubkey account. Its address is derived from one Ed25519 public key and an address nonce. An undeployed pubkey-account address resolves to Groundhog's native-compatible DefaultWallet, so creating the account does not require deploying or initializing a wallet contract:

```text
Ed25519 key + address nonce
            |
            v
   pubkey-account address
            |
            | kPubkeySignature auth claim
            v
DefaultWallet.execute         root invocation
            |
            v
Counter.increment             application invocation
```

Create a separate `web/src/write.ts`. This complete program connects to the same local node, binds a fresh pubkey account, funds it, executes the invocation, decodes the wallet and child returns, and reads the committed value:

```ts
import { randomBytes } from "node:crypto";
import {
  PrivateKeySigner,
  addressFromHex,
  createGroundhogClient,
  createPubkeyAccount,
  createWalletClient,
  localnet,
  toHex0x,
} from "@groundhogchain/client";
import { DefaultWallet } from "@groundhogchain/client/contracts";
import { gasAmount } from "@groundhogchain/protocol";
import { Counter } from "./contracts/my-counter.js";

const contractHex = process.env.GROUNDHOG_CONTRACT_ADDRESS;
if (!contractHex) {
  throw new Error("Set GROUNDHOG_CONTRACT_ADDRESS to the deployed counter");
}

const client = await createGroundhogClient({ cluster: localnet() });
const account = createPubkeyAccount({
  signer: new PrivateKeySigner(randomBytes(32)),
});
const wallet = createWalletClient({ client, account });
const contract = addressFromHex(contractHex);
const increment = Counter.increment.invocation(
  contract,
  gasAmount(500_000n),
  { amount: 5n },
);

const airdrop = await wallet.requestAirdrop();
if (airdrop.status.result !== "ok") {
  throw new Error(`Airdrop failed with ${airdrop.status.result}`);
}

const txHash = await wallet.execute({
  invocation: increment,
  gasLimit: gasAmount(10_000_000n),
});
const receipt = await wallet.waitForTransactionReceipt(txHash);

const outcome = DefaultWallet.execute.decodeReceiptOutcome(receipt);
if (outcome.kind !== "return") {
  throw new Error(`DefaultWallet execution ended with ${outcome.kind}`);
}
const incrementReturn = outcome.value[0];
if (!incrementReturn) {
  throw new Error("Expected one child return");
}
Counter.increment.decodeReturn(incrementReturn);

const committed = await Counter.get.view({
  client: wallet,
  contract,
  caller: account.address,
});

console.log({
  transaction: toHex0x(txHash),
  value: committed.value.toString(),
});
```

Run the write program with the same contract address:

```bash
GROUNDHOG_CONTRACT_ADDRESS="0x..." npm run write
```

`createPubkeyAccount()` constructs the protocol's `kPubkeySignature` claim and derives the matching address. `createWalletClient()` selects the DefaultWallet adapter automatically for this account type. Because `localnet()` validates the endpoint's network identity, the wallet can also use the returned network hash when signing.

The account must have HOG before it can pay transaction and storage costs. A committed airdrop can still contain a failed execution result, so the program checks `airdrop.status.result` before submitting the counter transaction.

Do not submit `Counter.increment` directly as the transaction root. `wallet.execute()` wraps it in `DefaultWallet.execute` and then signs and submits the root transaction.

:::note[Local bootstrap accounts]
Accounts loaded by `loadLocalDevAccount()` are existing source-address accounts created by `groundhog node`. To write through one, use `createSourceAddressAccount()` with `devWalletAdapter`. This compatibility path still uses `DevWallet.doAction`; it is different from the no-deploy pubkey-account path above. The maintained [counter deployment example](https://github.com/groundhogchain/client-ts/blob/main/examples/deploy-counter.ts) shows the complete setup.
:::

For additional implementation references, see the maintained client examples:

- [Transfer native HOG through a pubkey account and DefaultWallet](https://github.com/groundhogchain/client-ts/blob/main/examples/transfer-hog.ts). This targets the planned wire `3.3.0` Devnet deployment and is not runnable against the older public endpoint.
- [Deploy and call a counter](https://github.com/groundhogchain/client-ts/blob/main/examples/deploy-counter.ts)

For the current integration boundary, see [Wallet Integration Status](/tools/wallet-integration/).

## 7. Decode Receipts and Events

Generated descriptors can decode a receipt when the descriptor represents the transaction's root method. In `write.ts`, the root is `DefaultWallet.execute`:

```ts
const outcome = DefaultWallet.execute.decodeReceiptOutcome(receipt);

if (outcome.kind === "return") {
  const [incrementReturn] = outcome.value;
  if (!incrementReturn) {
    throw new Error("Expected one child return");
  }
  const value = Counter.increment.decodeReturn(incrementReturn);
}
```

`decodeReceipt()` is the throwing convenience API. `decodeReceiptOutcome()` returns a typed `return`, `abort`, or `failure` result.

The generated DefaultWallet binding decodes its root return into one raw return buffer per child call. Use the child method's generated `decodeReturn()` method for each item. The client cannot choose that child descriptor automatically because the receipt does not carry enough TypeScript method identity to do so.

For a void mutation such as `increment` or ERC-20 `transfer`, successful decoding produces `undefined`. Applications commonly combine the root execution result with typed events and a follow-up view of committed state.

After a wallet-backed `Counter.ping` call, its generated event descriptor can find the nested event by emitting contract address:

```ts
import { PingEvent } from "./contracts/my-counter.js";

const ping = PingEvent.singleFromReceipt(receipt, {
  contractAddress: contract,
});

console.log(ping.topics.tag);
```

See [Add Events to a Contract](/tutorials/add-events-to-a-contract/) for the complete event flow.

## 8. Work with ERC-20 Tokens

The client ships generated bindings for the standard Groundhog ERC-20 and metadata interfaces. You do not need to run codegen for those interfaces:

```ts
import {
  ERC20,
  ERC20Metadata,
  ERC20TransferEvent,
} from "@groundhogchain/client/contracts";
```

A useful token demonstration follows the contract's authorization and balance preconditions:

| Call | Caller | Purpose |
|---|---|---|
| `initialize` | Deployer or intended administrator | Set the administrator once |
| `mint` | Administrator | Create a balance for the sending account |
| `getBalanceOf`, `totalSupply` | Read-only view | Confirm balances and supply |
| `transfer` | Token holder | Send part of the caller's balance |
| `adjustAllowance` | Token holder | Change a spender's allowance by a signed delta |
| `transferFrom` | Spender | Transfer from the owner using allowance |
| `burn` | Administrator | Destroy tokens from an account |

If the contract includes `ERC20Metadata`, use its initializer to set the administrator, name, symbol, and decimals together. Do not call both initializers on a one-time-initialized token.

Read a balance without submitting a transaction:

```ts
const balance = await ERC20.getBalanceOf.view({
  client,
  contract: token,
  caller,
  args: { addr: holder },
});

console.log(balance.value);
```

Build and execute a transfer through the holder's wallet:

```ts
const transfer = ERC20.transfer.invocation(token, gasAmount(500_000n), {
  receiver,
  amount: 100n,
});

const txHash = await wallet.execute({
  invocation: transfer,
  gasLimit: gasAmount(10_000_000n),
});
const receipt = await wallet.waitForTransactionReceipt(txHash);
const transferReturn = DefaultWallet.execute.decodeReceipt(receipt).value[0];
if (!transferReturn) {
  throw new Error("Expected one child return");
}
ERC20.transfer.decodeReturn(transferReturn);
```

`mint`, `transfer`, `adjustAllowance`, `transferFrom`, and `burn` return `void`. Their useful application results are the committed execution outcome, emitted event, and updated state:

```ts
const event = ERC20TransferEvent.singleFromReceipt(receipt, {
  contractAddress: token,
});

console.log(event.topics.from, event.topics.to, event.fields.amount);
```

Groundhog's allowance interface differs from Ethereum's common `approve(spender, absoluteAmount)` pattern. `adjustAllowance({ spender, diff })` applies a positive or negative change to the existing allowance.

## CLI, Binding, or Client?

Use this rule of thumb:

| You need to... | Use... |
|---|---|
| Build a contract or manage CLI profiles | Groundhog CLI |
| Generate types for your contract | `groundhog build --bindings ts` or `groundhog codegen ts` |
| Connect to RPC, create an account, execute, sign, or poll | `@groundhogchain/client` |
| Encode or decode one contract's methods and events | Its generated binding |
| Call the standard token interface | `@groundhogchain/client/contracts` |

## Next Steps

- [TypeScript SDK](/tools/typescript-sdk/) for transports, transactions, receipts, deployment, and package entrypoints
- [TypeScript Bindings](/tools/typescript-bindings/) for generated method, exception, and event APIs
- [Build a Token](/tutorials/build-a-token/) for the Rust implementation behind the standard token interface
- [Add Events to a Contract](/tutorials/add-events-to-a-contract/) for typed event generation and queries
- [Wallet Integration Status](/tools/wallet-integration/) for the current signer and browser-wallet boundary
- [Understand a Swap Contract](/tutorials/build-a-swap/) for a larger application built from token and cross-contract calls
