---
title: Storage & Scheduling Economics
description: How Groundhog's capital-based economic model works.
---

Groundhog's economic model is capital-based, not usage-based. You hold HOG tokens to get capacity. You don't pay per operation.

Most chains charge operational costs: gas per transaction, fees per byte stored, per compute unit consumed. Some (Solana, NEAR) use refundable deposits for storage, but still charge per-transaction compute fees. Groundhog extends the capital model to everything: both throughput and storage are backed by held tokens. No tokens are burned. No fees are extracted. You hold capital, and the capital does two jobs.

## The Two Jobs of HOG

Every HOG token in your account is in one of two states:

| State | What it does | How you get it back |
|-------|-------------|-------------------|
| **Free** | Entitles you to a share of network throughput | Always available (cycles automatically) |
| **Locked** | Backs a piece of on-chain storage | Returned when you delete the data |

Free HOGs determine how many transactions you can push through the network. Locked HOGs hold your data on-chain. The tradeoff is direct: every HOG you lock for storage is one less HOG contributing to your throughput share.

## Execution: Free, Throughput-Allocated

Running contract code costs nothing. There are no gas fees, no per-operation charges, no token burns for compute.

The protocol defines gas limits on transactions and cross-contract calls, but gas costs zero. The gas infrastructure exists for computational metering (preventing infinite loops, bounding cross-contract calls), not for billing.

For root transactions, the declared gas limit is the amount of scheduling capacity used. If you submit a transaction with a `100_000` gas limit, the scheduler accounts for `100_000` units of HOG capacity whether the transaction actually uses `20_000`, `95_000`, or all `100_000`. The execution engine only checks whether the transaction exceeds its declared limit. It does not write a refund for unused gas.

That difference matters for parallelism. A refund-based gas model would need to credit unused gas back to the payer, which creates extra balance updates on the accounts sending many transactions. Groundhog avoids that hot-account path: gas metering can fault an over-limit transaction, but it does not create ledger-side refund effects.

### Balance-Proportional Scheduling

When the network is under capacity, every valid transaction lands in the next block. No scheduling pressure, no competition.

When demand exceeds capacity, the network allocates throughput proportionally to free HOG balances. If account A holds 1,000 free HOGs and account B holds 500, A gets roughly twice the throughput of B during congestion. This is Balance-Proportional Scheduling (BPS).

The mechanism works through age-weighted queuing. Each account's free HOGs sit in a scheduling queue tagged with the block number they entered. When a transaction is scheduled, the transaction's declared gas limit moves that much HOG capacity from the "ready" group to the "scheduled" group. The proposer fills each block by selecting transactions whose HOGs have waited longest. Over time, this produces proportional allocation without requiring any fee market or priority auction.

No tokens are consumed in this process. HOGs cycle between ready and scheduled groups and eventually become ready again.

HOG transferred between accounts enters the recipient's scheduling queue as newly received capacity. It does not carry the sender's accumulated scheduling age. That makes it safe for a transaction to transfer HOG from the same balance that gave it scheduling capacity: the transfer is just a token movement with fresh scheduling age on the recipient side, not a gas refund.

### Toll-Free Calls

:::caution[Planned, Not Implemented]
Gas sponsorship is on the roadmap but no implementation currently ships. The previous prototype was removed and is being redesigned. The description below is the intent, not current behaviour.
:::

The goal is to let contracts sponsor execution for their callers: a transaction would include a claim naming a sponsoring contract, so the caller would not need to hold enough free HOGs to cover the full gas limit. This is how you would build applications with zero user-facing costs once sponsorship lands.

## Storage: Refundable Deposits

When your contract writes data to the ledger (using [typed storage primitives](/programming-model/storage-types/)), it locks HOG proportional to the size of that data. Delete the data and the HOG is returned. This is a deposit, not a burn.

On Ethereum, you pay gas to write storage, and that cost is gone regardless of whether you later delete the data. The chain accumulates state forever with no incentive to clean it up. On Solana, accounts must hold a rent-exempt balance (conceptually similar to Groundhog's deposit model), but the mechanics differ: Solana accounts are fixed-size and require explicit reallocation to resize, while Groundhog's deposits adjust automatically as stored data grows or shrinks.

Groundhog's deposit model creates a direct incentive to clean up unused state. If your contract no longer needs a piece of data, deleting it frees HOG that you can use for storage elsewhere or that contributes to your throughput share.

### Cost Accounting

Every contract has a HOG balance that represents its unlocked (free) tokens. When a transaction commits, the runtime computes the storage delta for each piece of modified data and adjusts the contract's balance accordingly.

- **Writing new data** deducts HOG from the contract's free balance. The cost depends on the storage type: NNInt has a fixed per-key cost, bytestrings include a per-byte cost, and other types have their own formulas.
- **Modifying existing data** adjusts the deposit up or down based on the size difference.
- **Deleting data** returns the locked HOG to the contract's free balance.

If a contract does not have enough free HOG to cover a storage write, reservation fails with a bounds conflict. The transaction is excluded from that proposal and returned to the mempool. This is different from a deterministic contract abort, which remains in the block with no state changes.

Your contract does not calculate storage costs or manage deposits manually. The runtime handles it as part of the normal transaction commit process.

### Dynamic Pricing

:::caution[Under Active Development]
Dynamic pricing is under active development. The current implementation uses static cost constants. The mechanism described below is the target design.
:::

The target design makes the deposit amount per unit of storage adjust based on how much state the network is carrying.

The network defines a target state size. When total on-chain storage is below the target, deposit costs stay low. As state grows toward the target, deposits get more expensive, making it progressively costlier to add new data. If state growth slows or contracts delete data, prices come back down.

This creates a self-regulating system. The network does not need to impose hard caps on state size. The price signal does the work: when storage is scarce, the market pays more for it. When storage is abundant, costs are low.

Once dynamic pricing is active, deletion will return HOG based on the current rate.

### Sponsoring Users

Contracts can pay storage deposits on behalf of their users. A contract with a sufficient HOG balance absorbs the storage costs for any data its users create, so end users never need to hold HOG or think about deposits.

This is how you build applications with no user-facing fees. The contract operator funds the storage, and users interact with the application for free.

## The Native Token

HOG is implemented as a token contract with the same interface as any other token on the network (transfer, balance, allowance). There are no special syscalls for transferring HOG or checking balances. You call the same methods you would call on any token contract.

This is a deliberate design choice: minimize special cases. One token interface, one set of methods, whether you are working with HOG or any other asset on the network.

## The Capital Model in One Paragraph

Groundhog replaces per-operation fees with capital requirements. You hold HOG tokens. Free HOGs entitle you to a proportional share of network throughput via age-weighted scheduling. Locked HOGs back your on-chain storage and are returned when you delete the data. No tokens are burned for execution. No tokens are burned for storage. The cost of using Groundhog is the opportunity cost of holding HOG, not the operational cost of spending it.

## Related Documentation

- [Programming Model](/programming-model/execution/): Contract-writing rules for execution, storage types, and gas
- [Execution Model](/how-it-works/execution-model/): How the capital model fits into the execution pipeline
- [Architecture](/how-it-works/architecture/): The big-picture design
- [Storage Types Reference](/reference/storage-types/): API for the typed primitives that storage deposits back
- [Getting Started](/start/getting-started/): Write your first contract
