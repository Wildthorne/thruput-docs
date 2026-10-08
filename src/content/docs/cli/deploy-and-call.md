---
title: Deploy and call
description: Deploy an artifact, fund its storage, call methods, and read committed state.
---

Run these commands in a contract project with a built artifact and a funded account. Select the intended [profile](/cli/configuration/) explicitly. The examples use Devnet and the scaffolded counter's methods.

## Deploy an artifact

```bash
groundhog build
groundhog deploy --profile devnet --fund 10
```

Confirm the deployment. The CLI waits for its result, prints the deployed address, and saves an alias using the package name. For a project named `my-counter`, later commands can use that alias instead of the address.

Native deployment requires an explicit `--fund` amount. It transfers native tokens from the sender to the new contract to cover deployment and state storage. `10` is an example allocation, not a fixed fee or minimum.

At a workspace root, use `-p PACKAGE`. Use `--artifact PATH` to select an artifact directly and `--alias NAME` when you want a specific alias.

## Include initialization

For a new deployment that initializes the counter in the same transaction, use this instead:

```bash
groundhog deploy --profile devnet --fund 10 \
  --init initialize --init-arg 10
```

Repeat `--init-arg` for additional arguments. The initializer sees the deploying wallet as its caller. Funding, deployment, and initialization succeed together or roll back together.

Initialization is an ordinary contract method. The contract must enforce one-time initialization when its design requires it. The starter counter simply adds the supplied amount, so do not call it again after initializing this example.

## Submit a call

For a counter that has been deployed and initialized:

```bash
groundhog call my-counter increment 5 --profile devnet
```

This signs and submits a transaction. Method names and typed arguments use the contract spec. Without metadata, an explicit entrypoint and raw calldata are required; use generated metadata for normal development.

Use `--gas-limit` when the call needs a different execution budget. The sender must have the corresponding scheduling capacity; gas itself has no token fee.

## Read without submitting

```bash
groundhog view my-counter get --profile devnet
```

`view` runs a sandboxed call against committed state. It does not submit a transaction. Use `--from ADDRESS` when a read needs a simulated caller; this does not prove control of that address.

`groundhog storage CONTRACT KEY` reads a raw storage item. Prefer a view when you want the contract's typed behavior.

## Prepare without broadcasting

```bash
groundhog deploy --profile devnet --fund 10 --dry-run
groundhog call my-counter increment 5 --profile devnet --dry-run
```

A dry run prepares and signs a transaction but does not submit it. It still needs the selected key and network access. It is not a simulation of the state change and does not prove that execution will succeed.

## Inspect an uncertain result

Keep the transaction hash and original network if submission or receipt observation fails:

```bash
groundhog tx show TX_HASH --profile devnet
```

A timeout or `unknown` status does not prove that the transaction failed. Repeating a deployment creates a new nonce and predicted address. Inspect the original transaction before deciding to submit a new operation. See [Inspect transactions and events](/cli/transactions/).
