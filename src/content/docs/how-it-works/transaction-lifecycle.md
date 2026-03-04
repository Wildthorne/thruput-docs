---
title: Transaction Lifecycle
description: The five stages of transaction execution in Groundhog.
---

This document describes the step-by-step process of executing a transaction in Groundhog, from submission to final commit.

## Overview

When a transaction is executed, it progresses through five main stages:

1. **Authorization Verification**: Check that required signatures are present
2. **Root Frame Creation**: Initialize execution context for the transaction
3. **Execution**: Run the contract code and any subinvocations
4. **Root Frame Completion**: Check if execution succeeded, reverted, or panicked
5. **Reservation and Commit**: Attempt to reserve deltas and commit state changes

## Step 1: Authorization Verification

Before execution begins, the runtime verifies that the attached signatures authorize the transaction to begin at the specified address, as checked against that address's authorization data.

- If verification succeeds: proceed to execution
- If verification fails: transaction is rejected (does not execute)

See [Authorization](/how-it-works/authorization/) for details on the authorization system.

## Step 2: Root Frame Creation

The runtime creates the root invocation frame based on the transaction's `Invocation` and pushes it onto the (initially empty) call stack. The invocation targets a [contract](/how-it-works/contracts/) deployed at the specified address.

See [Invocation Frames](/how-it-works/invocation-frames/) for the complete frame structure.

## Step 3: Execution

The root frame begins execution from a **consistent snapshot** of the ledger state. All transactions in a block read from the same state snapshot taken at the start of block processing.

When contract code executes:
- It reads state values from the snapshot (via syscalls like `BytestringGet`, `NonnegativeIntGet`)
- It never sees writes from other transactions in the same block
- It produces **StorageDeltas** describing how to modify state
- It runs until termination (commit, abort, or fault)

Because all transactions read from the same snapshot and produce deltas instead of directly modifying state, execution can happen in parallel across all available CPU cores.

See [Invocation Frames](/how-it-works/invocation-frames/) for detailed execution semantics.

## Step 4: Root Frame Completion

When the root frame completes, the runtime checks its status:

**If the root frame hit a Fault or Aborted:**
- Transaction fails
- No state changes are committed

**If the root frame committed:**
- Proceed to reservation and commit (Step 5)

## Step 5: Reservation and Commit

If the root frame committed successfully, the transaction's deltas are ready for inclusion in a block.

### Reservation

During block assembly, each delta produced by the transaction undergoes a `reserve()` test to check if it's compatible with other deltas already reserved in the block (on the key that the delta modifies).

Multiple transactions can have their deltas reserved in parallel.[^reserve-parallel]

If all of the transaction's deltas successfully reserve, the transaction is included in the block. If any delta fails to reserve (conflicts with another delta), all of the transaction's reservations are rolled back and the transaction is excluded from this block.

[^reserve-parallel]: The `reserve()` operation is implemented primarily with lock-free atomic operations, enabling parallel execution across CPU cores. Reservation operations from different transactions can be interleaved at the instruction level. The deltas a transaction produces and their effects on state are independent of reservation ordering or transaction execution ordering.

### Commit

Once all of a transaction's deltas are reserved successfully, we add each delta to the set of deltas made by all transactions in the block (on the key that the delta modifies).

It is only once all transactions in the block have been executed, that all deltas for each key are combined according to type-specific rules to produce the final state for that key (which becomes the initial state in the next block).

## Related Documentation

- [Invocation Frames](/how-it-works/invocation-frames/): Execution context
- [Authorization](/how-it-works/authorization/): How signatures are verified
- [Contracts](/how-it-works/contracts/): Contract types and deployment
