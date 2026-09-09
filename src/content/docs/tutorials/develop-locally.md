---
title: Develop Locally with the CLI
description: Build, deploy, call, and inspect a Groundhog contract against a local hog-devnode.
---

This tutorial walks through the complete local CLI loop. You will build and test a counter, start an ephemeral Groundhog node, deploy with the built-in `dev-1` local user, submit calls, and inspect committed state. The node reserves `dev-0` for its faucet.

Local development is the fastest way to exercise deployment and RPC behavior. It does not require a hosted faucet, a hosted endpoint, or a persistent signing key.

## Prerequisites

Install the complete client bundle using [Getting Started](/start/getting-started/#choose-and-install-a-client-bundle). That page records the rehearsed local preview and the boundary of its validation. You also need `jq` for the structured-output checks below. Keep the generated SDK dependencies and toolchain for your selected CLI.

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

Init creates global `local` and `devnet` profiles. Decline starter-project creation because the next step creates it explicitly. The local flow below selects `dev-1`, the first ordinary local user, in project configuration. A stored global key therefore cannot replace the runtime account used by this tutorial.

## 2. Create a Counter Project

From the directory where you keep development projects:

```bash
groundhog new my-counter
cd my-counter
```

The generated project defines the private registry in `.cargo/config.toml`. Complete [Cargo access setup](/start/getting-started/#configure-cargo-access) from this project directory before the first build. For the native tests below, also supply the [FFI password in the task environment](/start/getting-started/#test-and-build). Credentials saved by `groundhog init` do not reach raw `cargo test`.

Select the built-in account in the project's local profile:

```bash
groundhog config set default-key dev-1 \
  --profile local \
  --project
groundhog config get local --sources
```

The project override prevents a stored global key from replacing `dev-1` in this tutorial. Runtime accounts are not stored in your key directory. The CLI derives the development signer and wallet address from the active node's runtime manifest.

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
groundhog node
```

The command starts one supervised `hog-devnode`, exposes JSON-RPC on `http://127.0.0.1:9545`, and records the active endpoint and runtime manifest in global CLI state. With the verified bundled runtime, the default artifact layout needs no extra flags. Use repeatable `--contract-artifacts-dir <DIR>` options only when the node must load contracts from nonstandard directories.

The node is ephemeral. Deployments and calls share state while this process runs, but stopping it discards chain state and clears the active-runtime record.

## 5. Check the Active Local Profile

Return to the project terminal:

```bash
groundhog status --profile local
groundhog balance dev-1 --profile local
```

The profile should resolve the active node endpoint, runtime manifest, and `dev-1` account. If no endpoint appears, confirm that `groundhog node` is still running and both terminals use the same user configuration. `status` can still report unrelated setup warnings; inspect the local profile fields rather than treating every warning as a node failure.

The node starts `dev-1+` local users with development funds. If you create a saved wallet for a generated key instead, wallet creation prefunds only the creation transaction. Fund that wallet before its first application deployment:

```bash
groundhog keys generate local-app
groundhog wallet create --key local-app --name local-app --profile local
groundhog config set default-key local-app --profile local --project
groundhog wallet use local-app --profile local
groundhog airdrop local-app --profile local
```

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
  | jq -e '.ok == true and .data.schemaVersion == 1 and .data.returnValue == 15'
```

## 8. Confirm Dry Runs Do Not Commit

Prepare a call without broadcasting it:

```bash
groundhog call my-counter increment 100 --profile local --dry-run
groundhog view my-counter get --profile local
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

Node.js applications can load the same first `local_user`, normally `dev-1`, from the active runtime without copying deterministic keys:

```ts
import { loadLocalDevAccount } from "@groundhogchain/client/local-dev";

const local = await loadLocalDevAccount();
```

`roleOffset` selects later `local_user` accounts in derivation-index order. This helper is for local development only. See the [TypeScript SDK](/tools/typescript-sdk/) for client and wallet setup.

Use this integration mode for automated RPC tests. For interactive development
across several commands, use the long-running `groundhog node` flow above.

## Troubleshooting

### `hog-devnode` is not found

Use the `groundhog` and `hog-devnode` binaries from the same Groundhog client bundle, preserve the extracted directory layout, and add its `bin` directory to `PATH`. For a custom location, set `GROUNDHOG_DEVNODE_BINARY` to that bundle's `hog-devnode` executable.

### `dev-1` is unavailable

`dev-1` only exists while commands can load the active local runtime manifest. Keep `groundhog node` running and make sure `[profile.local]` has `network = "local"`. `dev-0` is present too, but it is reserved for local faucet transactions.

### A stored key is selected instead

Run `groundhog config set default-key dev-1 --profile local --project`. The project profile takes precedence over the global key selected by `groundhog keys use`.

### Protocol mismatch

First repeat the [runtime selection check](#verify-the-selected-runtime), including inherited environment overrides. Use a `hog-devnode` build compatible with the CLI. Do not use `--hogd-protocol` to make a mismatched installation appear compatible. That developer diagnostic changes only the handshake token, not the wire format; use it only when token-only compatibility has been independently established.

## Next Steps

- [Develop on Devnet with the CLI](/tutorials/develop-on-devnet/) to create a persistent key-owned wallet and deploy to the hosted network
- [Build a Counter](/tutorials/build-a-counter/) for a line-by-line walkthrough of the generated contract
- [Groundhog CLI](/tools/groundhog-cli/) for command and flag reference
