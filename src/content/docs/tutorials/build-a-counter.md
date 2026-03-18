---
title: Build a Counter
description: "Tutorial: build a counter contract on Groundhog, step by step."
---

We're building a counter contract with initialize, increment, decrement, and get operations. It's the simplest possible Groundhog contract, but it demonstrates the core idea: express what you want to happen (`strict_inc`), not how to compute it. The system guarantees the result is correct, and as a bonus, concurrent operations execute in parallel.

**Prerequisites:** Complete the [Getting Started](/start/getting-started/) guide for SDK setup.

## What You'll Build

A contract with four methods:

| Method | Signature | What it does |
|--------|-----------|-------------|
| `initialize` | `(&mut self, initial_value: u64)` | Set starting value (runs once at deploy) |
| `increment` | `(&mut self, amount: u64)` | Add to the counter |
| `decrement` | `(&mut self, amount: u64)` | Subtract from the counter (aborts if result would be negative) |
| `get` | `(&self) -> u64` | Read current value |

## Step 1: Project Setup

Create a new contract crate in your workspace. Your `Cargo.toml`:

```toml
[package]
name = "counter"
version.workspace = true
edition.workspace = true

[features]
dev = ["sdk/dev"]

[lib]
crate-type = ["cdylib", "rlib"]
doctest = false
test = false

[dependencies]
sdk = { workspace = true, features = ["storage"] }
thiserror = { workspace = true }
xdrs = { workspace = true, features = ["derive"] }

[dev-dependencies]
counter = { path = ".", features = ["dev"] }
```

Your `src/lib.rs`:

```rust
#![cfg_attr(not(feature = "dev"), no_std)]

mod implementation;
pub use implementation::*;

#[cfg(feature = "dev")]
pub use implementation::test_setup;
```

The `no_std` attribute applies when not testing. Contracts compile to WASM, which has no standard library. The `dev` feature flag enables testing utilities (mock environment, test setup) that aren't included in the production build.

## Step 2: Define the Error Type

Every contract needs an error type. It must derive `ReadXDR` and `WriteXDR` for serialization, and `thiserror::Error` for display. The `#[repr(i32)]` attribute maps each variant to an integer for the XDR encoding.

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
```

This counter doesn't actually use authorization, so the `NotAuthorized` variant is a placeholder. The `#[contract]` macro requires the error type to exist. In a real contract, you'd add variants for your business logic errors. You don't need variants for SDK-level errors like NNInt underflow: those abort automatically.

## Step 3: Define Storage

```rust
#[derive(Debug)]
#[sdk::storage]
pub struct Counter {
    value: NNInt,
}
```

The `#[sdk::storage]` macro generates serialization and persistence code. Each field becomes a storage slot. `NNInt` (non-negative integer) is the core commutative primitive: it supports additive operations that commute by construction.

One field is all this contract needs. More complex contracts use `Map<K, V>` for key-value storage (see [Build a Token](/tutorials/build-a-token/)).

## Step 4: Implement the Contract

```rust
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

Line by line:

- **`#[contract(throws = Error, client = CounterClient)]`** generates WASM exports for each public method and a `CounterClient` struct for cross-contract calls and testing.

- **`#[init]`** marks `initialize` as the constructor. It runs once at deploy time.

- **`strict_inc(delta)`** is the only mutation operation. It records a delta ("+5", "-3") rather than an absolute value ("set to 10"). This is what makes operations commutative. Two concurrent `increment(5)` calls produce `+10`, regardless of execution order. `strict_inc` takes `i128`, so we cast the `u64` amount. For decrements, we negate the delta.

- **`strict_inc` aborts on underflow.** If the counter is at 3 and you call `decrement(5)`, the result would be -2, which violates the `NNInt` invariant. The transaction aborts automatically. You don't need to check for this.

- **`try_get().unwrap_or(0)`** reads the current value. `try_get()` returns `None` if the storage slot has never been written to, so `unwrap_or(0)` provides a default.

- **`&self` vs `&mut self`**: `get` takes `&self` (read-only), so it reads from the snapshot without producing any deltas. The other methods take `&mut self` and produce state changes.

## Step 5: Test It

Create `tests/test.rs`:

```rust
use counter::CounterClient;
use sdk::call::CallError;
use sdk::*;

static COUNTER_NONCE: SHA256Hash = sdk::sha256_static!("COUNTER_TEST_NONCE");

#[test]
fn test_counter_basic() {
    let mut env = sdk::TestEnvironment::no_cost();

    let test_contract = counter::test_setup::register(&mut env);
    let contract_hash = env.setup_create_contract(&test_contract);

    contract_exec(env, move || {
        let addr = deploy_contract(&COUNTER_NONCE, &contract_hash);

        let mut client = CounterClient::new(&addr);

        // Initialize with value 10
        client.initialize(10);
        assert_eq!(client.get(), 10);

        // Increment by 5
        client.increment(5);
        assert_eq!(client.get(), 15);

        // Decrement by 3
        client.decrement(3);
        assert_eq!(client.get(), 12);
    })
    .unwrap_or_else(|e| panic!("Test failed: {e}"));
}
```

Breaking down the test setup:

1. **`TestEnvironment::no_cost()`** creates a mock environment that skips storage cost enforcement. Good for logic tests.
2. **`test_setup::register`** registers the contract with the test environment. This module is generated by the `#[contract]` macro and exposed via the `dev` feature.
3. **`setup_create_contract`** produces a contract hash for deployment.
4. **`contract_exec`** runs the closure in a simulated contract execution context.
5. **`deploy_contract`** deploys the contract and returns its address. The nonce makes the address deterministic across test runs.
6. **`CounterClient::new`** creates a typed client. Methods return values directly (no `Result` unwrapping needed).

### Testing Error Cases

Use `try_*` methods to verify that operations fail as expected:

```rust
#[test]
fn test_counter_underflow() {
    let mut env = sdk::TestEnvironment::no_cost();

    let test_contract = counter::test_setup::register(&mut env);
    let contract_hash = env.setup_create_contract(&test_contract);

    contract_exec(env, move || {
        let addr = deploy_contract(&COUNTER_NONCE, &contract_hash);
        let mut client = CounterClient::new(&addr);

        client.initialize(5);

        // Decrementing by 10 should abort - NNInt can't go negative
        match client.try_decrement(10) {
            Err(CallError::Abort(ref exn)) => {
                assert!(exn.as_library_exn().is_some());
            }
            other => panic!("Expected abort, got: {:?}", other),
        }
    })
    .unwrap_or_else(|e| panic!("Test failed: {e}"));
}
```

The `try_decrement` method (generated by the `#[contract]` macro alongside `decrement`) returns a `Result` instead of aborting. The error is a `CallError::Abort` containing a `CrossExn`. For NNInt underflow, `as_library_exn()` returns `Some(LibraryExn::NonNegativeIntUnderflow)`.

## Why This Matters

This counter is trivial, but the pattern scales. Every mutation is a delta operation. That means if 1,000 users call `increment(1)` in the same block, all 1,000 transactions execute in parallel and merge to produce `+1000`. No conflicts, no retries, no ordering dependency. This is the foundation of every Groundhog contract, from simple counters to full token systems.

## Next Steps

- [Build a Token](/tutorials/build-a-token/) for a full ERC-20 implementation using the same patterns
- [Storage Types](/programming-model/storage-types/) for `NNInt`, `Map`, `Bytestring`, and `RetrocausalQueue`
- [NNInt In Depth](/programming-model/nnint/) for the `set_add` primitive and commutativity rules
- [SDK Macros](/reference/sdk-macros/) for details on `#[contract]`, `#[storage]`, `#[init]`
