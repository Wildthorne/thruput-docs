---
title: Testing
description: "How to test Groundhog contracts: native vs WASM, the fluent test API, and assertion patterns."
---

## Two Test Modes

Groundhog contracts can be tested in two ways. Both use mock executors (not a live network), but they behave differently:

**Native (`cargo test`)**: Your contract compiles as native code. Faults are Rust panics caught by `catch_unwind`. Fast, debuggable (you can set breakpoints), but aborts don't behave exactly like they would on-chain.

**WASM mock executor (`groundhog test`)**: Your contract goes through the C++ mock executor. Faults abort like a real contract would. This is the behavior-accurate path.

Use `cargo test` while iterating on logic. Use `groundhog test` to verify production behavior. See [Getting Started](/start/getting-started/) for setup.

## The Fluent Test API

The SDK provides a fluent API for writing contract tests. This is the direction the test infrastructure is heading.

### Basic Pattern

```rust
use sdk::*;

static ADDR: ContractAddress = ContractAddress::named("counter");

#[test]
fn test_counter() {
    let mut env = TestEnvironment::no_cost();
    let test_contract = my_counter::test_setup::register(&mut env);
    let contract_hash = env.setup_create_contract(&test_contract);

    let result = env.transact(|tx| {
        tx.call(&ADDR).run(|| {
            let addr = deploy_contract(&ADDR, &contract_hash);
            let mut client = CounterClient::new(&addr);

            client.initialize(10);
            client.increment(5);
            assert_eq!(client.get(), 15);
        })
    });

    result.assert_success();
}
```

`env.transact` runs a transaction closure, commits it, and returns a `TransactResult` you can assert against. No `.unwrap_or_else(|e| panic!(...))` boilerplate.

### Asserting Outcomes

`TransactResult` and `FrameResult` provide typed assertions:

```rust
// Success
result.assert_success();

// Expected abort
result.assert_abort();

// Expected fault
result.assert_fault();

// Frame succeeded but commit failed (e.g. NNInt went negative after merge)
result.assert_commit_failed();
```

### Checking Return Values

```rust
result.assert_return_with::<u64>(|val| {
    assert_eq!(*val, 15);
});
```

### Checking Abort Errors

```rust
result.assert_abort_with::<ERC20Error>(|err| {
    assert_eq!(*err, ERC20Error::MustBeContractOwner);
});
```

### Events

Contracts emit events via `log_event`. The test API lets you inspect them:

```rust
// Count events
result.assert_event_count(2);
result.assert_no_events();

// Decode and check a specific event by index
result.assert_event_data::<TransferEvent>(0, |event| {
    assert_eq!(event.amount, 100);
});

// Find first event matching a predicate
result.assert_emitted::<TransferEvent>(|e| e.amount > 50);

// Collect all events of a type
let transfers: Vec<TransferEvent> = result.filter_events();
```

Events from faulted or aborted frames are not returned.

### Manual Commit Control

`transact` always commits. If you need to commit or abort conditionally, use `transact_manual`:

```rust
let exec_result = env.transact_manual(|tx| {
    let frame = tx.call(&addr).run(|| {
        // contract logic
    });

    if frame.is_success() {
        tx.commit()
    } else {
        tx.abort();
    }
});
```

### Child Frames

For testing cross-contract calls, use `run_continuable` to get a frame handle that can open child frames:

```rust
let result = env.transact(|tx| {
    tx.call(&parent_addr)
        .run_continuable(|frame| {
            let child_result = frame.child_call(&child_addr).run(|| {
                // child contract logic
            });
            child_result.assert_success();
            FrameAction::Close
        })
        .finish()
});
```

`FrameAction::Continue` keeps the frame open for more steps. `FrameAction::Close` finalizes it.

### Multi-Block Tests

Use `advance_block` to test behavior across block boundaries:

```rust
// Block 1: set up state
env.transact(|tx| {
    tx.call(&addr).run(|| {
        client.initialize(100);
    })
}).assert_success();

env.advance_block();

// Block 2: verify state persisted
env.transact(|tx| {
    tx.call(&addr).run(|| {
        assert_eq!(client.get(), 100);
    })
}).assert_success();
```

### Named Addresses

`ContractAddress::named("alice")` produces a deterministic address from a string. Same name always returns the same address. Useful for readable test code:

```rust
static ALICE: ContractAddress = ContractAddress::named("alice");
static BOB: ContractAddress = ContractAddress::named("bob");
```

## The Older Pattern

The CLI currently generates tests using the `contract_exec` pattern:

```rust
static NONCE: SHA256Hash = sdk::sha256_static!("MY_COUNTER_NONCE");

contract_exec(env, move || {
    let addr = deploy_contract(&NONCE, &contract_hash);
    let mut client = CounterClient::new(&addr);
    // ...
}).unwrap_or_else(|e| panic!("Test failed: {e}"));
```

This still works. The fluent API is a more ergonomic layer over the same test infrastructure. Both use the same underlying mock executor.
