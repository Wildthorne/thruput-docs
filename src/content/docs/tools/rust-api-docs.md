---
title: Rust API Docs
description: Find generated Rustdoc for the SDK or build documentation for your project's resolved dependencies.
---

Use Rustdoc for exact signatures, trait bounds, and source links. Use this site for contract tasks and the programming model.

## Match your project

The hosted links below select one SDK release. If your project's dependency differs, select its version at [crates.thruput.network](https://crates.thruput.network) or build its resolved SDK documentation locally:

```bash
cargo doc -p thruput-sdk --no-deps --open
```

Run this from the generated contract project after [Cargo access setup](/cli/install/#configure-cargo-access). Hosted Rustdoc may require your onboarding credentials.

## Common Links

| Need | Rustdoc |
| --- | --- |
| SDK overview and re-exports | [`thruput_sdk`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/index.html) |
| Contract types | [`ContractAddress`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/types/struct.ContractAddress.html), [`SHA256Hash`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/types/struct.SHA256Hash.html) |
| Native tests | [`TestEnvironment`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/struct.TestEnvironment.html) |
| Storage types and traits | [`thruput_sdk::storage`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/storage/index.html) |
| Nonnegative balances and counters | [`Balance`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/storage/balance/struct.Balance.html) |
| Lower-level signed deltas and explicit bases | [`NNInt`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/storage/nnint/struct.NNInt.html) |
| Shared capacity | [`CapacityConstraint`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/storage/capacity_constraint/struct.CapacityConstraint.html) |
| Keyed and indexed storage | [`Map`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/storage/map/struct.Map.html), [`Vector`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/storage/vector/struct.Vector.html) |
| Typed and raw values | [`Value`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/storage/value/struct.Value.html), [`Bytestring`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/storage/bytestring/struct.Bytestring.html) |
| Queues and nested state | [`RCQ`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/storage/rcq/struct.RCQ.html), [`Node`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/storage/node/struct.Node.html) |
| Contract and storage macros | [`#[contract]`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/attr.contract.html), [`#[storage]`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/attr.storage.html) |
| Error macro | [`#[contract_exception]`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/attr.contract_exception.html) |
| Events | [`Event`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/derive.Event.html), [`log_event`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/event/fn.log_event.html) |
| Error helpers | [`throw`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/fn.throw.html), [`ensure`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/fn.ensure.html), [`OrThrow`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/trait.OrThrow.html) |
| Deployment | [`deploy_contract`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/deploy/fn.deploy_contract.html) |
| Mock registration | [`declare_mock_contract!`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/macro.declare_mock_contract.html) |
| Compile-time hashes | [`sha256_static!`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/macro.sha256_static.html), [`hash_ident!`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/macro.hash_ident.html) |

## How to Use These Docs

- Start with [Testing](/programming-model/testing/) to choose native, artifact, or RPC tests.
- Use [storage API tables](/reference/storage-types/) for common operations and [storage guidance](/programming-model/storage-types/) to choose a type.
- Use [SDK Macros](/reference/sdk-macros/) for parameters and generated items.
- Follow Rustdoc source links when you need the implementation behind an API.
