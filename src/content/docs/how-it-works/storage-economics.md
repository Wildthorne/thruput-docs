---
title: Compute, Capacity & Storage
description: How the native token provides scheduling capacity and refundable storage deposits without conventional gas fees.
---

Stellar Thruput has no conventional gas fees. Its native token backs onchain storage and provides scheduling capacity under load. The current experimental network's native token has no monetary value.

Removing the sequential execution bottleneck is intended to make compute abundant rather than keep it scarce by design. Parallel execution does not remove hardware limits or contention: the network still meters computation and allocates capacity when demand exceeds it.

<span id="the-two-jobs-of-hog"></span>

## The Two Jobs of the Native Token

Each unit of the native token in your account is in one of two states:

| State | What it does | How you get it back |
|-------|-------------|-------------------|
| **Free** | Entitles you to a share of network throughput | No deposit to reclaim; scheduling does not spend the tokens |
| **Locked** | Backs a piece of on-chain storage | Returned when you delete the data |

Locking native tokens for storage reduces the free balance available for scheduling.

<span id="execution-free-throughput-allocated"></span>

## Execution: Metered, Throughput-Allocated

Running contract code has no conventional gas fee. It still uses finite execution and scheduling capacity, backed by the sender's unlocked native-token balance.

The protocol defines gas limits on transactions and cross-contract calls, but gas costs zero. The gas infrastructure exists for computational metering (preventing infinite loops, bounding cross-contract calls), not for billing.

For root transactions, scheduling uses the **declared gas limit**, not measured consumption. A transaction with a `100_000` gas limit reserves capacity for that limit whether execution uses `20_000`, `95_000`, or all `100_000`. Exceeding the limit faults the transaction.

There is no unused-gas token refund. Metering does not debit or refund the sender's native-token balance, so it does not add a balance update for each transaction. Choose a limit that covers execution without reserving unnecessary scheduling capacity.

### Balance-Proportional Scheduling

When demand is below capacity, there is less scheduling contention. Inclusion still depends on admission, propagation, storage conflicts, and transaction expiry; the next block is not guaranteed.

When demand exceeds capacity, the scheduler allocates capacity proportionally to unlocked native-token balances over time. If account A holds 1,000 unlocked native tokens and account B holds 500, A receives roughly twice the scheduling capacity for comparable demand. This is Balance-Proportional Scheduling (BPS). Transaction counts also depend on their declared gas limits.

The mechanism works through age-weighted queuing. Each account's unlocked tokens sit in a scheduling queue tagged with the block number they entered. When a transaction is scheduled, its declared gas limit determines how much token-backed capacity moves from the "ready" group to the "scheduled" group. The proposer fills each block by selecting transactions whose capacity has waited longest. Over time, this produces proportional allocation without requiring any fee market or priority auction.

Tokens cycle through scheduling groups and become ready again. This changes their scheduling priority, not the number of tokens held.

Native tokens transferred between accounts enter the recipient's scheduling queue as newly received capacity. They do not carry the sender's accumulated scheduling age.

## Storage: Refundable Deposits

When your contract adds data to the ledger, it locks native tokens according to the [storage type](/programming-model/storage-types/) and size of the data. Delete the data and the deposit is returned to the address that held it. This is a deposit, not a burn.

Deleting unused state frees native tokens for other storage or scheduling capacity.

### Cost Accounting

Every contract has a native-token balance that represents its unlocked (free) tokens. When a transaction commits, the runtime computes the storage delta for each piece of modified data and adjusts the contract's balance accordingly.

- **Writing new data** deducts native tokens from the contract's free balance. The cost depends on the storage type: NNInt has a fixed per-key cost, bytestrings include a per-byte cost, and other types have their own formulas.
- **Modifying existing data** adjusts the deposit up or down based on the size difference.
- **Deleting data** returns the locked native tokens to the contract's free balance.

If an address does not have enough unlocked native tokens to cover a storage change, reservation can fail for insufficient funds. The transaction is excluded from that proposal and returned to the mempool. This differs from a committed contract abort, whose result is recorded with its contract changes discarded. See [Transaction Lifecycle](/how-it-works/transaction-lifecycle/#outcomes-to-distinguish).

Your contract does not calculate storage costs or manage deposits manually. The runtime handles it as part of the normal transaction commit process.

### Configured Costs

The current implementation uses configured rates: base item costs, per-byte costs, and costs for specific item types such as authorization keys and queue entries. These rates come from the network's storage cost model. The implementation does not adjust prices automatically based on total network state size.

### Sponsoring Users

A contract funds deposits for data stored under its address. Its operator can therefore provide application storage without asking users to fund each item. Users originating transactions still need scheduling capacity; storage funding does not provide execution sponsorship.

## The Native Token

A sufficient first native-token credit can pay for the recipient's new balance-item
deposit. A small first credit may be excluded with `insufficientFunds`; funding
the balance item first is one option, not a universal requirement to use an
airdrop. Amounts depend on runtime configuration. Funding a target's storage does
not fund the sender's scheduling capacity. See the
[client funding example](/typescript/accounts/#request-devnet-funds).

The native token is implemented by a native precompiled contract exposing the standard asset interface, including transfers, balance queries, and allowances. Applications call it through that interface. The runtime also uses its balances for scheduling and storage accounting. Current tooling calls this token `HOG`; use the existing `HOG_ADDRESS` SDK constant and CLI token alias when writing code or commands.

## Toll-Free Calls

:::caution[Planned, Not Implemented]
Execution sponsorship is a planned feature, not a capability applications can currently rely on.
:::

The intent is to let a contract provide scheduling capacity for its callers. That would let callers execute without holding the full capacity required by the transaction. This is separate from the storage funding described above.

## Related Documentation

- [Contract Execution](/programming-model/execution/): Contract-writing rules for execution and gas
- [Parallel Execution](/how-it-works/execution-model/): How compatible state changes are admitted
- [System Overview](/how-it-works/architecture/): The component map
- [Storage Types Reference](/reference/storage-types/): API for the typed primitives that storage deposits back
- [Contract quickstart](/get-started/contract/): Deploy your first contract
