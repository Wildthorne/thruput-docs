# NNInt set_add Commutativity Rules

Verified against the current sibling source repos:

- Public storage wrapper: `../sdk_rs/crates/sdk/src/storage/nnint.rs`
- Throwing syscall wrappers: `../sdk_rs/crates/sdk/src/sys_exn/nnint.rs`
- Internal set/add wrapper: `../sdk_rs/crates/sdk/src/sys_exn/nnint_internal.rs`
- Protocol storage deltas: `../protocol/storage_item.x`
- Engine validation and reservation: `../hogd/hogd/hogexec/runtime/item/item_view.cc`, `../hogd/hogd/storage_item/`

## The Primitive

Every NNInt storage location maintains two pending values during a transaction:

- **set**: `i128` -- absolute base value
- **add**: `i128` -- accumulated delta

The low-level operation is `set_add(set_value, add_value, flags)`. It replaces both pending values. The final value is `set + add`, subject to overflow, reservation, and floor checks.

Despite the protocol name `NonnegativeInt`, current source allows an explicit negative `set`. The invariant is not simply `value >= 0`; it is:

```text
value >= min(set, 0)
```

So `set(-5)` may commit a value of `-5`, and `set_add(-5, 10)` may commit `5`. But the engine rejects subtracting from an already-negative explicit base, such as `set_add(-5, -1)`. For ordinary balances, use `Balance`. For NNInt counters and other integer state, use nonnegative bases unless the data model intentionally needs a negative explicit floor.

## The One Conflict Rule

Two concurrent `set_add` calls commute **if and only if their resolved set values are equal**.

The set values don't have to be any particular value. They just have to match each other.

| Tx A | Tx B | Commutes? | Why |
|------|------|-----------|-----|
| `set_add(S, x)` | `set_add(S, y)` | Yes | Same base (any S). Adds merge: `x + y`. |
| `set_add(100, x)` | `set_add(100, y)` | Yes | Same explicit base (even if snapshot != 100). Adds merge. |
| `set_add(A, x)` | `set_add(B, y)` where `A != B` | **No** | Different bases. Conflict. One transaction excluded. |

**Same base + different deltas = merge. Different bases = conflict.**

Matching bases are the conflict rule. The merged value still has to fit in `i128` and satisfy `value >= min(set, 0)`.

## The None Path

`set_add` also accepts `None` as the set value: `set_add(None, add_value)`. This means "I don't need to load a base in this contract invocation; let the runtime resolve it from the snapshot."

This is a performance optimization. It produces the same result as `set_add(snapshot, add_value)` when the key already contains an NNInt, but skips the forced snapshot read. At the protocol level, the `None` path is `NonnegativeIntAdd`: it resolves to the value at the start of the block if the item is an NNInt, or `0` otherwise.

| Tx A | Tx B | Commutes? | Why |
|------|------|-----------|-----|
| `set_add(None, x)` | `set_add(None, y)` | Yes | Both resolve to the same start-of-block value. Same effective base. |
| `set_add(None, x)` | `set_add(S, y)` where `S = snapshot` | Yes | None resolves to the snapshot NNInt value. Same effective base. |
| `set_add(None, x)` | `set_add(S, y)` where `S != snapshot` | **No** | Different resolved bases. Conflict. |

## Public API

The public API maps to `set_add` as follows:

### `strict_inc(delta)` -- the common case

Loads the current base (pending explicit set, snapshot NNInt, or `0` for an empty key), checks that this invocation's total is nonnegative, then calls `set_add(Some(base), accumulated + delta)`.

- Commutes with other `strict_inc` and `inc` calls (all resolve to the same snapshot base).
- Aborts immediately if this invocation's result would be negative. Better debugging.
- Pays for the forced snapshot read.
- Does not preserve negative-base values. If the total remains negative, it aborts.

### `inc(delta)` -- the optimization

Preserves the pending set value if one already exists in this invocation; otherwise calls `set_add(None, accumulated + delta)`. Skips the forced snapshot read.

- Commutes with other `inc` and `strict_inc` calls (None resolves to snapshot).
- Underflow is caught later by runtime reservation/floor checks when no explicit base has been loaded. Harder to debug.
- Saves the forced read when you do not need early underflow detection.
- Can move a negative base upward, but cannot subtract from an already-negative explicit base.

`strict_inc` and `inc` are interchangeable from a commutativity standpoint. Mix them freely. The tradeoff is read cost vs early underflow detection.

### `set(value)` -- absolute write

Calls `set_add(value, 0)`. Replaces the base and clears the delta.

- Commutes only if all concurrent callers set the same value.
- Negative values are allowed. A negative set value becomes the floor.
- `set(100)` vs `set(100)` -- commutes.
- `set(100)` vs `set(200)` -- conflict.
- `set(100)` vs `strict_inc(5)` -- conflict if snapshot != 100; commutes if snapshot == 100.

Use `Balance` for ordinary balances. For NNInt state, use `strict_inc()` when early underflow detection matters and `inc()` when you intentionally want to skip the read. Reserve `set()` for initialization or admin operations.

## Summary

| Method | Calls | Reads? | Commutative? | Use for |
|--------|-------|--------|--------------|---------|
| `strict_inc(delta)` | `set_add(Some(base), accumulated + delta)` | Yes | Yes, when all callers resolve to the same snapshot base | NNInt counters and signed-delta state |
| `inc(delta)` | `set_add(existing_set_or_None, accumulated + delta)` | No | Yes, when all callers resolve to the same snapshot base | Skip the read when late underflow detection is acceptable |
| `set(value)` | `set_add(Some(value), 0)` | No | Only if values match | Init, admin, config |
