---
title: Execution Model
description: "How your contract runs: snapshot isolation, deltas, block lifecycle, and gas."
---

Your contract reads from a frozen snapshot and produces typed storage changes, called deltas. Ordinary storage reads do not see other transactions' writes. The runtime checks whether each transaction's deltas can coexist with the other changes landing in the block. Deltas that can coexist form the next committed state. Transactions with conflicting deltas are excluded and returned to the mempool.

This page is the contract-author model. Read it before choosing storage types. It explains the behavior your contract relies on without requiring the engine's lock and reservation implementation.

## Snapshot Isolation

All transactions in a block read the same committed state from the previous block. Ordinary storage reads do not see another transaction's writes within the block. Reads include changes made within your transaction, including successful child calls. Other transactions cannot change the snapshot you read.

The shared snapshot is a useful database analogy, but Groundhog has its own typed delta merge rules.

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

In these docs, **compatible deltas** means the storage type allows both changes to land. See [`Balance`](/programming-model/storage-types/#balance) for the ordinary balance API and [NNInt In Depth](/programming-model/nnint/) for the underlying `set_add` rules.

## Block Lifecycle

```
Previous block's committed state
        |
        v
   [Frozen Snapshot]
        |
        +---> Tx A executes; produces a delta batch
        +---> Tx B executes; produces a delta batch
        +---> Tx C executes; produces a delta batch
        |        (all read same snapshot, all run concurrently)
        v
   [Transactions that can land together]
        |
        +---> Type-specific deltas form the next state
        +---> Conflicting transactions have been excluded
        v
   [New Committed State]
        |
        +---> Excluded transactions returned to mempool
```

1. **Snapshot**: the block boundary freezes state. All transactions read from this.
2. **Execute**: transactions run concurrently against the snapshot and produce typed deltas.
3. **Reserve**: after a root contract call returns, the executor submits that transaction's delta batch for reservation against the in-progress proposal. The runtime applies each storage type's merge rules (see [Storage Types](/programming-model/storage-types/)). Multiple executor workers can reserve compatible batches concurrently.
4. **Commit or exclude**: compatible transactions form the new state. Conflicting transactions are excluded and returned to the mempool.

This is the contract developer's model. The engine resolves ordinary storage conflicts after each root call returns, while admitting its delta batch, rather than waiting for one serial end-of-block merge phase. See [How Conflicts Are Resolved](/how-it-works/execution-model/#how-conflicts-are-resolved) for that machinery.

## Exclusion

From your contract's perspective, a conflicting transaction simply doesn't land. Your code runs, produces deltas, and the system determines whether that completed delta batch is compatible with other transactions in the block. Incompatible transactions are excluded and returned to the mempool. See [How Conflicts Are Resolved](/how-it-works/execution-model/#how-conflicts-are-resolved) for the engine-level details.

Your contract writes no retry logic. Client-side, the flow is the same as any other chain: submit a transaction, get a hash, check whether it landed. How conflicts are determined depends on the storage type you choose. See [Storage Types](/programming-model/storage-types/).

## Gas

Transactions and cross-contract calls specify a gas limit. Gas bounds computation (prevents infinite loops, caps cross-contract call depth) but costs zero tokens. No gas is burned.

For root transactions, the gas limit is the scheduling quantity. The scheduler accounts for the amount you declare whether execution uses all of it or only part of it. If execution exceeds the limit, the transaction faults and its state changes are discarded.

There is no "pay the maximum, refund the unused gas" path. Actual gas consumed does not write a refund delta, touch the sender's balance, or create a serial hot-account update. Cross-contract calls may return unused child-frame gas to the caller's frame, but that only affects local execution budget. It is not a token refund and it does not change the root transaction's scheduling amount.

```rust
let client = TokenClient::new(&token_address);
client.with_gas_limit(100_000).transfer(&to, amount);
```

Gas has no token fee, but lower gas limits use less scheduling capacity. Choose a limit that covers execution and design storage operations to avoid unnecessary conflicts.

Groundhog needs no gas price estimation because the token price of gas is zero. Gas usage still matters when choosing an execution limit.

## Throughput

Your free HOG token balance determines your share of network throughput.

- **Under capacity**: scheduling contention is lower, but admission, propagation, conflicts, and expiry still affect inclusion.
- **Under congestion**: throughput is allocated proportionally to free HOG balances. Hold 2x the HOG, get roughly 2x the throughput.

HOG transferred between accounts enters the recipient's scheduling queue as newly received capacity. It does not carry the sender's accumulated scheduling age. A transaction can transfer HOG from the same balance that scheduled it without creating refund accounting or extra contention.

Scheduling does not consume tokens.

## Storage Costs

Writing data to the ledger locks HOG proportional to bytes stored. Deleting data returns the HOG. This is a refundable deposit, not a burn.

Every HOG locked for storage is one less HOG contributing to your throughput share. Current source uses a configured storage cost model. Dynamic pricing based on network state size is a target design, not the current implementation. Your contract does not calculate or manage deposits. The runtime handles storage cost accounting at commit.

Next, [Storage Types](/programming-model/storage-types/) turns this model into concrete API choices. Once that model is familiar, [How It Works: Execution Model](/how-it-works/execution-model/) explains how the runtime implements snapshot isolation, reservation, and delta merging.
