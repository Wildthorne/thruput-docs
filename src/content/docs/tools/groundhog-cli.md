---
title: Groundhog CLI
description: How Groundhog CLI commands fit into RV32 builds, local nodes, tests, deployment, and TypeScript bindings.
---

Run normal Rust loops with `cargo`. Run Groundhog-specific work with `groundhog`: scaffolds, RV32 artifacts, local nodes, deployments, RPC calls, state inspection, keys, wallets, and generated bindings. RV32 is Groundhog's 32-bit RISC-V contract target.

:::note[Version checked]
This page was source-checked against Groundhog CLI source `0.10.3` at `groundhog-rpc` commit `c6051ef` on August 26, 2026. The latest tagged and installable CLI release is `0.10.2`; this page does not imply that a `0.10.3` release artifact exists.
:::

## Foundry Mental Model

If you know Foundry, `groundhog node` is closest to `anvil`: it starts a standalone local development chain on port `9545`. Generated Groundhog projects select the `local` network. While the node is running, the CLI overlays its actual endpoint and runtime manifest.

| Foundry habit                                                  | Groundhog command     | What to remember                                                                                                   |
| -------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `anvil`                                                        | `groundhog node`      | Starts a local chain backed by `hog-devnode`; default port is `9545`.                                              |
| `forge script ... --broadcast --rpc-url http://localhost:8545` | `groundhog deploy`    | Signs and submits a deploy transaction for an existing `.rv32a` artifact.                                          |
| `cast call`                                                    | `groundhog view`      | Runs a read-only sandboxed simulation against committed state.                                                     |
| `cast send`                                                    | `groundhog call`      | Sends a signed state-changing transaction.                                                                         |
| Anvil's funded dev accounts                                    | `dev-1`, `dev-2`, ... | Bootstrap accounts come from the active local runtime. `dev-0` is the local faucet; normal users start at `dev-1`. |

Groundhog is not EVM-compatible. The analogy is about local workflow, not bytecode, ABI, accounts, or transaction format.

## Common Workflow

Start with native tests and the default RV32 build:

```bash
groundhog new my-counter     # create the project
cd my-counter
groundhog config set default-key dev-1 --profile local --project
cargo test                   # fast native tests
groundhog build              # write the RV32 artifact and lowering metadata
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

For complete command sequences, follow [Develop Locally with the CLI](/tutorials/develop-locally/) first, then [Develop on Devnet with the CLI](/tutorials/develop-on-devnet/).

## Which Command Should I Use?

| Goal                                        | Command                                                   |
| ------------------------------------------- | --------------------------------------------------------- |
| Create a starter contract                   | `groundhog new <name>`                                    |
| Check local setup                           | `groundhog status`                                        |
| Run fast logic tests                        | `cargo test`                                              |
| Build a deployable RV32 artifact            | `groundhog build`                                         |
| Run executor-backed RV32 tests              | `groundhog test`                                          |
| Keep a local chain running                  | `groundhog node`                                          |
| Deploy to the selected profile              | `groundhog deploy`                                        |
| Send a state-changing contract call         | `groundhog call <contract> <method> [args...]`            |
| Transfer native HOG                         | `groundhog transfer <recipient> <amount>`                 |
| Run a read-only contract simulation         | `groundhog view <contract> <method> [args...]`            |
| Read raw committed storage                  | `groundhog storage <contract> 0x<key>`                    |
| Inspect a transaction or address history    | `groundhog tx show <hash>` / `groundhog tx list [target]` |
| Inspect contract events                     | `groundhog events list <contract>`                        |
| Inspect ERC-20 transfers                    | `groundhog token transfers <token>`                       |
| Inspect merged profile configuration        | `groundhog config get [profile] [--sources]`              |
| Create or select a profile                  | `groundhog config new`, `groundhog config use`            |
| Create a contract wallet                    | `groundhog wallet create`                                 |
| Run disposable local-node integration tests | `groundhog test --integration`                            |
| Generate TypeScript contract bindings       | `groundhog codegen ts <spec.xdr> -o <file.ts>`            |

:::caution[RV32 default]
`groundhog build`, `groundhog test`, and `groundhog test --integration` default to RV32. Use `cargo test` for fast native logic tests, `groundhog test` for executor-backed artifact tests, and `groundhog test --integration` for local-node RPC tests.
:::

## First-Run Setup

Early-access Cargo registry credentials are handled by Cargo, not the CLI. Configure Cargo from your onboarding instructions before creating or building SDK projects.

`groundhog node` and `groundhog test --integration` also require a compatible `hog-devnode` executable, which is distributed separately. `groundhog node` accepts `--hog-devnode-binary`; both commands support `GROUNDHOG_DEVNODE_BINARY`, a sibling executable beside `groundhog`, or `PATH`. Integration mode does not accept the command-line flag.

Run interactive setup before creating your first project:

```bash
groundhog init
```

Init creates global `local` and `devnet` profiles. The Devnet profile includes its RPC and faucet settings. On a fresh configuration with no stored keys or configured global default, init offers to create and select the key named `default`. Existing profile values, keys, and key selections are preserved; use `groundhog keys use <name>` to repair or change the global selection.

`groundhog new <name>` creates a project from the `counter` or `stub` template. `groundhog status` checks toolchain, devnode, key, executor-auth, and project-config state. `groundhog completion <shell>` prints shell completions.

## Configuration

Groundhog keeps reusable settings in global config and allows projects to override them:

| Layer   | Default location                  | Use                                                                                |
| ------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| Global  | `~/.config/groundhog/config.toml` | Reusable profiles, defaults, endpoints, selected keys, and wallet bindings         |
| Project | Nearest ancestor `groundhog.toml` | Project defaults, profile overrides, contract aliases, and project wallet bindings |

Profiles with the same name merge field by field. Project values override matching global values. Contract and wallet maps merge by entry, so projects can add aliases and wallet bindings without copying the complete global profile.

Profile selection checks, in order:

1. Command-line `--profile`
2. `GROUNDHOG_PROFILE`
3. Project `default_profile`
4. Global `default_profile`

If none selects a profile, commands that require one fail. The name `default` has no special fallback behavior.

Inspect profiles before changing them:

```bash
groundhog config profiles
groundhog config get devnet --sources
```

Create an additional global profile:

```bash
groundhog config new staging \
  --network devnet \
  --rpc-url https://rpc.example \
  --network-hash "$NETWORK_HASH" \
  --global \
  --use
