---
title: Groundhog CLI
description: How Groundhog CLI commands fit into RV32 builds, local nodes, tests, deployment, and TypeScript bindings.
---

Run normal Rust loops with `cargo`. Run Groundhog-specific work with `groundhog`: scaffolds, RV32 artifacts, local nodes, deployments, RPC calls, state inspection, keys, wallets, and generated bindings.

:::note[Version checked]
This page was last checked against Groundhog CLI `0.5.10` and SDK `0.15.4` on June 26, 2026.
:::

## Foundry Mental Model

If you know Foundry, `groundhog node` is closest to `anvil`: it starts a standalone local development chain on port `9545`. Generated Groundhog projects point at `http://localhost:9545`; Anvil is commonly used at `http://localhost:8545`.

| Foundry habit | Groundhog command | What to remember |
|---------------|-------------------|------------------|
| `anvil` | `groundhog node` | Starts a local chain backed by `hog-devnode`; default port is `9545`. |
| `forge script ... --broadcast --rpc-url http://localhost:8545` | `groundhog deploy` | Signs and submits a deploy transaction for an existing `.rv32a` artifact. |
| `cast call` | `groundhog view` | Runs a read-only sandboxed simulation against committed state. |
| `cast send` | `groundhog call` | Sends a signed state-changing transaction. |
| Anvil's funded dev accounts | `dev-0`, `dev-1`, ... | Bootstrap accounts come from the local runtime manifest. Generated local profiles default to `dev-0`. |

Groundhog is not EVM-compatible. The analogy is about local workflow, not bytecode, ABI, accounts, or transaction format.

## Common Workflow

Start with native tests and the default RV32 build:

```bash
groundhog new my-counter     # create the project
cd my-counter
cargo test                   # fast native tests
groundhog build              # write target/groundhog/*.rv32a and spec sidecars
```

Run a local chain in a second terminal:

```bash
groundhog node
```

Then deploy and interact from the project directory:

```bash
groundhog deploy
groundhog call my-counter increment 1
groundhog view my-counter get
```

On a successful deploy, the CLI saves a project-name contract alias in `groundhog.toml`. Use that alias, such as `my-counter`, or the `0x...` address printed by `groundhog deploy`.

## Which Command Should I Use?

| Goal | Command |
|------|---------|
| Create a starter contract | `groundhog new <name>` |
| Check local setup | `groundhog status` |
| Run fast logic tests | `cargo test` |
| Build a deployable RV32 artifact | `groundhog build` |
| Keep a local chain running | `groundhog node` |
| Deploy to the selected profile | `groundhog deploy` |
| Send a state-changing contract call | `groundhog call <contract> <method> [args...]` |
| Run a read-only contract simulation | `groundhog view <contract> <method> [args...]` |
| Read raw committed storage | `groundhog storage <contract> 0x<key>` |
| Run disposable local-node integration tests | `groundhog test --integration` |
| Generate TypeScript contract bindings | `groundhog codegen ts <spec.xdr> -o <file.ts>` |

:::caution[RV32 default]
`groundhog build` and `groundhog test --integration` default to RV32. Plain `groundhog test` runs the WASM compatibility harness today. For the default RV32 path, use `cargo test` for native logic tests and `groundhog test --integration` for local-node RPC tests.
:::

## Setup and Flags

Early-access Cargo registry credentials are handled by Cargo, not the CLI. Configure Cargo from your onboarding instructions before creating or building SDK projects.

`groundhog new <name>` creates a project from the `counter` or `stub` template. `groundhog init` runs guided local setup. `groundhog status` checks toolchain, key, and project config state. `groundhog completion <shell>` prints shell completions.

Global flags work across commands:

```bash
groundhog --json status
groundhog --quiet build
```

Most network-facing commands accept `--profile` (also available as `--network`) to select a profile from `groundhog.toml` or `~/.config/groundhog/`.

## Build and Test

`groundhog build` defaults to `--target rv32` and writes the deployable artifact plus spec sidecars:

```text
target/groundhog/<name>.rv32a
target/groundhog/<name>.rv32.json
target/groundhog/<name>.spec.xdr
target/groundhog/<name>.spec.json
```

Use the WASM target only for compatibility work:

```bash
groundhog build --target wasm
```

