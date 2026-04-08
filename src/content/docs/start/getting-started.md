---
title: Getting Started
description: Set up the Groundhog SDK and write your first contract.
---

## How to Start

The **Groundhog CLI** is the recommended way to get going. It scaffolds a project, manages the Rust toolchain, and wraps the build and test workflow. The tutorials on this site all start from CLI-generated projects.

That said, the CLI is a convenience, not a requirement. You can also:

- Start from the example contracts in the SDK repository (`example-contracts/` in `sdk_rs`)
- Build a project from scratch using the SDK crate directly

The CLI is just a consumer of the SDK. It generates the same Rust crate you'd write by hand: a standard Cargo project that depends on the SDK, compiles to WASM, and uses the SDK's storage types and macros.

## Install

```bash
# Install Rust (if you don't have it)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install the Groundhog CLI (from source, during early access)
cargo install groundhog-cli  # exact instructions provided during early access onboarding
```

## Authenticate

During early access, the SDK is distributed through a private Cargo registry. Log in before creating your first project:

```bash
groundhog login
```

## Create and Run

```bash
groundhog new my-counter
cd my-counter
cargo test
```

Three commands. You now have a working counter contract with passing tests. The CLI also offers a `stub` template (`groundhog new my-contract --template stub`) if you want a bare-bones starting point.

## Two Modes: cargo vs groundhog

Generated projects work with both `cargo` and `groundhog`. They compile and test your contract differently:

| Command | What happens | Use for |
|---------|-------------|---------|
| `cargo build` | Compiles as native code for your host machine | IDE support, rust-analyzer |
| `cargo test` | Runs tests natively. Faults are Rust panics caught by `catch_unwind`. | Fast iteration, step-through debugging |
| `groundhog build` | Cross-compiles to WASM (the production binary format) | Deployable contract artifact |
| `groundhog test` | Runs tests through the C++ mock executor. Faults abort like a real contract. | Behavior-accurate integration tests |

These are meaningfully different test experiences. In native mode, a contract fault is a Rust panic that unwinds. In the mock executor, a fault is an actual abort, the same as what would happen on-chain. If you're debugging business logic, `cargo test` is faster and you can set breakpoints. If you're verifying that your contract behaves correctly under real abort/exclusion semantics, use `groundhog test`.

The `dev` feature is on by default, so `cargo` targets your host machine out of the box. The CLI commands are shortcuts for calling cargo with the WASM flags:

```bash
# What `groundhog build` does:
cargo --config .cargo/contract.toml build \
  --release --no-default-features --target wasm32-unknown-unknown

# The config overlay (.cargo/contract.toml) adds:
#   build-std = ["core", "alloc"]
#   panic = immediate-abort
```

You can call cargo directly with these flags if you prefer. The CLI just makes the default `cargo build` / `cargo test` be the native path and provides `groundhog build` / `groundhog test` for the WASM path.

Neither test mode uses a live network. Testing against a local node or testnet is not yet available.

## What the CLI Generated

```
my-counter/
  Cargo.toml              # SDK dependency, WASM crate type, dev feature toggle
  src/
    lib.rs                # Module wiring, no_std for WASM, test_setup export
    implementation.rs     # Your contract: error type, storage struct, methods
  tests/
    test.rs               # Deploy the contract and exercise it through the client
```

The counter has four methods: `initialize`, `increment`, `decrement`, `get`. All mutations use `strict_inc` (delta operations that commute). The test deploys the contract into a mock environment and calls it through a generated client.

For a line-by-line walkthrough of this code, see [Build a Counter](/tutorials/build-a-counter/).

## The SDK is Layered

The CLI generates code using the macro layer (`#[sdk::storage]`, `#[contract]`). This is the fastest path to a working contract, but it's not the only way to build on Groundhog.

The SDK is three layers, each building on the one below:

| Layer | What it provides | When to use |
|-------|-----------------|-------------|
| **Macros** | `#[storage]`, `#[contract]`, `#[contract_error]`. Generates storage wiring, WASM exports, and client stubs. | Default. Start here. |
| **Typed wrappers** | `NNInt`, `Map<K, V>`, `Handle<T>`. Type-safe storage access with auto-serialization. | When you need control over storage layout without writing raw syscalls. |
| **Raw syscalls** | Direct `bytestring_set()`, `non_negative_int_strict_inc()` calls. | When you need full control or are building your own abstractions. |

The `erc20_low_level/` example in the SDK implements a full ERC-20 token using only raw syscalls. It works identically to the macro-based version. The macros reduce boilerplate, they don't restrict what you can build.

If the provided storage types don't fit your use case, drop down a layer. The syscall interface is documented in the [Syscalls Reference](/reference/syscalls/).

## Deployment

:::caution[Coming Soon]
`groundhog deploy`, `groundhog call`, and `groundhog keys` are planned but not yet implemented. Testnet deployment instructions will be added when these commands ship.
:::

## Next Steps

- **[Build a Counter](/tutorials/build-a-counter/)**: Line-by-line walkthrough of the contract you just generated
- **[Programming Model](/programming-model/execution/)**: Understand why this works (snapshots, deltas, commutativity)
- **[Build a Token](/tutorials/build-a-token/)**: Build a full ERC-20 token
