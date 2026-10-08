---
title: Smart Contracts
description: Write, test, and understand Stellar Thruput contracts with the Rust SDK.
sidebar:
  label: Overview
---

Build contract logic with the Rust SDK. Use this section for storage choices, authorization, events, testing, and the contract programming model.

## Write your first contract

Follow the [contract quickstart](/get-started/contract/) to deploy a counter on Devnet. Then read [Build a Counter](/tutorials/build-a-counter/) to understand its code and tests, or [Project structure](/contracts/project-structure/) to find the generated files.

Use the [CLI section](/cli/) for build and deployment commands.

## Work on a contract

- [Define methods and interfaces](/contracts/methods/).
- [Choose storage types](/programming-model/storage-types/) for your data.
- [Authorize calls](/how-it-works/authorization/).
- [Define and handle errors](/contracts/errors/).
- [Emit and test events](/contracts/events/).
- [Call another contract](/contracts/cross-contract-calls/).
- [Choose a test mode and write tests](/programming-model/testing/).
- [Debug a contract](/contracts/debugging/).
- [Generate client bindings](/contracts/client-bindings/) for application developers.

## Understand the programming model

Read [execution](/programming-model/execution/) for how contract state changes are applied. Continue with [NNInt and concurrent updates](/programming-model/nnint/), [exclusive writes](/programming-model/storage-types/#exclusive-writes), or [invocation frames](/how-it-works/invocation-frames/) when your design needs that detail.

Read [Contract artifacts and addresses](/how-it-works/contracts/) to understand code hashes, deployment addresses, and immutability.

## Look up an API

Use the [storage API tables](/reference/storage-types/), [SDK macros](/reference/sdk-macros/), [syscalls](/reference/syscalls/), and [generated Rust API docs](/tools/rust-api-docs/).

For larger worked examples, visit [Guides](/guides/).
