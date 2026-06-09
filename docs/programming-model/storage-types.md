# Storage Types and Conflict Semantics

Each storage type defines merge behavior for concurrent transactions. The type you choose determines whether concurrent writes commute, conflict, or are independent.

At the protocol level, the user-facing primitives are `NNInt`, `Bytestring`, and `RetrocausalQueue`. The Rust SDK layers typed helpers on top: `Map`, `Value`, `Vector`, `Node`, and borrow guards such as `SlotRef` and `SlotMut`. For contract authors, the SDK types are the practical programming model.

## NNInt

Non-negative integer with a two-component (set, add) model. Concurrent increments commute. Concurrent absolute writes conflict. Full rules in [nnint.md](./nnint.md).

```rust
// Delta operation: commutes with other deltas on the same key
self.balance.strict_inc(5);
self.balance.strict_inc(-3);  // pass negative to subtract

// Absolute write: conflicts with any other write to this key
self.balance.set(100);
```

`strict_inc` reads the snapshot base for early underflow detection, then records a delta. `inc` records a delta without forcing that read; underflow is caught later. Both commute with other delta operations on the same base. The non-negative invariant is enforced by the runtime: if concurrent debits exceed available capacity, one or more transactions are excluded.

## Map<K, V>

Key-value store. **Different keys are fully independent.** Same-key behavior depends on the value type.

```rust
// Different keys: always independent, never conflict
self.balances.at_mut(&alice).strict_inc(10);  // Tx A
self.balances.at_mut(&bob).strict_inc(20);    // Tx B -- no interaction

// Same key: follows the value type's rules
self.balances.at_mut(&alice).strict_inc(10);  // Tx A
self.balances.at_mut(&alice).strict_inc(20);  // Tx B -- commutes (NNInt delta)
```

Maps can nest: `Map<K, Map<K2, NNInt>>` gives you composite keys with independent conflict domains at each level.

Maps do not enumerate keys and do not implement `Deletable`. Use `at` for read access, `at_mut` for normal writes, and `at_mut_exclusive` only when you need mutex-like behavior on a specific entry.

## Value<T>

Typed storage slot for any XDR-serializable value. `Value<T>` serializes to the same underlying primitive as bytes, so its conflict semantics match `Bytestring`: concurrent writes of the same value commute; concurrent writes of different values conflict.

```rust
self.config.set(&new_config);

let mut threshold = self.threshold.load_mut();
*threshold = 10;  // flushed on drop
```

Use `Value<T>` for typed config, metadata, ownership, and other single-slot state. Avoid it for hot counters or balances; use `NNInt` instead.

## Bytestring

Raw bytes. **Concurrent writes of the same value commute. Concurrent writes of different values conflict.**

```rust
self.owner.set(&new_owner);  // Tx A
self.owner.set(&other_owner); // Tx B -- conflict, one excluded
```

Use Bytestring when you need arbitrary data and accept that concurrent writes to the same location are mutually exclusive. This is the equivalent of `UPDATE ... SET col = ?` in SQL.

## Vector<S>

Ordered collection. Elements are stored as independent `Map<u32, S>` entries, plus a separately stored length.

```rust
self.items.push_with(|item| {
    item.value.set(&42);
});

let value = self.items.at(0).value.get();
self.items.at_mut(0).value.set(&99);
```

Different indices are independent and follow the element type's rules. Pushes and pops update the length with exclusive writes, so concurrent structural changes to the same vector conflict. For hot concurrent inserts, prefer `Map` with application-managed keys or `RCQ<T>`.

## RCQ<T> / RetrocausalQueue

FIFO queue. **Inserts commute. Consumes are sequential.**

```rust
// These commute: both add to the queue
self.requests.insert(&entry_a);  // Tx A
self.requests.insert(&entry_b);  // Tx B -- no conflict

// Consumes pull from the front of the queue
let entry = self.requests.try_consume();
```

Use `RCQ<T>` when producers are concurrent but consumers process items in order. Lower-level raw functions such as `retrocausal_queue_insert` and `retrocausal_queue_consume_sized` are available when you need byte-level control.

## Node<T>

Wrapper for compound storage field groups. Use `Node<T>` when a nested struct needs to live inside a `Map` or `Vector`.

```rust
#[derive(Storage)]
pub struct Item {
    value: Value<u64>,
}

#[derive(Storage)]
pub struct Registry {
    items: Vector<Node<Item>>,
}
```

`Node<T>` does not add new conflict semantics. Its fields follow their own underlying storage types.

## Choosing a Type

| If your write pattern is... | Use | Why |
|-----------------------------|-----|-----|
| `col = col + delta` | NNInt | Deltas commute. Concurrent increments merge. |
| `INSERT INTO ... (key, value)` with unique keys | Map | Different keys are independent. |
| Store typed config or metadata | Value<T> | Typed bytestring semantics. |
| Store raw bytes | Bytestring | Accept that concurrent different-value writes conflict. |
| Ordered list, accessed by index | Vector<S> | Per-index independence; structural changes are exclusive. |
| Append to a log / work queue | RCQ<T> | Inserts commute, consumers are sequential. |
| Nest compound storage structs | Node<T> | Carries a derived storage subtree inside a collection. |

## The Conflict Spectrum

From most concurrent to most exclusive:

1. **NNInt deltas** -- always commute (same key, same base)
2. **Map with different keys** -- always independent (no interaction)
3. **Vector element writes at different indices** -- independent once indices exist
4. **RCQ inserts** -- commute
5. **RCQ consumes** -- sequential
6. **Value<T> / Bytestring writes** -- same value commutes, different values conflict
7. **Vector pushes/pops** -- structural changes conflict through the length
8. **NNInt set()** -- conflicts when bases differ
