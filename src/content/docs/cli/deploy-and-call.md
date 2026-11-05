---
title: Deploy and call
description: Deploy an artifact, fund its storage, call methods, and read committed state.
---

Run these commands in a contract project with a built artifact. Deployment and calls need a funded account; estimating needs no signing key. Select the intended [profile](/cli/configuration/) explicitly. The examples use Futurenet and the scaffolded counter's methods.

## Estimate deployment funding

```bash
thruput build
thruput deploy --estimate --profile futurenet
thruput deploy --estimate --profile futurenet --json
```

The estimate reads the network's authoritative execution rules and storage prices without signing or submitting. It checks the artifact, code, and memory limits and assumes a fresh, unfunded contract address. Unlike `--dry-run`, it does not prepare a signed transaction.

| Report field | Meaning |
| --- | --- |
| `balanceDepositRaw`, `deploymentCostRaw` | First balance-item deposit and code collateral, in native-token base units |
| `minimumFundingRaw`, `minimumFundingTokens` | Their sum, as an integer base-unit string and a whole-token decimal string respectively; one native token has 10,000,000 base units |
| `initializerFundingRaw` | `null` when an initializer is requested, because its storage is not estimated; `"0"` when none is requested |
| `execution` | Observed committed tip, configuration hash, effective limits, and storage prices |

Missing authoritative rules or prices produce an error, not a zero-cost estimate. The reading applies at its reported configuration; prices can change before inclusion. Re-estimate after rebuilding or changing networks.

For deployment without initialization, the CLI can read and transfer the minimum directly:

```bash
thruput deploy --profile futurenet --fund minimum
```

The minimum leaves **zero free contract balance** for further storage. It excludes initializer writes, later storage growth, the sender's replay storage, and the sender's scheduling capacity. `--fund minimum` cannot be combined with `--init`. Use an explicit total amount when initialization or later calls need storage, as in the [counter guide](/tutorials/build-a-counter/#build-deploy-and-initialize).

## Deploy an artifact

```bash
thruput build
thruput deploy --profile futurenet --fund 10
```

Confirm the deployment. Without a terminal, pass `--yes` to confirm. The CLI waits for its result, prints the deployed address, and saves an alias using the package name. For a project named `my-counter`, later commands can use that alias instead of the address.

Numeric `--fund` transfers exactly that many native tokens from the sender to the new contract. Set it to the estimated minimum plus an allowance for contract storage. `10` above illustrates the syntax; choose your total from the current estimate rather than treating it as a fixed fee or minimum.

At a workspace root, use `-p PACKAGE`. Use `--artifact PATH` to select an artifact directly and `--alias NAME` when you want a specific alias.

## Include initialization

For a new deployment that initializes the counter in the same transaction, use this instead:

```bash
thruput deploy --profile futurenet --fund 10 \
  --init initialize --init-arg 10
```

Repeat `--init-arg` for additional arguments. The initializer sees the deploying wallet as its caller. Funding, deployment, and initialization succeed together or roll back together.

Initialization is an ordinary contract method. The contract must enforce one-time initialization when its design requires it. The starter counter simply adds the supplied amount, so do not call it again after initializing this example.

## Submit a call

For a counter that has been deployed and initialized:

```bash
thruput call my-counter increment 5 --profile futurenet
```

This signs and submits a transaction. Method names and typed arguments use the contract spec. Without metadata, an explicit entrypoint and raw calldata are required; use generated metadata for normal development.

The CLI resolves method names from the project you run it in, not from the target contract. It ships no spec for the native token, so outside a project that implements the standard ERC20 interface, `call` and `view` cannot resolve `NATIVE_TOKEN` method names. Use `thruput balance` and `thruput transfer` for native balances and transfers. For other methods, such as allowances, use the standard `ERC20.v0_1` TypeScript binding with `NATIVE_TOKEN_ADDRESS`; see [Send transactions](/typescript/transactions/).

Use `--gas-limit` when the call needs a different execution budget. The sender must have the corresponding scheduling capacity; gas itself has no token fee.

## Read without submitting

```bash
thruput view my-counter get --profile futurenet
```

`view` runs a sandboxed call against committed state. It does not submit a transaction. Use `--from ADDRESS` when a read needs a simulated caller; this does not prove control of that address.

`thruput storage CONTRACT KEY` reads a raw storage item. Prefer a view when you want the contract's typed behavior.

## Prepare without broadcasting

```bash
thruput deploy --profile futurenet --fund 10 --dry-run
thruput call my-counter increment 5 --profile futurenet --dry-run
```

A dry run prepares and signs a transaction but does not submit it. It still needs the selected key and network access. It is not a simulation of the state change and does not prove that execution will succeed.

## Inspect an uncertain result

Keep the transaction hash and original network if submission or receipt observation fails:

```bash
thruput tx show TX_HASH --profile futurenet
```

A timeout or `unknown` status does not prove that the transaction failed. Repeating a deployment creates a new nonce and predicted address. Inspect the original transaction before deciding to submit a new operation. See [Inspect transactions and events](/cli/transactions/).
