---
title: Getting Started
description: Set up the Groundhog SDK and write your first contract.
---

## How to Start

The **Groundhog CLI** is the recommended way to get going. It scaffolds a project, manages the Rust toolchain, and wraps the build and test workflow. The tutorials on this site all start from CLI-generated projects.

That said, the CLI is a convenience, not a requirement. You can also:

- Start from the example contracts in the SDK repository (`example-contracts/` in `sdk_rs`)
- Build a project from scratch using the SDK crate directly

The CLI and example contracts produce the same thing: a Rust crate that compiles to WASM and uses the SDK's storage types and macros.

## Install

```bash
# Install Rust (if you don't have it)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install the Groundhog CLI (from source, during early access)
cargo install --path /path/to/groundhog-cli
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

Generated projects work with both `cargo` and `groundhog`. They target different things:

| Command | Target | Use for |
|---------|--------|---------|
| `cargo build` | Native (host) | IDE support, rust-analyzer |
| `cargo test` | Native (host) | Fast iteration, step-through debugging |
| `groundhog build` | WASM | Production contract binary |
| `groundhog test` | WASM mock executor | Integration tests against the C++ mock runtime |

The `dev` feature is on by default, so `cargo` works out of the box for native compilation. `groundhog build` disables `dev` and cross-compiles to WASM with `build-std`.

Use `cargo` for day-to-day development (it's fast, you can set breakpoints). Use `groundhog` when you need the production WASM binary or want to test against the mock runtime. Both test modes use mock executors. Testing against a local node or testnet is not yet available.

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
| **Macros** | `#[storage]`, `#[contract]`, `#[init]`. Generates storage wiring, WASM exports, and client stubs. | Default. Start here. |
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
