---
title: Getting Started
description: Set up the Groundhog CLI and build your first RV32 contract.
---

## How to Start

The **[Groundhog CLI](/tools/groundhog-cli/)** is the recommended way to get going. It scaffolds a project, manages the Rust toolchain, builds deployable RV32 artifacts, and wraps the local-node workflow. RV32 is Groundhog's 32-bit RISC-V contract target. The tutorials on this site all start from CLI-generated projects.

That said, the CLI is a convenience, not a requirement. You can also:

- Inspect `sdk_rs/example-contracts/` as the SDK's internal compatibility and test corpus
- Build a project from scratch using the SDK crate directly

The CLI is just a consumer of the SDK. It generates the same Rust crate you'd write by hand: a standard Cargo project that depends on the SDK and uses its storage types and macros. Normal `cargo build` and `cargo test` target the host. `groundhog build` and `groundhog test` target RV32 by default.

:::note[Version checked]
This workflow was source-checked against Groundhog CLI `0.6.3` and SDK `0.17.9` on August 5, 2026.
:::

## Configure Cargo and Install

During early access, the SDK and CLI are distributed through the private Groundhog Cargo registry. Configure Cargo with the registry index and token from your onboarding instructions first.

```bash
# Install Rust (if you don't have it)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install the published CLI from the private registry
cargo install groundhog-cli \
  --version "=0.6.3" \
  --registry groundhog \
  --locked
```

To install from a `groundhog-rpc` source checkout instead:

```bash
cargo install --locked --path crates/tools/cli
```

The Groundhog CLI does not manage Cargo registry credentials.

## Initialize the CLI

Run the interactive setup before creating your first project:

```bash
groundhog init
```

Init creates reusable global `local` and `devnet` profiles. The Devnet profile includes its RPC and faucet settings. On a fresh setup with no stored keys, accept key generation to create and select the key named `default`.

Groundhog stores global profiles in `~/.config/groundhog/config.toml` by default. A project's `groundhog.toml` is an optional overlay for project defaults, profile overrides, and contract aliases. Same-named profiles merge, with project values taking precedence. Groundhog honors `XDG_CONFIG_HOME` when set.

Inspect the profiles created by init:

```bash
groundhog config profiles
groundhog config get devnet --sources
```