Test modes:

| Command | What runs |
|---------|-----------|
| `cargo test` | Native Rust tests on your host. Best for fast contract logic feedback. |
| `groundhog test` | WASM compatibility harness using `tests/test_wasm.rs`. |
| `groundhog test --integration` | Ephemeral local node, deploy, then `tests/integration.rs`. Defaults to RV32. |
| `groundhog test --integration --differential` | Runs the same integration target against isolated RV32 and WASM nodes. |

Integration tests receive:

| Variable | Value |
|----------|-------|
| `GROUNDHOG_RPC_URL` | RPC URL for the ephemeral local node |
| `GROUNDHOG_CONTRACT_ADDRESS` | Deployed contract address |
| `GROUNDHOG_PROFILE` | `integration` |
| `GROUNDHOG_DEFAULT_KEY` | `dev-0` |
| `GROUNDHOG_RUNTIME_MANIFEST` | Runtime manifest path, when available |

For testing guidance, see [Testing](/programming-model/testing/).

## Local Node

`groundhog node` starts a supervised `hog-devnode` process for local state that persists across manual deploys and calls.

```bash
groundhog node
groundhog node --port 9546
groundhog node --verbose
groundhog node --block-driver interval
groundhog node --block-driver interval --block-interval-ms 1000
```

Useful flags and environment variables:

| Setting | Use for |
|---------|---------|
| `--port` | Change the public JSON-RPC port. Default: `9545`. |
| `--dev-account-count` | Change how many deterministic dev accounts the node bootstraps. |
| `--hog-devnode-binary` | Point at a specific `hog-devnode` binary. |
| `--block-driver interval` | Pace block production on a timer instead of waking immediately after successful submits. |
| `--block-driver instant` | Use submit-wake block production. This is the default. |
| `--block-interval-ms <ms>` | Override the interval driver timer. Default: `500`. Requires `--block-driver interval`. |
| `GROUNDHOG_DEVNODE_BINARY` | Default binary path when `--hog-devnode-binary` is omitted. |
| `GROUNDHOG_RUNTIME_MANIFEST` | Point commands at a specific runtime manifest for `dev-N` accounts. |
| `RUST_LOG` | Control supervisor and forwarded node logs. |

When run from a project directory, `groundhog node` records project-local node state so later CLI commands can resolve `dev-0` and the runtime manifest without copying the manifest path by hand. The command also prints an export line for `GROUNDHOG_RUNTIME_MANIFEST` when the node reports a manifest.

Use `groundhog test --integration` when you want disposable state per test run.

## Deploy and Interact

Build before deploying. `groundhog deploy` auto-detects the selected artifact (`.rv32a` by default), signs a deploy transaction with the active key, submits it to the selected profile, and saves a contract alias in `groundhog.toml` when deploy succeeds. If source files are newer than the artifact, it warns so you can rebuild before submitting stale code.

Use `groundhog call` for signed state changes and `groundhog view` for read-only simulation. Add `--from dev-0` to simulate a caller. `groundhog storage` reads one raw committed storage item; prefer contract methods and `groundhog view` when you want typed behavior. `groundhog balance` and `groundhog airdrop` cover local HOG account work.

## Keys and Wallets

Signing keys are Ed25519 keypairs stored globally under `~/.config/groundhog/keys/`.

```bash
groundhog keys generate alice
groundhog keys ls
groundhog keys use alice
groundhog keys rm alice
```

Contract wallets are project config entries used by the local-node wallet flow:

```bash
groundhog wallet create --key alice --name alice
groundhog wallet ls
groundhog wallet rm alice
```

Generated local profiles use `dev-0` by default, so you usually do not need to create a key or wallet before the first local deploy.

## TypeScript Bindings

For the RV32 path, generate TypeScript from the spec sidecar produced by `groundhog build`:

```bash
groundhog build
groundhog codegen ts \
  ./target/groundhog/my_counter.spec.xdr \
  -o ./web/src/contracts/my-counter.ts
```

The shortcut `groundhog build --target wasm --bindings ts` is WASM-only today. For RV32, use `groundhog codegen ts` against `.spec.xdr`.

For package setup and TypeScript usage, see [TypeScript Bindings](/tools/typescript-sdk/).
