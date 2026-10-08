---
title: Methods and interfaces
description: Define contract state, expose methods, and share typed interfaces with Rust callers.
---

Start with a [generated project](/cli/create-project/) so its host tests and RV32 entrypoint are configured.

## Define state and behavior

```rust
use sdk::storage::NNInt;
use sdk::*;

#[derive(Debug)]
#[sdk::storage]
pub struct Counter {
    value: NNInt,
}

#[contract]
impl Counter {
    pub fn increment(&mut self, amount: u64) {
        self.value.strict_inc(amount as i128);
    }

    pub fn get(&self) -> i128 {
        self.value.try_get().none_if_missing().unwrap_or(0)
    }
}
```

`#[sdk::storage]` assigns each field a storage path. The field is a handle to persisted data, not an in-memory integer that you must save manually. `#[contract]` generates entrypoints, a `CounterClient`, and interface metadata.

`none_if_missing()` gives the never-written counter a zero default while preserving other storage errors. Do not turn every read error into zero with `unwrap_or(0)` on the original `Result`.

## Expose methods

Public methods on an inherent implementation become entrypoints. Private helper methods stay internal. Use `&mut self` to update through mutable storage handles and `&self` to read through shared handles. A method without a receiver does not need the generated storage struct.

Rust receiver mutability is separate from runtime call restrictions. Use [read-only child calls](/contracts/cross-contract-calls/#gas-limits) when the runtime must reject state changes.

Exported methods return their normal values. Use [contract exceptions](/contracts/errors/) for failures.

## Share an interface

Put a trait in a shared interface crate when callers need the interface without importing its implementation:

```rust
use sdk::*;

#[contract]
pub trait CounterApi {
    fn increment(&mut self, amount: u64);
    fn get(&self) -> i128;
}
```

This generates `CounterApiClient`. Mark the trait implementation with `#[contract]` too. Declare `throws` and `emits` on the trait definition, not again on its implementation.

For a self-contained contract, the inherent implementation in the first example is enough. The [macro reference](/reference/sdk-macros/#contract) lists parameters and reserved method names.

## Define argument and return types

```rust
#[contract_type]
pub struct CounterSummary {
    pub value: i128,
    pub owner: ContractAddress,
}
```

`#[contract_type]` supplies serialization and spec metadata. Use `Value<T>` when plain data must persist; choose other [storage types](/programming-model/storage-types/) for other update patterns.

## Initialize and generate bindings

Initialization is an ordinary method, not an automatic constructor. Enforce one-time initialization when required and [initialize atomically with deployment](/cli/deploy-and-call/#include-initialization).

Rust callers use generated clients. [Generate client bindings](/contracts/client-bindings/) to share the built contract interface with TypeScript applications. Keep bindings and deployment addresses from the same interface build.
