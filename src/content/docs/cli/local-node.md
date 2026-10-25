---
title: Run a local node
description: Start an isolated development chain, select its accounts, and preserve or inspect local state.
---

Use a local node for disposable development and RPC tests. For a first hosted deployment, follow the [Futurenet contract quickstart](/get-started/contract/).

## Start the node

```bash
thruput node
```

Keep this terminal running. The CLI starts its managed `hog-devnode` and exposes JSON-RPC at `http://127.0.0.1:9545` by default. If the selected runtime is missing, the CLI can download its verified bundle.

The CLI records the active endpoint and runtime manifest so commands using a local profile can find the node.

The node funds the selected project/global key. If local and Futurenet profiles
use different keys, run `THRUPUT_PROFILE=local thruput node` so startup uses the
key selected by local commands. `--key NAME` explicitly selects a stored key.

## Select a local account

From another terminal in your project:

```bash
thruput status --profile local
thruput balance --profile local
```

`status` shows the effective key. On a fresh chain, the node gives that key's account 100 native tokens. Use `thruput node --initial-account-tokens AMOUNT` to change the amount. The faucet key is private to the node, and the node creates no other accounts. An ML-DSA-65 key gets no genesis allocation. To fund it, or any other key, run `thruput airdrop NAME --profile local`.

If the profile already selects a saved wallet, key selection alone does not replace that wallet. Inspect `thruput status --profile local` and [wallet selection](/cli/wallets/#select-an-account) before submitting.

You can now use the normal [deployment and call commands](/cli/deploy-and-call/) with `--profile local`.

## Preserve state

Without a data directory, stopping the node discards its chain state. Stored signing keys and project configuration remain, but the local deployments and balances do not.

```bash
thruput node --data-dir .thruput/node
```

Restart with the same data directory to reuse the chain. Repeat the same `--network-config` overrides, and omit `--init-network-hash`. A runtime older than `0.1.31-rc.10` created data directories that the current runtime cannot open. Use a new directory for them.

Stop the node before backing up or restoring that directory:

```bash
thruput chain dump --data-dir .thruput/node --output chain-backup.json
thruput chain restore --data-dir .thruput/node --input chain-backup.json
```

Restore asks before replacing populated state. Use `--yes` only when that replacement is intended.

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
