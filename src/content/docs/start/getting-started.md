---
title: Getting Started
description: Set up the Groundhog CLI and build your first RV32 contract.
---

## How to Start

The **[Groundhog CLI](/tools/groundhog-cli/)** is the recommended way to get going. It scaffolds a project, manages the Rust toolchain, builds deployable RV32 artifacts, and wraps the local-node workflow. RV32 is Groundhog's 32-bit RISC-V contract target. The tutorials on this site all start from CLI-generated projects.

That said, the CLI is a convenience, not a requirement. You can also:

- Start from the example contracts in the SDK repository (`example-contracts/` in `sdk_rs`)
- Build a project from scratch using the SDK crate directly

The CLI is just a consumer of the SDK. It generates the same Rust crate you'd write by hand: a standard Cargo project that depends on the SDK, uses the SDK's storage types and macros, and builds to RV32 by default.

:::note[Version checked]
This workflow was last checked against Groundhog CLI `0.5.10` and SDK `0.15.4` on June 26, 2026.
:::

## Install

```bash
# Install Rust (if you don't have it)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install the Groundhog CLI (from source, during early access)
cargo install groundhog-cli  # exact instructions provided during early access onboarding
```

## Configure Cargo

During early access, the SDK is distributed through a private Cargo registry. Configure Cargo with the registry settings and credentials from your onboarding instructions before creating or building SDK projects. The Groundhog CLI does not manage Cargo registry credentials.

## Create and Run

```bash
groundhog new my-counter
cd my-counter
cargo test
groundhog build
```

You now have a working counter contract with passing native tests and a deployable RV32 artifact under `target/groundhog/`. The CLI also offers a `stub` template (`groundhog new my-contract --template stub`) if you want a bare-bones starting point.

:::note[Git ignore]
Early-access scaffolds may not create `.gitignore` yet. Add `/target` before running `git init` or committing the project.
:::

## Main Commands

Generated projects work with both `cargo` and `groundhog`. Use `cargo` for native Rust development and `groundhog` for contract artifacts, local nodes, and RPC workflows:

| Command | What happens | Use for |
|---------|-------------|---------|
| `cargo build` | Compiles as native code for your host machine | IDE support, rust-analyzer |
| `cargo test` | Runs tests natively. Faults are Rust panics caught by `catch_unwind`. | Fast logic tests, step-through debugging |
| `groundhog build` | Builds the deployable RV32 artifact and spec sidecars | Deployable contract artifact |
| `groundhog node` | Starts a standalone local `hog-devnode` on port `9545` | Local deploy/call testing |
| `groundhog deploy` | Signs and submits the selected built artifact | Deploy to the selected profile |
| `groundhog test --integration` | Starts an ephemeral `hog-devnode`, deploys the contract, and runs `tests/integration.rs` | End-to-end RPC tests |
| `groundhog test` | Runs the WASM compatibility harness | Legacy WASM checks |

For a command-by-command map, including the Foundry/Anvil mental model for local development, see [Groundhog CLI](/tools/groundhog-cli/).

### What `groundhog build` Produces

`groundhog build` defaults to `--target rv32`. It compiles the RV32 (32-bit RISC-V) entrypoint binary, lowers it, and writes:

- `target/groundhog/<name>.rv32a`: deployable contract artifact
- `target/groundhog/<name>.rv32.json`: RV32 lowering metadata
- `target/groundhog/<name>.spec.xdr`: canonical contract spec
- `target/groundhog/<name>.spec.json`: human-readable contract spec

The effective Cargo build is:

```bash
cargo build \
  --release \
  --no-default-features \
  --features rv32-entrypoints \
  --target riscv32im-unknown-none-elf \
  --bin my_counter
```

Then the CLI lowers the ELF into the `.rv32a` artifact consumed by the node.

WASM is still available with `groundhog build --target wasm`, but RV32 is the default path. Use WASM only for compatibility checks or legacy tooling that still depends on it.

### Integration Tests

`groundhog test --integration` is the production-shaped test path. It starts an ephemeral `hog-devnode`, builds and deploys the selected artifact (`rv32` by default), and runs `tests/integration.rs` with these environment variables:

| Variable | Value |
|----------|-------|
| `GROUNDHOG_RPC_URL` | RPC URL for the ephemeral node |
| `GROUNDHOG_CONTRACT_ADDRESS` | Address of the deployed contract |
| `GROUNDHOG_PROFILE` | `integration` |
| `GROUNDHOG_DEFAULT_KEY` | `dev-0` |
| `GROUNDHOG_RUNTIME_MANIFEST` | Runtime manifest path, when available |