```

Override one value for the current project:

```bash
groundhog config set rpc-url http://127.0.0.1:9546 \
  --profile local \
  --project
```

The editable fields are `network`, `rpc-url`, `network-hash`, `faucet-url`, and `default-key`. The persisted `network_hash` value is 64 lowercase hexadecimal characters without a `0x` prefix.

Local profiles discover their network hash from the active runtime manifest written by `groundhog node`. Hosted profiles must persist the expected network hash. Signing commands validate that hosted identity against the live RPC endpoint before signing.

Use `config unset` to remove a value from one layer and reveal an inherited value. Use `config rm` to remove a complete profile from one layer. Profile removal prompts in an interactive terminal. Automation, including `--json` and `--quiet` use, must confirm deletion explicitly:

```bash
groundhog config rm staging --global --force
```

Mutations outside a project default to global config. Inside a project, pass `--global` or `--project`. Contract aliases are managed by deployment commands, and wallet bindings are managed by wallet commands.

`config get` shows the merged persisted profile. It does not apply active local-node state, global key fallback, runtime-manifest environment variables, or command-line endpoint overrides. Use `groundhog status --profile <name>` for broader environment diagnostics.

## Shared Flags

Global flags work across commands:

```bash
groundhog --json status
groundhog --quiet build
groundhog --show-cargo-commands build
```

Global config and keys live under `${XDG_CONFIG_HOME:-$HOME/.config}/groundhog/`. Cache and retry records live under `${XDG_CACHE_HOME:-$HOME/.cache}/groundhog/`.

CLI HTTP requests honor `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, and `NO_PROXY`, including their lowercase forms. HTTP and HTTPS proxy values may be an HTTP(S) URL or `host:port`.

### JSON output

`--json` wraps command data in a common envelope:

```json
{
  "ok": true,
  "command": "balance",
  "warnings": [],
  "data": {
    "schemaVersion": 1
  }
}
```

Scripts should check `ok` and the command-specific `data.schemaVersion` before reading fields. Migrated command payloads use camelCase. `wallet.create` schema 4 still contains legacy snake_case fields, so consume its keys exactly as emitted.

| Command         | `data.schemaVersion` |
| --------------- | -------------------: |
| `call`          |                    1 |
| `deploy`        |                    4 |
| `airdrop`       |                    3 |
| `wallet.create` |                    4 |
| `new`           |                    1 |
| `build`         |                    1 |
| `status`        |                    1 |
| `balance`       |                    1 |
| `storage`       |                    1 |
| `keys.export`   |                    1 |

## Build and Test

