---
title: Rust API Docs
description: Where to find generated Rustdoc for the Groundhog SDK crates.
---

Groundhog's guide docs live on this site. Generated Rustdoc for the Rust crates lives at [crates.thruput.network](https://crates.thruput.network).

During early access, Rustdoc may require the credentials from your onboarding instructions. Use the [`sdk` crate root](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/index.html) first for SDK overview sections on storage, macros, calling and errors, events, and testing. Use item pages when you need exact signatures, trait bounds, re-exports, source links, or crate-level API details. Use this site for workflows, tutorials, and programming model guidance.

:::note[Version checked]
This page's API inventory was source-checked against SDK `0.34.3`. The links point to that version’s Rustdoc.
:::

## Common Links

| Need | Rustdoc |
|------|---------|
| SDK crate root | [`sdk`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/index.html) |
| Common contract types | [`ContractAddress`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/types/struct.ContractAddress.html), [`SHA256Hash`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/types/struct.SHA256Hash.html) |
| Native test environment | [`TestEnvironment`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/struct.TestEnvironment.html) |
| Storage wrappers | [`sdk::storage`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/storage/index.html) |
| Ordinary balances | [`Balance`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/storage/balance/struct.Balance.html) |
| Commutative integers | [`NNInt`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/storage/nnint/struct.NNInt.html) |
| Shared capacity limits | [`CapacityConstraint`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/storage/capacity_constraint/struct.CapacityConstraint.html) |
| Keyed storage | [`Map`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/storage/map/struct.Map.html) |
| Typed value storage | [`Value`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/storage/value/struct.Value.html) |
| Byte storage | [`Bytestring`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/storage/bytestring/struct.Bytestring.html) |
| Queues | [`RCQ`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/storage/rcq/struct.RCQ.html) |
| Sparse vectors | [`Vector`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/storage/vector/struct.Vector.html) |
| Nested storage | [`Node`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/storage/node/struct.Node.html) |
| Contract macro | [`#[contract]`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/attr.contract.html) |
| Storage macro | [`#[storage]`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/attr.storage.html) |
| Error macro | [`#[contract_exception]`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/attr.contract_exception.html) |
| Event derive | [`#[derive(Event)]`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/derive.Event.html) |
| Event logging | [`log_event`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/event/fn.log_event.html) |
| Error helpers | [`throw`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/fn.throw.html), [`ensure`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/fn.ensure.html), [`OrThrow`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/trait.OrThrow.html) |
| Deployment helper | [`deploy_contract`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/deploy/fn.deploy_contract.html) |
| Testing macro | [`declare_mock_contract!`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/macro.declare_mock_contract.html) |
| Compile-time hashes | [`sha256_static!`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/macro.sha256_static.html), [`hash_ident!`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/macro.hash_ident.html) |

## How to Use These Docs

Start with the tutorials and reference pages here when you are learning a workflow. Jump to Rustdoc when you need the complete item-level API.

For example:

- Use [Testing](/programming-model/testing/) to decide between `cargo test`, `groundhog test --integration`, `TestEnvironment::no_cost()`, and `TestEnvironment::default()`.
- Use the [`TestEnvironment` Rustdoc](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/struct.TestEnvironment.html) for the full method list.
- Use [Storage Types](/reference/storage-types/) for the curated storage API table.
- Use [`sdk::storage` Rustdoc](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/storage/index.html) when you need exact generics, trait implementations, or source links.
