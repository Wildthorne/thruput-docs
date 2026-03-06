# Execution Model and Gas

## Snapshot Isolation

All transactions in a block read from the **same frozen snapshot**: the committed state at the end of the previous block.

- No transaction sees another's writes within the block.
- Reads are stable. The same key returns the same value throughout a transaction.
- Each transaction produces **deltas** (how state should change), not final state.

This is identical to Postgres `REPEATABLE READ`. If you understand database snapshot isolation, you understand Groundhog's execution model.

## Block Lifecycle

```
Previous block committed state
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
        +---> Check all deltas against invariants and each other
        +---> Compatible deltas merge
        +---> Incompatible transactions excluded
        v
   [New Committed State]
        |
        +---> Excluded transactions returned to mempool
              (resubmitted next block, no developer retry logic)
```

1. **Snapshot**: block boundary freezes state. All transactions read from this.
2. **Execute**: all transactions run against the snapshot. Order doesn't matter. Each produces a set of deltas.
3. **Reserve**: deltas are checked for compatibility using each storage type's merge rules (see [storage-types.md](./storage-types.md)).
4. **Merge or exclude**: compatible deltas merge into new state. Incompatible transactions are excluded and returned to the mempool.

## Exclusion, Not Failure

Conflicting transactions are not aborted mid-execution. They execute fully, produce deltas, and are excluded at reservation. The excluded transaction is returned to the mempool and resubmitted in the next block.

The developer writes no retry logic. The user experiences sub-second latency. The mempool handles resubmission.

## Gas: Metering, Not Billing

Transactions and cross-contract calls specify a gas limit. Gas bounds computation (prevents infinite loops, caps cross-contract call depth) but costs zero tokens. No gas is burned.

```rust
// Cross-contract call with gas limit
client.with_gas_limit(100_000).transfer(&to, amount);
```

The gas infrastructure exists for computational safety, not economic extraction.

## Throughput: Balance-Proportional Scheduling

Your free HOG token balance determines your share of network throughput.

- **Under capacity**: every valid transaction lands in the next block. No competition.
- **Under congestion**: throughput is allocated proportionally to free HOG balances. If you hold 2x the HOG, you get roughly 2x the throughput.

The mechanism: HOG cycles between "ready" and "scheduled" states via age-weighted queuing. No tokens are consumed. No tokens are burned.

**Schedule your coins, don't burn them.**

## Storage Costs: Deposits, Not Fees

Writing data to the ledger locks HOG proportional to bytes stored. Deleting data returns the HOG. This is a refundable deposit, not a burn.

- Every HOG locked for storage is one less HOG contributing to your throughput share.
- The deposit rate adjusts dynamically based on total network state size.
- Your contract does not calculate or manage deposits. The runtime handles it at commit.

## What This Means for Contract Design

- **Default to NNInt deltas.** They commute. Concurrent transactions merge instead of conflicting.
- **Use Map for independent entities.** Different keys never interact.
- **Use Bytestring sparingly.** Concurrent writes conflict. Use it for config or ownership, not hot paths.
- **Don't write retry logic.** The mempool handles excluded transactions.
- **Don't optimize for gas cost.** Gas is free. Optimize for correct conflict semantics instead.
