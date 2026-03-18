---
title: NNInt In Depth
description: The set_add primitive underneath NNInt and why concurrent transactions merge.
---

You've been using `strict_inc` to write to NNInt values. Here's what's happening underneath, and why concurrent transactions can merge safely.

## The set_add Primitive

Every NNInt storage location maintains two pending values during a transaction:

- **set**: `i128`. The absolute base value.
- **add**: `i128`. The accumulated delta.

The low-level operation is `set_add(set_value, add_value)`. It replaces both pending values. The final committed value is `set + add`.

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

## The None Optimization

`set_add` also accepts `None` as the set value: `set_add(None, add_value)`. This means "I don't need to choose the base. Let the DB fill it in from the snapshot."

The DB reads the snapshot value and runs `set_add(snapshot, add_value)` internally. This is a performance optimization: it produces the same result as reading the snapshot yourself, but skips the client-side DB read.

Since None resolves to the snapshot, commutativity depends on what the other transaction does:

| Tx A | Tx B | Commutes? | Why |
|------|------|-----------|-----|
| `set_add(None, x)` | `set_add(None, y)` | Yes | Both resolve to snapshot. Same effective base. |
| `set_add(None, x)` | `set_add(S, y)` where S = snapshot | Yes | None resolves to snapshot. Same effective base. |
| `set_add(None, x)` | `set_add(S, y)` where S != snapshot | **No** | Different resolved bases. Conflict. |

## How the API Maps to set_add

| Method | Calls | Reads snapshot? | Commutes? |
|--------|-------|-----------------|-----------|
| `strict_inc(delta)` | `set_add(snapshot, accumulated + delta)` | Yes | Always (all resolve to snapshot base) |
| `inc(delta)` | `set_add(None, accumulated + delta)` | No | Always (None resolves to snapshot) |
| `set(value)` | `set_add(value, 0)` | No | Only if all concurrent callers set the same value |

**strict_inc(delta)**: reads the snapshot base, checks the non-negative invariant, calls `set_add(snapshot, accumulated + delta)`. Aborts immediately if the result would be negative. This is the common case. Use this for balances, counters, and any hot path.

**inc(delta)**: calls `set_add(None, accumulated + delta)`. Skips the client-side DB read. Underflow is caught at commit time, not at call site (harder to debug). Use this when you need to skip the read and are confident the balance is sufficient.

**set(value)**: calls `set_add(value, 0)`. Replaces the base and clears the delta. Commutes only when all concurrent callers set the same value. `set(100)` vs `set(100)` merges. `set(100)` vs `set(200)` conflicts. `set(100)` vs `strict_inc(5)` conflicts if the snapshot is not 100, commutes if it is. Reserve `set` for initialization or admin operations.

`strict_inc` and `inc` are interchangeable from a commutativity standpoint. Mix them freely. The only trade-off is a DB read vs early underflow detection.

## Why This Matters

Transaction ordering does not matter on Groundhog. When every concurrent write resolves to the same base, the deltas are addition. Addition commutes.

This is what "compatible" means in the [Execution Model](/programming-model/execution/): at reservation, the system checks whether all deltas for a given storage location share the same resolved set value. If they do, the adds merge. If they don't, one transaction is excluded.

Pick the right storage type, use `strict_inc` on hot paths, and the runtime handles concurrency for you.