`groundhog build` defaults to `--target rv32` and writes the deployable 32-bit RISC-V artifact plus lowering metadata:

```text
target/groundhog/<name>.rv32a
target/groundhog/<name>.rv32.json
target/groundhog/<name>.spec.xdr
target/groundhog/<name>.spec.json
```

The spec sidecars are emitted when the contract contains spec metadata. Artifact names use the package's snake-case name, so `my-contract` produces `my_contract.*`.

Test modes:

| Command                        | What runs                                                              |
| ------------------------------ | ---------------------------------------------------------------------- |
| `cargo test`                   | Native Rust tests on your host. Best for fast contract logic feedback. |
| `groundhog test`               | Executor-backed RV32 tests using `tests/test_rv32.rs`.                 |
| `groundhog test --integration` | Ephemeral local node, RV32 deploy, then `tests/integration.rs`.        |

Fresh projects created by `groundhog new` include `tests/integration.rs`, a small `build.rs`, and optional host-only RPC dependencies. The starter test verifies that the CLI provided a deployed contract and a live RPC node, then leaves a placeholder for contract-specific assertions. It stays ignored under ordinary `cargo test`; the integration command activates it without coupling activation to a particular test name.

Projects created with an older scaffold must add the integration target and activation wiring before running the command. Otherwise, it exits with `integration_test_not_found`. See [Testing](/programming-model/testing/#what-the-scaffold-gives-you) for the generated Cargo entries and build-script hook.

Integration mode accepts `--hogd-protocol hogp/<hash>` when a local devnode is slightly ahead of the published protocol token. `GROUNDHOG_HOGD_PROTOCOL` is its environment fallback. Shape mismatches still fail.

Integration tests receive:

| Variable                     | Value                                       |
| ---------------------------- | ------------------------------------------- |
| `GROUNDHOG_INTEGRATION_TEST` | `1`; activates the scaffolded live test     |
| `GROUNDHOG_RPC_URL`          | RPC URL for the ephemeral local node        |
| `GROUNDHOG_CONTRACT_ADDRESS` | Deployed contract address                   |
| `GROUNDHOG_PROFILE`          | `integration`                               |
| `GROUNDHOG_DEFAULT_KEY`      | Lowest-index `local_user`, normally `dev-1` |
| `GROUNDHOG_RUNTIME_MANIFEST` | Runtime manifest path, when available       |

For testing guidance, see [Testing](/programming-model/testing/).

## Local Node

`groundhog node` starts one supervised `hog-devnode`. Without `--data-dir`, deploys and calls share ephemeral state for the lifetime of that process. Pass `--data-dir <dir>` to preserve node state across restarts.

```bash
groundhog node
groundhog node --port 9546
groundhog node --verbose
groundhog node --data-dir ./local-chain
groundhog node --contract-artifacts-dir ./contracts/a/target/groundhog \
  --contract-artifacts-dir ./contracts/b/target/groundhog
groundhog node --block-driver interval
groundhog node --block-driver interval --block-interval-ms 1000
```

Useful flags and environment variables:

| Setting                          | Use for                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `--port`                         | Change the public JSON-RPC port. Default: `9545`.                                             |
| `--dev-account-count`            | Change how many deterministic dev accounts the node bootstraps.                               |
| `--hog-devnode-binary`           | Point at a specific `hog-devnode` binary.                                                     |
| `--contract-artifacts-dir <dir>` | Add a contract artifact search directory. Repeat the flag to add directories in search order. |
| `--data-dir <dir>`               | Preserve hog-devnode state in a specific directory. Omit for an ephemeral node.               |
| `--block-driver interval`        | Pace block production on a timer instead of waking immediately after successful submits.      |
| `--block-driver instant`         | Use submit-wake block production. This is the default.                                        |
| `--block-interval-ms <ms>`       | Override the interval driver timer. Default: `500`. Requires `--block-driver interval`.       |
| `--rpc-max-connections <count>`  | Set the public RPC connection cap. Default: `2000`.                                           |
| `--ramdb-bytes <size>`           | Set the devnode RAM database capacity, using decimal, hex, or K/M/G suffixes.                 |
| `--hogd-protocol hogp/<hash>`    | Override the local x23 protocol token when protocol shapes remain compatible.                 |
| `GROUNDHOG_DEVNODE_BINARY`       | Default binary path when `--hog-devnode-binary` is omitted.                                   |
| `GROUNDHOG_RUNTIME_MANIFEST`     | Point commands at a specific runtime manifest for `dev-N` accounts.                           |
| `RUST_LOG`                       | Control supervisor and forwarded node logs.                                                   |

`groundhog node` records the active local endpoint and runtime manifest in global CLI state so profiles with `network = "local"` can resolve bootstrap accounts without copying the manifest path by hand. `dev-0` is the faucet. Normal local users are `dev-1` and above. The CLI removes the active-runtime record when the node shuts down and prints an export line for `GROUNDHOG_RUNTIME_MANIFEST` when the node reports a manifest.

For persistent state, `groundhog chain restore` refuses to replace populated state unless you pass `--force` (`-f`). Stop the node before dumping or restoring its data directory.

Use `groundhog test --integration` when you want disposable state per test run.

## Deploy and Interact

Build before deploying. `groundhog deploy` auto-detects the selected artifact (`.rv32a` by default), signs a deploy transaction with the active key, submits it to the selected profile, and saves a contract alias in `groundhog.toml` when deploy succeeds. If source files are newer than the artifact, it warns so you can rebuild before submitting stale code.

Use `groundhog call` for signed state changes and `groundhog view` for read-only simulation. Add `--from dev-1` to simulate a normal local caller. `groundhog storage` reads one raw committed storage item; prefer contract methods and `groundhog view` when you want typed behavior. `groundhog balance`, `groundhog transfer`, and `groundhog airdrop` cover native HOG account work.

The target is optional for these commands:

```bash
groundhog balance [TARGET]
groundhog airdrop [RECIPIENT]
groundhog tx list [TARGET]
```

When omitted, the target resolves to the effective wallet from the selected profile and key.

## Transactions, Events, and Tokens

The inspection commands return one page at a time. Cursors are opaque and must be reused with the same target and filters.

```bash
groundhog tx show 0x<32-byte-hash>
groundhog tx list my-counter --limit 50
groundhog events list my-counter --topic0 0x<topic>
groundhog token transfers HOG --account dev-1
```

`tx show` returns public status and receipt fields, not raw transaction bodies or deep traces. `tx list` filters by root invocation target. `events list` scans one contract newest first and supports repeated topic options for OR within a topic position. `token transfers` returns canonical ERC-20 transfer records and leaves amounts as base-unit decimal strings.

## Keys and Wallets

Signing keys are Ed25519 keypairs stored globally under `${XDG_CONFIG_HOME:-$HOME/.config}/groundhog/keys/`.

```bash
groundhog keys generate alice
groundhog keys ls
groundhog keys use alice
groundhog keys export alice
groundhog keys rm alice
```

`keys export` prints the 32-byte private key to stdout as `0x`-prefixed hex. Treat this output as secret key material. Do not write it to logs, CI output, shell history, or committed files.

Key removal prompts in an interactive terminal. Non-TTY scripts and commands using `--json` or `--quiet` must pass `--force`:

```bash
groundhog keys rm alice --force
```

Contract wallets are profile entries that bind a signing key to its deployed wallet contract. On a fresh setup, create a globally reusable Devnet wallet from outside a project:

```bash
groundhog wallet create --profile devnet
groundhog wallet ls --profile devnet
groundhog balance --profile devnet
groundhog airdrop --profile devnet
```

When `--key` and `--name` are omitted, the command uses the selected key and gives the wallet the same name. If no default wallet exists and the wallet belongs to the effective key, it becomes the profile default. Hosted wallet creation prefunds the future address with the amount advertised by the network so the wallet contract can be created. Request an airdrop for more funds.

Wallet mutations write to the project overlay when run inside a project and to global config otherwise. Select or remove a saved binding explicitly:

```bash
groundhog wallet use default --profile devnet
groundhog wallet rm default --profile devnet
```

Removing a binding does not remove the on-chain wallet. See [Develop Locally with the CLI](/tutorials/develop-locally/) for the local bootstrap workflow and [Develop on Devnet with the CLI](/tutorials/develop-on-devnet/) for hosted wallet setup.

## TypeScript Bindings

Generate TypeScript bindings as part of the build:

```bash
groundhog build --bindings ts
```

Use standalone codegen when the binding belongs elsewhere:

```bash
mkdir -p ./web/src/contracts
groundhog codegen ts \
  ./target/groundhog/my_counter.spec.xdr \
  -o ./web/src/contracts/my-counter.ts
```

Standalone TypeScript codegen accepts canonical `.spec.xdr` input. It does not accept `.wasm`, `.rv32a`, or `.spec.json` input.

For generated contract bindings, see [TypeScript Bindings](/tools/typescript-bindings/). For the app-facing client package, see [TypeScript SDK](/tools/typescript-sdk/).
