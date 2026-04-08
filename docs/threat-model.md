# Threat Model: Groundhog Execution and Scheduling

Working document. Not published. Covers the adversarial game theory of Groundhog's eager capacity reservation model and proposer discretion.

## Proposer Discretion

The block proposer runs concurrent execution across multiple executors. NNInt capacity locks are resolved by atomic compare-and-swap during execution. The lock API (`nnint128_lock.cc:try_reserve_sub_capacity`) receives no transaction identity metadata: no sender address, no fee, no priority. The lock is blind.

The proposer controls:
- Which transactions from its mempool are included in the nomination
- The order in which transactions are fed to executors (round-robin across executors, chunked into batches)
- Indirectly, which conflicting transaction wins a contested lock (determined by thread scheduling)

The proposer does NOT control:
- The state transition rules (validators re-execute and verify)
- The block hash (validators recompute independently)
- Whether a transaction's math is valid (enforced by the capacity lock invariants)

Source: `hogd/mempool/rpc_from_coord.cc:309-353` (proposal fanning), `hogd/hogdb/item_lock/nnint128_lock.cc:87` (identity-blind lock API).

## MEV Analysis

### What is structurally eliminated

**Algorithmic MEV (fee-based reordering, sandwich attacks).** Front-running requires strict transaction ordering within a block. Because NNInt operations commute, the sequence of non-conflicting transactions within a block does not affect the final state. There is no transaction ordering to exploit. The capacity lock API is blind to fees and identity, so a searcher cannot bribe the lock to prioritize their delta.

**Sandwich attacks.** A sandwich attack requires: (1) observing a pending transaction, (2) inserting a transaction before it, (3) inserting a transaction after it. Step 2 is meaningless when operations commute. The attacker's "before" transaction produces a delta that merges with the victim's delta, not a state change that the victim reads.

### What remains

**Latency MEV.** If two transactions contend for the same NNInt capacity (e.g., two users draining the same pool), the one that reaches the proposer's executor first wins the lock. This creates an incentive to minimize latency to the current proposer's RPC ingress.

**Inclusion MEV.** The proposer chooses which transactions to include. A malicious proposer could exclude specific transactions or preferentially include its own. Validators verify the proposed result but do not currently verify that the proposer followed a canonical scheduling policy.

Source: `hogd/mempool/rpc_from_coord.cc:982` (TODO on scheduling policy verification).

## Spam and Ingress Pressure

Without per-operation fees, the primary defense against spam is gateway admission control. The attack surface is the proposer's RPC ingress, not the consensus layer.

**Attack vector:** Flood the proposer with redundant transactions targeting a contested NNInt key. Each copy consumes RPC bandwidth, mempool space, and executor time. Even if duplicates are deduplicated by hash, the attacker can generate unique transactions (different nonces, slightly different amounts) that all target the same capacity lock.

**Defense surfaces:**
- **Rate limiting.** Per-IP, per-account, per-contract rate limits at the RPC gateway.
- **Authenticated clients.** Require client authentication (API keys, signed requests) for RPC access. Shifts the cost of spam from "free UDP packets" to "acquiring credentials."
- **Stake-weighted QoS.** Connections from staked validators or known infrastructure get priority ingress bandwidth. Anonymous traffic is best-effort.
- **Bounded queues.** Fixed-depth ingress queues with drop-tail policy. When the queue fills, new connections are shed. Protects the proposer's CPU from exhaustion.
- **Deduplication.** Drop transactions with duplicate hashes before they reach the mempool. Does not help against unique-but-similar spam.
- **Prepaid admission capacity.** Possible future mechanism: accounts reserve ingress bandwidth proportional to HOG holdings. Not a fee (nothing is burned), but a capacity allocation that limits how many transactions an account can submit per unit time. Design space is open.

This is a different security model from EVM chains. The defense is at the network/gateway layer, not the economic/fee layer. The tradeoff: no gas costs for users, but the network must actively manage ingress.

## Scheduling Policy Verification

The codebase contains: `TODO(jhumphri): Need to ensure that the node that proposed the block is following the expected scheduling policy.` (`hogd/mempool/rpc_from_coord.cc:982`)

**What this means:** Validators currently verify that the proposed state transitions are mathematically valid. They do not verify that the proposer's selection of transactions was fair, complete, or followed any particular ordering policy.

**What it protects against:** A malicious proposer that censors specific transactions or preferentially includes its own.

**Design space:**
- **Mandatory inclusion proofs.** Require the proposer to include all transactions it received that fit within block capacity. Difficult to enforce without a shared view of the mempool.
- **Scheduling policy attestation.** Proposer attests to the scheduling algorithm used. Validators verify the algorithm's constraints. Adds complexity.
- **Rotation and reputation.** Frequent proposer rotation limits the damage a single malicious proposer can do. Reputation systems penalize proposers that consistently exclude transactions.
- **Decentralized mempool gossip.** If all validators see the same transaction pool, a proposer that excludes a well-known transaction is detectable.

This is an open design question. The current architecture is safe (validators prevent invalid state transitions) but does not guarantee fairness.

## Double-Spend Scenario Walkthrough

Grounded in hogd code paths.

**Setup:** Alice has 10 tokens (NNInt snapshot value = 10).

**Lock initialization:** When the first transaction touches Alice's balance key, `BlockTX::get_snapshot_cost_and_cache_data` reads the snapshot (`block_tx.cc:80-94`). The `NNInt128Lock` constructor initializes with `base_value = 10`, which sets `sub_capacity = 10` (can subtract up to 10) and `add_capacity = i128::MAX - 10` (`nnint128_lock.h:39-52`).

**Tx A: Alice sends 8 to Bob.** `strict_inc(-8)` calls `try_atomic_change_lock` (`nnint128_lock.cc:87`), which calls `try_reserve_delta` → `try_reserve_sub_capacity(-8)`. CAS loop: current sub = 10, proposed = 10 + (-8) = 2. 2 >= 0, so CAS succeeds. Sub budget is now 2.

**Tx B: Alice sends 5 to Charlie.** `strict_inc(-5)` calls the same path. CAS loop: current sub = 2, proposed = 2 + (-5) = -3. -3 < 0, so reservation fails. Returns `HogDBCode::kConflict` (`nnint128_lock.cc:98`).

**Conflict handling:** `rpc_from_exec.cc:188-196` catches the error, rolls back the subtransaction via `rollback_to_savepoint`. Tx B is excluded from the block and returned to the mempool.

**Block close:** `BlockTX::close` (`block_tx.cc:299`) calls `stage_locks`, which iterates finalized locks and stages their committed values into a ChangeSet. Alice's balance lock has delta = -8. The ChangeSet applies this to the snapshot to produce the new committed value: 10 - 8 = 2. No conflict resolution happens here.

**Result:** Alice's balance is 2. Bob received 8. Tx B is in the mempool and will be re-evaluated against the next block's snapshot, where Alice has 2. If Alice still has insufficient balance, Tx B fails again and eventually expires via TTL.
