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

Splitting state across multiple HogDB shards is the planned path for scaling state. Each account's state is owned by one shard, and execution routes reads and writes to the owning shard. Initial support is in review in the core engine. Cross-shard snapshot reads and protocol support for shard identity still need to land. Large-state workloads and benchmarks across shard counts would help.

## Exploring

### Post quantum readiness

Thruput's authorization model already supports multiple keys per address and is designed to accommodate multiple cryptographic key types. Ed25519 is the currently supported scheme. We're evaluating post-quantum options and their performance impact. The migration design also needs to cover account and validator keys. Threat-model, performance, and migration-design reviews would help.

## Open to builders

### Ecosystem tooling

Wallet integrations, oracles, and application conventions are areas where builder demand can shape the work. The [wallet integration guide](/tools/wallet-integration/) is a starting point. Bring an integration or application that exposes a concrete need, and find related projects through the [GitHub community](https://github.com/thruputchain).
