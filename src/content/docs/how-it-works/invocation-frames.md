---
title: Invocation Frames
description: How contract calls track state, return results, and merge or discard child effects.
---

An invocation frame is the execution context for one contract call. A transaction begins with a root frame. A [cross-contract call](/contracts/cross-contract-calls/) creates a child frame and returns control to its parent when it finishes.

The same model applies to RV32 contracts and native system contracts.

## Frame Structure

| Part | Contents |
| --- | --- |
| Call context | Contract address, entrypoint, calldata, invocation flags, and gas budget |
| State changes | Storage operations and deployments made by this frame and its successful children |
| Events | Events emitted by this frame and its successful children |
| Child result | Status and return bytes from the most recent child call |
| Resource use | Gas consumed by this frame and its children |

A transaction's root invocation has no child-call flags. A child's gas budget is capped by its parent's remaining budget. See [Invocation configuration](/contracts/cross-contract-calls/) for SDK controls.

## Call Stack

```text
Root: wallet.execute
  Child: counter.increment
    Nested child: another contract method
```

Each child has its own execution context. Its ordinary reads use the block snapshot plus visible changes from the current transaction. A child call is part of that transaction, not a separate transaction or a separate block.

## Frame Lifecycle

### 1. Creation

The runtime creates a frame with the call context and an empty record of local changes and events.

### 2. Execution

Contract code uses [syscalls](/reference/syscalls/) to read state, record changes, emit events, and call other contracts. Child calls can create further frames.

### 3. Completion

| Result | Return bytes | Contract effects |
| --- | --- | --- |
| **Return** (`0`) | Returned to the caller | Preserved for merging into the parent |
| **Fault** (`1`) | Empty | Discarded |
| **Abort** (`2`) | Returned to the caller, usually as error data | Discarded |

A fault can result from an invalid instruction, invalid memory access, or exhausted gas. An abort is an explicit revert. SDK-generated wrappers use the Return syscall with its revert flag to produce a return or abort. Gas consumed before either failure remains consumed; it is computation metering, not a token fee.

### 4. Merge into Parent (or Finalize for Root)

On a successful child return, its storage changes, deployments, and events become part of the parent frame. They have not committed to the ledger yet. On a child abort or fault, those effects are discarded.

In either case, the parent receives the child's status and return buffer and accounts for its gas use. A recoverable SDK call lets the parent inspect the failure. A throwing call propagates an unhandled failure. See [Cross-Contract Calls](/contracts/cross-contract-calls/#error-handling).

When the root returns successfully, the transaction's changes must still pass reservation against the proposed block. A committed root abort or fault records the failure while discarding contract effects; protocol bookkeeping such as replay protection remains. See [Transaction Lifecycle](/how-it-works/transaction-lifecycle/#root-frame-completion).

### 5. Pop and Return

The runtime discards the completed frame's guest memory, registers, and stack. Control returns to the parent, or execution ends for the root. Only state written through the storage APIs can persist beyond execution.

## Example: Nested Contract Calls

Suppose contract A calls B, C, and D using recoverable calls:

| Step | Outcome | Changes retained by A |
| --- | --- | --- |
| A writes `AAA` | A continues | `AAA` |
| B writes `BBB` and returns | Child effects merge | `AAA`, `BBB` |
| C writes `CCC` and aborts | Child effects are discarded; A handles the error | `AAA`, `BBB` |
| D writes `DDD` and faults | Child effects are discarded; A handles the fault | `AAA`, `BBB` |
| A writes `FINAL` and returns | Root changes enter reservation | `AAA`, `BBB`, `FINAL` |

If the transaction is admitted and committed, the ledger contains `AAA`, `BBB`, and `FINAL`. C's and D's writes never commit. If A instead propagates either child failure, A's contract effects are discarded too.

## Related Documentation

- [Cross-Contract Calls](/contracts/cross-contract-calls/): SDK call and error-handling patterns
- [Authorization](/how-it-works/authorization/#passing-auth-tokens): Auth-token ownership across frames
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/): Reservation and final outcomes
- [Contract artifacts and addresses](/how-it-works/contracts/): Code and deployment identities
