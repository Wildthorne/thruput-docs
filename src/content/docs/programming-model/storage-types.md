---
title: Storage Types
description: "The four storage types, their conflict semantics, and how to choose between them."
---

Groundhog has four storage types. The type you choose determines whether concurrent writes merge, conflict, or ignore each other.

## NNInt

Non-negative integer. The workhorse type for balances, counters, and any value that changes by deltas.

```rust
use sdk::storage::NNInt;

#[derive(Debug)]
#[sdk::storage]
pub struct Counter {
    value: NNInt,
}
```

Concurrent increments merge automatically:

```rust
// Two transactions run concurrently against the same snapshot:
self.value.strict_inc(5);    // Tx A: "add 5"
self.value.strict_inc(-3);   // Tx B: "subtract 3"
// Both land. Result: original + 2
```

Pass negative values to `strict_inc` to subtract. The non-negative invariant is enforced at the protocol level: if the merged result of all deltas would take the value below zero, the offending transaction is excluded.

How this works underneath (the `set_add` primitive and its commutativity rules) is covered in [NNInt In Depth](/programming-model/nnint/).

## Map\<K, V\>

Key-value store. Different keys are fully independent and never conflict. Same-key behavior follows the value type's rules.

```rust
use sdk::storage::{Map, NNInt};

#[derive(Debug)]
#[sdk::storage]
pub struct Token {
    balances: Map<ContractAddress, NNInt>,
}
```

```rust
// Different keys: always independent, never conflict
self.balances.get(&alice).strict_inc(10);  // Tx A
self.balances.get(&bob).strict_inc(20);    // Tx B -- no interaction

// Same key: follows NNInt rules (concurrent increments merge)
self.balances.get(&alice).strict_inc(10);  // Tx A
self.balances.get(&alice).strict_inc(20);  // Tx B -- merges to +30
```

Maps can nest: `Map<K, Map<K2, NNInt>>` gives composite keys with independent conflict domains at each level. The ERC-20 allowance pattern uses this: `Map<owner, Map<spender, NNInt>>`.

## Bytestring

Raw bytes. Concurrent writes of the same value commute. Concurrent writes of different values conflict.

```rust
use sdk::storage::Bytestring;

#[derive(Debug)]
#[sdk::storage]
pub struct Config {
    owner: Bytestring,
}
```

```rust
self.owner.set(&new_owner);    // Tx A
self.owner.set(&other_owner);  // Tx B -- conflict, one excluded
```

Use Bytestring for config, ownership, or metadata where you accept that concurrent writers to the same location are mutually exclusive. Not for hot paths.

## RetrocausalQueue

FIFO queue. Inserts always commute. Consumes are sequential.

```rust
// These two transactions both land:
retrocausal_queue_insert(&key, &entry_a);  // Tx A
retrocausal_queue_insert(&key, &entry_b);  // Tx B -- no conflict

// Consumes pull from the front of the queue
let entry = retrocausal_queue_consume_sized::<N>(&key);
```

Use RetrocausalQueue when producers are concurrent but consumers process items in order.

## Choosing a Type

| If your write pattern is... | Use | Why |
|-----------------------------|-----|-----|
| `col = col + delta` | NNInt | Deltas merge. Concurrent increments land. |
| `INSERT INTO ... (key, value)` with unique keys | Map | Different keys are independent. |
| `col = absolute_value` | Bytestring | Accept that concurrent writes conflict. |
| Append to a log or work queue | RetrocausalQueue | Inserts merge, consumers are sequential. |

:::tip[Exclusive Write Flag]
If you need mutex-like semantics (guarantee that only one transaction can write to a storage location per block), the `set_exclusive` method is available on NNInt, Map, and Bytestring. It acquires an exclusive lock at reservation time. If two transactions both use `set_exclusive` on the same location, one is excluded.

This is a blunt instrument. Prefer NNInt deltas on hot paths. Reserve exclusive writes for operations that genuinely cannot tolerate concurrent access.
:::
