---
title: Choose Your Background
description: Pick the right Groundhog guide based on what you already know.
---

Groundhog is a blockchain where most operations execute in parallel, safely, deterministically, without you managing the parallelism. The trick: your storage types have built-in merge rules that make concurrent execution correct by construction.

If that sounds abstract, you probably already understand the underlying concept. You just know it by a different name.

---

## Find Your Entry Point

| Your background | Groundhog feels like... | Start here |
|---|---|---|
| **Postgres / MySQL / MVCC databases** | Snapshot isolation with typed delta columns. `UPDATE balance = balance + 5` is your primary write pattern. | [Guide for Backend & Database Developers](/start/for-backend-developers/) |
| **Solidity / EVM** | Everything you know minus gas, MEV, and ordering. Types enforce concurrency safety instead of sequential execution. | [Guide for Blockchain Developers](/start/for-blockchain-developers/) |
| **Solana / SVM** | No access lists, no compute budgets, no account sizing. Types replace annotations. | [Guide for Blockchain Developers](/start/for-blockchain-developers/) |
| **Move (Aptos / Sui)** | Typed resources, but with commutative merge semantics instead of ownership transfers. | [Guide for Blockchain Developers](/start/for-blockchain-developers/) |
| **Distributed systems / CRDTs** | A replicated state machine where storage primitives are CRDTs with invariant enforcement. | [Guide for Distributed Systems Developers](/start/for-distributed-systems-developers/) |

---

## Next Steps

Pick the guide that matches your background, then head to [Getting Started](/start/getting-started/) to set up the SDK.

- **[Guide for Blockchain Developers](/start/for-blockchain-developers/)** if you've written Solidity, Solana, or Move contracts
- **[Guide for Backend Developers](/start/for-backend-developers/)** if you come from Postgres or web backends
- **[Guide for Distributed Systems Developers](/start/for-distributed-systems-developers/)** if you've worked with CRDTs, eventual consistency, or conflict-free replication
