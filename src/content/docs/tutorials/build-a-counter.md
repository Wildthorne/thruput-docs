---
title: "Build a counter, part 1: Contract"
description: Create, test, and deploy the contract for a counter application, starting from an empty directory.
sidebar:
  label: "Counter 1: Contract"
---

Build a small counter application from scratch. Across four parts, you will create a contract, add a TypeScript development signer, build a React interface, and let users switch to their own wallet.

You can also explore the [full counter example on GitHub](https://github.com/thruputchain/thruput-examples/tree/main/apps/counter).

## Create the contract

Complete [CLI installation and Cargo access](/cli/install/). For deployment, use a funded Futurenet account from the [CLI quickstart](/get-started/cli/).

```bash
thruput new counter --template counter
cd counter
```

Keep the generated manifest and toolchain settings. Open `src/implementation.rs`. The scaffold includes the Balance-based counter used by this guide; focus on its storage and these methods.

## Store a relative count

```rust
use thruput_sdk::storage::Balance;

#[derive(Debug)]
#[thruput_sdk::storage]
pub struct Counter {
    value: Balance,
}
```

`value` is a persistent storage handle. `Balance` stores nonnegative amounts and reads zero before the first update. Increment and decrement record relative changes:

```rust
pub fn initialize(&mut self, initial_value: u64) {
    self.value.increase(initial_value as i128);
}

pub fn increment(&mut self, amount: u64) {
    self.value.increase(amount as i128);
}

pub fn decrement(&mut self, amount: u64) {
    self.value.decrease(amount as i128);
}
```

Both methods take a nonnegative amount. `increase` checks for overflow, and `decrease` fails during execution if this invocation would take the count below zero. Both record deltas that can merge across compatible concurrent transactions within bounds. See [Balance](/programming-model/storage-types/#balance) for checked and lazy updates.

`Balance::get` returns zero for missing storage and preserves other storage errors:

```rust
pub fn get(&self) -> u64 {
    self.value.get() as u64
}
```

`initialize` adds its initial amount. It is an ordinary method, so call it once during this deployment flow. This teaching counter allows any caller to update it. Leave the extra scaffold event and error methods in place; the app does not need them.

Balance uses the same mergeable integer storage as NNInt. Once you understand the Balance API, read [NNInt and concurrent updates](/programming-model/nnint/) for signed deltas, explicit bases, and the underlying merge rules.

## Run both test modes

```bash
cargo test
thruput test
```

The native tests exercise contract logic and underflow handling. The artifact test runs the compiled RV32 contract. Neither needs a running RPC node.

**Checkpoint:** the counter tests pass, including a decrement that is expected to fail.

## Build, deploy, and initialize

```bash
thruput build
thruput deploy --estimate --profile futurenet
```

Add **10 native test tokens** to the reported minimum funding in whole-token units as an example allowance for initializer storage and later writes. This is a budget, not an exact estimate of those writes or a universal requirement. Replace `TOTAL_FUNDING` with the decimal sum. The minimum alone covers only the first balance-item deposit and deployment collateral, leaving no free contract balance. See [Estimate deployment funding](/cli/deploy-and-call/#estimate-deployment-funding).

```bash
thruput deploy --profile futurenet --fund TOTAL_FUNDING \
  --init initialize --init-arg 10
thruput view counter get --profile futurenet
```

Funding, deployment, and initialization happen in one transaction. The sender still needs its own storage and scheduling capacity. Your new counter should read `10`.

Save the printed deployment address. Part 2 uses this address and the contract spec produced by the build.

## Check a change

```bash
thruput call counter increment 1 --profile futurenet
thruput view counter get --profile futurenet
```

On your otherwise unchanged counter, the value is now `11`. Keep the same address and project for [part 2](/tutorials/work-with-thruput-from-typescript/).

For isolated local work, follow [Run a local node](/cli/local-node/) and use its profile, endpoint, and network identity consistently.

## Work with an agent

```text
Follow Build a counter, part 1:
https://thruput.network/docs/tutorials/build-a-counter/
Start with thruput new counter --template counter, without cloning an examples repo.
Run the native and RV32 checks, build, and read the deployment estimate.
Add the documented storage allowance to the minimum and deploy with that
explicit total using my configured Futurenet account. Initialize atomically to 10.
Report the actual address, transaction hash,
and read value. Keep the generated dependency configuration and report
failed checks rather than inventing results.
```
