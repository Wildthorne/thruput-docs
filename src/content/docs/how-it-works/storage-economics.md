---
title: Storage & Scheduling Economics
description: How Groundhog's capital-based economic model works.
---

Groundhog's economic model is capital-based, not usage-based. You hold HOG tokens to get capacity. You don't pay per operation.

Free HOG provides scheduling capacity. HOG held for storage backs the data an address keeps on-chain. Neither execution nor storage burns those tokens.

## The Two Jobs of HOG

Every HOG token in your account is in one of two states:

| State | What it does | How you get it back |
|-------|-------------|-------------------|
| **Free** | Entitles you to a share of network throughput | Always available (cycles automatically) |
| **Locked** | Backs a piece of on-chain storage | Returned when you delete the data |

Free HOGs determine how many transactions you can push through the network. Locked HOGs hold your data on-chain. The tradeoff is direct: every HOG you lock for storage is one less HOG contributing to your throughput share.

## Execution: Free, Throughput-Allocated

Running contract code has no token fee. It still uses finite execution and scheduling capacity.

The protocol defines gas limits on transactions and cross-contract calls, but gas costs zero. The gas infrastructure exists for computational metering (preventing infinite loops, bounding cross-contract calls), not for billing.

For root transactions, the declared gas limit is the amount of scheduling capacity used. If you submit a transaction with a `100_000` gas limit, the scheduler accounts for `100_000` units of HOG capacity whether the transaction actually uses `20_000`, `95_000`, or all `100_000`. The execution engine only checks whether the transaction exceeds its declared limit. It does not write a refund for unused gas.

That difference matters for parallelism. A refund-based gas model would need to credit unused gas back to the payer, which creates extra balance updates on the accounts sending many transactions. Groundhog avoids that hot-account path: gas metering can fault an over-limit transaction, but it does not create ledger-side refund effects.

### Balance-Proportional Scheduling

When demand is below capacity, there is less scheduling contention. Inclusion still depends on admission, propagation, storage conflicts, and transaction expiry; the next block is not guaranteed.

When demand exceeds capacity, the network allocates throughput proportionally to free HOG balances. If account A holds 1,000 free HOGs and account B holds 500, A gets roughly twice the throughput of B during congestion. This is Balance-Proportional Scheduling (BPS).

The mechanism works through age-weighted queuing. Each account's free HOGs sit in a scheduling queue tagged with the block number they entered. When a transaction is scheduled, the transaction's declared gas limit moves that much HOG capacity from the "ready" group to the "scheduled" group. The proposer fills each block by selecting transactions whose HOGs have waited longest. Over time, this produces proportional allocation without requiring any fee market or priority auction.

No tokens are consumed in this process. HOGs cycle between ready and scheduled groups and eventually become ready again.

HOG transferred between accounts enters the recipient's scheduling queue as newly received capacity. It does not carry the sender's accumulated scheduling age. That makes it safe for a transaction to transfer HOG from the same balance that gave it scheduling capacity: the transfer is just a token movement with fresh scheduling age on the recipient side, not a gas refund.

### Toll-Free Calls

:::caution[Planned, Not Implemented]
Gas sponsorship is on the roadmap but no implementation currently ships. The description below is the intent, not current behaviour.
:::

The goal is to let contracts sponsor execution for their callers: a transaction would include a claim naming a sponsoring contract, so the caller would not need to hold enough free HOGs to cover the full gas limit. This is how you would build applications with zero user-facing costs once sponsorship lands.

## Storage: Refundable Deposits

When your contract writes data to the ledger (using [typed storage primitives](/programming-model/storage-types/)), it locks HOG proportional to the size of that data. Delete the data and the HOG is returned. This is a deposit, not a burn.

Deleting unused state frees HOG for other storage or scheduling capacity.

### Cost Accounting

Every contract has a HOG balance that represents its unlocked (free) tokens. When a transaction commits, the runtime computes the storage delta for each piece of modified data and adjusts the contract's balance accordingly.

- **Writing new data** deducts HOG from the contract's free balance. The cost depends on the storage type: NNInt has a fixed per-key cost, bytestrings include a per-byte cost, and other types have their own formulas.
- **Modifying existing data** adjusts the deposit up or down based on the size difference.
- **Deleting data** returns the locked HOG to the contract's free balance.

If a contract does not have enough free HOG to cover a storage write, reservation fails with a bounds conflict. The transaction is excluded from that proposal and returned to the mempool. This is different from a deterministic contract abort, which remains in the block with no state changes.

Your contract does not calculate storage costs or manage deposits manually. The runtime handles it as part of the normal transaction commit process.

### Configured Costs

Version 0.1.27 uses configured storage cost constants, including per-item and per-byte costs. Dynamic pricing based on total network state is a target design, not a behavior applications can rely on in this release.

### Sponsoring Users

A contract funds deposits for data stored under its address. Its operator can therefore provide application storage without asking users to fund each item. Users originating transactions still need scheduling capacity; this is separate from the planned execution sponsorship described above.

## The Native Token

A sufficient first HOG credit can pay for the recipient's new balance-item
deposit. A small first credit may be excluded with `insufficientFunds`; funding
the balance item first is one option, not a universal requirement to use an
airdrop. Amounts depend on runtime configuration. Funding a target's storage does
not fund the sender's scheduling capacity. See the
[client funding example](/tools/typescript-sdk/#fund-and-execute-a-call).

HOG is implemented by a native precompiled token contract exposing the standard asset interface, including transfers, balance queries, and allowances. Applications call it through that interface. The runtime also uses its balances for scheduling and storage accounting.



## Related Documentation

- [Programming Model](/programming-model/execution/): Contract-writing rules for execution, storage types, and gas
- [Execution Model](/how-it-works/execution-model/): How the capital model fits into the execution pipeline
- [Architecture](/how-it-works/architecture/): The big-picture design
- [Storage Types Reference](/reference/storage-types/): API for the typed primitives that storage deposits back
- [Getting Started](/start/getting-started/): Write your first contract
