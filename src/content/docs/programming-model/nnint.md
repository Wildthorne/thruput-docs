---
title: NNInt In Depth
description: The set_add primitive underneath NNInt and why concurrent transactions merge.
---

`NNInt` is the lower-level signed-integer storage API underneath [`Balance`](/programming-model/storage-types/#balance). This page explains its `set_add` representation and why concurrent transactions can merge safely.

Most contracts should use `Balance` for balances, allowances, and supply. Read this page when you need signed changes, an explicit integer base, or the exact representation that makes checked and lazy balance deltas compatible.

For exact SDK method signatures, see [`NNInt` Rustdoc](https://groundhog.dev/docs/sdk/latest/sdk/storage/nnint/struct.NNInt.html) or [Storage Types Reference](/reference/storage-types/#nnint).

## The set_add Primitive

Every NNInt storage location maintains two pending values during a transaction:

- **set**: `i128`. The absolute base value.
- **add**: `i128`. The accumulated delta.

The low-level operation is `set_add(set_value, add_value, flags)`. It replaces both pending values. The final committed value is `set + add`, subject to overflow, reservation, and floor checks.

Despite the protocol name `NonnegativeInt`, current source allows an explicit negative `set`. The storage invariant is:

```text
value >= min(set, 0)
```

So `set(-5)` may commit `-5`, and `set_add(-5, 10)` may commit `5`. The engine still rejects subtracting from an already-negative explicit base, such as `set_add(-5, -1)`. Use `Balance` for ordinary balances. Use `NNInt` when the state model needs signed changes or an explicit base.

Your contract never calls `set_add` directly. The SDK methods (`strict_inc`, `inc`, `set`) map onto it. But this two-component model is what makes the commutativity rules simple and mechanical.

## The One Rule

Two concurrent `set_add` calls commute **if and only if their resolved set values are equal**.

The set values don't have to be any particular value. They just have to match each other.

| Tx A | Tx B | Result |
|------|------|--------|
| `set_add(S, x)` | `set_add(S, y)` | Merge: same base, adds combine to `x + y` |
| `set_add(100, x)` | `set_add(100, y)` | Merge: same explicit base, even if snapshot != 100 |
| `set_add(A, x)` | `set_add(B, y)` where A != B | **Conflict**: different bases, one transaction excluded |

Same base + different deltas = merge. Different bases = conflict. The merged value still has to fit in `i128` and satisfy `value >= min(set, 0)`.

## The None Path

`set_add` also accepts `None` as the set value: `set_add(None, add_value)`. This means "I don't need to choose the base in this invocation. Let the runtime resolve it from the snapshot."

The runtime resolves `None` to the start-of-block value internally. This is a performance optimization: it produces the same result as forcing the snapshot read yourself when the key already contains an NNInt, but skips that read in the contract invocation. If the key is absent or not an NNInt, the `None` path resolves to `0`.

Since `None` resolves to the start-of-block value, commutativity depends on what the other transaction does:

| Tx A | Tx B | Commutes? | Why |
|------|------|-----------|-----|
| `set_add(None, x)` | `set_add(None, y)` | Yes | Both resolve to the same start-of-block value. Same effective base. |
| `set_add(None, x)` | `set_add(S, y)` where S = snapshot | Yes | None resolves to the snapshot NNInt value. Same effective base. |
| `set_add(None, x)` | `set_add(S, y)` where S != snapshot | **No** | Different resolved bases. Conflict. |

## How the API Maps to set_add

| Method | Effective call | Forces snapshot read? | Commutes? |
|--------|----------------|-----------------------|-----------|
| `strict_inc(delta)` | `set_add(Some(base), accumulated + delta)` | Yes | Yes, when all callers resolve to the same snapshot base |
| `inc(delta)` | `set_add(existing_set_or_None, accumulated + delta)` | No | Yes, when all callers resolve to the same snapshot base |
| `set(value)` | `set_add(Some(value), 0)` | No | Only if all concurrent callers set the same value |

**strict_inc(delta)**: loads the current base (pending explicit set, snapshot NNInt, or `0` for an empty key), checks that this invocation's total is nonnegative, then calls `set_add(Some(base), accumulated + delta)`. Aborts immediately if this invocation's result would be negative. Use this when lower-level integer state needs an early underflow check.

**inc(delta)**: preserves the pending set value if one already exists in this invocation; otherwise calls `set_add(None, accumulated + delta)`. Skips the forced snapshot read. Underflow is caught later by runtime reservation/floor checks when no explicit base has been loaded, which can be harder to debug.

**set(value)**: calls `set_add(Some(value), 0)`. Replaces the base and clears the delta. Negative values are allowed, and a negative set value becomes the floor. `set` commutes only when all concurrent callers set the same value. `set(100)` vs `set(100)` merges. `set(100)` vs `set(200)` conflicts. `set(100)` vs `strict_inc(5)` conflicts if the snapshot is not 100, commutes if it is. Reserve `set` for initialization or admin operations.

`strict_inc` and `inc` are interchangeable from a commutativity standpoint. Mix them freely. The trade-off is read cost vs early underflow detection.

## Why This Matters

For NNInt writes that resolve to the same base, transaction ordering does not affect the merged value. The deltas are addition, and addition commutes.

This is what "compatible" means in [Merged Deltas](/programming-model/execution/#merged-deltas): at reservation, the system checks whether all deltas for a given storage location share the same resolved set value. If they do, the adds merge. If they don't, one transaction is excluded.

Pick the narrowest storage API that fits the state. Use `Balance` for balances and `NNInt` when you need signed changes or explicit bases. The runtime handles their concurrency rules.
