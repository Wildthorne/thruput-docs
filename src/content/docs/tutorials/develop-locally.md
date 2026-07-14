---
title: Develop Locally with the CLI
description: Build, deploy, call, and inspect a Groundhog contract against a local hog-devnode.
---

This tutorial walks through the complete local CLI loop. You will build and test a counter, start an ephemeral Groundhog node, deploy with the built-in `dev-0` wallet, submit calls, and inspect committed state.

Local development is the fastest way to exercise deployment and RPC behavior. It does not require a faucet, a hosted endpoint, or a persistent signing key.

:::note[Version checked]
This tutorial was last checked against Groundhog CLI `0.5.17` and SDK `0.17.1` on July 13, 2026.
:::

## Prerequisites

You need:

- Rust and Cargo through [rustup](https://rustup.rs/)
- `jq` for structured-output checks
- Access to the private Groundhog Cargo registry
- Groundhog CLI `0.5.17`
- A compatible `hog-devnode` executable supplied during onboarding

Authenticate Cargo and install the published CLI:

```bash
cargo login --registry groundhog
cargo install groundhog-cli \
  --version "=0.5.17" \
  --registry groundhog \
  --locked
```

Point the CLI at `hog-devnode` if it is not beside the `groundhog` executable or on `PATH`:

```bash
export GROUNDHOG_DEVNODE_BINARY="/path/to/hog-devnode"
```

## 1. Initialize the CLI

Run the guided environment check if this is your first Groundhog project:

```bash
groundhog init
```

Decline starter-project creation because the next step creates it explicitly. The local flow below selects `dev-0` in project configuration, so generating a normal key during initialization or having an existing global key does not change which local account deploys the contract.

## 2. Create a Counter Project

From the directory where you keep development projects:

```bash
groundhog new my-counter
cd my-counter
```

Open `groundhog.toml` and select the built-in account under the existing local profile:

```toml
[profile.local]
network = "local"
default_key = "dev-0"
```

`dev-0` is not stored in your key directory. The CLI derives its development signer and wallet address from the runtime manifest advertised by the active local node.

## 3. Build and Test Locally

Run the fast native tests, then the executor-backed RV32 test:

```bash
cargo test
groundhog build --profile local
groundhog test --profile local
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
export GROUNDHOG_DEVNODE_BINARY="/path/to/hog-devnode"
groundhog node
```

The command starts one supervised `hog-devnode`, exposes JSON-RPC on `http://127.0.0.1:9545`, and records the active endpoint and runtime manifest in global CLI state.

The node is ephemeral. Deployments and calls share state while this process runs, but stopping it discards chain state and clears the active-runtime record.

## 5. Check the Active Local Profile

Return to the project terminal:

```bash
groundhog status --profile local
groundhog balance dev-0 --profile local
```

The profile should resolve the active node endpoint, runtime manifest, and `dev-0` account. If no endpoint appears, confirm that `groundhog node` is still running and both terminals use the same user configuration. `status` can still report unrelated setup warnings; inspect the local profile fields rather than treating every warning as a node failure.

## 6. Dry-Run and Deploy

Prepare a signed deployment without broadcasting it:

```bash
groundhog deploy --profile local --dry-run
```

Then deploy the RV32 artifact:

```bash
groundhog deploy --profile local
```

The CLI prints the contract address and saves `my-counter` as an alias under `[profile.local.contracts]` in `groundhog.toml`.

## 7. Initialize and Call the Counter

Deployment and initialization are separate operations. Initialize the counter once:

```bash
groundhog call my-counter initialize 10 --profile local
groundhog view my-counter get --profile local
```

The first view should return `10`.

Submit another state change:

```bash
groundhog call my-counter increment 5 --profile local
groundhog view my-counter get --profile local
```

The counter should now return `15`.

Use JSON mode when testing scripts or automation:

```bash
groundhog --json view my-counter get --profile local \
  | jq -e '.ok == true and .data.returnValue == 15'
```

## 8. Confirm Dry Runs Do Not Commit

Prepare a call without broadcasting it:

```bash
groundhog call my-counter increment 100 --profile local --dry-run
groundhog view my-counter get --profile local
```

The value should remain `15`.

## Integration Test Mode

`groundhog test --integration` starts its own disposable local node, deploys the selected artifact, and runs `tests/integration.rs`. The scaffold does not create that file, so add the Cargo integration-test target before using this mode.

```bash
GROUNDHOG_DEVNODE_BINARY="/path/to/hog-devnode" \
  groundhog test --integration
```

Use integration mode for automated RPC tests. Use the long-running `groundhog node` flow above for interactive development across several commands.

## Troubleshooting

### `hog-devnode` is not found

Set `GROUNDHOG_DEVNODE_BINARY` to the compatible executable supplied during onboarding. The CLI also checks beside the `groundhog` executable and on `PATH`.

### `dev-0` is unavailable

`dev-0` only exists while commands can load the active local runtime manifest. Keep `groundhog node` running and make sure `[profile.local]` has `network = "local"`.

### A stored key is selected instead

Set `default_key = "dev-0"` in the project's `[profile.local]` table. Project profile configuration takes precedence over the global key selected by `groundhog keys use`.

### Protocol mismatch

Use a `hog-devnode` build compatible with the CLI. `groundhog node --hogd-protocol hogp/<hash>` can override the handshake token when only the token differs; incompatible protocol shapes still fail.

## Next Steps

- [Develop on Devnet with the CLI](/tutorials/develop-on-devnet/) to create a persistent key-owned wallet and deploy to the hosted network
- [Build a Counter](/tutorials/build-a-counter/) for a line-by-line walkthrough of the generated contract
- [Groundhog CLI](/tools/groundhog-cli/) for command and flag reference
