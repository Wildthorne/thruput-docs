---
title: Storage Types
description: API reference for Groundhog storage types.
---

API reference for the SDK storage types. For conflict semantics, usage guidance, and when to choose each type, see [Programming Model: Storage Types](/programming-model/storage-types/). For generated Rustdoc, see [`sdk::storage`](https://groundhog.dev/docs/sdk/latest/sdk/storage/index.html) or [Rust API Docs](/tools/rust-api-docs/).

Rustdoc shortcuts:

| Area | Links |
|------|-------|
| Storage types | [`NNInt`](https://groundhog.dev/docs/sdk/latest/sdk/storage/nnint/struct.NNInt.html), [`Map`](https://groundhog.dev/docs/sdk/latest/sdk/storage/map/struct.Map.html), [`Vector`](https://groundhog.dev/docs/sdk/latest/sdk/storage/vector/struct.Vector.html), [`Value`](https://groundhog.dev/docs/sdk/latest/sdk/storage/value/struct.Value.html), [`Bytestring`](https://groundhog.dev/docs/sdk/latest/sdk/storage/bytestring/struct.Bytestring.html), [`RCQ`](https://groundhog.dev/docs/sdk/latest/sdk/storage/rcq/struct.RCQ.html), [`Node`](https://groundhog.dev/docs/sdk/latest/sdk/storage/node/struct.Node.html) |
| Borrow guards | [`SlotRef`](https://groundhog.dev/docs/sdk/latest/sdk/storage/slot/struct.SlotRef.html), [`SlotMut`](https://groundhog.dev/docs/sdk/latest/sdk/storage/slot/struct.SlotMut.html), [`DisjointMut`](https://groundhog.dev/docs/sdk/latest/sdk/storage/map/struct.DisjointMut.html) |
| Traits and paths | [`Deletable`](https://groundhog.dev/docs/sdk/latest/sdk/storage/deletable/trait.Deletable.html), [`StorageType`](https://groundhog.dev/docs/sdk/latest/sdk/storage/node/trait.StorageType.html), [`Keypath`](https://groundhog.dev/docs/sdk/latest/sdk/storage/keypath/struct.Keypath.html) |

## NNInt

Integer storage with a two-component (set, add) model and a commit-time floor. Used for balances, counters, and supply tracking.

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `fn get(&self) -> i128` | Read current value. Aborts if the location has never been set. |
| `try_get` | `fn try_get(&self) -> Option<i128>` | Read current value. Returns `None` if never set. |
| `set` | `fn set(&mut self, set_value: i128)` | Set the value. Uses the keypath's locking mode. |
| `inc` | `fn inc(&mut self, increment: i128)` | Add `increment` without forcing a snapshot read. Underflow caught at merge, not immediately. |
| `strict_inc` | `fn strict_inc(&mut self, increment: i128)` | Add `increment`, loading the current base for early underflow detection. Aborts immediately if the result would be negative. |

Pass a negative value to `inc` or `strict_inc` to decrement. Use `strict_inc` by default. See [NNInt In Depth](/programming-model/nnint/) for commutativity rules.

Exclusivity is controlled by the **keypath flag** set at storage-derivation time, not by a `set_exclusive` method. For ad-hoc exclusive writes, use the free function `non_negative_int_set_exclusive` from `sdk::sys_exn::nnint`.

Implements `Deletable`.

## Map\<K, V\>

Key-value map. `K` must implement `WriteXDR`. `V` must implement `StorageType`.

| Method | Signature | Description |
|--------|-----------|-------------|
| `at` | `fn at(&self, entry_key: &K) -> SlotRef<'_, Self, V>` | Read-only borrow of the value at `entry_key`. Returns a `SlotRef` that derefs to `V`. |
| `at_mut` | `fn at_mut(&mut self, entry_key: &K) -> SlotMut<'_, Self, V>` | Mutable borrow of the value at `entry_key`. Returns a `SlotMut` that derefs to `V`. |
| `at_mut_exclusive` | `fn at_mut_exclusive(&mut self, entry_key: &K) -> SlotMut<'_, Self, V>` | Mutable borrow with an exclusive lock. One writer per key per block. |
| `at_disjoint_mut` | `fn at_disjoint_mut<const N: usize>(&mut self, keys: [&K; N]) -> DisjointMut<'_, Self, V, N>` | Mutably borrow N elements at once. Panics if any keys are equal. |
| `at_disjoint_unchecked_mut` | `unsafe fn at_disjoint_unchecked_mut<const N: usize>(&mut self, keys: [&K; N]) -> DisjointMut<'_, Self, V, N>` | Mutably borrow N elements without duplicate checking. Caller must ensure all keys are disjoint. |
| `keypath` | `fn keypath(&self) -> &Keypath` | Reference to the map's root keypath. |

`K` additionally requires `PartialEq` for `at_disjoint_mut`.

Maps do not support enumeration. No `keys()` method, no iteration.

Does not implement `Deletable` (cannot enumerate entries).

### DisjointMut\<Owner, S, N\>

Borrow guard returned by `at_disjoint_mut`. Holds an exclusive borrow on the map. Implements `Deref<Target = [S; N]>` and `DerefMut`, so you can index into it directly.

## Vector\<S\>

Indexed, append-only collection. `S` must implement `StorageType`. Built on `Map<u32, S>` internally, with a separately stored length.

Slots are sparse-capable: deleting element storage does not shrink `len`, so an in-bounds index does not guarantee the slot has backing data.

| Method | Signature | Description |
|--------|-----------|-------------|
| `len` | `fn len(&self) -> u32` | Current logical length. Returns 0 if never set. |
| `is_empty` | `fn is_empty(&self) -> bool` | True if `len() == 0`. |
| `at` | `fn at(&self, index: u32) -> SlotRef<'_, Self, S>` | Read-only borrow at `index`. Bounds-checked. |
| `at_mut` | `fn at_mut(&mut self, index: u32) -> SlotMut<'_, Self, S>` | Mutable borrow at `index`. Bounds-checked. |
| `push_empty_slot` | `fn push_empty_slot(&mut self) -> SlotMut<'_, Self, S>` | Increment `len` and return a mutable handle to the new slot. Marked `#[must_use]`. |
| `push_with` | `fn push_with<R>(&mut self, f: impl FnOnce(&mut S) -> R) -> R` | Initialize a new slot through the closure `f`, then increment `len`. If `f` traps, neither the data nor `len` are committed. |
| `pop` | `fn pop(&mut self)` | Delete the last element and decrement `len`. Aborts if empty. Requires `S: Deletable`. |
| `iter` | `fn iter(&self) -> VectorIter<'_, S>` | Read-only iterator. Yields `SlotRef` handles. Shared borrow prevents structural modifications. |
| `iter_mut` | `fn iter_mut(&mut self) -> VectorIterMut<'_, S>` | Mutable iterator. Yields `SlotMut` handles. Exclusive borrow on the vector. |
| `keypath` | `fn keypath(&self) -> &Keypath` | Reference to the vector's root keypath. |

Both `VectorIter` and `VectorIterMut` implement `Iterator`, `ExactSizeIterator`, and `DoubleEndedIterator`. Supports `&vec` and `&mut vec` via `IntoIterator`.

Implements `Deletable` when `S: Deletable` (deletes all elements then the length).

## Value\<T\>

A typed storage slot for serialized values. All operations are immediate syscalls.

`T` must implement `WriteXDR` for writes and `ReadXDR` for reads.

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `fn get(&self) -> T` | Deserialize and return the stored value. Aborts if the key does not exist. |
| `try_get` | `fn try_get(&self) -> Option<T>` | Deserialize and return the stored value. Returns `None` if the key does not exist. |
| `set` | `fn set(&mut self, value: &T)` | Serialize and store the value. Uses the keypath's locking mode. |
| `set_exclusive` | `fn set_exclusive(&mut self, value: &T)` | Serialize and store the value with an exclusive lock, regardless of keypath flag. |
| `load_mut` | `fn load_mut(&mut self) -> ValueMut<'_, T>` | Load the value and return a mutable guard. Flushes back to storage on drop. Requires `T: WriteXDR + ReadXDR`. |

Implements `Deletable`.

### ValueMut\<T\>

Mutable guard returned by `load_mut`. Implements `Deref<Target = T>` and `DerefMut`. Calls `set` on drop to flush changes back to storage.

## Bytestring

Arbitrary byte data. Raw bytes in, raw bytes out.

| Method | Signature | Description |
|--------|-----------|-------------|
| `len` | `fn len(&self) -> usize` | Length in bytes. |
| `is_empty` | `fn is_empty(&self) -> bool` | True if length is zero. |
| `get` | `fn get(&self) -> Box<[u8]>` | Read stored bytes as a heap-allocated slice. |
| `try_get` | `fn try_get(&self) -> Option<Box<[u8]>>` | Read stored bytes. Returns `None` if the key does not exist. |
| `get_sized` | `fn get_sized<const N: usize>(&self) -> [u8; N]` | Read into a fixed-size array. Aborts if length does not match `N`. |
| `set` | `fn set(&mut self, buf: &[u8])` | Write bytes. Uses the keypath's locking mode (exclusive if the keypath flag is set). |

Exclusivity is controlled by the keypath flag, not by a `set_exclusive` method. For ad-hoc exclusive writes, use the free function `bytestring_set_exclusive` from `sdk::sys_exn::bytestring`.

Implements `Deletable`.

## RCQ\<T\>

Multi-producer queue. Items of type `T` are XDR-encoded on insert and decoded on consume. Inserts commute; consumes are sequential.

The typed wrapper lives in `sdk::storage`. Lower-level free functions (operating on raw `StorageKey` values) are available in `sdk::sys_exn::rcq` for cases where you want byte-level control.

| Method | Signature | Description |
|--------|-----------|-------------|
| `insert` | `fn insert(&mut self, entry: &T)` where `T: WriteXDR` | XDR-encode and insert the entry. |
| `insert_raw` | `fn insert_raw(&mut self, queue_entry: &[u8])` | Insert raw bytes; bypasses XDR encoding. |
| `consume` | `fn consume(&mut self) -> T` where `T: ReadXDROwned` | Consume the next entry and decode it. Aborts if the queue is empty or the entry cannot be decoded. |
| `try_consume` | `fn try_consume(&mut self) -> Option<T>` where `T: ReadXDROwned` | Consume the next entry if one exists. |
| `consume_raw` | `fn consume_raw(&mut self) -> Box<[u8]>` | Consume the next entry as raw bytes. Aborts if the queue is empty. |
| `try_consume_raw` | `fn try_consume_raw(&mut self) -> Option<Box<[u8]>>` | Consume the next entry as raw bytes if one exists. |
| `consume_sized` | `fn consume_sized<const N: usize>(&mut self) -> [u8; N]` | Consume into a fixed-size array. Aborts on size mismatch. |
| `try_consume_sized` | `fn try_consume_sized<const N: usize>(&mut self) -> Option<[u8; N]>` | Consume into a fixed-size array if an entry exists. Aborts on size mismatch. |
| `peek` | `fn peek(&self) -> T` where `T: ReadXDROwned` | Read the next entry without consuming. Aborts if empty. |
| `try_peek` | `fn try_peek(&self) -> Option<T>` where `T: ReadXDROwned` | Read the next entry without consuming if one exists. |
| `peek_raw` | `fn peek_raw(&self) -> Box<[u8]>` | Raw-bytes peek. Aborts if empty. |
| `try_peek_raw` | `fn try_peek_raw(&self) -> Option<Box<[u8]>>` | Raw-bytes peek if an entry exists. |
| `peek_sized` | `fn peek_sized<const N: usize>(&self) -> [u8; N]` | Fixed-size peek. Aborts on size mismatch. |
| `try_peek_sized` | `fn try_peek_sized<const N: usize>(&self) -> Option<[u8; N]>` | Fixed-size peek if an entry exists. Aborts on size mismatch. |
| `keypath` | `fn keypath(&self) -> &Keypath` | Reference to the queue's root keypath. |
| `key` | `fn key(&self) -> &StorageKey` | Reference to the queue's resolved storage key. |

Implements `StorageType` and `Deletable`.

### Lower-level free functions (`sdk::sys_exn::rcq`)

| Function | Signature | Description |
|----------|-----------|-------------|
| `retrocausal_queue_insert` | `fn retrocausal_queue_insert(key: &StorageKey, queue_entry: &[u8])` | Insert raw bytes. |
| `retrocausal_queue_consume_sized` | `fn retrocausal_queue_consume_sized<const N: usize>(key: &StorageKey) -> [u8; N]` | Consume a fixed-size entry. Aborts on size mismatch or empty queue. |
| `retrocausal_queue_peek_sized` | `fn retrocausal_queue_peek_sized<const N: usize>(key: &StorageKey) -> [u8; N]` | Peek a fixed-size entry. |
| `retrocausal_queue_get` | `fn retrocausal_queue_get(key: &StorageKey, peek: bool) -> Box<[u8]>` | Read the next entry into a boxed slice. If `peek` is true, the entry is not consumed. |

## Slot Types

`SlotRef` and `SlotMut` are borrow guards returned by `Map` and `Vector` access methods. They tie the lifetime of the accessed element to the parent collection.

| Type | Implements | Description |
|------|------------|-------------|
| `SlotRef<'a, Owner, S>` | `Deref<Target = S>` | Read-only handle. Holds a shared borrow on the parent. |
| `SlotMut<'a, Owner, S>` | `Deref<Target = S>` + `DerefMut` | Mutable handle. Holds an exclusive borrow on the parent. |

Use `*slot` or field access directly through the deref. No explicit "unwrap" needed.

## Node\<T\>

Wrapper for compound storage field groups (structs with multiple storage fields). Pairs a `T: From<Keypath>` with its root keypath. Implements `Deref<Target = T>` and `DerefMut` for field access.

| Method | Signature | Description |
|--------|-----------|-------------|
| `keypath` | `fn keypath(&self) -> &Keypath` | Reference to the node's root keypath. |

Implements `StorageType`, so it can be used as a value type in `Map` and `Vector`. Implements `Deletable` when `T: Deletable` (delegates to the inner fields).

## Deletable Trait

Trait for storage types whose data can be fully deleted. Leaf types (NNInt, Value, Bytestring) delete their single storage key. Compound types (Node, Vector) implement this recursively when their elements are Deletable. Map does not implement Deletable because it cannot enumerate its entries.

| Method | Signature | Description |
|--------|-----------|-------------|
| `delete` | `fn delete(&mut self)` | Delete using the keypath's own locking semantics. |
| `delete_exclusive` | `fn delete_exclusive(&mut self)` | Delete with an exclusive lock, regardless of keypath flag. |

---

[Programming Model: Storage Types](/programming-model/storage-types/) for conflict semantics and usage guidance.
