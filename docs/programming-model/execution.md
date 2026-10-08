# Execution Model and Gas

## Snapshot Isolation

All transactions in a block read from the **same frozen snapshot**: the committed state at the end of the previous block.

- Ordinary storage reads do not see another transaction's writes within the block.
- Reads include the transaction's own changes and successful child calls, over the stable block snapshot.
- Each transaction produces **deltas** (how state should change), not final state.

The shared snapshot is a useful database analogy, but Stellar Thruput uses typed delta reservation rather than SQL isolation and conflict rules.

`RetrocausalQueue` has separate observation rules: a consumer can observe concurrent inserts in the same block. The proposer records these observations for validator replay.

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
              (eligible for a later block, subject to scheduling and expiry)
```

1. **Snapshot**: block boundary freezes state. All transactions read from this.
2. **Execute**: transactions run against the snapshot and produce deltas.
3. **Reserve**: after a root contract call returns, its delta batch is checked for compatibility using each storage type's merge rules (see [storage-types.md](./storage-types.md)). Multiple executor workers can reserve compatible batches concurrently.
4. **Merge or exclude**: compatible deltas merge into new state. Incompatible transactions are excluded and returned to the mempool.

## Exclusion, Not Failure

From the contract author's perspective, conflicts are exclusions, not retry loops inside your code. A transaction either lands or is excluded by the runtime when its deltas cannot be reserved or merged with other transactions in the block. The excluded transaction is returned to the mempool and can be resubmitted in a later block.

The mempool handles conflict resubmission. Clients should still track confirmation and expiry.

An excluded transaction is not the same as a committed execution failure. Deterministic aborts and faults can be included with contract-body changes discarded, while protocol bookkeeping such as the replay nonce and RCQ observations is still recorded. Do not describe this as "no state changes" without qualifying which state.

## Gas: Metering, Not Billing

Transactions and cross-contract calls specify a gas limit. Gas bounds computation, including work in child calls, but costs zero tokens.

For root transactions, the declared gas limit is the scheduling quantity. The scheduler accounts for that declared amount whether execution uses all of it or only part of it. If execution exceeds the limit, the transaction faults and its contract changes are discarded.

There is no "pay the maximum, refund the unused gas" path. Actual gas consumed does not write a refund delta, touch the sender's balance, or create a serial hot-account update. Cross-contract calls may return unused child-frame gas to the caller's frame, but that only affects local execution budget. It is not a token refund and it does not change the root transaction's scheduling amount.

```rust
// Cross-contract call with gas limit
client.with_gas_limit(100_000).transfer(&to, amount);
```



## Throughput: Balance-Proportional Scheduling

Your unlocked native-token balance determines your share of network throughput.

- **Under capacity**: scheduling contention is lower, but admission, propagation, conflicts, and expiry still affect inclusion.
- **Under congestion**: throughput is allocated proportionally to unlocked native-token balances. If you hold twice the tokens, you get roughly twice the throughput for comparable demand.

The mechanism: native tokens cycle between "ready" and "scheduled" states via age-weighted queuing. No tokens are consumed. No tokens are burned.

Native tokens transferred between accounts enter the recipient's scheduling queue as newly received capacity. They do not carry the sender's accumulated scheduling age. This is why a transaction can transfer native tokens from the same balance that scheduled it without creating refund accounting or extra contention.



## Storage Costs: Deposits, Not Fees

Writing data to the ledger locks native tokens according to the storage type and size. Deleting data returns its deposit. This is a refundable deposit, not a burn.

- Every native token locked for storage is one less token contributing to your throughput share.
- Current source uses a configured storage cost model: base item cost, bytestring per-byte cost, contract deployment cost, auth key cost, RCQ entry cost, replay-cache entry cost, and balance cost.
- Dynamic pricing based on network state size is a target design, not the current implementation.
- Your contract does not calculate or manage deposits. The runtime handles storage cost accounting at commit.

## What This Means for Contract Design

- **Use Balance for ordinary balances.** Checked and lazy increases and decreases map to mergeable NNInt deltas.
- **Use NNInt for lower-level integer state.** It adds signed deltas and explicit base operations when the data model needs them.
- **Use Map for independent entities.** Different keys never interact.
- **Use Bytestring for replacement values.** Concurrent writes of different values conflict; identical writes can coexist. Consider this when modeling frequently updated state.
- **Don't write retry logic.** The mempool handles excluded transactions.
- **Budget gas for execution and scheduling.** Gas has no token fee, but the declared limit consumes scheduling capacity.
