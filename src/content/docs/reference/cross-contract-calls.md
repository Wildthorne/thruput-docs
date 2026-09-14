---
title: Cross-Contract Calls
description: Calling other contracts from your contract.
---

## Client Generation

On a trait definition or inherent impl, `#[contract]` generates a client struct, named `{Interface}Client` unless you override it with `client = CustomName`. The client mirrors every public method on the trait or impl block.

For exact macro behavior, see [`#[contract]` Rustdoc](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/attr.contract.html) or [SDK Macros](/reference/sdk-macros/#contract).

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
| `try_foo(...)` | `Result<T, CallError>` | Returns the error for inspection. Match it with `match_exn!`, or decode it with `try_as` / `try_decode`. |

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
| `with_commit_locking()` | `fn with_commit_locking(&self) -> Self` | Ask the child frame to acquire its commit locks before returning, so a `try_` call can handle a conflict. |
| `with_read_only()` | `fn with_read_only(&self) -> Self` | Prevent the child frame from modifying state. |

`with_commit_locking()` and `with_read_only()` return a configured copy of the client. They can be combined:

```rust
let result = ERC20Client::new(&token_addr)
    .with_commit_locking()
    .with_read_only()
    .try_get_balance_of(&account);
```

Commit locking performs early conflict detection at the child-frame boundary. If lock acquisition fails, the child reverts and a `try_` method can inspect the failure. Read-only calls may read storage but cannot write, deploy a contract, or perform another state-changing operation.

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

Prefixing any method with `try_` returns a `Result` you can match on. The error type is the SDK's `CallError`, the same type for every client.

```rust
let client = MultiClient::new(&addr);

match client.try_throw_alpha_not_found() {
    Ok(()) => { /* success */ }
    Err(e) => match_exn!(e, {
        AlphaError::NotFound => { /* handle this error */ }
        _ => e.re_throw(),
    }),
}
```

### CallError

`try_*` does not pre-decode the exception into a per-interface enum. A caught exception stays a `RawException`, and `CallError` describes only how the call failed:

```rust
pub enum CallError {
    Invalid,
    Reentrance,
    DepthExceeded,
    InvokeRejected(SysErr),
    Exception(RawException),
    Fault(FaultInfo),
    UnparseableReturn(FaultString),
    UnparseableAbort(FaultString),
    UnparseableAuthHandles(FaultString),
    EncodingArgs(FaultString),
}
```

| Variant | When it appears |
|---------|-----------------|
| `Invalid` | The call could not be made (e.g. invalid contract address before the call dispatched). |
| `Reentrance` | The target already had a frame open on the invocation stack, so the runtime refused the call as reentrant. See [`Reentrance`](/reference/syscalls/) in the syscall errors. |
| `DepthExceeded` | Admitting the call would have exceeded the network's cross-invoke depth bound. The same call succeeds from a shallower frame. |
| `InvokeRejected(SysErr)` | The invoke syscall was refused for another reason, carrying the raw syscall error. |
| `Exception(RawException)` | The callee threw. Any exception type, declared in `throws` or not, including the SDK's own `LibraryExn`. |
| `Fault(FaultInfo)` | The callee panicked, trapped, or exhausted gas. Child faults carry no diagnostic message across the call boundary. `FaultInfo` exists on every target and is zero-sized without `dev`; only a native root-frame panic can retain harness diagnostics. |
| `UnparseableReturn(FaultString)` | The callee committed but its return buffer could not be decoded as the expected type. |
| `UnparseableAbort(FaultString)` | The callee aborted but the abort payload could not be parsed. |
| `UnparseableAuthHandles(FaultString)` | The callee committed but the returned auth-token handle list was malformed. |
| `EncodingArgs(FaultString)` | The caller's arguments could not be encoded before dispatch. |

The first four variants mean the callee never ran: the invoke syscall was
refused before any child frame opened, so the call was a complete no-op that
observed nothing and wrote nothing. `CallError::is_rejected_before_call()`
tests for exactly that set, which is the distinction to reach for when a
retry or a fallback is only safe if the callee did not execute.

### Matching exceptions with `match_exn!`

An exception carries a selector derived from its type, independent of any interface's `throws` list. `match_exn!` matches on that, so errors from different interfaces are peers:

```rust
match client.try_transfer(&recipient, 100) {
    Ok(()) => { /* transfer succeeded */ }
    Err(CallError::Fault(f)) => {
        // The callee panicked
    }
    Err(e) => match_exn!(e, {
        ERC20Error::MustBeContractOwner => {
            // Caller is not the owner
        }
        ERC20PausableError::EnforcedPause => {
            // Declared by an extension the ERC20 interface knows nothing
            // about, matched here exactly like a declared error
        }
        LibraryExn::NonNegativeIntUnderflow => {
            // SDK-level failure inside the callee
        }
        _ => e.re_throw(),
    }),
}
```

Handle `Ok`, `Fault`, `Invalid`, and encode/decode failures with an ordinary `match`. `match_exn!` only does typed downcasting, and its arms are tried in order, so it requires a final `_` arm.

Two rules follow from how the macro infers the type from each arm's pattern:

- Every typed arm must be path-rooted (`Type::Variant`, `Type::Variant { .. }`, or a unit-struct `Type`). A bare identifier would be a binding, leaving nothing to infer the type from; `_` is the untyped escape hatch, and the error value is still in scope there.
- `|` cannot combine patterns of different exception types. Alternates within one type are fine.

### Matching a single type

When only one exception type matters, `try_as` skips the macro:

```rust
assert_eq!(
    client.try_transfer(&recipient, 100).unwrap_err().try_as(),
    Some(ERC20Error::MustBeContractOwner),
);
```

`None` covers all three ways this can miss: the failure carried no exception, it carried a different type, or the payload failed to decode.

### Telling a corrupt error from an unknown one

`try_as` returns `None` both for a selector belonging to another type and for a matching selector whose payload will not decode, and `match_exn!` sweeps both into `_`. `try_decode` separates them:

```rust
match client.try_call_something().unwrap_err().try_decode::<SomeKnownError>() {
    Some(Ok(err)) => { /* decoded */ }
    Some(Err(_)) => { /* right selector, payload did not decode */ }
    None => { /* no exception, or a different type */ }
}
```

This matters more than "a callee sent garbage" suggests. An exception's selector is the first 8 bytes of `sha256(major_version :: crate :: type)` and says nothing about the payload's layout, so a callee that **adds a variant** to an exception enum makes a semver-compatible change that leaves the selector unchanged, and an older caller cannot decode the result. Through `try_as` that is indistinguishable from an error type the caller has never heard of. If confusing the two would change a decision your contract makes, ask `try_decode`.

The reverse direction is not detectable at all: decoding reads a *prefix*, so a callee that **appends a field** to a struct exception is accepted silently by an older caller, which decodes the shorter shape and drops the extra data.

### Raw inspection

`RawException` also exposes `selector()` and `payload()` for inspecting bytes directly, and `re_throw()` to propagate the original abort verbatim.

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

See [Error Handling](/reference/error-handling/) for defining error types with `#[contract_exception]`.
