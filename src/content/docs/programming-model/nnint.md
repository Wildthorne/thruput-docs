---
title: NNInt and concurrent updates
description: The set_add primitive underneath NNInt and why concurrent transactions merge.
---

`NNInt` is the lower-level signed-integer storage API underneath [`Balance`](/programming-model/storage-types/#balance). This page explains its `set_add` representation and why concurrent transactions can merge safely.

Start with `Balance` for nonnegative counters, balances, allowances, and supply. Read this page when you need signed changes, an explicit integer base, or the exact representation that makes checked and lazy balance deltas compatible.

For exact SDK method signatures, see [Rust API Docs](/tools/rust-api-docs/) or [Storage Types Reference](/reference/storage-types/#nnint).

## From Balance to NNInt

Balance gives each direction a name: `increase(5)` adds five and `decrease(3)` subtracts three. NNInt exposes the signed delta directly: `strict_inc(5)` and `strict_inc(-3)`. Both APIs record relative changes. Checked operations load the base for early bound checks; lazy operations defer snapshot-bound checks to reservation.

Balance also enforces a nonnegative value and supplies zero for missing storage. NNInt adds control over the base through `set`, and its `get` fails on missing storage. Use that lower-level control only when the state model needs it.

## The set_add Primitive

Every NNInt storage location maintains two pending values during a transaction:

- **set**: `i128`. The absolute base value.
- **add**: `i128`. The accumulated delta.

The low-level operation is `set_add(set_value, add_value)`. It replaces both pending values. The final committed value is `set + add`, subject to overflow, reservation, and floor checks. The storage handle's `strict_inc`, `inc`, and `set` methods map to this operation.

## The One Rule

Two concurrent `set_add` calls commute **if and only if their resolved set values are equal**.

The bases must match each other; they do not have to equal the snapshot value.

| Tx A | Tx B | Result |
|------|------|--------|
| `set_add(S, x)` | `set_add(S, y)` | Merge: same base, adds combine to `x + y` |
| `set_add(100, x)` | `set_add(100, y)` | Merge: same explicit base, even if snapshot != 100 |
| `set_add(A, x)` | `set_add(B, y)` where A != B | **Conflict**: different bases, one transaction excluded |

A merge still has to fit in `i128` and respect the floor described in [Negative Set Values](#negative-set-values). All negative deltas admitted in a block must fit within the base; positive deltas from other transactions do not offset them.

## The None Path

`set_add` also accepts `None` as the set value: `set_add(None, add_value)`. This means "I don't need to choose the base in this transaction. Let the runtime resolve it from the snapshot."

The runtime resolves `None` to the start-of-block value, or to `0` if the key is absent or not an NNInt. This skips the snapshot read in the contract and gives the same result as loading the base yourself.

| Tx A | Tx B | Commutes? |
|------|------|-----------|
| `set_add(None, x)` | `set_add(None, y)` | Yes: both resolve to the start-of-block value |
| `set_add(None, x)` | `set_add(S, y)` where S = snapshot | Yes: same effective base |
| `set_add(None, x)` | `set_add(S, y)` where S != snapshot | **No**: different resolved bases |

## How the API Maps to set_add

| Method | Effective call | Loads the base? | Commutes? |
|--------|----------------|-----------------|-----------|
| `strict_inc(delta)` | `set_add(Some(base), accumulated + delta)` | Yes | When resolved bases match |
| `inc(delta)` | `set_add(existing_set_or_None, accumulated + delta)` | No | When resolved bases match |
| `set(value)` | `set_add(Some(value), 0)` | No | Only if all concurrent callers set the same value |

**strict_inc(delta)** loads the base (a pending explicit set, the snapshot value, or `0` for an empty key) and aborts immediately if the transaction's running total would be negative. Use it when you want an early underflow check.

**inc(delta)** keeps a pending explicit set if this transaction has one; otherwise it uses the `None` path and skips the read. Underflow is caught later, during reservation, which can be harder to debug.

**set(value)** replaces the base and clears the delta. `set(100)` merges with `set(100)` and conflicts with `set(200)`. It conflicts with a concurrent `strict_inc` or `inc` unless the snapshot is 100. Reserve `set` for initialization or admin operations.

`strict_inc` and `inc` merge with each other when their resolved bases match. Choose between them based on read cost and the need for early underflow detection.

## Negative Set Values

Despite the protocol name `NonnegativeInt`, an explicit `set` can be negative. The commit-time invariant is:

```text
value >= min(set, 0)
```

A negative base becomes the floor. An increment can move the value up from it, but nothing can subtract from it:

```rust
non_negative_int_set(key, -5);
non_negative_int_inc(key, 1);  // The value becomes -4.
// set_add(-5, -1) is rejected.
```

`strict_inc` rejects a running total that remains negative, so use `inc` or the raw functions for negative-base state. Use `Balance` for ordinary nonnegative counters, balances, and allowances. A negative NNInt base is a separate state model, not a way to represent a Balance.

Matching bases are required, but do not guarantee inclusion: aggregate bounds and other transaction changes still matter. See [Merged Deltas](/programming-model/execution/#merged-deltas) for the contract-level model.