Use `groundhog config new`, `set`, `unset`, and `use` for routine profile management instead of editing TOML. See [Groundhog CLI configuration](/tools/groundhog-cli/#configuration) for merge behavior, selection precedence, and mutation scope.

### Create a Devnet Wallet

For a fresh installation, create a globally reusable wallet for the selected `default` key from outside a Groundhog project:

```bash
groundhog wallet create --profile devnet
groundhog balance default --profile devnet
```

The wallet inherits the key name. Wallet creation prefunds its address, so no separate airdrop is needed for initial setup. If you selected another key, substitute its name for `default`. See [Faucet](/tools/faucet/) for additional funding and retry guidance.

## Create and Run

```bash
groundhog new my-counter
cd my-counter
cargo test
groundhog build
```

You now have a working counter contract with passing native tests and a deployable RV32 artifact under `target/groundhog/`. The CLI also offers a `stub` template (`groundhog new my-contract --template stub`) if you want a bare-bones starting point.

The scaffold creates `.gitignore` entries for `/target/` and `/.groundhog/`.

## Main Commands

Generated projects work with both `cargo` and `groundhog`. Use `cargo` for native Rust development and `groundhog` for contract artifacts, local nodes, and RPC workflows:

| Command | What happens | Use for |
|---------|-------------|---------|
| `cargo build` | Compiles as native code for your host machine | IDE support, rust-analyzer |
| `cargo test` | Runs tests natively. Faults are Rust panics caught by `catch_unwind`. | Fast logic tests, step-through debugging |
| `groundhog build` | Builds the deployable RV32 artifact and lowering metadata | Deployable contract artifact |
| `groundhog node` | Starts a standalone local `hog-devnode` on port `9545` | Local deploy/call testing |
| `groundhog deploy` | Signs and submits the selected built artifact | Deploy to the selected profile |
| `groundhog config get [profile]` | Inspects merged persisted profile configuration | Profile setup and troubleshooting |
| `groundhog wallet create` | Creates and prefunds a contract wallet | Hosted-network setup |
| `groundhog balance <target>` | Reads a committed native HOG balance | Funding checks |
| `groundhog test` | Runs executor-backed RV32 artifact tests | Contract artifact tests |
| `groundhog test --integration` | Starts an ephemeral `hog-devnode`, deploys the contract, and runs `tests/integration.rs` | End-to-end RPC tests |

For a command-by-command map, including the Foundry/Anvil mental model for local development, see [Groundhog CLI](/tools/groundhog-cli/).

### What `groundhog build` Produces

`groundhog build` defaults to `--target rv32`. It compiles the RV32 (32-bit RISC-V) entrypoint binary, lowers it, and writes:

- `target/groundhog/<name>.rv32a`: deployable contract artifact
- `target/groundhog/<name>.rv32.json`: RV32 lowering metadata
- `target/groundhog/<name>.spec.xdr`: canonical contract spec, when metadata exists
- `target/groundhog/<name>.spec.json`: human-readable contract spec, when metadata exists

The effective Cargo build is:

```bash
cargo build \
  --release \
  --no-default-features \
  --features rv32-entrypoints \
  --target riscv32im-unknown-none-elf \
  -p my-counter \
  --bin my_counter
```

Then the CLI lowers the ELF into the `.rv32a` artifact consumed by the node.

WASM is still available with `groundhog build --target wasm`, but RV32 is the default path. Both build paths finalize contract specs when metadata exists. Use WASM only for compatibility checks or tooling that still depends on it.

### Integration Tests

`groundhog test --integration` is the production-shaped test path. It starts an ephemeral `hog-devnode`, builds and deploys the RV32 artifact, and runs the scaffolded `tests/integration.rs` with these environment variables:

| Variable | Value |
|----------|-------|
| `GROUNDHOG_INTEGRATION_TEST` | `1`; activates the scaffolded live test |
| `GROUNDHOG_RPC_URL` | RPC URL for the ephemeral node |
| `GROUNDHOG_CONTRACT_ADDRESS` | Address of the deployed contract |
| `GROUNDHOG_PROFILE` | `integration` |
| `GROUNDHOG_DEFAULT_KEY` | `dev-0` |
| `GROUNDHOG_RUNTIME_MANIFEST` | Runtime manifest path, when available |

The starter test confirms that the node is live and the contract was deployed. Add contract-specific RPC assertions in that file. See [Testing](/programming-model/testing/#what-the-scaffold-gives-you) for the generated feature and build-script wiring.

## What the CLI Generated

```
my-counter/
  Cargo.toml              # SDK dependency, RV32 bin wrapper, dev feature toggle
  build.rs                # Activates the RPC test during integration runs
  groundhog.toml          # project profile overlays, selection, and contract aliases
  rust-toolchain.toml     # Rust toolchain and targets
  .gitignore              # ignores /target/ and /.groundhog/
  .cargo/
    config.toml           # Cargo target configuration
    contract.toml         # WASM compatibility build overlay
  src/
    lib.rs                # Module wiring, no_std contract builds, mock registration
    implementation.rs     # Your contract: error type, storage struct, methods
    main.rs               # RV32 entrypoint wrapper
  tests/
    test.rs               # Native SDK tests through the generated client
    integration.rs        # RPC test, run by `groundhog test --integration`
    test_rv32.rs          # RV32 artifact test, run by `groundhog test`
    test_wasm.rs          # WASM test, run by `groundhog test --target wasm`
```

The counter has four core methods: `initialize`, `increment`, `decrement`, and `get`. The scaffold also includes a small event example (`ping`) and an explicit error example (`error`). All counter mutations use `strict_inc`, which records signed changes instead of replacement values. Those [deltas can merge](/programming-model/execution/#merged-deltas) across concurrent calls. The native test deploys the contract into a mock environment and calls it through a generated client.

For a line-by-line walkthrough of this code, see [Build a Counter](/tutorials/build-a-counter/).

## SDK Surfaces

The CLI generates code using the macro layer (`#[sdk::storage]`, `#[contract]`). This is the fastest path to a working contract, but it's not the only way to build on Groundhog.

The SDK exposes three complementary surfaces. They can be mixed: a contract can use the `#[contract]` macro while accessing storage through typed handles or raw syscall wrappers.

| Layer | What it provides | When to use |
|-------|-----------------|-------------|
| **Macros** | `#[storage]`, `#[contract]`, `#[contract_exception]`. Generates storage wiring, contract entrypoints, and client stubs. | Default. Start here. |
| **Typed storage handles** | `Balance`, `NNInt`, `CapacityConstraint`, `Map<K, V>`, `Value<T>`, `Bytestring`, `RCQ<T>`, `Vector<T>`. `Value`, map keys, and typed RCQ entries use XDR; integer and bytestring types expose specialized storage operations. | Default storage access without writing raw syscalls. |
| **Raw syscalls** | Direct `bytestring_set()`, `non_negative_int_strict_inc()` calls. | When you need full control or are building your own abstractions. |

The SDK's `erc20_low_level/` example implements ERC-20 storage through raw bytestring and NNInt syscall wrappers instead of typed storage handles. It still uses `#[contract]`, generated clients, events, and SDK error helpers. Compare it with `erc20/`, which implements the same interface with `Value`, `Map`, and `Balance`.

If the provided storage types don't fit your use case, drop down a layer. The syscall interface is documented in the [Syscalls Reference](/reference/syscalls/). Generated Rustdoc for exact SDK signatures lives at [groundhog.dev/docs/](https://groundhog.dev/docs/); see [Rust API Docs](/tools/rust-api-docs/) for common links.

## Deployment

The CLI uses profiles to target local and hosted networks with the same build, deploy, call, view, balance, and storage commands.

| Path | Account model | Start here |
|------|---------------|------------|
| Local `hog-devnode` | Built-in `dev-0` wallet from the active runtime manifest | [Develop Locally with the CLI](/tutorials/develop-locally/) |
| Hosted Devnet | Persistent key-owned contract wallet funded through the faucet | [Develop on Devnet with the CLI](/tutorials/develop-on-devnet/) |

Use local development first for fast, disposable iteration. Move to Devnet when you want to validate persistent wallet setup, hosted endpoint behavior, faucet funding, and shared-chain deployment.

The [Groundhog CLI reference](/tools/groundhog-cli/) documents individual commands, flags, profile precedence, node options, and artifact formats.

## Next Steps

- **[Groundhog CLI](/tools/groundhog-cli/)**: Map each CLI command to the development job it handles
- **[Develop Locally with the CLI](/tutorials/develop-locally/)**: Build, deploy, and call the counter against `hog-devnode`
- **[Develop on Devnet with the CLI](/tutorials/develop-on-devnet/)**: Create a persistent key-owned wallet and deploy the counter to Devnet
- **[Rust API Docs](/tools/rust-api-docs/)**: Find generated Rustdoc for the SDK crates
- **[Build a Counter](/tutorials/build-a-counter/)**: Line-by-line walkthrough of the contract you just generated
- **[Merged Deltas](/programming-model/execution/#merged-deltas)**: Understand how concurrent state changes combine
- **[Build a Token](/tutorials/build-a-token/)**: Build a full ERC-20 token
