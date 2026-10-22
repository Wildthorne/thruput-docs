---
title: Thruput roadmap
description: Candidate improvements, open questions, and ways to help shape Stellar Thruput.
sidebar:
  label: Roadmap
---

These are candidate improvements to Stellar Thruput, roughly ordered by what they could unblock. The order is provisional. Scope and priorities can change as people build on Devnet; there are no committed delivery dates.

Last reviewed: October 21, 2026.

## Proposed next work

### Block and transaction history

Public block queries and recoverable transaction feeds would let explorers and independent indexers discover chain activity without private infrastructure access. Block queries remain incomplete; the supported feed and its recovery contract still need qualification. Indexer requirements and tests for resuming after an outage would help.

### Contract failure diagnostics

Failures inside wallet or other nested contract calls can be difficult to locate. The goal is to preserve which call failed and provide more useful runtime fault details through the [public API](/reference/json-rpc-api/). Small contracts that reproduce difficult failures are useful contributions.

### State preserving upgrades

Supported upgrade paths and migration tooling would reduce the need to recreate applications after network changes. This work is deferred. Devnet can still reset, as described in [Get Started](/get-started/). Upgrade fixtures, compatibility tests, and operator feedback would help define the supported paths.

### Sharded state storage

Partitioning state across multiple HogDB shards within each validator is the planned path for scaling state. This is not chain sharding: applications see one key space and never choose a shard. Each account's state is owned by one shard, and execution routes reads and writes to the owning shard. Initial support is in review in the core engine. Cross-shard snapshot reads, protocol support for shard identity, and a two-phase block commit across shards still need to land. Large-state workloads and benchmarks across shard counts would help.

### Post-quantum signatures

Each address can register multiple keys, and authorization is abstracted over the signature scheme, so users can add or revoke keys without changing addresses. Ed25519 and ML-DSA-65 (FIPS 204) are supported. Validator key migration still needs design, and more schemes may follow as they are standardized. Threat-model, performance, and migration-design reviews would help.

## Exploring

### External calls

Contracts could call services outside the chain within one atomic transaction. While a call is pending, executors run other transactions. The proposer records the response in the block proposal, so other nodes replay it without making the call. Responses must be self-authenticating, and each call's timeout is bounded by block time. This is not implemented. The contract API and protections against using the chain to flood other services still need design. Use cases such as market-maker quotes, on-demand oracle reads, and compliance checks would help shape it.

## Open to builders

### Additional storage types

Contracts use the [storage types](/programming-model/storage-types/) the SDK provides today. Earlier research prototypes also used ordered sets and bitmaps, and new types will follow developer demand. If an application is hard to express with the current types, describe the workload and where it conflicts.

### Ecosystem tooling

Wallet integrations, oracles, and application conventions are areas where builder demand can shape the work. The [wallet integration guide](/tools/wallet-integration/) is a starting point. Bring an integration or application that exposes a concrete need, and find related projects through the [GitHub community](https://github.com/thruputchain).
