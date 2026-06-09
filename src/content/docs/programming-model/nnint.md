---
title: NNInt In Depth
description: The set_add primitive underneath NNInt and why concurrent transactions merge.
---

You've been using `strict_inc` to write to NNInt values. Here's what's happening underneath, and why concurrent transactions can merge safely.

## The set_add Primitive

Every NNInt storage location maintains two pending values during a transaction:

- **set**: `i128`. The absolute base value.
- **add**: `i128`. The accumulated delta.

The low-level operation is `set_add(set_value, add_value, flags)`. It replaces both pending values. The final committed value is `set + add`, subject to runtime reservation and invariant checks.

Your contract never calls `set_add` directly. The SDK methods (`strict_inc`, `inc`, `set`) map onto it. But this two-component model is what makes the commutativity rules simple and mechanical.

## The One Rule

Two concurrent `set_add` calls commute **if and only if their set values are equal**.

The set values don't have to be any particular value. They just have to match each other.

| Tx A | Tx B | Result |
|------|------|--------|
| `set_add(S, x)` | `set_add(S, y)` | Merge: same base, adds combine to `x + y` |
| `set_add(100, x)` | `set_add(100, y)` | Merge: same explicit base, even if snapshot != 100 |
| `set_add(A, x)` | `set_add(B, y)` where A != B | **Conflict**: different bases, one transaction excluded |

Same base + different deltas = merge. Different bases = conflict. That's the whole rule.

## The None Path

`set_add` also accepts `None` as the set value: `set_add(None, add_value)`. This means "I don't need to choose the base in this invocation. Let the runtime resolve it from the snapshot."

The runtime resolves `None` to the snapshot value internally. This is a performance optimization: it produces the same result as forcing the snapshot read yourself, but skips that read in the contract invocation.

Since `None` resolves to the snapshot, commutativity depends on what the other transaction does:

| Tx A | Tx B | Commutes? | Why |
|------|------|-----------|-----|
| `set_add(None, x)` | `set_add(None, y)` | Yes | Both resolve to snapshot. Same effective base. |
| `set_add(None, x)` | `set_add(S, y)` where S = snapshot | Yes | None resolves to snapshot. Same effective base. |
| `set_add(None, x)` | `set_add(S, y)` where S != snapshot | **No** | Different resolved bases. Conflict. |

## How the API Maps to set_add

| Method | Effective call | Forces snapshot read? | Commutes? |
|--------|----------------|-----------------------|-----------|
| `strict_inc(delta)` | `set_add(Some(snapshot), accumulated + delta)` | Yes | Yes, when all callers resolve to the same snapshot base |
| `inc(delta)` | `set_add(existing_set_or_None, accumulated + delta)` | No | Yes, when all callers resolve to the same snapshot base |
| `set(value)` | `set_add(Some(value), 0)` | No | Only if all concurrent callers set the same value |

**strict_inc(delta)**: forces the snapshot base to be loaded, checks the non-negative invariant in the current invocation, then calls `set_add(Some(snapshot), accumulated + delta)`. Aborts immediately if this invocation's result would be negative. This is the common case. Use this for balances, counters, and any hot path.

**inc(delta)**: preserves the pending set value if one already exists in this invocation; otherwise calls `set_add(None, accumulated + delta)`. Skips the forced snapshot read. Underflow is caught later by runtime reservation/invariant checks when no explicit base has been loaded, which can be harder to debug.

**set(value)**: calls `set_add(Some(value), 0)`. Replaces the base and clears the delta. Commutes only when all concurrent callers set the same value. `set(100)` vs `set(100)` merges. `set(100)` vs `set(200)` conflicts. `set(100)` vs `strict_inc(5)` conflicts if the snapshot is not 100, commutes if it is. Reserve `set` for initialization or admin operations.

`strict_inc` and `inc` are interchangeable from a commutativity standpoint. Mix them freely. The trade-off is read cost vs early underflow detection.

## Why This Matters

Transaction ordering does not matter on Groundhog. When every concurrent write resolves to the same base, the deltas are addition. Addition commutes.

This is what "compatible" means in the [Execution Model](/programming-model/execution/): at reservation, the system checks whether all deltas for a given storage location share the same resolved set value. If they do, the adds merge. If they don't, one transaction is excluded.

Pick the right storage type, use `strict_inc` on hot paths, and the runtime handles concurrency for you.
