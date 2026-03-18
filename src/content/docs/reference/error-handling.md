---
title: Error Handling
description: How errors work in Groundhog contracts.
---

## Abort Model

Groundhog contracts don't use `Result`. Methods return values directly. If something goes wrong, the frame aborts and all state changes in that frame are discarded.

You cannot catch an abort within the same contract. Once an abort fires, the frame is discarded and control returns to the caller. To handle errors from another contract, use `try_*` client methods (see [Cross-Contract Calls](/reference/cross-contract-calls/)).

## Automatic Aborts

Several SDK operations abort on their own when preconditions fail:

| Operation | Aborts when |
|-----------|------------|
| `strict_inc(delta)` | Result would be negative (NNInt underflow) |
| `strict_inc(delta)` | Result would overflow |
| Storage read | Key does not exist or type mismatch |

You do not need to define error variants for these. The SDK produces descriptive `LibraryExn` errors automatically (e.g. `NonNegativeIntUnderflow`).

```rust
// This aborts automatically if balance would go below zero.
// No error handling code needed.
balance.strict_inc(-diff);
```

## Manual Checks

Use `ensure(condition, error)` for authorization and validation:

```rust
fn mint(&mut self, receiver: &ContractAddress, amount: Amount) {
    let caller = get_caller();
    ensure(
        &caller == self._contract_owner(),
        ERC20Error::MustBeContractOwner,
    );

    let diff = amount_to_diff(amount);
    self._adjust_balance(receiver, diff);
    self._adjust_total_supply(diff);
}
```

`ensure` aborts with the given error if the condition is false. You can also call `abort(&error)` directly.

## Defining Error Types

Error types need `#[repr(i32)]` and XDR derives for serialization across contract boundaries. Only define variants for your own business logic. SDK operations already abort with their own descriptive errors.

```rust
#[derive(Error, Debug, Clone, PartialEq, ReadXDR, WriteXDR)]
#[repr(i32)]
pub enum ERC20Error {
    #[error("Contract already initialized")]
    AlreadyInitialized = 1,

    #[error("Caller must be contract owner")]
    MustBeContractOwner = 2,

    #[error("Provided amount too large")]
    TooLarge = 3,

    #[error("Internal error")]
    Internal = 100,
}
```

Each variant has an explicit `i32` discriminant. The `thiserror::Error` derive provides display strings. The `ReadXDR` and `WriteXDR` derives handle serialization.

## How Errors Propagate

When a contract aborts, the calling frame can catch the error through `try_*` client methods. Direct calls propagate the abort to the caller. Try calls return a `Result` so you can inspect and handle the failure.

See [Cross-Contract Calls](/reference/cross-contract-calls/) for the full pattern. For a working example of `ensure()` in an authorization check, see [Build a Token](/tutorials/build-a-token/).

## Related Documentation

- [Programming Model: Execution Model](/programming-model/execution/) for how exclusion works at the block level
- [Cross-Contract Calls](/reference/cross-contract-calls/) for the `try_*` pattern
- [Build a Token](/tutorials/build-a-token/) for `ensure()` in a real contract
