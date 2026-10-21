---
title: Handle errors
description: How errors work in Stellar Thruput contracts.
---

Exported Stellar Thruput contract methods return their declared values and signal failure by throwing an exception. The frame aborts, all state changes in that frame are discarded, and control returns to the caller. Private helpers may use `Result` when they translate failures into a contract or library exception.

You cannot catch a thrown exception within the same frame. Use `Result`-returning helpers for local fallible work and generated `try_*` client methods for another contract. See [Cross-Contract Calls](/contracts/cross-contract-calls/).

For exact SDK signatures, see [Rust API Docs](/tools/rust-api-docs/).

## Defining Errors

Use `#[contract_exception]` to define error types. It generates `Debug`, `PartialEq`, serialization and spec traits, and the `Exn` implementation. Add `Clone` yourself if the type needs it.

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

Do not copy the usual `#[derive(Error, Debug)]` pattern from generic Rust examples. `#[contract_exception]` already generates `Debug` and `PartialEq`; deriving them again creates duplicate implementations.

For contract crates, configure `thiserror` without the default `std` feature:

```toml
thiserror = { version = "2", default-features = false }
```

Avoid `anyhow` for contract exception types and public contract method surfaces. `anyhow::Error` is an erased application error type, while contract exceptions need concrete CXS-serializable types that appear in the contract spec. `anyhow` is fine in off-chain tools, build scripts, tests, or CLI code. Inside a contract, private helpers may use `Result` if they immediately convert failures into concrete contract exceptions with `throw`, `ensure`, or `or_throw`.

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
| `Balance::decrease(amount)` | Balance is insufficient (`NonNegativeIntUnderflow`) |
| `Balance::increase(amount)` | Balance would overflow (`NonNegativeIntOverflow`) |
| `NNInt::strict_inc(delta)` | Result would be negative (`NonNegativeIntUnderflow`) |
| `NNInt::strict_inc(delta)` | Result would overflow (`NonNegativeIntOverflow`) |
| `CapacityConstraint::set_capacity(value)` | Another non-idempotent write already occurred this transaction (`CapacityConstraintAlreadyWritten`) |
| `bytestring_get_sized` | Stored length does not match expected (`BytestringWrongSize`) |
| `NNInt::get()` | Key does not exist (syscall error); `Balance::get()` defaults missing storage to zero |

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
| `Calling(CallingError)` | 2 | Error while making an outgoing contract call: encoding args, decoding the result, or the runtime refusing the invoke as reentrant (`Reentrance`) or past the cross-invoke depth bound (`DepthExceeded`) |
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
| `UnknownMethod` | 13 | The callee has no entrypoint for the invoked method ID |

`LibraryExn` is `#[non_exhaustive]`: when matching, always include a wildcard arm.

Generated `try_*` calls can return a `LibraryExn` thrown by the callee. See [Library errors](#library-errors) below for an example.

## Cross-Contract Errors

A thrown exception travels as `[selector][payload]`, where the selector is derived from the exception *type*, not from the interface that threw it. Callers match on that selector, so what a caller can catch does not depend on what the callee's interface declared.

`throws` declares an interface's error contract: it is published in the contract spec and tells callers what to expect. It does not gate catching.

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

### Catching errors with `try_*` methods

Every method on the generated client has a `try_` variant returning `Result<T, CallError>` instead of aborting. `CallError` is the same type for every client; a caught exception stays undecoded inside it, and `match_exn!` decodes it against the types you name:

```rust
let client = MultiClient::new(&addr);

match client.try_throw_alpha_not_found() {
    Ok(val) => {
        // Success
    }
    Err(CallError::Fault(f)) => {
        // The called contract panicked
    }
    Err(e) => match_exn!(e, {
        AlphaError::NotFound => {
            // Handle the expected error
        }
        _ => e.re_throw(),
    }),
}
```

Handle `Fault`, `Invalid`, and encode/decode failures with ordinary `match` arms on `CallError`. `match_exn!` handles only the typed part, and its arms are tried in order, so a final `_` arm is required.

### Library errors

`LibraryExn` is matched like any other exception type. There is no special wrapper variant:

```rust
match client.try_do_something() {
    Err(e) => match_exn!(e, {
        LibraryExn::NonNegativeIntUnderflow => {
            // The called contract underflowed an NNInt
        }
        _ => e.re_throw(),
    }),
    Ok(_) => {}
}
```

### Non-try calls and re-throwing

Non-try client methods (e.g. `client.do_something()` without the `try_` prefix) automatically re-throw any exception from the called contract. The error propagates through the call chain with its original selector intact.

### Undeclared errors

An error type absent from `throws` is caught exactly like a declared one. The selector identifies it either way:

```rust
match client.try_throw_undeclared() {
    Err(e) => match_exn!(e, {
        SecretError => {
            // Never declared by the interface; matched all the same
        }
        _ => e.re_throw(),
    }),
    Ok(_) => {}
}
```

This is what lets an extension define errors the base interface does not declare. `ERC20PausableError::EnforcedPause` can come back from `ERC20::transfer`, and an `ERC20Client` caller matches it in the same `match_exn!` as `ERC20Error`, no separate decode step, and no coupling of the base interface to the extension.

### Matching a single type

When only one exception type matters, `try_as` skips the macro:

```rust
assert_eq!(
    client.try_transfer(&to, 1).unwrap_err().try_as(),
    Some(ERC20PausableError::EnforcedPause),
);
```

`None` covers all three ways this can miss: no exception, a different type, or a payload that failed to decode. Use `try_decode` when the last of those must be distinguished from the other two. See [Cross-Contract Calls](/contracts/cross-contract-calls/#telling-a-corrupt-error-from-an-unknown-one), which also explains how this can occur through semver-compatible evolution.

See [Cross-Contract Calls](/contracts/cross-contract-calls/) for the full calling patterns.
