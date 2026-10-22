---
title: Smart Contracts
description: Write, test, and understand Stellar Thruput contracts with the Rust SDK.
sidebar:
  label: Overview
---

Build contract logic with the Rust SDK. Use this section for storage choices, authorization, events, testing, and the contract programming model.

## Write your first contract

Follow the [contract quickstart](/get-started/contract/) to deploy a counter on Futurenet. Then read [Build a Counter](/tutorials/build-a-counter/) to understand its code and tests, or [Project structure](/contracts/project-structure/) to find the generated files.

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

Read [Contract Execution](/programming-model/execution/) first for snapshots, merged changes, and the rules that cause bugs. Then read [Storage Types](/programming-model/storage-types/), starting with [Balance](/programming-model/storage-types/#balance) for nonnegative counts and amounts. Continue with [NNInt and concurrent updates](/programming-model/nnint/) to understand the underlying signed deltas, explicit bases, and merge rules. [Exclusive writes](/programming-model/storage-types/#exclusive-writes) and [invocation frames](/how-it-works/invocation-frames/) cover other storage and call constraints.

Read [Contract artifacts and addresses](/how-it-works/contracts/) to understand code hashes, deployment addresses, and immutability.

## Look up an API

Use the [storage API tables](/reference/storage-types/), [SDK macros](/reference/sdk-macros/), [syscalls](/reference/syscalls/), and [generated Rust API docs](/tools/rust-api-docs/).

For larger worked examples, visit [Guides](/guides/).
