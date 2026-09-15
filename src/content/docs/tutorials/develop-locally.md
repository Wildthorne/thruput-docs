---
title: Develop Locally with the CLI
description: Build, deploy, call, and inspect a Groundhog contract against a local hog-devnode.
---

This tutorial walks through the complete local CLI loop. You will build and test a counter, start an ephemeral Groundhog node, create and fund a wallet for your signing key, deploy, submit calls, and inspect committed state.

Local development is the fastest way to exercise deployment and RPC behavior. The node provides its own local faucet and RPC endpoint.

## Prerequisites

Install the complete client bundle using [Getting Started](/start/getting-started/#choose-and-install-a-client-bundle). You also need `jq` for the structured-output checks below. Keep the generated SDK dependencies and toolchain for your selected CLI.

### Verify the Selected Runtime

After setting `GROUNDHOG_CLIENT_HOME` and `PATH` as described in Getting Started, inspect what the CLI will actually run:

```bash
command -v groundhog
groundhog --version
groundhog status --json | jq '.data.environment.devnode'
```

Read the returned `path` and `version`. They must identify the node from your selected bundle. A successful status command alone does not establish that it selected the right node. `GROUNDHOG_DEVNODE_BINARY` takes precedence over the executable beside the CLI.

If you intend to use the bundle and the path points elsewhere, select its node for this terminal, then check again:

```bash
export GROUNDHOG_DEVNODE_BINARY="$GROUNDHOG_CLIENT_HOME/bin/hog-devnode"
groundhog status --json | jq '.data.environment.devnode'
```

Use the same bundle and environment in the terminal that starts the node. This changes only the current shell; do not rewrite a developer's shell configuration or discard an intentional source-build setup. A protocol mismatch is a reason to verify the selected binaries before trying any protocol override.

## 1. Initialize the CLI

Run the guided environment check if this is your first Groundhog project:

```bash
groundhog init
```

Accept signing-key generation to create the stored key named `default`. Decline starter-project creation because the next step creates it explicitly. Init also creates global `local` and `devnet` profiles.

## 2. Create a Counter Project

From the directory where you keep development projects:

```bash
groundhog new my-counter
cd my-counter
```

The generated `groundhog.toml` sets `default_profile = "local"`, so commands run from this project use the local profile automatically. Only `config set` requires an explicit `--profile local`; the other commands below use the project default. If you previously set `GROUNDHOG_PROFILE`, unset it first because it overrides that default.

The generated project defines the private registry in `.cargo/config.toml`. Complete [Cargo access setup](/start/getting-started/#configure-cargo-access) from this project directory before the first build. The SDK downloads its test executor from public storage without FFI credentials.

Check the stored key and select it explicitly for this project's local profile:

```bash
groundhog keys ls
groundhog config set default-key default --profile local --project
```

You should see `default` in the key list. If you skipped key generation during init, run `groundhog keys generate default` first. If you already use a differently named key, substitute its name in the key-selection command above and in `--key default` in step 5. The wallet created in step 5 will still be named `default`.

## 3. Build and Test Locally

Run the fast native tests, then the executor-backed RV32 test:

```bash
cargo test
groundhog build
groundhog test
```

These commands do not require a running JSON-RPC node:

| Command | What it checks |
|---------|----------------|
| `cargo test` | Native contract logic through the SDK test environment |
| `groundhog build` | Deployable RV32 artifact, lowering metadata, and contract spec |
| `groundhog test` | The generated executor-backed `tests/test_rv32.rs` target |

Inspect the generated artifacts:

```bash
ls -lh target/groundhog/
```

For `my-counter`, expect:

```text
my_counter.rv32a
my_counter.rv32.json
my_counter.spec.xdr
my_counter.spec.json
```

## 4. Start the Local Node

Open a second terminal, keep it running, and start the node:

```bash
groundhog node
```

The command starts one supervised `hog-devnode`, exposes JSON-RPC on `http://127.0.0.1:9545`, and records the active endpoint and runtime manifest in global CLI state. With the verified bundled runtime, the default artifact layout needs no extra flags. Use repeatable `--contract-artifacts-dir <DIR>` options only when the node must load contracts from nonstandard directories.

The node is ephemeral. Deployments and calls share state while this process runs, but stopping it discards chain state and clears the active-runtime record.

## 5. Create and Fund Your Local Wallet

Return to the project terminal and check the active node:

```bash
groundhog status
```

The profile should show `default` as the key and `http://127.0.0.1:9545` as the RPC URL. If no endpoint appears, confirm that `groundhog node` is still running and both terminals use the same user configuration.

Create a wallet owned by your stored key, then select it for this project:

```bash
groundhog wallet create --key default --name default
groundhog wallet use default
groundhog wallet ls
```

Confirm wallet creation when prompted. The key signs transactions; the wallet has the on-chain address and holds HOG. `wallet ls` should show `default` as selected. Its address differs from the address printed by `keys ls`.

Wallet creation prefunds the creation transaction. Request 100 local HOG to cover deployment and the subsequent calls:

```bash
groundhog airdrop default --amount 100
groundhog balance default
```

Confirm the airdrop when prompted. The CLI uses the node's local faucet automatically. Keep this node running for the remaining steps.

## 6. Dry-Run and Deploy

Prepare a signed deployment without broadcasting it:

```bash
groundhog deploy --dry-run
```

Then deploy the RV32 artifact and confirm when prompted:

```bash
groundhog deploy
```

The CLI prints the contract address and saves `my-counter` as an alias under `[profile.local.contracts]` in `groundhog.toml`.

## 7. Initialize and Call the Counter

Deployment and initialization are separate operations. Initialize the counter once, confirming the call when prompted:

```bash
groundhog call my-counter initialize 10
groundhog view my-counter get
```

The first view should return `10`.

Submit another state change:

```bash
groundhog call my-counter increment 5
groundhog view my-counter get
```

The counter should now return `15`.

Use JSON mode when testing scripts or automation:

```bash
groundhog --json view my-counter get \
  | jq -e '.ok == true and .data.schemaVersion == 1 and .data.returnValue == 15'
```

## 8. Confirm Dry Runs Do Not Commit

Prepare a call without broadcasting it:

```bash
groundhog call my-counter increment 100 --dry-run
groundhog view my-counter get
```

The value should remain `15`.

## Integration Test Mode

`groundhog test --integration` starts its own disposable local node, deploys
the RV32 artifact, and runs the scaffolded `tests/integration.rs`. Invoke it
like this:

```bash
groundhog test --integration
```

The generated starter stays ignored under ordinary `cargo test`. Add your
contract-specific RPC assertions to `tests/integration.rs`. See
[Testing](/programming-model/testing/#what-the-scaffold-gives-you) for how the
CLI activates the test and which environment variables it provides.

The starter uses `groundhog-json-rpc-client` to connect directly to the node.
Use `GROUNDHOG_RPC_URL` and `GROUNDHOG_CONTRACT_ADDRESS` for your own RPC
assertions.

Use this integration mode for automated RPC tests. For interactive development
across several commands, use the long-running `groundhog node` flow above.

## Troubleshooting

### `hog-devnode` is not found

Use the `groundhog` and `hog-devnode` binaries from the same Groundhog client bundle, preserve the extracted directory layout, and add its `bin` directory to `PATH`. For a custom location, set `GROUNDHOG_DEVNODE_BINARY` to that bundle's `hog-devnode` executable.

### The wrong key or wallet is selected

From the project directory, repeat the explicit selections:

```bash
groundhog config set default-key default --profile local --project
groundhog wallet use default
```

If the wallet has not been created yet, complete step 5 first. Use your actual key name if it differs from `default`.

### The node was restarted

Stopping the ephemeral node discards its wallets, funds, and deployed contracts. Your stored key and project configuration remain. Repeat wallet creation, funding, deployment, and initialization against the new node before continuing.

### Protocol mismatch

First repeat the [runtime selection check](#verify-the-selected-runtime), including inherited environment overrides. Use a `hog-devnode` build compatible with the CLI. Do not use `--hogd-protocol` to make a mismatched installation appear compatible. That developer diagnostic changes only the handshake token, not the wire format; use it only when token-only compatibility has been independently established.

## Next Steps

- [Develop on Devnet with the CLI](/tutorials/develop-on-devnet/) to create a persistent key-owned wallet and deploy to the hosted network
- [Build a Counter](/tutorials/build-a-counter/) for a line-by-line walkthrough of the generated contract
- [Groundhog CLI](/tools/groundhog-cli/) for command and flag reference
