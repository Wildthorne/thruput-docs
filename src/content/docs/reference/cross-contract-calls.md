---
title: Cross-Contract Calls
description: Calling other contracts from your contract.
---

## Client Generation

The `#[contract]` macro generates a client struct for calling other [contracts](/how-it-works/contracts/) when you specify the `client` parameter:

```rust
#[contract(client = ERC20Client, throws = ERC20Error)]
pub trait ERC20 {
    fn transfer(&mut self, receiver: &ContractAddress, amount: Amount);
    fn get_balance(&self) -> Amount;
    // ...
}
```

Construct the client with the target contract's address:

```rust
let mut token = ERC20Client::new(&token_addr);
```

The generated client provides two call styles for each method: direct calls and try calls.

## Direct Calls

Direct calls return values directly and abort if the callee aborts or faults. Use these when you want failures to propagate up.

```rust
let mut token = ERC20Client::new(&token_addr);
token.transfer(&recipient, 100);  // aborts if it fails
let balance = token.get_balance(); // returns Amount directly
```

If the called contract aborts, your contract aborts too. No error handling needed or possible.

## Try Calls

Try calls return `Result<T, CallError>`. Use these when you want to handle failures instead of propagating them.

```rust
use sdk::call::CallError;

match client.try_transfer(&recipient, 100) {
    Ok(()) => { /* success */ }
    Err(CallError::Abort(ref exn)) => {
        // handle abort (see Inspecting Errors below)
    }
    Err(CallError::Fault(f)) => {
        // contract panicked
        println!("Fault: {}", f);
    }
}
```

## CallError Variants

| Variant | Meaning |
|---------|---------|
| `CallError::Abort(CrossExn<E>)` | Contract aborted with a structured error. `E` is the error type from `throws`. |
| `CallError::Fault(FaultString)` | Contract panicked (unstructured error). |

## Inspecting Errors

`CrossExn<E>` provides methods to determine the error source:

| Method | Returns | When |
|--------|---------|------|
| `as_contract_exn() -> Option<&E>` | The contract's own error type | Error matches the `throws` type |
| `as_library_exn() -> Option<&LibraryExn>` | An SDK-internal error | Error is from SDK operations (e.g. NNInt underflow) |
| `is_unknown() -> bool` | `true` | Error type does not match the `throws` declaration |

Full match pattern:

```rust
match client.try_transfer(&recipient, 100) {
    Ok(()) => { /* success */ }
    Err(CallError::Abort(ref exn)) => {
        if let Some(err) = exn.as_contract_exn() {
            // Typed contract error (e.g. ERC20Error::MustBeContractOwner)
            println!("Contract error: {:?}", err);
        }
        if let Some(lib) = exn.as_library_exn() {
            // SDK library error (syscall failure, NNInt overflow, etc.)
            println!("Library error: {:?}", lib);
        }
        if exn.is_unknown() {
            // Thrown type doesn't match `throws` declaration
            println!("Unknown error");
        }
    }
    Err(CallError::Fault(f)) => {
        // Contract panicked
        println!("Fault: {}", f);
    }
}
```

## Testing Error Cases

Use `try_*` methods in tests to verify that operations fail as expected:

```rust
match client.try_decrement(10) {
    Err(CallError::Abort(ref exn)) => {
        assert!(exn.as_library_exn().is_some());
    }
    other => panic!("Expected abort, got: {:?}", other),
}
```

See [Error Handling](/reference/error-handling/) for defining error types. For complete cross-contract call examples, see the [`caller/`](https://github.com/groundhogchain/sdk_rs/tree/main/example-contracts/caller) and [`exceptions/`](https://github.com/groundhogchain/sdk_rs/tree/main/example-contracts/exceptions) contracts in the SDK repository.
