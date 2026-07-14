---
title: Start Here
description: Pick the right Groundhog guide based on what you already know.
---

Groundhog is a blockchain where most operations execute in parallel, safely, deterministically, without you managing the parallelism. No double spends, no negative balances, no dirty reads. No gas costs, no MEV, no reentrancy. All without requiring sequential execution.

The core concept to learn is [`NNInt`](/programming-model/storage-types/#nnint), Groundhog's integer storage type for balances and counters. Instead of overwriting a balance with a newly calculated value, an `NNInt` records a delta such as `+5` or `-3`. [Merged deltas](/programming-model/execution/#merged-deltas) from concurrent transactions can combine when they are safe to apply, while the runtime still prevents total debits from exceeding the available balance. The guides below explain the same model from different starting points.

---

## Find Your Entry Point

| Your background | Groundhog feels like... | Start here |
|---|---|---|
| **Smart contracts** (EVM, SVM, Move) | Everything you know minus gas, MEV, and ordering. No reentrancy, no access lists, no move semantics. Fewer footguns, stronger guarantees, and simplicity that yields performance. | [Guide for Blockchain Developers](/start/for-blockchain-developers/) |
| **SQL databases** | `UPDATE balance = balance + 5` maps to an NNInt delta. Concurrent updates can combine while balance constraints still hold. | [Guide for Backend Developers](/start/for-backend-developers/) |
| **Distributed systems** | Your intuition transfers, but don't worry Groundhog is **not** CRDTs on a blockchain. | [Guide for Distributed Systems Developers](/start/for-distributed-systems-developers/) |

---

## Next Steps

Pick the guide that matches your background, then head to [Getting Started](/start/getting-started/) to set up the SDK.

- **[Guide for Blockchain Developers](/start/for-blockchain-developers/)** if you've written Solidity, Solana, or Move contracts
- **[Guide for Backend Developers](/start/for-backend-developers/)** if you come from Postgres or web backends
- **[Guide for Distributed Systems Developers](/start/for-distributed-systems-developers/)** if you've worked with CRDTs or eventual consistency
