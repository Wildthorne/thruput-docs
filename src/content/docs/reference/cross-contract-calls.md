---
title: Cross-Contract Calls
description: Calling other contracts from your contract.
---

## Client Generation

The `#[contract]` macro generates a client struct when you specify the `client` parameter. The client mirrors every public method on the trait or impl block.

Single error type:

```rust
#[contract(client = ERC20Client, throws = ERC20Error)]
pub trait ERC20 {
    fn transfer(&mut self, receiver: &ContractAddress, amount: Amount);
    fn get_balance_of(&self, addr: &ContractAddress) -> Amount;
}
```

Multiple error types:

```rust
#[contract(client = MultiClient, throws(AlphaError, BetaError))]
pub trait MultiThrows {
    fn succeed() -> u32;
    fn throw_alpha_not_found();
    fn throw_beta_denied();
}
```

For each method `foo`, the generated client provides:

| Method | Signature | On error |
|--------|-----------|----------|
| `foo(...)` | Same return type as the trait method | Re-throws. Your contract aborts too. |
| `try_foo(...)` | `Result<T, {Client}Error>` | Returns the error for inspection. |

## Making Calls

Construct a client with the target contract's address, then call methods on it.

```rust
let token = ERC20Client::new(&token_addr);
let balance = token.get_balance_of(&account);
token.transfer(&recipient, 100);
```

Client methods take `&self` (not `&mut self`). Clients are lightweight value types holding an address and configuration.

## Gas Limits

Use `with_gas_limit` to cap how much computation the callee can perform. It returns a new client instance (non-mutating).

```rust
let token = ERC20Client::new(&token_addr);
let capped = token.with_gas_limit(500_000);
capped.transfer(&recipient, 100);
```

The default gas limit is `u64::MAX` (no effective cap). Gas is metered but free. Limits prevent runaway computation. See [Execution Model](/programming-model/execution/#gas) for details.

| Method | Signature | Description |
|--------|-----------|-------------|
| `new(address)` | `fn new(&ContractAddress) -> Self` | Create a client for the given contract address. |
| `with_gas_limit(gas_limit)` | `fn with_gas_limit(&self, u64) -> Self` | Return a new client with the specified gas limit. |

## Error Handling

### Direct calls (re-throw)

Direct calls propagate errors automatically. If the callee throws, your contract throws the same exception to its own caller. No error handling needed or possible.

```rust
let client = MultiClient::new(&addr);

// If this throws AlphaError::NotFound, your contract
// re-throws the same error to whoever called you.
client.throw_alpha_not_found();
```

### try_ calls (inspect)

Prefixing any method with `try_` returns a `Result` you can match on.

```rust
let client = MultiClient::new(&addr);

match client.try_throw_alpha_not_found() {
    Ok(()) => { /* success */ }
    Err(MultiClientError::AlphaError(AlphaError::NotFound)) => {
        // Handle specific error variant
    }
    Err(other) => {
        // Handle everything else
    }
}
```

### The generated error enum

For a client named `FooClient`, the macro generates `FooClientError`. The enum contains one variant per declared `throws` type, plus three fixed variants.

Given `#[contract(client = MultiClient, throws(AlphaError, BetaError))]`, the generated enum is:

```rust
pub enum MultiClientError {
    // One variant per declared throws type (named after the type)
    AlphaError(AlphaError),
    BetaError(BetaError),

    // Fixed variants present on every client error enum
    Library(LibraryExn),
    Fault(FaultString),
    Unknown(RawException),
    BadDecode(RawException),
}
```

| Variant | When it appears |
|---------|-----------------|
| `{ErrorType}(ErrorType)` | The callee threw a declared error type. One variant per type in `throws`. |
| `Library(LibraryExn)` | The SDK itself threw (e.g., NNInt underflow, encoding failure). |
| `Fault(FaultString)` | The callee panicked. Contains a debug message when the `debugging` feature is enabled. |
| `Unknown(RawException)` | The callee threw an error type not listed in `throws`. |
| `BadDecode(RawException)` | The selector matched a declared type, but the payload could not be decoded. |

### Matching on specific errors

```rust
match client.try_transfer(&recipient, 100) {
    Ok(()) => { /* transfer succeeded */ }
    Err(ERC20ClientError::ERC20Error(ERC20Error::MustBeContractOwner)) => {
        // Caller is not the owner
    }
    Err(ERC20ClientError::Library(_)) => {
        // SDK-level failure (e.g., NNInt underflow during transfer)
    }
    Err(ERC20ClientError::Fault(f)) => {
        // The callee panicked
    }
    Err(ERC20ClientError::Unknown(ref raw)) => {
        // Undeclared error type. You can attempt manual decoding
        // if you know the type:
        if let Some(secret) = raw.try_as::<SecretError>() {
            // decoded successfully
        }
    }
    Err(ERC20ClientError::BadDecode(ref raw)) => {
        // Selector matched but payload was malformed
    }
}
```

### Decoding unknown errors

`RawException` exposes `selector()` and `payload()` for raw inspection. If you know the concrete type, use `try_as`:

```rust
match client.try_call_something() {
    Err(MyClientError::Unknown(ref raw)) => {
        if let Some(err) = raw.try_as::<SomeKnownError>() {
            // Successfully decoded
        }
    }
    _ => {}
}
```

## Error Forwarding

When contract A calls contract B with a direct (non-try) call and B throws, the error propagates through A to A's caller with the original selector and payload intact. This means callers further up the chain can still decode the original error.

```rust
fn forward_alpha(target: ContractAddress) {
    // If target throws AlphaError::NotFound, this contract
    // re-throws it unchanged. Our caller sees AlphaError::NotFound.
    MultiClient::new(&target).throw_alpha_not_found();
}
```

## Full Example

A contract that calls an ERC20 token contract:

```rust
#![cfg_attr(not(feature = "dev"), no_std)]

pub use groundhog_erc20_if as erc20_if;

use erc20_if::Amount;
use erc20_if::ERC20Client;
use sdk::storage::Value;
use sdk::*;

#[storage]
pub struct Caller {
    token_contract: Value<ContractAddress>,
}

#[contract(client = CallerClient)]
impl Caller {
    pub fn initialize(&mut self, token_contract: &ContractAddress) {
        self.token_contract.set(token_contract);
    }

    pub fn check_balance(&self, account: &ContractAddress) -> Amount {
        let token = ERC20Client::new(&self.token_contract.get());
        token.get_balance_of(account)
    }
}
```

See [Error Handling](/reference/error-handling/) for defining error types with `#[contract_error]`.
