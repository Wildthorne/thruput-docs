---
title: Rust API Docs
description: Find generated Rustdoc for the SDK or build documentation for your project's resolved dependencies.
---

Use Rustdoc for exact signatures, trait bounds, and source links. Use this site for contract tasks and the programming model.

## Match your project

The links below point to the latest SDK release on docs.rs. If your project's dependency differs, select its version at [docs.rs/thruput-sdk](https://docs.rs/thruput-sdk) or build its resolved SDK documentation locally:

```bash
cargo doc -p thruput-sdk --no-deps --open
```

Run this from the generated contract project.

## Common Links

| Need | Rustdoc |
| --- | --- |
| SDK overview and re-exports | [`thruput_sdk`](https://docs.rs/thruput-sdk/latest/thruput_sdk/index.html) |
| Contract types | [`ContractAddress`](https://docs.rs/thruput-sdk/latest/thruput_sdk/types/struct.ContractAddress.html), [`SHA256Hash`](https://docs.rs/thruput-sdk/latest/thruput_sdk/types/struct.SHA256Hash.html) |
| Native tests | [`TestEnvironment`](https://docs.rs/thruput-sdk/latest/thruput_sdk/struct.TestEnvironment.html) |
| Storage types and traits | [`thruput_sdk::storage`](https://docs.rs/thruput-sdk/latest/thruput_sdk/storage/index.html) |
| Nonnegative balances and counters | [`Balance`](https://docs.rs/thruput-sdk/latest/thruput_sdk/storage/balance/struct.Balance.html) |
| Lower-level signed deltas and explicit bases | [`NNInt`](https://docs.rs/thruput-sdk/latest/thruput_sdk/storage/nnint/struct.NNInt.html) |
| Shared capacity | [`CapacityConstraint`](https://docs.rs/thruput-sdk/latest/thruput_sdk/storage/capacity_constraint/struct.CapacityConstraint.html) |
| Keyed and indexed storage | [`Map`](https://docs.rs/thruput-sdk/latest/thruput_sdk/storage/map/struct.Map.html), [`Vector`](https://docs.rs/thruput-sdk/latest/thruput_sdk/storage/vector/struct.Vector.html) |
| Typed and raw values | [`Value`](https://docs.rs/thruput-sdk/latest/thruput_sdk/storage/value/struct.Value.html), [`Bytestring`](https://docs.rs/thruput-sdk/latest/thruput_sdk/storage/bytestring/struct.Bytestring.html) |
| Queues and nested state | [`RCQ`](https://docs.rs/thruput-sdk/latest/thruput_sdk/storage/rcq/struct.RCQ.html), [`Node`](https://docs.rs/thruput-sdk/latest/thruput_sdk/storage/node/struct.Node.html) |
| Contract and storage macros | [`#[contract]`](https://docs.rs/thruput-sdk/latest/thruput_sdk/attr.contract.html), [`#[storage]`](https://docs.rs/thruput-sdk/latest/thruput_sdk/attr.storage.html) |
| Error macro | [`#[contract_exception]`](https://docs.rs/thruput-sdk/latest/thruput_sdk/attr.contract_exception.html) |
| Events | [`Event`](https://docs.rs/thruput-sdk/latest/thruput_sdk/derive.Event.html), [`log_event`](https://docs.rs/thruput-sdk/latest/thruput_sdk/event/fn.log_event.html) |
| Error helpers | [`throw`](https://docs.rs/thruput-sdk/latest/thruput_sdk/fn.throw.html), [`ensure`](https://docs.rs/thruput-sdk/latest/thruput_sdk/fn.ensure.html), [`OrThrow`](https://docs.rs/thruput-sdk/latest/thruput_sdk/trait.OrThrow.html) |
| Deployment | [`deploy_contract`](https://docs.rs/thruput-sdk/latest/thruput_sdk/deploy/fn.deploy_contract.html) |
| Mock registration | [`declare_mock_contract!`](https://docs.rs/thruput-sdk/latest/thruput_sdk/macro.declare_mock_contract.html) |
| Compile-time hashes | [`sha256_static!`](https://docs.rs/thruput-sdk/latest/thruput_sdk/macro.sha256_static.html), [`hash_ident!`](https://docs.rs/thruput-sdk/latest/thruput_sdk/macro.hash_ident.html) |

## How to Use These Docs

- Start with [Testing](/programming-model/testing/) to choose native, artifact, or RPC tests.
- Use [storage API tables](/reference/storage-types/) for common operations and [storage guidance](/programming-model/storage-types/) to choose a type.
- Use [SDK Macros](/reference/sdk-macros/) for parameters and generated items.
- Follow Rustdoc source links when you need the implementation behind an API.
