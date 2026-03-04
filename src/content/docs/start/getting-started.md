---
title: Getting Started
description: Set up the Groundhog Rust SDK and write your first contract.
---

import { Aside } from '@astrojs/starlight/components';

## Installation

<Aside type="caution" title="Coming Soon">
The SDK is not yet publicly available. Installation instructions and project setup will be added when the crate is published. The rest of this page documents the SDK design and contract patterns for early access developers.
</Aside>

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

## Contract Structure at a Glance

A Groundhog contract (using the macro layer) has three parts:

1. **Error type** - Defines your contract's error variants. Must derive XDR serialization. SDK-level errors (like NNInt underflow) abort automatically; you only define business logic errors.

2. **Storage struct** - Marked with `#[sdk::storage]`. Fields become persistent storage slots. Use `NNInt` for balances/counters, `Map<K, V>` for key-value data.

3. **Implementation block** - Marked with `#[contract]`. Public methods become WASM exports. `#[init]` marks the constructor. `&mut self` methods write state; `&self` methods are read-only.

The core pattern: all state mutations use `strict_inc(delta)` to record changes as deltas, not absolute values. This is what makes operations commutative and enables parallel execution.

For the full walkthrough with project setup, line-by-line explanation, and tests, see [Build a Counter](/tutorials/build-a-counter/).

### Error Handling

The SDK uses an **abort-centric** error model. Contract methods return values directly (not `Result`). When something goes wrong, the transaction aborts. `strict_inc(delta)` aborts automatically on NNInt underflow/overflow, `abort(&error)` aborts with a typed error, and `ensure(condition, error)` aborts if the condition is false.

You can't "catch" an abort within the same contract. To handle errors from *another* contract, use the `try_*` client methods. See [Error Handling](/reference/error-handling/) for the complete model.

---

## Building and Testing

The SDK provides `./scripts/dev.sh` for common operations:

### Build for WASM

```bash
# Build all example contracts
./scripts/dev.sh build-examples

# Or directly with cargo from the example-contracts workspace
cd example-contracts/erc20
cargo --config ../.cargo/contract.toml build --release
```

### Run Tests

Building contracts to WASM works with just the Rust toolchain. Running tests requires the `native_exec` mock executor, which runs your contract logic natively (not in WASM) so you can use standard Rust debugging tools, set breakpoints, and iterate on business logic before deploying to testnet.

On supported platforms (x86_64 Linux, aarch64 macOS), prebuilt test libraries are automatically downloaded. No C++ toolchain required.

```bash
# Run everything (SDK tests + examples + integration tests)
./scripts/dev.sh test

# Test just the example contracts
./scripts/dev.sh test-examples

# Test a specific contract
cd example-contracts && cargo test -p counter -- --show-output

# Full CI (formatting + linting + all tests)
./scripts/dev.sh ci
```

### Other Useful Commands

```bash
./scripts/dev.sh lint                              # Run clippy
./scripts/dev.sh open-docs                         # Generate and open docs
./scripts/dev.sh expand example-contracts/erc20    # Expand macros
```

---

## Design Guidelines

### Do

- Use `NNInt` for all balances and counters
- Use `strict_inc(delta)` for commutative updates (aborts on underflow)
- Use `ensure(condition, error)` for authorization checks
- Design with deltas in mind: `+50`, `-20` not `set 130`
- Keep storage keys independent when possible

### Avoid

- Absolute writes to frequently-updated values (forces serialization)
- Reading a value and writing it back (use deltas instead)

---

## Examples to Study

All examples live in `example-contracts/`:

| Example | What It Shows |
|---------|---------------|
| `counter/` | Simplest complete example, start here |
| `erc20/` | Production patterns: trait impl, events, `ensure()`, `strict_inc()` |
| `erc20_low_level/` | Same ERC-20 using raw syscalls (no SDK abstractions) |
| `erc20_no_storage/` | ERC-20 with typed wrappers but no `#[storage]` macro |
| `caller/` | Cross-contract invocation via generated clients |
| `exceptions/` | Exception handling: `try_*` calls, `CallError`, `CrossExn` matching |
| `hasher/` | Minimal stateless contract |

Start with `counter/`, then study `erc20/src/implementation.rs` for production patterns. Compare `erc20/`, `erc20_no_storage/`, and `erc20_low_level/` to see the same contract at each SDK layer. The `exceptions/` example is the best reference for understanding the error handling system. For step-by-step tutorials, see [Build a Counter](/tutorials/build-a-counter/) and [Build a Token](/tutorials/build-a-token/).

---

## Further Reading

- [Storage Types](/reference/storage-types/) for the full `NNInt`, `Map`, and `Bytestring` API
- [SDK Macros Reference](/reference/sdk-macros/) for details on the `#[contract]` and `#[storage]` macros
- [Error Handling](/reference/error-handling/) for the abort model and `ensure()` pattern
- [Cross-Contract Calls](/reference/cross-contract-calls/) for calling other contracts
