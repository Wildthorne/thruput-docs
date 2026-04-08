---
title: Execution Model
description: "How your contract runs: snapshot isolation, deltas, block lifecycle, and gas."
---

Your contract reads from a frozen snapshot and produces deltas. It never sees other transactions' writes. At block close, deltas are checked for compatibility: compatible ones merge, incompatible ones are excluded and returned to the mempool.

## Snapshot Isolation

All transactions in a block read the same committed state from the previous block. No transaction sees another's writes within the block. Reads are stable: the same key returns the same value throughout your transaction.

If you've used Postgres with `REPEATABLE READ` isolation, you already understand this model.

## Deltas, Not State

Your contract produces changes, not final state. When you write:

```rust
self.balance.strict_inc(5);
```

This says "add 5 to the balance." It does not say "set the balance to 105." The difference matters: deltas from independent transactions can be merged. Absolute assignments cannot.

## Block Lifecycle

```
Previous block's committed state
        |
        v
   [Frozen Snapshot]
        |
        +---> Tx A executes, produces deltas
        +---> Tx B executes, produces deltas
        +---> Tx C executes, produces deltas
        |        (all read same snapshot, all run concurrently)
        v
   [Reservation Phase]
        |
        +---> Check deltas for compatibility
        +---> Compatible deltas merge
        +---> Incompatible transactions excluded
        v
   [New Committed State]
        |
        +---> Excluded transactions returned to mempool
```

1. **Snapshot**: the block boundary freezes state. All transactions read from this.
2. **Execute**: all transactions run against the snapshot. Order does not matter. Each produces a set of deltas.
3. **Reserve**: deltas are checked for compatibility using each storage type's merge rules (see [Storage Types](/programming-model/storage-types/)).
4. **Merge or exclude**: compatible deltas merge into new state. Incompatible transactions are excluded and returned to the mempool.

## Exclusion

From your contract's perspective, a conflicting transaction simply doesn't land. Your code runs, produces deltas, and the system determines whether those deltas are compatible with other transactions in the block. Incompatible transactions are excluded and returned to the mempool. (Under the hood, the engine resolves most conflicts eagerly during execution via capacity reservation. See [How Conflicts Are Resolved](/how-it-works/execution-model/#how-conflicts-are-resolved) for the engine-level details.)

Your contract writes no retry logic. Client-side, the flow is the same as any other chain: submit a transaction, get a hash, check whether it landed. How conflicts are determined depends on the storage type you choose. See [Storage Types](/programming-model/storage-types/).

## Gas

Transactions and cross-contract calls specify a gas limit. Gas bounds computation (prevents infinite loops, caps cross-contract call depth) but costs zero tokens. No gas is burned.

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

No tokens are consumed. No tokens are burned. Schedule your coins, don't burn them.

## Storage Costs

Writing data to the ledger locks HOG proportional to bytes stored. Deleting data returns the HOG. This is a refundable deposit, not a burn.

Every HOG locked for storage is one less HOG contributing to your throughput share. The deposit rate adjusts dynamically based on total network state size. Your contract does not calculate or manage deposits. The runtime handles it at commit.

For a deeper look at how the runtime implements snapshot isolation, reservation, and delta merging, see [How It Works: Execution Model](/how-it-works/execution-model/).
