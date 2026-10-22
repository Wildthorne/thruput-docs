---
title: Contract Execution
description: "The rules your contract relies on: snapshots, compatible state changes, exclusion, and gas limits."
---

Your contract reads from a frozen snapshot and produces typed storage changes, called deltas. Ordinary storage reads do not see other transactions' writes. The runtime checks whether each transaction's deltas can coexist with the other changes landing in the block. Deltas that can coexist form the next committed state. Transactions with conflicting deltas are excluded and reported as `retry`.

Read this page first, then [Storage Types](/programming-model/storage-types/). It explains the behavior your contract relies on without requiring the engine's lock and reservation implementation.

## Rules That Cause Bugs

- **Reads are not checked at commit.** A decision based on a value that another transaction can change in the same block can be stale. See [Snapshot Isolation](#snapshot-isolation).
- **Decreases must fit the base.** All decreases admitted to one `Balance` or `NNInt` in a block must fit within the base value. For `Balance` and ordinary `NNInt` updates, the base is the start-of-block snapshot; an explicit `NNInt::set_add` uses the base it sets. Same-block credits do not count. See [Merged Deltas](#merged-deltas) and [NNInt](/programming-model/nnint/).
- **Excluded is not failed.** An excluded transaction can be resubmitted unchanged. A transaction whose root call aborts, reverts, or runs out of gas is committed and its nonce is consumed. See [Exclusion](#exclusion).
- **Absolute writes merge only when equal.** Two `Value`, `Bytestring`, or `NNInt::set` writes to one key land together only when they write the same value. See [Storage Types](/programming-model/storage-types/#choosing-a-type).
- **Some operations allow one writer per block.** One transaction per block can consume from a queue, push or pop a `Vector`, or hold an exclusive write on a key. See [RCQ](/programming-model/storage-types/#rcqt--retrocausalqueue) and [Exclusive Writes](/programming-model/storage-types/#exclusive-writes).
- **The full gas limit is reserved.** Scheduling uses the declared limit, not the gas used. See [Gas](#gas).

## Snapshot Isolation

All transactions in a block read the same committed state from the previous block. Ordinary storage reads do not see another transaction's writes within the block. Reads include changes made within your transaction, including successful child calls. Other transactions cannot change the snapshot you read.

Reads are not validated when the transaction commits. Only writes can conflict. If two transactions each read `total_supply`, find room under a cap, and mint, both can land and exceed the cap. Enforce a rule that spans transactions with a write the runtime checks: a `Balance` or `NNInt` floor, a [`CapacityConstraint`](/programming-model/storage-types/#capacityconstraint), or an [exclusive write](/programming-model/storage-types/#exclusive-writes).

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

Both changes can land because addition gives the same result in either order and the combined debit fits within the balance. We say the operations **commute**, and the runtime can merge their deltas. If the transactions instead try to debit 80 and 30, the combined debit exceeds the snapshot balance, so whichever transaction reserves second is excluded.

Merge rules depend on the storage type:

- `Balance` merges increases and decreases. All decreases admitted in a block must fit within the snapshot value; credits from other transactions in the same block do not fund a decrease.
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

Exclusion is not the same as a failed call. If the root call aborts, reverts, or runs out of gas, the transaction is still committed. Its contract changes are discarded, but its replay nonce and RCQ observations are recorded, so the signed transaction is consumed. Fix the cause and sign a new transaction.

Clients keep the submitted hash and observe its outcome. A pending result is not a reason to sign a replacement transaction. See [Track transaction results](/typescript/transaction-status/). When a recent attempt hit a storage conflict, [`getTransactionStatus`](/reference/json-rpc-api/#gettransactionstatus) can include `recentFailure` with `cause.kind` set to `dbConflict` and a `conflict` object naming the contract address, storage key, and conflict code. Use it to find hot keys.

To handle a conflict inside a child call, use [`with_commit_locking()`](/contracts/cross-contract-calls/#gas-limits). The child takes its commit locks before it returns, so a `try_` call sees the conflict as a failure.

## Gas

Transactions and cross-contract calls specify a gas limit. Gas bounds computation, including work in child calls, but costs zero tokens.

For root transactions, the gas limit is the scheduling quantity. The scheduler accounts for the amount you declare whether execution uses all of it or only part of it. If execution exceeds the limit, the transaction faults. The fault is committed with its contract changes discarded.

Each chain caps the root gas limit at `max_tx_gas`. A transaction above the cap is rejected, not clamped. Wire `14.1.0` servers expose the cap as `stated.maxTxGas` in [`getChainConfig`](/reference/json-rpc-api/#getchainconfig) and report the rejection as `gasLimitTooHigh`.

A child call without `with_gas_limit` can use all of the caller's remaining gas. Unused child-call gas returns to the caller's execution budget. That is not a token refund and does not change the root transaction's scheduling amount.

```rust
let client = TokenClient::new(&token_address);
client.with_gas_limit(100_000).transfer(&to, amount);
```

Gas has no token fee, but lower gas limits use less scheduling capacity. Choose a limit that covers execution and design storage operations to avoid unnecessary conflicts.

Project Thruput needs no gas price estimation because the token price of gas is zero. Gas usage still matters when choosing an execution limit.

## Throughput

Your unlocked native-token balance provides scheduling capacity. A transaction's gas limit must fit within the capacity the sending account's tokens provide; the scheduler drops a transaction whose limit exceeds it. Compatible storage changes do not guarantee inclusion in the next block: admission, capacity, propagation, and expiry still matter. See [Balance-Proportional Scheduling](/how-it-works/storage-economics/#balance-proportional-scheduling) for the allocation rules.

## Storage Costs

The address that owns stored data funds its deposit. The runtime accounts for storage changes; your contract does not calculate the deposit itself. Delete data you no longer need with `delete()` or `Map::delete_at` to release its deposit. See [Storage: Refundable Deposits](/how-it-works/storage-economics/#storage-refundable-deposits) for funding and cost rules.

Next, [Storage Types](/programming-model/storage-types/) turns this model into concrete API choices.
