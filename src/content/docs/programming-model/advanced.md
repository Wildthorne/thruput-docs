---
title: Advanced Patterns
description: "Lower-level NNInt operations and exclusive writes."
---

These features exist in the SDK but are less commonly needed than `Balance` and the core storage types.

## Negative Set Values

NNInt allows setting a negative base value explicitly:

```rust
non_negative_int_set(key, -5);
non_negative_int_inc(key, 1);  // succeeds, value is now -4
```

When the base is negative, increments that move the value upward can keep the value negative without aborting. The commit-time floor is `value >= min(set, 0)`, not simply `value >= 0`. `strict_inc` still aborts if the invocation's total remains negative.

This is a low-level capability. Most contracts should use `Balance` for balances and allowances. Negative set values are relevant to state models that deliberately need an explicit lower floor.

## Exclusive Writes

Exclusive writes acquire a per-key lock at reservation time: if two transactions both write exclusively to the same location, one is excluded. This is a stronger guarantee than normal conflict semantics, where compatible deltas merge.

The mechanism is exposed differently per storage type:

- `Value<T>::set_exclusive(&new_value)` or `try_set_exclusive(&new_value)` for a typed slot.
- `Map<K, V>::at_mut_exclusive(&key)` for an exclusive Map entry handle.
- Free functions `non_negative_int_set_exclusive(key, value)` and `bytestring_set_exclusive(key, bytes)` for the lower-level primitives.

```rust
self.config.set_exclusive(&new_value);            // Value<Config>
self.counters.at_mut_exclusive(&owner).set(v);    // Map<_, NNInt>
```

Use exclusive writes only when an operation genuinely needs sole access to a storage location for the duration of a block. Mixing exclusive and non-exclusive writes to the same key in the same block excludes the non-exclusive writers.

### Lock Requests

An exclusive write requests `ExclusiveLock` on its key after the write succeeds. The request belongs to the key, not to the write: later writes to the key in the same transaction keep it, whether they come from an ordinary handle, another call frame, or a later call into the same contract. The transaction's change to the key then holds the exclusive lock for the whole block, so no concurrent transaction in the block can modify that key. `clear_flags` withdraws the request.

```rust
self.counters.at_mut_exclusive(&owner).set(0);  // write, then request ExclusiveLock
self.counters.at_mut(&owner).inc(1);            // ordinary write: the request stays
// This transaction's change to `owner` commits with the exclusive lock,
// so no other transaction in the block can modify that key.
```

Leaf handles (`Value`, `NNInt`, `Balance`, `Bytestring`) implement the `Flaggable` trait (`use sdk::storage::Flaggable;`): `flags()` reads the key's flags, `set_flags(flags)` adds flags, and `clear_flags()` withdraws them before the transaction ends. The free functions `storage_flags`, `set_storage_flags`, and `clear_storage_flags` do the same for a raw `StorageKey`. Setting flags requires a pending write to the key in the current call frame, so write first, then set flags.

Flag changes follow call frames. A reverted frame or a failed `try_invoke` discards its flag changes along with its writes.

See [Syscalls: Storage Flags](/reference/syscalls/#storage-flags) for the host interface.
