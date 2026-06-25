---
title: Advanced Patterns
description: "Additional NNInt operations, exclusive writes, and early reservation."
---

These features exist in the SDK but are less commonly needed than `strict_inc` and the core storage types. They're documented here so you know they exist. Full explanations are coming as the APIs stabilize.

## Negative Set Values

NNInt allows setting a negative base value explicitly:

```rust
non_negative_int_set(key, -5);
non_negative_int_inc(key, 1);  // succeeds, value is now -4
```

When the base is negative, increments that move the value upward can keep the value negative without aborting. The commit-time floor is `value >= min(set, 0)`, not simply `value >= 0`. `strict_inc` still aborts if the invocation's total remains negative.

This is a low-level capability. Most contracts should use `strict_inc` on nonnegative bases and let the invariant protect balances and counters. Negative set values are relevant for initialization patterns and edge cases that need an explicit lower floor.

## Exclusive Writes

Exclusive writes acquire a per-key lock at reservation time: if two transactions both write exclusively to the same location, one is excluded. This is a stronger guarantee than normal conflict semantics, where compatible deltas merge.

The mechanism is exposed differently per storage type:

- `Value<T>::set_exclusive(&new_value)` — typed slot, exclusive write.
- `Map<K, V>::at_mut_exclusive(&key)` — exclusive slot accessor on a Map entry.
- Free functions `non_negative_int_set_exclusive(key, value)` and `bytestring_set_exclusive(key, bytes)` for the lower-level primitives.

```rust
self.config.set_exclusive(&new_value);              // Value<Config>
self.balances.at_mut_exclusive(&owner).set(&v);     // Map<_, NNInt>
```

Use exclusive writes only when an operation genuinely needs sole access to a storage location for the duration of a block. Mixing exclusive and non-exclusive writes to the same key in the same block excludes the non-exclusive writers.
