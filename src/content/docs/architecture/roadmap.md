---
title: Project Thruput roadmap
description: Things we'd like to see built in Thruput.
sidebar:
  label: Roadmap
---

These are things we'd like to see built in Thruput.

## Core improvements

### Sharded state storage

Sharded storage would increase the amount of state each validator can hold by spreading it across multiple HogDB instances. Applications would still see one key space and would not need to choose or manage shards. An [initial proposal](https://github.com/thruputchain/hogd/pull/3108) covers the first part of this work (repository access required).

### Sponsored transactions

Today, the account that sends a transaction backs its scheduling with its own native tokens. A contract pays the storage deposits for data stored under its address, which lets an operator [sponsor its users' storage](/how-it-works/storage-economics/#sponsoring-users). No party can pay another account's scheduling, and a caller cannot pay for the storage its call creates. This is a known gap. Sponsored transactions are planned so that one party can pay these costs for another. Scope and policy controls still need design. Applications that need sponsored onboarding, relayed submission, or caller-paid storage would help shape it.

### Post-quantum consensus

Post-quantum signing with ML-DSA-65 is already supported for accounts and contracts. The next phase is to extend post-quantum support to validator signatures and consensus. This needs protocol design, performance testing, and an upgrade path for future validators that may need to transition from classical to post-quantum signatures.

## Exploring

### External calls

Contracts could call services outside the chain within one atomic transaction. While a call is pending, executors run other transactions. The proposer records the response in the block proposal, so other nodes replay it without making the call. Responses must be self-authenticating, and each call's timeout is bounded by block time. This is not implemented. The contract API and protections against using the chain to flood other services still need design. Use cases such as market-maker quotes, on-demand oracle reads, and compliance checks would help shape it.

## Open to builders

### Additional storage types

Contracts use the [storage types](/programming-model/storage-types/) the SDK provides today. Earlier research prototypes also used ordered sets and bitmaps, and new types will follow developer demand. Let us know where a new storage type would help your application. We'd like to work with you on it.

### Ecosystem tooling

Wallet integrations, oracles, and application conventions are areas where builder demand can shape the work. The [wallet integration guide](/tools/wallet-integration/) is a starting point. If there's tooling you'd like to build or use, we'd like to hear about it and explore it with you. Join the conversation through the [GitHub community](https://github.com/thruputchain).
