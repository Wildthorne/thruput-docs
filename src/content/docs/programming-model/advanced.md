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

When the base is negative, increments that keep the value negative do not abort. The non-negative invariant only triggers an immediate abort when a positive base plus a negative increment would go below zero.

This is a low-level capability. Most contracts should use `strict_inc` and let the invariant protect them. Negative set values are relevant for initialization patterns and edge cases where the protocol-level enforcement needs to be bypassed temporarily.

## Exclusive Writes

The `set_exclusive` method is available on NNInt, Map, and Bytestring. It acquires an exclusive lock at reservation time: if two transactions both use `set_exclusive` on the same storage location, one is excluded.

```rust
self.config.set_exclusive(&new_value);
```

This is a stronger guarantee than normal conflict semantics. Normal NNInt deltas can merge. Exclusive writes cannot. Use this when an operation genuinely requires sole access to a storage location for the duration of a block.

:::caution[Coming Soon]
Full documentation on exclusive write semantics, including behavior when mixed with non-exclusive writes to the same location, is planned.
:::

## Early Reservation (try_invoke)

The execution model described in [Execution Model](/programming-model/execution/) runs all transactions against the snapshot and checks compatibility at the end. An alternative path exists where reservations can be checked during execution rather than after.

:::caution[Coming Soon]
This feature is available in the runtime but not yet documented for general use. It will be covered here when the API and naming are finalized.
:::
