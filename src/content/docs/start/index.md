---
title: Start Here
description: Pick the right Groundhog guide based on what you already know.
---

Groundhog executes transactions concurrently using typed storage. Storage merge rules determine which changes can land together in a block.

The core concept to learn is mergeable storage. Instead of overwriting a balance with a newly calculated value, [`Balance`](/programming-model/storage-types/#balance) records increases and decreases. [Merged deltas](/programming-model/execution/#merged-deltas) from concurrent transactions can combine when they are safe to apply, while the runtime still prevents total debits from exceeding the available balance. Lower-level [`NNInt`](/programming-model/storage-types/#nnint) storage exposes the same signed-delta model for counters and other integer state. The guides below explain this model from different starting points.

---

## Find Your Entry Point

| Your background | Groundhog feels like... | Start here |
|---|---|---|
| **Smart contracts** (EVM, SVM, Move) | Familiar contracts without gas fees, sequential nonces, reentrancy guards, or declared access lists. Commutative paths do not depend on transaction order. | [Guide for Blockchain Developers](/start/for-blockchain-developers/) |
| **SQL databases** | `UPDATE balance = balance + 5` maps to a `Balance` increase. Concurrent updates can combine while balance constraints still hold. | [Guide for Backend Developers](/start/for-backend-developers/) |
| **Distributed systems** | Commutative operations combine within a consensus block. | [Guide for Distributed Systems Developers](/start/for-distributed-systems-developers/) |

---

## Next Steps

Pick the guide that matches your background, then head to [Getting Started](/start/getting-started/) to set up the SDK.

- **[Guide for Blockchain Developers](/start/for-blockchain-developers/)** if you've written Solidity, Solana, or Move contracts
- **[Guide for Backend Developers](/start/for-backend-developers/)** if you come from Postgres or web backends
- **[Guide for Distributed Systems Developers](/start/for-distributed-systems-developers/)** if you've worked with CRDTs or eventual consistency
