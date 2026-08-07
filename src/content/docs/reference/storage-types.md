---
title: Storage Types
description: API reference for Groundhog storage types.
---

API reference for the SDK storage types. For conflict semantics, usage guidance, and when to choose each type, see [Programming Model: Storage Types](/programming-model/storage-types/). For generated Rustdoc, see [`sdk::storage`](https://groundhog.dev/docs/sdk/latest/sdk/storage/index.html) or [Rust API Docs](/tools/rust-api-docs/).

Rustdoc shortcuts:

| Area | Links |
|------|-------|
| Storage types | [`Balance`](https://groundhog.dev/docs/sdk/latest/sdk/storage/balance/struct.Balance.html), [`NNInt`](https://groundhog.dev/docs/sdk/latest/sdk/storage/nnint/struct.NNInt.html), [`CapacityConstraint`](https://groundhog.dev/docs/sdk/latest/sdk/storage/capacity_constraint/struct.CapacityConstraint.html), [`Map`](https://groundhog.dev/docs/sdk/latest/sdk/storage/map/struct.Map.html), [`Vector`](https://groundhog.dev/docs/sdk/latest/sdk/storage/vector/struct.Vector.html), [`Value`](https://groundhog.dev/docs/sdk/latest/sdk/storage/value/struct.Value.html), [`Bytestring`](https://groundhog.dev/docs/sdk/latest/sdk/storage/bytestring/struct.Bytestring.html), [`RCQ`](https://groundhog.dev/docs/sdk/latest/sdk/storage/rcq/struct.RCQ.html), [`Node`](https://groundhog.dev/docs/sdk/latest/sdk/storage/node/struct.Node.html) |
| Borrow guards | [`SlotRef`](https://groundhog.dev/docs/sdk/latest/sdk/storage/slot/struct.SlotRef.html), [`SlotMut`](https://groundhog.dev/docs/sdk/latest/sdk/storage/slot/struct.SlotMut.html), [`DisjointMut`](https://groundhog.dev/docs/sdk/latest/sdk/storage/map/struct.DisjointMut.html) |
| Traits and paths | [`Deletable`](https://groundhog.dev/docs/sdk/latest/sdk/storage/deletable/trait.Deletable.html), [`StorageType`](https://groundhog.dev/docs/sdk/latest/sdk/storage/node/trait.StorageType.html), [`Keypath`](https://groundhog.dev/docs/sdk/latest/sdk/storage/keypath/struct.Keypath.html) |

## NNInt

Integer storage with signed changes, an explicit `set`, and a commit-time floor. Concurrent changes can combine.

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `fn get(&self) -> i128` | Read current value. Aborts if the location has never been set. |
| `try_get` | `fn try_get(&self) -> Result<i128, LibraryExn>` | Read current value without aborting. Missing storage is an `Err` identifiable with `is_storage_missing()`. |
| `set` | `fn set(&mut self, set_value: i128)` | Set the value. Uses the keypath's locking mode. |
| `inc` | `fn inc(&mut self, increment: i128)` | Add `increment` without forcing a snapshot read. Underflow is caught by later runtime checks, not immediately. |
| `strict_inc` | `fn strict_inc(&mut self, increment: i128)` | Add `increment`, loading the current base for early underflow detection. Aborts immediately if the result would be negative. |
| `try_strict_inc` | `fn try_strict_inc(&mut self, increment: i128) -> Result<(), LibraryExn>` | Checked increment that reports overflow, underflow, or storage failure instead of aborting. Leaves storage unmodified on `Err`. |

Pass a negative value to `inc` or `strict_inc` to decrement. Use `Balance` for ordinary balances and allowances. See [Merged Deltas](/programming-model/execution/#merged-deltas) for the contract-level model and [NNInt In Depth](/programming-model/nnint/) for the underlying rules.

Exclusivity is controlled by the **keypath flag** set at storage-derivation time, not by a `set_exclusive` method. For ad-hoc exclusive writes, use the free function `non_negative_int_set_exclusive` from `sdk::sys_exn::nnint`.

Implements `Deletable`.

## Balance

Nonnegative, zero-defaulting `u128` storage over the same mergeable representation as `NNInt`. Represents values from `0` through `i128::MAX`.

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `fn get(&self) -> u128` | Read the balance. A never-written location returns zero. |
| `try_get` | `fn try_get(&self) -> Result<u128, LibraryExn>` | Read without aborting. A never-written location returns `Ok(0)`. |
| `increase` | `fn increase(&mut self, amount: u128)` | Load and increase the balance. Aborts immediately on overflow. |
| `try_increase` | `fn try_increase(&mut self, amount: u128) -> Result<(), LibraryExn>` | Checked increase that reports failure and leaves storage unmodified on `Err`. |
| `decrease` | `fn decrease(&mut self, amount: u128)` | Load and decrease the balance. Aborts immediately if funds are insufficient. |
| `try_decrease` | `fn try_decrease(&mut self, amount: u128) -> Result<(), LibraryExn>` | Checked decrease that reports failure and leaves storage unmodified on `Err`. |
| `lazy_increase` | `fn lazy_increase(&mut self, amount: u128)` | Record an increase without loading the committed balance. Aggregate overflow is checked during delta reservation after contract execution. |
| `try_lazy_increase` | `fn try_lazy_increase(&mut self, amount: u128) -> Result<(), LibraryExn>` | Lazy increase that reports immediate conversion or accumulated-delta overflow. |
| `lazy_decrease` | `fn lazy_decrease(&mut self, amount: u128)` | Record a decrease without loading the committed balance. Aggregate sufficiency is checked during delta reservation after contract execution. |
| `try_lazy_decrease` | `fn try_lazy_decrease(&mut self, amount: u128) -> Result<(), LibraryExn>` | Lazy decrease that reports immediate conversion or accumulated-delta underflow. |

`Balance::MAX` is `i128::MAX as u128`. `Balance` exposes no absolute `set` or signed-adjustment method. Implements `Deletable`.

## CapacityConstraint

Commit-time capacity for a contract-defined linear constraint. Changes are staged on the handle and written when the handle is flushed or dropped.

| Method | Signature | Description |
|--------|-----------|-------------|
| `get_remaining_capacity` | `fn get_remaining_capacity(&self) -> i128` | Return the committed capacity plus changes staged in this transaction and handle. A never-written location starts at zero. |
| `try_get_remaining_capacity` | `fn try_get_remaining_capacity(&self) -> Result<i128, LibraryExn>` | Read remaining capacity without aborting. |
| `consume_capacity` | `fn consume_capacity(&mut self, amount: i128)` | Stage consumption for commit-time enforcement. A negative amount releases capacity. |
| `try_consume_capacity` | `fn try_consume_capacity(&mut self, amount: i128) -> Result<(), LibraryExn>` | Stage consumption and report arithmetic overflow instead of aborting. |
| `set_capacity` | `fn set_capacity(&mut self, capacity: i128)` | Set the capacity. Must be the first write in the transaction, except for an idempotent repeat. |
| `try_set_capacity` | `fn try_set_capacity(&mut self, capacity: i128) -> Result<(), LibraryExn>` | Set capacity and report invalid write ordering instead of aborting. |
| `flush` | `fn flush(&mut self)` | Merge staged changes into pending storage immediately. |
| `try_flush` | `fn try_flush(&mut self) -> Result<(), LibraryExn>` | Flush staged changes and report failure instead of aborting. |

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

`at_disjoint_mut` compares derived storage keypaths, so `K` does not need `PartialEq`. It panics when two supplied keys address the same storage slot.

Maps do not support enumeration. No `keys()` method, no iteration.

Does not implement `Deletable` (cannot enumerate entries).

### DisjointMut\<Owner, S, N\>

Borrow guard returned by `at_disjoint_mut`. Holds an exclusive borrow on the map. Implements `Deref<Target = [S; N]>` and `DerefMut`, so you can index into it directly.

## Vector\<S\>

Indexed collection. `S` must implement `StorageType`. Built on `Map<u32, S>` internally, with a separately stored length.

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
| `try_get` | `fn try_get(&self) -> Result<T, LibraryExn>` | Deserialize without aborting. Missing storage is an `Err` identifiable with `is_storage_missing()`. |
| `set` | `fn set(&mut self, value: &T)` | Serialize and store the value. Uses the keypath's locking mode. |
| `try_set` | `fn try_set(&mut self, value: &T) -> Result<(), LibraryExn>` | Serialize and store without aborting. Leaves storage unmodified on `Err`. |
| `set_exclusive` | `fn set_exclusive(&mut self, value: &T)` | Serialize and store the value with an exclusive lock, regardless of keypath flag. |
| `try_set_exclusive` | `fn try_set_exclusive(&mut self, value: &T) -> Result<(), LibraryExn>` | Exclusive store that reports failure instead of aborting. |
| `load_mut` | `fn load_mut(&mut self) -> ValueMut<'_, T>` | Load the value and return a mutable guard. Flushes back to storage on drop. Requires `T: WriteXDR + ReadXDR`. |

Implements `Deletable`.

### ValueMut\<T\>

Mutable guard returned by `load_mut`. Implements `Deref<Target = T>` and `DerefMut`. A guard that receives mutable access writes back on drop. A read-only guard performs no write.

| Method | Signature | Description |
|--------|-----------|-------------|
| `flush` | `fn flush(&mut self)` | Write a dirty value immediately. A clean guard is a no-op. |
| `try_flush` | `fn try_flush(&mut self) -> Result<(), LibraryExn>` | Flush and report serialization or storage failure instead of aborting. |

## Bytestring

Arbitrary byte data. Raw bytes in, raw bytes out.

| Method | Signature | Description |
|--------|-----------|-------------|
| `len` | `fn len(&self) -> usize` | Length in bytes. |
| `is_empty` | `fn is_empty(&self) -> bool` | True if length is zero. |
| `exists` | `fn exists(&self) -> bool` | True if a bytestring exists. Returns false for a missing key. |
| `get` | `fn get(&self) -> Box<[u8]>` | Read stored bytes as a heap-allocated slice. |
| `try_get` | `fn try_get(&self) -> Result<Box<[u8]>, LibraryExn>` | Read without aborting. Missing storage is an `Err` identifiable with `is_storage_missing()`. |
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
| `try_consume` | `fn try_consume(&mut self) -> Result<T, LibraryExn>` where `T: ReadXDROwned` | Consume and decode without aborting. A decode failure leaves the entry in the queue. |
| `consume_raw` | `fn consume_raw(&mut self) -> Box<[u8]>` | Consume the next entry as raw bytes. Aborts if the queue is empty. |
| `try_consume_raw` | `fn try_consume_raw(&mut self) -> Result<Box<[u8]>, LibraryExn>` | Consume raw bytes without aborting. |
| `consume_sized` | `fn consume_sized<const N: usize>(&mut self) -> [u8; N]` | Consume into a fixed-size array. Aborts on size mismatch. |
| `try_consume_sized` | `fn try_consume_sized<const N: usize>(&mut self) -> Result<[u8; N], LibraryExn>` | Consume without aborting. A wrong-size entry is left in the queue. |
| `peek` | `fn peek(&self) -> T` where `T: ReadXDROwned` | Read the next entry without consuming. Aborts if empty. |
| `try_peek` | `fn try_peek(&self) -> Result<T, LibraryExn>` where `T: ReadXDROwned` | Read and decode without aborting or consuming. |
| `peek_raw` | `fn peek_raw(&self) -> Box<[u8]>` | Raw-bytes peek. Aborts if empty. |
| `try_peek_raw` | `fn try_peek_raw(&self) -> Result<Box<[u8]>, LibraryExn>` | Raw-bytes peek without aborting. |
| `peek_sized` | `fn peek_sized<const N: usize>(&self) -> [u8; N]` | Fixed-size peek. Aborts on size mismatch. |
| `try_peek_sized` | `fn try_peek_sized<const N: usize>(&self) -> Result<[u8; N], LibraryExn>` | Fixed-size peek without aborting. |
| `keypath` | `fn keypath(&self) -> &Keypath` | Reference to the queue's root keypath. |
| `key` | `fn key(&self) -> &StorageKey` | Reference to the queue's resolved storage key. |

Implements `StorageType` and `Deletable`.

### Lower-level free functions (`sdk::sys_exn::rcq`)

| Function | Signature | Description |
|----------|-----------|-------------|
| `retrocausal_queue_insert` | `fn retrocausal_queue_insert(key: &StorageKey, queue_entry: &[u8])` | Insert raw bytes. |
| `retrocausal_queue_consume_sized` | `fn retrocausal_queue_consume_sized<const N: usize>(key: &StorageKey) -> [u8; N]` | Consume a fixed-size entry. Aborts on size mismatch or empty queue. |
| `retrocausal_queue_try_consume_sized` | `fn retrocausal_queue_try_consume_sized<const N: usize>(key: &StorageKey) -> Result<[u8; N], LibraryExn>` | Consume a fixed-size entry without aborting. |
| `retrocausal_queue_peek_sized` | `fn retrocausal_queue_peek_sized<const N: usize>(key: &StorageKey) -> [u8; N]` | Peek a fixed-size entry. |
| `retrocausal_queue_try_peek_sized` | `fn retrocausal_queue_try_peek_sized<const N: usize>(key: &StorageKey) -> Result<[u8; N], LibraryExn>` | Peek a fixed-size entry without aborting. |
| `retrocausal_queue_consume` | `fn retrocausal_queue_consume(key: &StorageKey) -> Box<[u8]>` | Consume a raw entry. |
| `retrocausal_queue_try_consume` | `fn retrocausal_queue_try_consume(key: &StorageKey) -> Result<Box<[u8]>, LibraryExn>` | Consume a raw entry without aborting. |
| `retrocausal_queue_peek` | `fn retrocausal_queue_peek(key: &StorageKey) -> Box<[u8]>` | Peek a raw entry. |
| `retrocausal_queue_try_peek` | `fn retrocausal_queue_try_peek(key: &StorageKey) -> Result<Box<[u8]>, LibraryExn>` | Peek a raw entry without aborting. |

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

Trait for storage types whose data can be fully deleted. Leaf types (`Balance`, `NNInt`, `CapacityConstraint`, `Value`, and `Bytestring`) delete their single storage key. Compound types (`Node` and `Vector`) implement this recursively when their elements are `Deletable`. `Map` does not implement `Deletable` because it cannot enumerate its entries.

| Method | Signature | Description |
|--------|-----------|-------------|
| `delete` | `fn delete(&mut self)` | Delete using the keypath's own locking semantics. |
| `delete_exclusive` | `fn delete_exclusive(&mut self)` | Delete with an exclusive lock, regardless of keypath flag. |

---

[Programming Model: Storage Types](/programming-model/storage-types/) for conflict semantics and usage guidance.