Use `--target wasm` only when you need to compare against the legacy WASM artifact. Use `--differential` to run the same integration test against isolated RV32 and WASM local nodes.

## What the CLI Generated

```
my-counter/
  Cargo.toml              # SDK dependency, RV32 bin wrapper, dev feature toggle
  groundhog.toml          # CLI profiles, default local RPC URL, default key
  rust-toolchain.toml     # Rust toolchain and targets
  .cargo/
    config.toml           # Cargo target configuration
    contract.toml         # WASM compatibility build overlay
  src/
    lib.rs                # Module wiring, no_std for contract builds, test setup export
    implementation.rs     # Your contract: error type, storage struct, methods
    main.rs               # RV32 entrypoint wrapper
  tests/
    test.rs               # Native SDK tests through the generated client
    test_wasm.rs          # WASM compatibility test, run by `groundhog test`
```

The counter has four core methods: `initialize`, `increment`, `decrement`, and `get`. The scaffold also includes a small event example (`ping`) and an explicit error example (`error`). All counter mutations use `strict_inc` (delta operations that commute). The native test deploys the contract into a mock environment and calls it through a generated client.

For a line-by-line walkthrough of this code, see [Build a Counter](/tutorials/build-a-counter/).

## The SDK is Layered

The CLI generates code using the macro layer (`#[sdk::storage]`, `#[contract]`). This is the fastest path to a working contract, but it's not the only way to build on Groundhog.

The SDK is three layers, each building on the one below:

| Layer | What it provides | When to use |
|-------|-----------------|-------------|
| **Macros** | `#[storage]`, `#[contract]`, `#[contract_exception]`. Generates storage wiring, contract entrypoints, and client stubs. | Default. Start here. |
| **Typed wrappers** | `NNInt`, `Map<K, V>`, `Value<T>`, `Bytestring`, `RCQ<T>`, `Vector<T>`. Type-safe storage access with auto-serialization. | When you need control over storage layout without writing raw syscalls. |
| **Raw syscalls** | Direct `bytestring_set()`, `non_negative_int_strict_inc()` calls. | When you need full control or are building your own abstractions. |

The `erc20_low_level/` example in the SDK implements a full ERC-20 token using only raw syscalls. It works identically to the macro-based version. The macros reduce boilerplate, they don't restrict what you can build.

If the provided storage types don't fit your use case, drop down a layer. The syscall interface is documented in the [Syscalls Reference](/reference/syscalls/). Generated Rustdoc for exact SDK signatures lives at [groundhog.dev/docs/](https://groundhog.dev/docs/); see [Rust API Docs](/tools/rust-api-docs/) for common links.

## Deployment

The CLI handles the full deploy/call/inspect flow:

```bash
groundhog keys generate              # create an Ed25519 signing key
groundhog node                       # start a local hog-devnode on :9545
groundhog build                      # build the RV32 artifact
groundhog deploy                     # sign and submit the selected artifact
groundhog call <addr> increment 1    # send a signed transaction
groundhog view <addr> get            # sandboxed read-only simulation
groundhog storage <addr> 0x<key>     # read raw committed storage
```

`groundhog node` prints the local RPC URL and runtime manifest. The default generated profile points at `http://localhost:9545` and uses `dev-0`, so the local-node path works without creating a separate key. If `hog-devnode` is not on your `PATH`, set `GROUNDHOG_DEVNODE_BINARY=/path/to/hog-devnode`.

`--profile` selects which network the command targets. Profiles live in `groundhog.toml` and `~/.config/groundhog/`; keys are stored globally at `~/.config/groundhog/keys/`. `GROUNDHOG_RUNTIME_MANIFEST` can point the CLI at a specific runtime manifest when you are not using the project-local node state. Run `groundhog status` for a non-interactive diagnostic of toolchain, keys, credentials, and project config.

A hosted testnet faucet is not yet available; for now, fund accounts via the local dev node.

## Next Steps

- **[Groundhog CLI](/tools/groundhog-cli/)**: Map each CLI command to the development job it handles
- **[Rust API Docs](/tools/rust-api-docs/)**: Find generated Rustdoc for the SDK crates
- **[Build a Counter](/tutorials/build-a-counter/)**: Line-by-line walkthrough of the contract you just generated
- **[Programming Model](/programming-model/execution/)**: Understand why this works (snapshots, deltas, commutativity)
- **[Build a Token](/tutorials/build-a-token/)**: Build a full ERC-20 token
