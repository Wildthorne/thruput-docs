---
title: Getting Started
description: Set up the Groundhog SDK and write your first contract.
---

## The Groundhog CLI

:::caution[Coming Soon]
The Groundhog CLI is under development. When it ships, the full workflow below will work as written. For now, skip to [Early Access Setup](#early-access-setup) for the current manual path.
:::

The CLI handles the entire contract lifecycle in single commands:

```bash
# Install
brew install groundhog

# Create a new contract project
groundhog new my-counter
cd my-counter

# Test locally (native execution, instant feedback)
groundhog test

# Build to WASM
groundhog build

# Create a testnet identity and fund it
groundhog keys new --fund

# Deploy
groundhog deploy

# Call your contract
groundhog call my-counter increment 1
groundhog call my-counter get        # => 1
```

No config files to manage. No toolchain flags to remember. The CLI wraps Rust compilation, WASM optimization, the test executor, and deployment into one tool.

---

## Early Access Setup

The SDK is available to early access developers as a Rust workspace. You'll need:

- **Rust nightly** (the SDK uses unstable features for WASM compilation)
- **wasm-opt** (from [Binaryen](https://github.com/WebAssembly/binaryen), for optimizing WASM output)

```bash
# Install Rust (if you don't have it)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add the WASM target
rustup target add wasm32-unknown-unknown

# Install wasm-opt (macOS)
brew install binaryen
```

### Creating a Contract

The fastest path: start from the `counter/` example in the SDK's `example-contracts/` directory. It contains a working Cargo.toml, contract code, and tests.

For a new contract from scratch, you need three files:

**`Cargo.toml`** with the WASM crate type and SDK dependency:

```toml
[package]
name = "my-contract"
version = "0.1.0"
edition = "2024"

[lib]
crate-type = ["cdylib", "rlib"]
doctest = false
test = false

[dependencies]
sdk = { version = "0.1" }
thiserror = { version = "2", default-features = false }
xdrs = { version = "0.1" }

[features]
dev = ["sdk/dev"]

[dev-dependencies]
my-contract = { path = ".", features = ["dev"] }
```

**`src/lib.rs`** with the contract:

```rust
#![cfg_attr(not(feature = "dev"), no_std)]

use sdk::prelude::*;

#[derive(Error, Debug, Clone, PartialEq, ReadXDR, WriteXDR)]
#[repr(i32)]
pub enum Error {
    #[error("Not authorized")]
    NotAuthorized = 1,
}

#[sdk::storage]
pub struct Counter {
    count: NNInt,
}

#[contract(throws = Error)]
impl Counter {
    #[init]
    pub fn initialize(&mut self, starting_value: u64) {
        self.count.strict_inc(starting_value as i128);
    }

    pub fn increment(&mut self, amount: u64) {
        self.count.strict_inc(amount as i128);
    }

    pub fn get(&self) -> u64 {
        self.count.try_get().unwrap_or(0) as u64
    }
}
```

**`tests/test.rs`** with a basic test:

```rust
use my_contract::*;
use sdk::testutils::*;

#[test]
fn test_increment() {
    let env = TestEnvironment::no_cost();
    let (addr, mut client) = env.deploy::<Counter>();

    client.increment(5);
    assert_eq!(client.get(), 5);

    client.increment(3);
    assert_eq!(client.get(), 8);
}
```

### Building

```bash
# Build to WASM
cargo --config .cargo/contract.toml build --release

# Optimize (reduces binary size)
wasm-opt -O3 --enable-bulk-memory target/wasm32-unknown-unknown/release/my_contract.wasm \
  -o my_contract.wasm
```

### Testing

Building to WASM only needs the Rust toolchain. Running tests uses the `native_exec` mock executor, which runs your contract logic natively (not in WASM) so you can use standard Rust debugging tools, set breakpoints, and iterate on business logic before deploying to testnet.

```bash
cargo test -- --show-output
```

On supported platforms (x86_64 Linux, aarch64 macOS), prebuilt test libraries are downloaded automatically.

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

The core pattern: all state mutations use `strict_inc(delta)` to record changes as deltas, not absolute values. This is what makes operations commutative and enables parallel execution.

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
- [Storage Types](/reference/storage-types/) for the full `NNInt`, `Map`, and `Bytestring` API
- [Execution Model](/how-it-works/execution-model/) for snapshots, deltas, and merge rules
