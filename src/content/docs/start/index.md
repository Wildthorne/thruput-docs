---
title: Start Here
description: Pick the right Groundhog guide based on what you already know.
---

Groundhog is a blockchain where most operations execute in parallel, safely, deterministically, without you managing the parallelism. No double spends, no negative balances, no dirty reads. No gas costs, no MEV, no reentrancy. All without requiring sequential execution.

In exchange, we're asking you to learn one new concept: `NNInt`, Groundhog's commutative integer storage primitive. Writes are deltas (`+5`, `-3`) instead of absolute assignments. Concurrent deltas merge automatically. For ordinary balances and counters, the runtime enforces that debits cannot drive the value below zero. All the goodness above follows from this one primitive. The guides below show how it maps to concepts you already know.

---

## Find Your Entry Point

| Your background | Groundhog feels like... | Start here |
|---|---|---|
| **Smart contracts** (EVM, SVM, Move) | Everything you know minus gas, MEV, and ordering. No reentrancy, no access lists, no move semantics. Fewer footguns, stronger guarantees, and simplicity that yields performance. | [Guide for Blockchain Developers](/start/for-blockchain-developers/) |
| **SQL databases** | Snapshot isolation with typed delta columns. `UPDATE balance = balance + 5` is your primary write pattern. | [Guide for Backend Developers](/start/for-backend-developers/) |
| **Distributed systems** | Your intuition transfers, but don't worry Groundhog is **not** CRDTs on a blockchain. | [Guide for Distributed Systems Developers](/start/for-distributed-systems-developers/) |

---

## Next Steps

Pick the guide that matches your background, then head to [Getting Started](/start/getting-started/) to set up the SDK.

- **[Guide for Blockchain Developers](/start/for-blockchain-developers/)** if you've written Solidity, Solana, or Move contracts
- **[Guide for Backend Developers](/start/for-backend-developers/)** if you come from Postgres or web backends
- **[Guide for Distributed Systems Developers](/start/for-distributed-systems-developers/)** if you've worked with CRDTs or eventual consistency
