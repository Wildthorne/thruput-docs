---
title: Execution Model
description: "How your contract runs: snapshot isolation, deltas, block lifecycle, and gas."
---

Your contract reads from a frozen snapshot and produces typed storage changes, called deltas. It never sees other transactions' writes. The runtime checks whether each transaction's deltas can coexist with the other changes landing in the block. Deltas that can coexist form the next committed state. Transactions with conflicting deltas are excluded and returned to the mempool.

## Snapshot Isolation

All transactions in a block read the same committed state from the previous block. No transaction sees another's writes within the block. Reads are stable: the same key returns the same value throughout your transaction.

If you've used Postgres with `REPEATABLE READ` isolation, you already understand this model.

## Merged Deltas

A delta describes how one transaction changes a storage location. It is not necessarily an arithmetic difference. The storage type gives the delta its meaning and defines whether it can coexist with other changes to the same location.

For an `NNInt` balance, the delta is a signed change. When you write:

```rust
self.balance.strict_inc(5);
```

This says "add 5 to the balance." It does not say "set the balance to 105."

Suppose two transactions read a balance of 100:

```text
Tx A: strict_inc(-20)
Tx B: strict_inc(-30)
Both land: 100 - 20 - 30 = 50
```

Both changes can land because addition gives the same result in either order and the combined debit fits within the balance. We say the operations **commute**, and the runtime can merge their deltas. If the transactions instead try to debit 80 and 30, the combined debit is too large, so one or more transactions are excluded.

Merge rules depend on the storage type:

- `NNInt` combines signed changes while enforcing its bounds.
- Changes to different `Map` keys are independent.
- Two `Value` writes to the same key can coexist only when they store the same value.

In these docs, **compatible deltas** means the storage type allows both changes to land. See [`NNInt`](/programming-model/storage-types/#nnint) for the main contract-level example and [NNInt In Depth](/programming-model/nnint/) for the underlying `set_add` rules.

## Block Lifecycle

```
Previous block's committed state
        |
        v
   [Frozen Snapshot]
        |
        +---> Tx A executes; deltas are checked
        +---> Tx B executes; deltas are checked
        +---> Tx C executes; deltas are checked
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
3. **Check**: as deltas are produced, the runtime applies each storage type's merge rules (see [Storage Types](/programming-model/storage-types/)). For contract design, the useful question is whether the deltas can coexist.
4. **Commit or exclude**: compatible transactions form the new state. Conflicting transactions are excluded and returned to the mempool.

This is the contract developer's model. The engine resolves most conflicts eagerly while transactions execute rather than waiting for a separate end-of-block merge phase. See [How Conflicts Are Resolved](/how-it-works/execution-model/#how-conflicts-are-resolved) for that machinery.

## Exclusion

From your contract's perspective, a conflicting transaction simply doesn't land. Your code runs, produces deltas, and the system determines whether those deltas are compatible with other transactions in the block. Incompatible transactions are excluded and returned to the mempool. (Under the hood, the engine resolves most conflicts eagerly during execution via capacity reservation. See [How Conflicts Are Resolved](/how-it-works/execution-model/#how-conflicts-are-resolved) for the engine-level details.)

Your contract writes no retry logic. Client-side, the flow is the same as any other chain: submit a transaction, get a hash, check whether it landed. How conflicts are determined depends on the storage type you choose. See [Storage Types](/programming-model/storage-types/).

## Gas

Transactions and cross-contract calls specify a gas limit. Gas bounds computation (prevents infinite loops, caps cross-contract call depth) but costs zero tokens. No gas is burned.

For root transactions, the gas limit is the scheduling quantity. The scheduler accounts for the amount you declare whether execution uses all of it or only part of it. If execution exceeds the limit, the transaction faults and its state changes are discarded.

There is no "pay the maximum, refund the unused gas" path. Actual gas consumed does not write a refund delta, touch the sender's balance, or create a serial hot-account update. Cross-contract calls may return unused child-frame gas to the caller's frame, but that only affects local execution budget. It is not a token refund and it does not change the root transaction's scheduling amount.

```rust
let client = TokenClient::new(&token_address);
client.with_gas_limit(100_000).transfer(&to, amount);
```

Don't optimize for gas cost. There is no gas cost. Optimize for correct conflict semantics instead.

On other chains, "gas estimation" is painful because gas *price* fluctuates. On Groundhog, gas price estimation is a non-issue: the price is zero.

## Throughput

Your free HOG token balance determines your share of network throughput.

- **Under capacity**: every valid transaction lands in the next block. No competition.
- **Under congestion**: throughput is allocated proportionally to free HOG balances. Hold 2x the HOG, get roughly 2x the throughput.

HOG transferred between accounts enters the recipient's scheduling queue as newly received capacity. It does not carry the sender's accumulated scheduling age. A transaction can transfer HOG from the same balance that scheduled it without creating refund accounting or extra contention.

No tokens are consumed. No tokens are burned. Schedule your coins, don't burn them.

## Storage Costs

Writing data to the ledger locks HOG proportional to bytes stored. Deleting data returns the HOG. This is a refundable deposit, not a burn.

Every HOG locked for storage is one less HOG contributing to your throughput share. Current source uses a configured storage cost model. Dynamic pricing based on network state size is a target design, not the current implementation. Your contract does not calculate or manage deposits. The runtime handles storage cost accounting at commit.

For a deeper look at how the runtime implements snapshot isolation, reservation, and delta merging, see [How It Works: Execution Model](/how-it-works/execution-model/).
