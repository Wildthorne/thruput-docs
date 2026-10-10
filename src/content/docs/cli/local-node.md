---
title: Run a local node
description: Start an isolated development chain, select its accounts, and preserve or inspect local state.
---

Use a local node for disposable development and RPC tests. For a first hosted deployment, follow the [Devnet contract quickstart](/get-started/contract/).

## Start the node

```bash
thruput node
```

Keep this terminal running. The CLI starts its managed `hog-devnode` and exposes JSON-RPC at `http://127.0.0.1:9545` by default. If the selected runtime is missing, the CLI can download its verified bundle.

The CLI records the active endpoint and runtime manifest so commands using a local profile can find the node.

## Select a local account

From another terminal in your project:

```bash
thruput config set default-key dev-1 --profile local --project
thruput balance dev-1 --profile local
```

`dev-0` is the local faucet. Normal bootstrap accounts start at `dev-1`; their keys and initial balances come from the runtime manifest. These deterministic accounts are for local development only.

If the profile already selects a saved wallet, key selection alone does not replace that wallet. Inspect `thruput status --profile local` and [wallet selection](/cli/wallets/#select-an-account) before submitting.

You can now use the normal [deployment and call commands](/cli/deploy-and-call/) with `--profile local`.

## Preserve state

Without a data directory, stopping the node discards its chain state. Stored signing keys and project configuration remain, but the local deployments and balances do not.

```bash
thruput node --data-dir .thruput/node
```

Restart with the same data directory to reuse the chain. Preserve any explicit genesis settings used to create it.

Stop the node before backing up or restoring that directory:

```bash
thruput chain dump --data-dir .thruput/node --output chain-backup.json
thruput chain restore --data-dir .thruput/node --input chain-backup.json
```

Restore asks before replacing populated state. Use `--force` only when that replacement is intended.

## Change the endpoint or logging

```bash
thruput node --port 9546
thruput node --verbose
```

Choose logging before reproducing a problem: restarting an ephemeral node to enable it loses the old state. `RUST_LOG` provides finer control and overrides the verbose preset.

The public listener binds to loopback by default. `--host` changes that listener for container or VM access; exposing it beyond loopback exposes an unauthenticated development RPC endpoint.

## Runtime selection

The CLI selects a default from its bundled runtime catalog. See [local runtime setup](/cli/install/#set-up-the-local-runtime) to inspect and install managed runtimes.

To inspect the effective configuration:

```bash
thruput status --json
```

An explicit `--hog-devnode-binary`, `THRUPUT_DEVNODE_BINARY`, or adjacent binary can take precedence over managed selection. Use `--hog-devnode-version VERSION` when intentionally selecting an exact catalog entry. `--offline` prevents managed downloads, not RPC or Cargo traffic.

If the runtime is incompatible, select matching binaries. `--hogd-protocol` changes a handshake token only; it does not make different wire formats compatible.

For isolated automated runs, prefer [integration tests](/cli/build-and-test/#integration-and-workspace-runs) rather than managing a long-running node yourself.
