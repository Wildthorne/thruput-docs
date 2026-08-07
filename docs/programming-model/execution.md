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
2. **Execute**: transactions run against the snapshot and produce deltas.
3. **Reserve**: after a root contract call returns, its delta batch is checked for compatibility using each storage type's merge rules (see [storage-types.md](./storage-types.md)). Multiple executor workers can reserve compatible batches concurrently.
4. **Merge or exclude**: compatible deltas merge into new state. Incompatible transactions are excluded and returned to the mempool.

## Exclusion, Not Failure

From the contract author's perspective, conflicts are exclusions, not retry loops inside your code. A transaction either lands or is excluded by the runtime when its deltas cannot be reserved or merged with other transactions in the block. The excluded transaction is returned to the mempool and can be resubmitted in a later block.

The developer writes no retry logic. The mempool handles resubmission.

## Gas: Metering, Not Billing

Transactions and cross-contract calls specify a gas limit. Gas bounds computation (prevents infinite loops, caps cross-contract call depth) but costs zero tokens. No gas is burned.

For root transactions, the declared gas limit is the scheduling quantity. The scheduler accounts for that declared amount whether execution uses all of it or only part of it. If execution exceeds the limit, the transaction faults and its state changes are discarded.

There is no "pay the maximum, refund the unused gas" path. Actual gas consumed does not write a refund delta, touch the sender's balance, or create a serial hot-account update. Cross-contract calls may return unused child-frame gas to the caller's frame, but that only affects local execution budget. It is not a token refund and it does not change the root transaction's scheduling amount.

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

HOG transferred between accounts enters the recipient's scheduling queue as newly received capacity. It does not carry the sender's accumulated scheduling age. This is why a transaction can transfer HOG from the same balance that scheduled it without creating refund accounting or extra contention.

**Schedule your coins, don't burn them.**

## Storage Costs: Deposits, Not Fees

Writing data to the ledger locks HOG proportional to bytes stored. Deleting data returns the HOG. This is a refundable deposit, not a burn.

- Every HOG locked for storage is one less HOG contributing to your throughput share.
- Current source uses a configured storage cost model: base item cost, bytestring per-byte cost, contract deployment cost, auth key cost, RCQ entry cost, replay-cache entry cost, and balance cost.
- Dynamic pricing based on network state size is a target design, not the current implementation.
- Your contract does not calculate or manage deposits. The runtime handles storage cost accounting at commit.

## What This Means for Contract Design

- **Use Balance for ordinary balances.** Checked and lazy increases and decreases map to mergeable NNInt deltas.
- **Use NNInt for lower-level integer state.** It adds signed deltas and explicit base operations when the data model needs them.
- **Use Map for independent entities.** Different keys never interact.
- **Use Bytestring sparingly.** Concurrent writes conflict. Use it for config or ownership, not hot paths.
- **Don't write retry logic.** The mempool handles excluded transactions.
- **Don't optimize for gas cost.** Gas is free. Optimize for correct conflict semantics instead.
