---
title: Rust API Docs
description: Where to find generated Rustdoc for the Groundhog SDK crates.
---

Groundhog's guide docs live on this site. Generated Rustdoc for the Rust crates lives at [groundhog.dev/docs/](https://groundhog.dev/docs/).

During early access, Rustdoc may require the credentials from your onboarding instructions. Use the [`sdk` crate root](https://groundhog.dev/docs/sdk/latest/sdk/) first for SDK overview sections on storage, macros, calling and errors, events, and testing. Use item pages when you need exact signatures, trait bounds, re-exports, source links, or crate-level API details. Use this site for workflows, tutorials, and programming model guidance.

:::note[Version checked]
This page's API inventory was source-checked against SDK `0.17.9` on August 5, 2026. The links use the `latest` Rustdoc route.
:::

## Common Links

| Need | Rustdoc |
|------|---------|
| SDK crate root | [`sdk`](https://groundhog.dev/docs/sdk/latest/sdk/) |
| Common contract types | [`ContractAddress`](https://groundhog.dev/docs/sdk/latest/sdk/types/struct.ContractAddress.html), [`SHA256Hash`](https://groundhog.dev/docs/sdk/latest/sdk/types/struct.SHA256Hash.html) |
| Native test environment | [`TestEnvironment`](https://groundhog.dev/docs/sdk/latest/sdk/struct.TestEnvironment.html) |
| Storage wrappers | [`sdk::storage`](https://groundhog.dev/docs/sdk/latest/sdk/storage/index.html) |
| Ordinary balances | [`Balance`](https://groundhog.dev/docs/sdk/latest/sdk/storage/balance/struct.Balance.html) |
| Commutative integers | [`NNInt`](https://groundhog.dev/docs/sdk/latest/sdk/storage/nnint/struct.NNInt.html) |
| Shared capacity limits | [`CapacityConstraint`](https://groundhog.dev/docs/sdk/latest/sdk/storage/capacity_constraint/struct.CapacityConstraint.html) |
| Keyed storage | [`Map`](https://groundhog.dev/docs/sdk/latest/sdk/storage/map/struct.Map.html) |
| Typed value storage | [`Value`](https://groundhog.dev/docs/sdk/latest/sdk/storage/value/struct.Value.html) |
| Byte storage | [`Bytestring`](https://groundhog.dev/docs/sdk/latest/sdk/storage/bytestring/struct.Bytestring.html) |
| Queues | [`RCQ`](https://groundhog.dev/docs/sdk/latest/sdk/storage/rcq/struct.RCQ.html) |
| Sparse vectors | [`Vector`](https://groundhog.dev/docs/sdk/latest/sdk/storage/vector/struct.Vector.html) |
| Nested storage | [`Node`](https://groundhog.dev/docs/sdk/latest/sdk/storage/node/struct.Node.html) |
| Contract macro | [`#[contract]`](https://groundhog.dev/docs/sdk/latest/sdk/attr.contract.html) |
| Storage macro | [`#[storage]`](https://groundhog.dev/docs/sdk/latest/sdk/attr.storage.html) |
| Error macro | [`#[contract_exception]`](https://groundhog.dev/docs/sdk/latest/sdk/attr.contract_exception.html) |
| Event derive | [`#[derive(Event)]`](https://groundhog.dev/docs/sdk/latest/sdk/derive.Event.html) |
| Event logging | [`log_event`](https://groundhog.dev/docs/sdk/latest/sdk/event/fn.log_event.html) |
| Error helpers | [`throw`](https://groundhog.dev/docs/sdk/latest/sdk/fn.throw.html), [`ensure`](https://groundhog.dev/docs/sdk/latest/sdk/fn.ensure.html), [`OrThrow`](https://groundhog.dev/docs/sdk/latest/sdk/trait.OrThrow.html) |
| Deployment helper | [`deploy_contract`](https://groundhog.dev/docs/sdk/latest/sdk/deploy/fn.deploy_contract.html) |
| Testing macro | [`declare_mock_contract!`](https://groundhog.dev/docs/sdk/latest/sdk/macro.declare_mock_contract.html) |
| Compile-time hashes | [`sha256_static!`](https://groundhog.dev/docs/sdk/latest/sdk/macro.sha256_static.html), [`hash_ident!`](https://groundhog.dev/docs/sdk/latest/sdk/macro.hash_ident.html) |

## How to Use These Docs

Start with the tutorials and reference pages here when you are learning a workflow. Jump to Rustdoc when you need the complete item-level API.

For example:

- Use [Testing](/programming-model/testing/) to decide between `cargo test`, `groundhog test --integration`, `TestEnvironment::no_cost()`, and `TestEnvironment::default()`.
- Use the [`TestEnvironment` Rustdoc](https://groundhog.dev/docs/sdk/latest/sdk/struct.TestEnvironment.html) for the full method list.
- Use [Storage Types](/reference/storage-types/) for the curated storage API table.
- Use [`sdk::storage` Rustdoc](https://groundhog.dev/docs/sdk/latest/sdk/storage/index.html) when you need exact generics, trait implementations, or source links.
