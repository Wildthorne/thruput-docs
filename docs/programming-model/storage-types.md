# Storage Types and Conflict Semantics

Each storage type defines its own merge behavior for concurrent transactions. The type you choose determines whether concurrent writes commute, conflict, or are independent.

## NNInt

Non-negative integer with a two-component (set, add) model. Concurrent increments commute. Concurrent absolute writes conflict. Full rules in [nnint.md](./nnint.md).

```rust
// Delta operation: commutes with other deltas on the same key
self.balance.strict_inc(5);
self.balance.strict_inc(-3);  // pass negative to subtract

// Absolute write: conflicts with any other write to this key
self.balance.set(100);
```

The non-negative invariant is enforced at reservation. If the merged result of all deltas would take the value below zero, the offending transaction is excluded.

## Map<K, V>

Key-value store. **Different keys are fully independent.** Same-key behavior depends on the value type.

```rust
// Different keys: always independent, never conflict
self.balances.get(&alice).strict_inc(10);  // Tx A
self.balances.get(&bob).strict_inc(20);    // Tx B -- no interaction

// Same key: follows the value type's rules
self.balances.get(&alice).strict_inc(10);  // Tx A
self.balances.get(&alice).strict_inc(20);  // Tx B -- commutes (NNInt delta)
```

Maps can nest: `Map<K, Map<K2, NNInt>>` gives you composite keys with independent conflict domains at each level.

## Bytestring

Raw bytes. Last-write-wins. **Concurrent writes to the same key always conflict.**

```rust
self.owner.set(&new_owner);  // Tx A
self.owner.set(&other_owner); // Tx B -- conflict, one excluded
```

Use Bytestring when you need arbitrary data and accept that concurrent writes to the same location are mutually exclusive. This is the equivalent of `UPDATE ... SET col = ?` in SQL.

## RetrocausalQueue

FIFO queue. **Inserts commute. Consumes are sequential.**

```rust
// These commute: both add to the queue
retrocausal_queue_insert(&key, &entry_a);  // Tx A
retrocausal_queue_insert(&key, &entry_b);  // Tx B -- no conflict

// Consumes pull from the front of the queue
let entry = retrocausal_queue_consume_sized::<N>(&key);
```

Use RetrocausalQueue when producers are concurrent but consumers process items in order.

## Choosing a Type

| If your write pattern is... | Use | Why |
|-----------------------------|-----|-----|
| `col = col + delta` | NNInt | Deltas commute. Concurrent increments merge. |
| `INSERT INTO ... (key, value)` with unique keys | Map | Different keys are independent. |
| `col = absolute_value` | Bytestring | Accept that concurrent writes conflict. |
| Append to a log / work queue | RetrocausalQueue | Inserts commute, consumers are sequential. |

## The Conflict Spectrum

From most concurrent to most exclusive:

1. **NNInt deltas** -- always commute (same key, same base)
2. **Map with different keys** -- always independent (no interaction)
3. **RetrocausalQueue inserts** -- always commute
4. **RetrocausalQueue consumes** -- sequential
5. **Bytestring writes** -- always conflict on same key
6. **NNInt set()** -- conflicts when bases differ
