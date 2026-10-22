---
title: Contract Execution
description: "The rules your contract relies on: snapshots, compatible state changes, exclusion, and gas limits."
---

Your contract reads from a frozen snapshot and produces typed storage changes, called deltas. Ordinary storage reads do not see other transactions' writes. The runtime checks whether each transaction's deltas can coexist with the other changes landing in the block. Deltas that can coexist form the next committed state. Transactions with conflicting deltas are excluded and reported as `retry`.

This page is the contract-author model. Read it before choosing storage types. It explains the behavior your contract relies on without requiring the engine's lock and reservation implementation.

## Snapshot Isolation

All transactions in a block read the same committed state from the previous block. Ordinary storage reads do not see another transaction's writes within the block. Reads include changes made within your transaction, including successful child calls. Other transactions cannot change the snapshot you read.

The shared snapshot is a useful database analogy, but Stellar Thruput has its own typed delta merge rules.

`RetrocausalQueue` has separate observation rules: a consumer can observe concurrent inserts in the same block. The proposer records these observations for validator replay.

## Merged Deltas

A delta describes how one transaction changes a storage location. It is not necessarily an arithmetic difference. The storage type gives the delta its meaning and defines whether it can coexist with other changes to the same location.

For a `Balance`, the delta is an increase or decrease. When you write:

```rust
self.balance.lazy_increase(5);
```

This says "add 5 to the balance." It does not say "set the balance to 105."

Suppose two transactions read a balance of 100:

```text
Tx A: lazy_decrease(20)
Tx B: lazy_decrease(30)
Both land: 100 - 20 - 30 = 50
```

Both changes can land because addition gives the same result in either order and the combined debit fits within the balance. We say the operations **commute**, and the runtime can merge their deltas. If the transactions instead try to debit 80 and 30, the combined debit is too large, so one or more transactions are excluded.

Merge rules depend on the storage type:

- `Balance` combines increases and decreases while keeping the committed value non-negative.
- `NNInt` exposes lower-level signed changes and explicit bases.
- Changes to different `Map` keys are independent.
- Two `Value` writes to the same key can coexist only when they store the same value.

In these docs, **compatible deltas** means the storage type allows both changes to land. See [`Balance`](/programming-model/storage-types/#balance) for the ordinary balance API and [NNInt and concurrent updates](/programming-model/nnint/) for the underlying `set_add` rules.

## Block Lifecycle

1. **Read and execute:** your contract reads the block snapshot plus its own changes and successful child calls. It records typed deltas.
2. **Reserve:** after the root call succeeds, the runtime checks whether the complete delta batch can coexist with the proposal's other changes.
3. **Commit or exclude:** admissible transactions contribute to the finalized block. Conflicting transactions are excluded and reported as `retry`.

Your contract does not control these phases. [Transaction Lifecycle](/how-it-works/transaction-lifecycle/) covers submission through finalization; [Parallel Execution](/how-it-works/execution-model/) explains the reservation machinery.

## Exclusion

From your contract's perspective, a conflicting transaction doesn't land. Your code runs, produces deltas, and the system determines whether that completed delta batch is compatible with other transactions in the block. An excluded transaction is not committed and its replay nonce is not consumed, so the client can resubmit the same signed transaction until it commits or expires. See [How Conflicts Are Resolved](/how-it-works/execution-model/#how-conflicts-are-resolved) for the engine-level details.

Clients keep the submitted hash and observe its outcome. A pending result is not a reason to sign a replacement transaction. See [Track transaction results](/typescript/transaction-status/). Storage choices determine which changes can coexist; see [Storage Types](/programming-model/storage-types/).

## Gas

Transactions and cross-contract calls specify a gas limit. Gas bounds computation, including work in child calls, but costs zero tokens.

For root transactions, the gas limit is the scheduling quantity. The scheduler accounts for the amount you declare whether execution uses all of it or only part of it. If execution exceeds the limit, the transaction faults and its contract changes are discarded.

Unused child-call gas can return to the caller's execution budget. That is not a token refund and does not change the root transaction's scheduling amount.

```rust
let client = TokenClient::new(&token_address);
client.with_gas_limit(100_000).transfer(&to, amount);
```

Gas has no token fee, but lower gas limits use less scheduling capacity. Choose a limit that covers execution and design storage operations to avoid unnecessary conflicts.

Stellar Thruput needs no gas price estimation because the token price of gas is zero. Gas usage still matters when choosing an execution limit.

## Throughput

Your unlocked native-token balance provides scheduling capacity. Compatible storage changes do not guarantee inclusion in the next block: admission, capacity, propagation, and expiry still matter. See [Balance-Proportional Scheduling](/how-it-works/storage-economics/#balance-proportional-scheduling) for the allocation rules.

## Storage Costs

The address that owns stored data funds its deposit. The runtime accounts for storage changes; your contract does not calculate the deposit itself. See [Storage: Refundable Deposits](/how-it-works/storage-economics/#storage-refundable-deposits) for funding and cost rules.

Next, [Storage Types](/programming-model/storage-types/) turns this model into concrete API choices.
