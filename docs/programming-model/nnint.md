# NNInt set_add Commutativity Rules

Source of truth: lead dev, confirmed 2026-03-06.
Public API: `sdk_rs/src/non_negative_int.rs`. Internal syscall wrapper: `sdk_rs/src/internal/nnint.rs`. The `src/storage/` layer is optional convenience sugar.

## The Primitive

Every NNInt storage location maintains two pending values during a transaction:

- **set**: `i128` -- absolute base value
- **add**: `i128` -- accumulated delta

The low-level syscall is `set_add(set_value, add_value)`. It replaces both pending values. The final committed value is `set + add`.

## The One Rule

Two concurrent `set_add` calls commute **if and only if their set values are equal**.

The set values don't have to be any particular value. They just have to match each other.

| Tx A | Tx B | Commutes? | Why |
|------|------|-----------|-----|
| `set_add(S, x)` | `set_add(S, y)` | Yes | Same base (any S). Adds merge: `x + y`. |
| `set_add(100, x)` | `set_add(100, y)` | Yes | Same explicit base (even if snapshot != 100). Adds merge. |
| `set_add(A, x)` | `set_add(B, y)` where `A != B` | **No** | Different bases. Conflict. One transaction excluded. |

**Same base + different deltas = merge. Different bases = conflict.**

## The None Optimization

`set_add` also accepts `None` as the set value: `set_add(None, add_value)`. This means "I don't need to see the base, let the DB fill it in." The DB reads the snapshot value and calls the `set_add(snapshot, add_value)` codepath internally.

This is a performance optimization. It produces the same result as `set_add(snapshot, add_value)` but skips the client-side DB read. Since the DB resolves None to the snapshot, it commutes with any call that also resolves to the snapshot value:

| Tx A | Tx B | Commutes? | Why |
|------|------|-----------|-----|
| `set_add(None, x)` | `set_add(None, y)` | Yes | Both resolve to snapshot. Same effective base. |
| `set_add(None, x)` | `set_add(S, y)` where `S = snapshot` | Yes | None resolves to snapshot. Same effective base. |
| `set_add(None, x)` | `set_add(S, y)` where `S != snapshot` | **No** | Different resolved bases. Conflict. |

## Public API

The public API maps to `set_add` as follows:

### `strict_inc(delta)` -- the common case

Reads the snapshot base, checks the non-negative invariant, calls `set_add(snapshot, accumulated + delta)`.

- Commutes with other `strict_inc` and `inc` calls (all resolve to the same snapshot base).
- Aborts immediately if the result would be negative. Better debugging.
- Pays for a DB read.

### `inc(delta)` -- the optimization

Calls `set_add(None, accumulated + delta)`. Skips the client-side read.

- Commutes with other `inc` and `strict_inc` calls (None resolves to snapshot).
- Underflow is caught at commit time, not at call site. Harder to debug.
- Saves a DB read per call.

`strict_inc` and `inc` are fully interchangeable from a commutativity standpoint. Mix them freely. The only tradeoff is read cost vs early underflow detection.

### `set(value)` -- absolute write

Calls `set_add(value, 0)`. Replaces the base and clears the delta.

- Commutes only if all concurrent callers set the same value.
- `set(100)` vs `set(100)` -- commutes.
- `set(100)` vs `set(200)` -- conflict.
- `set(100)` vs `strict_inc(5)` -- conflict if snapshot != 100; commutes if snapshot == 100.

Use `strict_inc()` on hot paths. Reserve `set()` for initialization or admin operations.

## Summary

| Method | Calls | Reads? | Commutative? | Use for |
|--------|-------|--------|--------------|---------|
| `strict_inc(delta)` | `set_add(snapshot, accumulated + delta)` | Yes | Always (snapshot base) | Hot paths, balances, counters |
| `inc(delta)` | `set_add(None, accumulated + delta)` | No | Always (resolves to snapshot) | High-throughput, skip the read |
| `set(value)` | `set_add(value, 0)` | No | Only if values match | Init, admin, config |
