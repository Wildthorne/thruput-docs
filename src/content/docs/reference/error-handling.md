---
title: Error Handling
description: How errors work in Groundhog contracts.
---

Exported Groundhog contract methods return their declared values and signal failure by throwing an exception. The frame aborts, all state changes in that frame are discarded, and control returns to the caller. Private helpers may use `Result` when they translate failures into a contract or library exception.

You cannot catch an exception within the same contract. To handle errors from another contract, use `try_*` client methods (see [Cross-Contract Calls](/reference/cross-contract-calls/)).

:::note[Version checked]
This page was source-checked against SDK `0.17.9` on August 5, 2026.
:::

For exact SDK item docs, see [`#[contract_exception]`](https://groundhog.dev/docs/sdk/latest/sdk/attr.contract_exception.html), [`throw`](https://groundhog.dev/docs/sdk/latest/sdk/fn.throw.html), [`ensure`](https://groundhog.dev/docs/sdk/latest/sdk/fn.ensure.html), [`OrThrow`](https://groundhog.dev/docs/sdk/latest/sdk/trait.OrThrow.html), and [Rust API Docs](/tools/rust-api-docs/).

## Defining Errors

Use `#[contract_exception]` to define error types. The macro generates all required derives (`Debug`, `Clone`, `PartialEq`, `ReadXDR`, `WriteXDR`) and the `Exn` trait implementation automatically.

### `thiserror` and `anyhow`

You can use `thiserror` with `#[contract_exception]` when you want `Display` messages for logs, tests, or off-chain tooling. Put `#[derive(thiserror::Error)]` on the exception type and use `#[error("...")]` on each variant:

```rust
use sdk::*;

#[derive(thiserror::Error)]
#[contract_exception]
pub enum CounterError {
    #[error("not authorized")]
    NotAuthorized = 1,
}
```

Do not copy the usual `#[derive(Error, Debug)]` pattern from generic Rust examples. `#[contract_exception]` already generates `Debug`, `Clone`, and `PartialEq`; deriving them again creates duplicate implementations.

For contract crates, configure `thiserror` without the default `std` feature:

```toml
thiserror = { version = "2", default-features = false }
```

Avoid `anyhow` for contract exception types and public contract method surfaces. `anyhow::Error` is an erased application error type, while contract exceptions need concrete XDR-serializable types that appear in the contract spec. `anyhow` is fine in off-chain tools, build scripts, tests, or CLI code. Inside a contract, private helpers may use `Result` if they immediately convert failures into concrete contract exceptions with `throw`, `ensure`, or `or_throw`.

### Enum errors

Enum errors carry variant-level meaning. Each variant gets an explicit `i32` discriminant. The macro adds `#[repr(i32)]` for you.

```rust
use sdk::*;

#[contract_exception]
pub enum ERC20Error {
    AlreadyInitialized = 1,
    MustBeContractOwner = 2,
    TooLarge = 3,
    Internal = 100,
}
```

### Struct errors

Struct errors work when you only need a single error type with no variants.

```rust
use sdk::*;

#[contract_exception]
pub struct Unauthorized;
```

Structs with fields work too:

```rust
#[contract_exception]
pub struct InsufficientBalance {
    pub balance: u64,
}
```

## Throwing Errors

### `throw(exn)`

Aborts the current frame with the given error. Never returns.

```rust
use sdk::*;

fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    if amount == 0 {
        throw(ERC20Error::TooLarge);
    }
    // ...
}
```

### `ensure(condition, error)`

Throws `error` if `condition` is false. A convenience wrapper around `throw`.

```rust
use sdk::*;

fn mint(&mut self, receiver: &ContractAddress, amount: Amount) {
    let caller = get_caller();
    ensure(
        caller == self._contract_owner(),
        ERC20Error::MustBeContractOwner,
    );

    let diff = amount_to_diff(amount);
    self._adjust_balance(receiver, diff);
    self._adjust_total_supply(diff);
}
```

### `result.or_throw(exn)`

Extension method on `Result`. Returns the `Ok` value, or throws `exn` on `Err`. Useful for converting fallible operations into contract exceptions.

```rust
use sdk::*;

pub fn amount_to_diff(n: u128) -> i128 {
    n.try_into().or_throw(ERC20Error::TooLarge)
}
```

## Automatic Aborts

The SDK throws `LibraryExn` errors automatically when internal preconditions fail. You do not need to define error variants for these.

| Operation | Throws when |
|-----------|------------|
| `strict_inc(delta)` | Result would be negative (`NonNegativeIntUnderflow`) |
| `strict_inc(delta)` | Result would overflow (`NonNegativeIntOverflow`) |
| `Balance::decrease(amount)` | Balance is insufficient (`NonNegativeIntUnderflow`) |
| `Balance::increase(amount)` | Balance would overflow (`NonNegativeIntOverflow`) |
| `CapacityConstraint::set_capacity(value)` | Another non-idempotent write already occurred this transaction (`CapacityConstraintAlreadyWritten`) |
| `bytestring_get_sized` | Stored length does not match expected (`BytestringWrongSize`) |
| Storage read | Key does not exist (syscall error) |

```rust
// Aborts automatically if balance would go below zero.
// No error handling code needed.
balance.decrease(amount);
```

Every public SDK function whose name starts with `try_` reports its own failures through `Option` or `Result` instead of aborting. Storage `try_` getters return `Result<T, LibraryExn>`. Use `error.is_storage_missing()` to identify absence, or `.none_if_missing()` to convert only absence into `None` while re-throwing other failures.

## LibraryExn

`LibraryExn` is the SDK's built-in error enum. It covers all errors generated by SDK internals and runtime operations.

| Variant | Discriminant | Trigger |
|---------|--------------|---------|
| `Syscall(SyscallExn)` | 0 | A host syscall returned an error (e.g. storage key not found) |
| `Handling(HandlingError)` | 1 | Error while handling an incoming contract call (decoding args, encoding result) |
| `Calling(CallingError)` | 2 | Error while making an outgoing contract call (encoding args, decoding result) |
| `Called(FaultString)` | 3 | The called contract reverted |
| `AuthToken(AuthTokenError)` | 4 | Error encoding or consuming an authorization token |
| `BytestringWrongSize { expected, found }` | 5 | A fixed-size bytestring read found a different length |
| `NonNegativeIntUnderflow` | 6 | An integer or balance operation would violate its lower bound |
| `NonNegativeIntOverflow` | 7 | An integer or balance operation would overflow |
| `StorageSerialization` | 8 | A typed storage value could not be serialized or deserialized |
| `StorageIndexOutOfBounds { len, access }` | 9 | A vector index was outside its logical extent |
| `StorageKeypathOverflow` | 10 | A no-allocation storage keypath exceeded its fixed budget |
| `RetrocausalQueueEntryWrongSize { expected, found }` | 11 | A fixed-size queue read found a different entry length |
| `CapacityConstraintAlreadyWritten` | 12 | `set_capacity` followed an incompatible write in the same transaction |

`LibraryExn` is `#[non_exhaustive]`: when matching, always include a wildcard arm.

When calling another contract via a `try_*` method, `LibraryExn` errors appear in the `Library` variant of the generated client error enum:

```rust
match client.try_do_something() {
    Err(FooClientError::Library(LibraryExn::NonNegativeIntUnderflow)) => {
        // The called contract underflowed an NNInt
    }
    // ...
}
```

## Cross-Contract Errors

When you define a contract interface with `throws`, the `#[contract]` macro generates a client error enum named `{Client}Error`. This enum has one variant per declared error type, plus built-in variants for library errors, faults, and unknown errors.

### Declaring thrown errors

Single error type:

```rust
#[contract(client = CounterClient, throws = CounterError)]
impl Counter {
    // ...
}
```

Multiple error types:

```rust
#[contract(client = MultiClient, throws(AlphaError, BetaError))]
pub trait MultiThrows {
    // ...
}
```

### Generated client error enum

For `throws(AlphaError, BetaError)` on a contract with `client = MultiClient`, the macro generates:

```rust
// Generated. You don't write this
enum MultiClientError {
    AlphaError(AlphaError),   // Declared error types
    BetaError(BetaError),
    Library(LibraryExn),      // SDK internal errors
    Fault(FaultString),       // Panics from the called contract
    Unknown(RawException),    // Errors with unrecognized selectors
    BadDecode(RawException),  // Recognized selector but payload failed to decode
}
```

### Catching errors with `try_*` methods

Every method on the generated client has a `try_` variant that returns `Result<T, {Client}Error>` instead of aborting:

```rust
let client = MultiClient::new(&addr);

match client.try_throw_alpha_not_found() {
    Err(MultiClientError::AlphaError(AlphaError::NotFound)) => {
        // Handle the expected error
    }
    Err(MultiClientError::Fault(f)) => {
        // The called contract panicked
    }
    Ok(val) => {
        // Success
    }
    _ => {}
}
```

### Non-try calls and re-throwing

Non-try client methods (e.g. `client.do_something()` without the `try_` prefix) automatically re-throw any exception from the called contract. The error propagates through the call chain with its original selector intact.

### Undeclared errors

If a contract throws an error type not listed in `throws`, callers receive it as `Unknown(RawException)`. You can still decode it if you know the type:

```rust
match client.try_throw_undeclared() {
    Err(MultiClientError::Unknown(ref raw)) => {
        // Decode manually if you know the type
        if let Some(secret) = raw.try_as::<SecretError>() {
            // Handle it
        }
    }
    _ => {}
}
```

See [Cross-Contract Calls](/reference/cross-contract-calls/) for the full calling patterns.
