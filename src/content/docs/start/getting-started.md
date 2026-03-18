---
title: Getting Started
description: Set up the Groundhog SDK and write your first contract.
---

## Install

You need Rust and the Groundhog CLI. The CLI wraps Rust compilation, WASM optimization, and the test executor into one tool.

```bash
# Install Rust (if you don't have it)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install the Groundhog CLI (from source, during early access)
cargo install --path /path/to/groundhog-cli
```

The CLI manages the nightly toolchain and WASM target automatically for generated projects.

## Authenticate

During early access, the SDK is distributed through a private Cargo registry. Log in before creating your first project:

```bash
groundhog login
```

This configures registry credentials and access to the pre-compiled test executor library.

## Create a Project

```bash
groundhog new my-counter
cd my-counter
```

This scaffolds a counter contract with tests. Two templates are available:

| Template | Command | What you get |
|----------|---------|-------------|
| `counter` (default) | `groundhog new my-counter` | Counter with increment/decrement and tests |
| `stub` | `groundhog new my-contract --template stub` | Bare-bones contract with empty init |

## Two Modes: cargo vs groundhog

Generated projects work with both `cargo` and `groundhog`. They do different things:

| Command | Target | Use for |
|---------|--------|---------|
| `cargo build` | Native (host) | IDE support, rust-analyzer |
| `cargo test` | Native (host) | Fast iteration, step-through debugging |
| `groundhog build` | WASM | Production contract binary |
| `groundhog test` | WASM executor | Integration tests against the real runtime |

The `dev` feature is on by default, so `cargo build` and `cargo test` work out of the box for native compilation. `groundhog build` passes `--no-default-features` to disable `dev` and cross-compiles to WASM with `build-std`.

Use `cargo` for day-to-day development. Use `groundhog` when you need the WASM binary or want to test against the real executor.

```bash
# Iterate on logic (native, fast, debuggable)
cargo test

# Build the production WASM contract
groundhog build

# Test against the WASM executor
groundhog test
```

## What You Get

`groundhog new my-counter` generates three files:

**`Cargo.toml`**:

```toml
[package]
name = "my-counter"
version = "0.1.0"
edition = "2024"

[lib]
crate-type = ["cdylib", "rlib"]
doctest = false
test = false

[features]
default = ["dev"]
dev = ["sdk/dev"]

[dependencies]
sdk = { version = "0.3", registry = "groundhog", features = ["storage"] }
thiserror = { version = "2", default-features = false }
xdrs = { version = "0.5", registry = "groundhog", features = ["derive"] }

[dev-dependencies]
my-counter = { path = ".", features = ["dev"] }
```

**`src/lib.rs`**:

```rust
#![cfg_attr(not(feature = "dev"), no_std)]

mod implementation;

pub use implementation::CounterClient;
pub use implementation::exports::*;

#[cfg(feature = "dev")]
pub use implementation::test_setup;
```

**`src/implementation.rs`**:

```rust
use sdk::storage::NNInt;
use sdk::*;
use thiserror::Error;

#[derive(Error, Debug, Clone, PartialEq, ReadXDR, WriteXDR)]
#[repr(i32)]
pub enum Error {
    #[error("Not authorized")]
    NotAuthorized = 1,
}

#[derive(Debug)]
#[sdk::storage]
pub struct Counter {
    value: NNInt,
}

#[contract(throws = Error, client = CounterClient)]
impl Counter {
    #[init]
    pub fn initialize(&mut self, initial_value: u64) {
        self.value.strict_inc(initial_value as i128);
    }

    pub fn increment(&mut self, amount: u64) {
        self.value.strict_inc(amount as i128);
    }

    pub fn decrement(&mut self, amount: u64) {
        self.value.strict_inc(-(amount as i128));
    }

    pub fn get(&self) -> u64 {
        self.value.try_get().unwrap_or(0) as u64
    }
}
```

**`tests/test.rs`**:

```rust
use my_counter::CounterClient;
use sdk::call::CallError;
use sdk::*;

static NONCE: SHA256Hash =
    sdk::sha256_static!("MY_COUNTER_NONCE");

#[test]
fn test_counter() {
    let mut env = sdk::TestEnvironment::no_cost();
    let test_contract =
        my_counter::test_setup::register(&mut env);
    let contract_hash =
        env.setup_create_contract(&test_contract);

    contract_exec(env, move || {
        let addr =
            deploy_contract(&NONCE, &contract_hash);
        let mut client = CounterClient::new(&addr);

        client.initialize(10);
        assert_eq!(client.get(), 10);

        client.increment(5);
        assert_eq!(client.get(), 15);

        client.decrement(3);
        assert_eq!(client.get(), 12);
    })
    .unwrap_or_else(|e| panic!("Test failed: {e}"));
}
```

Run `cargo test` to verify everything works.

## Deployment

:::caution[Coming Soon]
`groundhog deploy`, `groundhog call`, and `groundhog keys` are planned but not yet implemented. Testnet deployment instructions will be added when these commands ship.
:::

---

## SDK Layers: Use What You Need

The SDK is not a framework you're locked into. It's a set of optional convenience layers over the base storage primitives. You can use as much or as little as you want.

| Layer | What It Provides | Example |
|-------|-----------------|---------|
| **Raw syscalls** | Direct `bytestring_set()`, `non_negative_int_strict_inc()` calls. Full control, no abstraction. | `erc20_low_level/` |
| **Typed wrappers** | `NNInt`, `Handle<T>`, `Map<K, V>`. Type-safe access with auto-serialization. | `erc20_no_storage/` |
| **Macros** | `#[storage]`, `#[contract]`. Generates boilerplate for storage structs, WASM exports, and client code. | `erc20/`, `counter/` |

Each layer builds on the one below it. The `erc20_low_level/` example implements a full ERC-20 token using only raw syscalls and manual key hashing. It works identically to the macro-based version. The macros exist to reduce boilerplate, not to restrict what you can build.

The tutorials use the macro layer because it's the fastest path to a working contract. When you see `#[sdk::storage]` or `#[contract]` in example code, those are convenience macros generating serialization and WASM exports. You could do the same thing by hand with raw syscalls.

If the provided storage types don't fit your use case, you can work with raw bytestrings and build your own abstractions. The syscall interface is stable and documented in the [Syscalls Reference](/reference/syscalls/).

## Contract Anatomy

A Groundhog contract (using the macro layer) has three parts:

1. **Error type.** Defines your contract's error variants. Must derive XDR serialization. SDK-level errors (like NNInt underflow) abort automatically; you only define business logic errors.

2. **Storage struct.** Marked with `#[sdk::storage]`. Fields become persistent storage slots. Use `NNInt` for balances/counters, `Map<K, V>` for key-value data, `Handle<T>` for single values.

3. **Implementation block.** Marked with `#[contract]`. Public methods become WASM exports. `#[init]` marks the constructor (runs once at deployment). `&mut self` methods write state; `&self` methods are read-only.

The core pattern: all state mutations use `strict_inc(delta)` to record changes as deltas, not absolute values. This gives you built-in guarantees (no double spends, no negative balances) with less code. It also makes operations commutative, which is how the system executes them in parallel.

### Error Handling

The SDK uses an **abort-centric** error model. Contract methods return values directly (not `Result`). When something goes wrong, the transaction aborts:

- `strict_inc(delta)` aborts automatically on NNInt underflow
- `abort(&error)` aborts with a typed error
- `ensure(condition, error)` aborts if the condition is false

You can't catch an abort within the same contract. To handle errors from *another* contract, use the `try_*` client methods. See [Error Handling](/reference/error-handling/) for the complete model.

## Design Guidelines

### Do

- Use `NNInt` for all balances and counters
- Use `strict_inc(delta)` for commutative updates (aborts on underflow)
- Use `ensure(condition, error)` for authorization checks
- Design with deltas in mind: `+50`, `-20`, not `set 130`
- Keep storage keys independent when possible

### Avoid

- Absolute writes to frequently-updated values (forces serialization)
- Reading a value and writing it back (use deltas instead)

## Next Steps

- [Build a Counter](/tutorials/build-a-counter/) for the full step-by-step first contract tutorial
- [Build a Token](/tutorials/build-a-token/) for a production ERC-20 implementation
- [Storage Types](/programming-model/storage-types/) for `NNInt`, `Map`, `Bytestring`, and `RetrocausalQueue`
- [Execution Model](/programming-model/execution/) for snapshots, deltas, and merge rules
