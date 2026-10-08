---
title: "Build a counter, part 1: Contract"
description: Create, test, and deploy the contract for a counter application, starting from an empty directory.
sidebar:
  label: "Counter 1: Contract"
---

Build a small counter application from scratch. Across four parts, you will create a contract, add a TypeScript development signer, build a React interface, and let users switch to their own wallet.

You can also explore the [full counter example on GitHub](https://github.com/groundhogchain/groundhog-examples/tree/main/apps/counter).

## Create the contract

Complete [CLI installation and Cargo access](/cli/install/). For deployment, use a funded Devnet account from the [CLI quickstart](/get-started/cli/).

```bash
groundhog new counter --template counter
cd counter
```

Keep the generated manifest and toolchain settings. Open `src/implementation.rs`. The scaffold includes the counter used by this guide; focus on its storage and these methods.

## Store a relative count

```rust
#[derive(Debug)]
#[sdk::storage]
pub struct Counter {
    value: NNInt,
}
```

`value` is a persistent storage handle. Increment and decrement record signed deltas:

```rust
pub fn increment(&mut self, amount: u64) {
    self.value.strict_inc(amount as i128);
}

pub fn decrement(&mut self, amount: u64) {
    self.value.strict_inc(-(amount as i128));
}
```

`strict_inc` checks the invocation for underflow and records the relative change. Compatible deltas can merge across concurrent transactions. See [NNInt and concurrent updates](/programming-model/nnint/) for the merge rules.

The read defaults only missing storage to zero:

```rust
pub fn get(&self) -> u64 {
    self.value.try_get().none_if_missing().unwrap_or(0) as u64
}
```

The scaffold's `initialize` method adds its initial amount. It is an ordinary method, so call it once during this deployment flow. This teaching counter allows any caller to update it. Leave the extra scaffold event and error methods in place; the app does not need them.

## Run both test modes

```bash
cargo test
groundhog test
```

The native tests exercise contract logic and underflow handling. The artifact test runs the compiled RV32 contract. Neither needs a running RPC node.

**Checkpoint:** the counter tests pass, including a decrement that is expected to fail.

## Build, deploy, and initialize

```bash
groundhog build
groundhog deploy --profile devnet --fund 10 \
  --init initialize --init-arg 10
groundhog view counter get --profile devnet
```

Funding, deployment, and initialization happen in one transaction. `10` native tokens is an example allocation, not a fixed deployment fee. Your new counter should read `10`.

Save the printed deployment address. Part 2 uses this address and the contract spec produced by the build.

## Check a change

```bash
groundhog call counter increment 1 --profile devnet
groundhog view counter get --profile devnet
```

On your otherwise unchanged counter, the value is now `11`. Keep the same address and project for [part 2](/tutorials/work-with-groundhog-from-typescript/).

For isolated local work, follow [Run a local node](/cli/local-node/) and use its profile, endpoint, and network identity consistently.

## Work with an agent

```text
Follow Build a counter, part 1:
https://docs.groundhog.dev/tutorials/build-a-counter/
Start with groundhog new counter --template counter, without cloning an examples repo.
Run the native and RV32 checks, build, and deploy using my
configured Devnet account. Report the actual address, transaction hash,
and read value. Keep the generated dependency configuration and report
failed checks rather than inventing results.
```
