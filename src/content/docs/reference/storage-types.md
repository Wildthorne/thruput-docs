---
title: Storage Types
description: API reference for Stellar Thruput storage types.
---

| Area | Links |
|------|-------|
| Type choice and conflict semantics | [Storage guidance](/programming-model/storage-types/) |
| Generated type, guard, and trait APIs | [`sdk::storage`](https://crates.thruput.network/docs/sdk/0.42.2/doc/sdk/storage/index.html), [Rust API Docs](/tools/rust-api-docs/) |
| Encoding | CXS; serialization traits retain the names `ReadXDR` and `WriteXDR` |

## Balance

| Property | Value |
| --- | --- |
| Representation | `i128`, backed by NNInt |
| Range | `0..=i128::MAX`; `Balance::MAX` is `i128::MAX` |
| Missing value | Zero |
| Negative amount | Rejected with `NonNegativeIntUnderflow` |
| Operations | No absolute `set` or signed adjustment |
| Traits | `Deletable` |
| Usage | [Balance guidance](/programming-model/storage-types/#balance), [Counter tutorial](/tutorials/build-a-counter/) |

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `fn get(&self) -> i128` | Read the balance. A never-written location returns zero. |
| `try_get` | `fn try_get(&self) -> Result<i128, LibraryExn>` | Read without aborting. A never-written location returns `Ok(0)`. |
| `increase` | `fn increase(&mut self, amount: i128)` | Load and increase the balance. Aborts immediately on overflow. |
| `try_increase` | `fn try_increase(&mut self, amount: i128) -> Result<(), LibraryExn>` | Checked increase that leaves storage unmodified on `Err`. |
| `decrease` | `fn decrease(&mut self, amount: i128)` | Load and decrease the balance. Aborts immediately if funds are insufficient. |
| `try_decrease` | `fn try_decrease(&mut self, amount: i128) -> Result<(), LibraryExn>` | Checked decrease that leaves storage unmodified on `Err`. |
| `lazy_increase` | `fn lazy_increase(&mut self, amount: i128)` | Record an increase without loading the committed balance. Aggregate overflow is checked during reservation. |
| `try_lazy_increase` | `fn try_lazy_increase(&mut self, amount: i128) -> Result<(), LibraryExn>` | Report a negative amount or accumulated-delta overflow. |
| `lazy_decrease` | `fn lazy_decrease(&mut self, amount: i128)` | Record a decrease without loading the committed balance. Aggregate sufficiency is checked during reservation. |
| `try_lazy_decrease` | `fn try_lazy_decrease(&mut self, amount: i128) -> Result<(), LibraryExn>` | Report a negative amount or accumulated-delta underflow. |

## NNInt

| Property | Value |
| --- | --- |
| Data model | Signed changes, explicit `set`, and a commit-time floor |
| Decrement | Negative `inc` or `strict_inc` argument |
| Exclusive writes | Keypath flag, or `non_negative_int_set_exclusive` in `sdk::sys_exn::nnint`; no handle `set_exclusive` method |
| Traits | `Deletable` |
| Usage | [Merged deltas](/programming-model/execution/#merged-deltas), [NNInt and concurrent updates](/programming-model/nnint/) |

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `fn get(&self) -> i128` | Read current value. Aborts if the location has never been set. |
| `try_get` | `fn try_get(&self) -> Result<i128, LibraryExn>` | Read current value without aborting. Missing storage is an `Err` identifiable with `is_storage_missing()`. |
| `set` | `fn set(&mut self, set_value: i128)` | Set the value. Uses the keypath's locking mode. |
| `inc` | `fn inc(&mut self, increment: i128)` | Add `increment` without forcing a snapshot read. Underflow is caught by later runtime checks, not immediately. |
| `strict_inc` | `fn strict_inc(&mut self, increment: i128)` | Add `increment`, loading the current base for early underflow detection. Aborts immediately if the result would be negative. |
| `try_strict_inc` | `fn try_strict_inc(&mut self, increment: i128) -> Result<(), LibraryExn>` | Checked increment that reports overflow, underflow, or storage failure instead of aborting. Leaves storage unmodified on `Err`. |

## CapacityConstraint

| Property | Value |
| --- | --- |
| Purpose | Commit-time capacity for a contract-defined linear constraint |
| Flush | Staged changes are written on flush or drop |
| Traits | `Deletable` |

| Method | Signature | Description |
|--------|-----------|-------------|
| `get_remaining_capacity` | `fn get_remaining_capacity(&self) -> i128` | Return the committed capacity plus changes staged in this transaction and handle. A never-written location starts at zero. |
| `try_get_remaining_capacity` | `fn try_get_remaining_capacity(&self) -> Result<i128, LibraryExn>` | Read remaining capacity without aborting. |
| `consume_capacity` | `fn consume_capacity(&mut self, amount: i128)` | Stage consumption for commit-time enforcement. A negative amount releases capacity. |
| `try_consume_capacity` | `fn try_consume_capacity(&mut self, amount: i128) -> Result<(), LibraryExn>` | Stage consumption and report arithmetic overflow instead of aborting. |
| `set_capacity` | `fn set_capacity(&mut self, capacity: i128)` | Set the capacity. Must be the first write in the transaction, except for an idempotent repeat. |
| `try_set_capacity` | `fn try_set_capacity(&mut self, capacity: i128) -> Result<(), LibraryExn>` | Set capacity and report invalid write ordering instead of aborting. |
| `flush` | `fn flush(&mut self)` | Merge staged changes into pending storage immediately. |
| `try_flush` | `fn try_flush(&mut self) -> Result<(), LibraryExn>` | Flush staged changes and report failure. On error, changes remain staged and drop retries the flush. |

## Map\<K, V\>

| Property | Value |
| --- | --- |
| Bounds | `K: WriteXDR`, `V: StorageType` |
| Enumeration | Not supported; no `keys()` or iterator |
| Deletion | Does not implement `Deletable` |
| Disjoint access | Compares derived keypaths, not `PartialEq`; duplicate slots panic |

| Method | Signature | Description |
|--------|-----------|-------------|
| `at` | `fn at(&self, entry_key: &K) -> SlotRef<'_, Self, V>` | Read-only borrow of the value at `entry_key`. Returns a `SlotRef` that derefs to `V`. |
| `at_mut` | `fn at_mut(&mut self, entry_key: &K) -> SlotMut<'_, Self, V>` | Mutable borrow of the value at `entry_key`. Returns a `SlotMut` that derefs to `V`. |
| `at_mut_exclusive` | `fn at_mut_exclusive(&mut self, entry_key: &K) -> SlotMut<'_, Self, V>` | Mutable borrow with an exclusive lock. One writer per key per block. Later writes to the entry in the same transaction keep the lock request. |
| `at_disjoint_mut` | `fn at_disjoint_mut<const N: usize>(&mut self, keys: [&K; N]) -> DisjointMut<'_, Self, V, N>` | Mutably borrow N elements at once. Panics if any keys are equal. |
| `at_disjoint_unchecked_mut` | `unsafe fn at_disjoint_unchecked_mut<const N: usize>(&mut self, keys: [&K; N]) -> DisjointMut<'_, Self, V, N>` | Mutably borrow N elements without duplicate checking. Caller must ensure all keys are disjoint. |
| `keypath` | `fn keypath(&self) -> &Keypath` | Reference to the map's root keypath. |

### DisjointMut\<Owner, S, N\>

| Property | Value |
| --- | --- |
| Origin | `at_disjoint_mut` |
| Borrow | Exclusive borrow of the parent map |
| Traits | `Deref<Target = [S; N]>`, `DerefMut`; supports direct indexing |

## Vector\<S\>

| Property | Value |
| --- | --- |
| Representation | `Map<u32, S>` and a separate length; `S: StorageType` |
| Sparse slots | Deleting element storage does not shrink `len`; an in-bounds slot can be missing |
| Iterators | `Iterator`, `ExactSizeIterator`, `DoubleEndedIterator`; `IntoIterator` for shared and mutable references |
| Deletion | `Deletable` when `S: Deletable`; deletes elements, then length |

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

## Value\<T\>

| Property | Value |
| --- | --- |
| Data | One serialized typed value |
| Bounds | `T: WriteXDR` for writes, `T: ReadXDR` for reads |
| Traits | `Deletable` |

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `fn get(&self) -> T` | Deserialize and return the stored value. Aborts if the key does not exist. |
| `try_get` | `fn try_get(&self) -> Result<T, LibraryExn>` | Deserialize without aborting. Missing storage is an `Err` identifiable with `is_storage_missing()`. |
| `set` | `fn set(&mut self, value: &T)` | Serialize and store the value. Uses the keypath's locking mode. |
| `try_set` | `fn try_set(&mut self, value: &T) -> Result<(), LibraryExn>` | Serialize and store without aborting. Leaves storage unmodified on `Err`. |
| `set_exclusive` | `fn set_exclusive(&mut self, value: &T)` | Serialize and store the value with an exclusive lock, regardless of keypath flag. |
| `try_set_exclusive` | `fn try_set_exclusive(&mut self, value: &T) -> Result<(), LibraryExn>` | Exclusive store that reports failure instead of aborting. |
| `load_mut` | `fn load_mut(&mut self) -> ValueMut<'_, T>` | Load the value and return a mutable guard. Flushes back to storage on drop. Requires `T: WriteXDR + ReadXDR`. |
| `key` | `fn key(&self) -> &StorageKey` | Reference to the value's resolved storage key. |

### ValueMut\<T\>

| Property | Value |
| --- | --- |
| Origin | `load_mut` |
| Traits | `Deref<Target = T>`, `DerefMut` |
| Drop | Writes back after mutable access; a clean guard does not write |

| Method | Signature | Description |
|--------|-----------|-------------|
| `flush` | `fn flush(&mut self)` | Write a dirty value immediately. A clean guard is a no-op. |
| `try_flush` | `fn try_flush(&mut self) -> Result<(), LibraryExn>` | Flush and report serialization or storage failure. On error, the guard remains dirty and drop retries. |

## Bytestring

| Property | Value |
| --- | --- |
| Data | Raw bytes |
| Exclusive writes | Keypath flag, or `bytestring_set_exclusive` in `sdk::sys_exn::bytestring`; no handle `set_exclusive` method |
| Traits | `Deletable` |

| Method | Signature | Description |
|--------|-----------|-------------|
| `len` | `fn len(&self) -> usize` | Length in bytes. |
| `is_empty` | `fn is_empty(&self) -> bool` | True if length is zero. |
| `exists` | `fn exists(&self) -> bool` | True if a bytestring exists. Returns false for a missing key. |
| `get` | `fn get(&self) -> Box<[u8]>` | Read stored bytes as a heap-allocated slice. |
| `try_get` | `fn try_get(&self) -> Result<Box<[u8]>, LibraryExn>` | Read without aborting. Missing storage is an `Err` identifiable with `is_storage_missing()`. |
| `get_sized` | `fn get_sized<const N: usize>(&self) -> [u8; N]` | Read into a fixed-size array. Aborts if length does not match `N`. |
| `set` | `fn set(&mut self, buf: &[u8])` | Write bytes. Uses the keypath's locking mode (exclusive if the keypath flag is set). |

## RCQ\<T\>

| Property | Value |
| --- | --- |
| Data | CXS-encoded `T`; multi-producer queue |
| Concurrency | Inserts commute; consumes are sequential |
| Traits | `StorageType`, `Deletable` |
| Modules | Typed wrapper in `sdk::storage`; raw-key functions in `sdk::sys_exn::rcq` |

| Method | Signature | Description |
|--------|-----------|-------------|
| `insert` | `fn insert(&mut self, entry: &T)` where `T: WriteXDR` | CXS-encode and insert the entry. |
| `insert_raw` | `fn insert_raw(&mut self, queue_entry: &[u8])` | Insert raw bytes; bypasses CXS encoding. |
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
| `key` | `fn key(&self) -> &StorageKey` | Reference to the queue's resolved storage key. |

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

| Type | Implements | Description |
|------|------------|-------------|
| `SlotRef<'a, Owner, S>` | `Deref<Target = S>` | Read-only handle. Holds a shared borrow on the parent. |
| `SlotMut<'a, Owner, S>` | `Deref<Target = S>` + `DerefMut` | Mutable handle. Holds an exclusive borrow on the parent. |

| Access | Lifetime | Syntax |
| --- | --- | --- |
| Map or vector element | Tied to parent collection | `*slot` or direct field access; no unwrap |

## Node\<T\>

| Property | Value |
| --- | --- |
| Data | Compound storage field group and its root keypath |
| Bound | `T: From<Keypath>` |
| Access | `Deref<Target = T>`, `DerefMut` |
| Collection support | Implements `StorageType` for use in maps and vectors |
| Deletion | `Deletable` when `T: Deletable`; delegates to inner fields |

| Method | Signature | Description |
|--------|-----------|-------------|
| `keypath` | `fn keypath(&self) -> &Keypath` | Reference to the node's root keypath. |

## Deletable Trait

| Implementor | Behavior |
| --- | --- |
| `Balance`, `NNInt`, `CapacityConstraint`, `Value`, `Bytestring` | Delete one key |
| `Node`, `Vector` | Delete recursively when elements implement `Deletable` |
| `Map` | Not implemented; entries cannot be enumerated |

| Method | Signature | Description |
|--------|-----------|-------------|
| `delete` | `fn delete(&mut self)` | Delete using the keypath's own locking semantics. |
| `delete_exclusive` | `fn delete_exclusive(&mut self)` | Delete with an exclusive lock, regardless of keypath flag. |

## Flaggable Trait

| Property | Value |
| --- | --- |
| Implementors | `Value`, `NNInt`, `Balance`, `Bytestring` |
| Scope | Current transaction's requested flags for a leaf key |
| Type | `StorageFlags` aliases `StorageDeltaFlags` |
| Flag | `ExclusiveLock` |

| Method | Signature | Description |
|--------|-----------|-------------|
| `flags` | `fn flags(&self) -> StorageFlags` | The key's flags as seen by the current call frame. `None` if the key has no pending write. |
| `set_flags` | `fn set_flags(&mut self, flags: StorageFlags)` | Add `flags` (bitwise OR). Throws unless a write to the key is pending in the current call frame. |
| `clear_flags` | `fn clear_flags(&mut self)` | Remove every flag. Does nothing if the key has no pending write. |

### Raw-key functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `storage_flags` | `fn storage_flags(key: &StorageKey) -> StorageDeltaFlags` | Read the key's flags. |
| `set_storage_flags` | `fn set_storage_flags(key: &StorageKey, flags: StorageDeltaFlags)` | Add flags. Throws if no write is pending or a flag is unknown. |
| `clear_storage_flags` | `fn clear_storage_flags(key: &StorageKey)` | Remove every flag. |

| Module | Behavior |
| --- | --- |
| `sdk::sys_exn::flags` | Throwing versions, re-exported at crate root |
| `sdk::sys_result::flags` | Non-throwing versions returning `Result` |
| Usage | [Lock requests](/programming-model/storage-types/#lock-requests) |
