# Storage Types and Conflict Semantics

Each storage type defines merge behavior for concurrent transactions. The type you choose determines whether concurrent writes commute, conflict, or are independent.

At the protocol level, the contract-data primitives are `NNInt`, `Bytestring`, and `RetrocausalQueue`. The Rust SDK layers typed helpers on top: `Balance`, `CapacityConstraint`, `Map`, `Value`, `Vector`, `Node`, and borrow guards such as `SlotRef` and `SlotMut`. For contract authors, the SDK types are the practical programming model.

## Balance

Nonnegative, zero-defaulting balance storage backed by NNInt. Use checked operations when an error must surface during contract execution and lazy operations when the committed bound can be checked later.

```rust
self.balances.at_mut(&sender).decrease(amount);
self.balances.at_mut(&receiver).lazy_increase(amount);
```

All four operations record deltas that can merge with concurrent transactions. `increase` and `decrease` load the current balance for immediate overflow or underflow checks. `lazy_increase` and `lazy_decrease` skip that load and leave the combined bound check to reservation after contract execution. `Balance` accepts `u128` amounts, treats missing storage as zero, and exposes no absolute `set` operation.

## NNInt

Integer storage with a two-component (set, add) model and a commit-time floor. Concurrent increments commute. Absolute writes conflict when their resolved bases differ. Full rules in [nnint.md](./nnint.md).

```rust
// Delta operation: commutes with other deltas on the same key
self.counter.strict_inc(5);
self.counter.strict_inc(-3);  // pass negative to subtract

// Absolute write: conflicts with writes that resolve to a different base
self.counter.set(100);
```

`strict_inc` reads the current base for early underflow detection, then records a delta. `inc` records a delta without forcing that read; underflow is caught later. Both commute with other delta operations on the same resolved base. Use NNInt for counters or state that needs signed changes or an explicit base.

## CapacityConstraint

A remaining-capacity counter for constraints that must hold across all transactions admitted to a block. `consume_capacity(amount)` stages a negative delta, and a negative amount releases capacity. `set_capacity(value)` resets the base and must be the first write in the transaction, except for an idempotent same-value repeat.

Changes flush when the handle drops. Use `try_flush()` when the contract needs to catch a flush failure. Capacity consumption is checked at reservation, so transactions can execute independently while the merged total remains bounded.

## Map<K, V>

Key-value store. **Different keys are fully independent.** Same-key behavior depends on the value type.

```rust
// Different keys: always independent, never conflict
self.balances.at_mut(&alice).lazy_increase(10);  // Tx A
self.balances.at_mut(&bob).lazy_increase(20);    // Tx B -- no interaction

// Same key: follows the value type's rules
self.balances.at_mut(&alice).lazy_increase(10);  // Tx A
self.balances.at_mut(&alice).lazy_increase(20);  // Tx B -- commutes
```

Maps can nest: `Map<K, Map<K2, Balance>>` gives you composite keys with independent conflict domains at each level.

Maps do not enumerate keys and do not implement `Deletable`. Use `at` for read access, `at_mut` for normal writes, and `at_mut_exclusive` only when you need mutex-like behavior on a specific entry. An exclusive write's lock request stays on the key through later ordinary writes in the same transaction, until `clear_flags` withdraws it. The transaction's change to the key then holds the exclusive lock for the whole block: no concurrent transaction can modify the key.

## Value<T>

Typed storage slot for any CXS-serializable value. `Value<T>` serializes to the same underlying primitive as bytes, so its conflict semantics match `Bytestring`: concurrent writes of the same value commute; concurrent writes of different values conflict.

```rust
self.config.set(&new_config);

let mut threshold = self.threshold.load_mut();
*threshold = 10;  // flushed on drop
```

Use `Value<T>` for typed config, metadata, ownership, and other single-slot state. Avoid it for hot counters or balances. Use `NNInt` or `Balance` instead.

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

Multi-producer queue. Inserts commute; consumption is sequential. Persisted entries are ordered by queue block, then lexicographically within that block. Concurrent observations follow the proposer-recorded order.

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
| Increase or decrease a nonnegative amount | Balance | Zero-defaulting `u128` API with checked and lazy deltas. |
| `col = col + delta` | NNInt | Deltas commute. Concurrent increments merge. |
| Reserve shared aggregate capacity | CapacityConstraint | Consumption merges while the runtime enforces the remaining-capacity floor. |
| `INSERT INTO ... (key, value)` with unique keys | Map | Different keys are independent. |
| Store typed config or metadata | Value<T> | Typed bytestring semantics. |
| Store raw bytes | Bytestring | Accept that concurrent different-value writes conflict. |
| Ordered list, accessed by index | Vector<S> | Per-index independence; structural changes are exclusive. |
| Append to a log / work queue | RCQ<T> | Inserts commute, consumers are sequential. |
| Nest compound storage structs | Node<T> | Carries a derived storage subtree inside a collection. |

## The Conflict Spectrum

From most concurrent to most exclusive:

1. **Balance and NNInt deltas** -- commute when they resolve to the same base
2. **Map with different keys** -- always independent (no interaction)
3. **Vector element writes at different indices** -- independent once indices exist
4. **RCQ inserts** -- commute
5. **RCQ consumes** -- sequential
6. **Value<T> / Bytestring writes** -- same value commutes, different values conflict
7. **Vector pushes/pops** -- structural changes conflict through the length
8. **NNInt set()** -- conflicts when bases differ
