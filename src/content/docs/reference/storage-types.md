---
title: Storage Types
description: API reference for Groundhog's storage types.
---

API reference for the SDK storage types. For conflict semantics, usage guidance, and when to choose each type, see [Programming Model: Storage Types](/programming-model/storage-types/).

## NNInt

Non-negative integer. Used for balances, counters, supply tracking.

| Method | Description |
|--------|-------------|
| `get() -> i128` | Read current value. Aborts if the location has never been set. |
| `try_get() -> Option<i128>` | Read current value. Returns `None` if never set. |
| `set(value: i128)` | Set the value directly. |
| `set_exclusive(value: i128)` | Set the value with an exclusive lock. Only one writer succeeds per block. |
| `inc(increment: i128)` | Add `increment` without reading first. Underflow caught at merge, not immediately. |
| `strict_inc(increment: i128)` | Add `increment`. Aborts immediately if the result would be negative. |

Use `strict_inc` by default. Pass a negative value to decrement. See [NNInt In Depth](/programming-model/nnint/) for commutativity rules.

## Map\<K, V\>

Key-value map. Keys are XDR-serializable. Values can be any storage type, including nested Maps.

| Method | Description |
|--------|-------------|
| `get(key: &K) -> V` | Get value at `key`. Returns default if never set. |
| `try_get(key: &K) -> Option<V>` | Get value at `key`. Returns `None` if never set. |
| `set(key: &K, value: &V)` | Set value at `key`. |
| `set_exclusive(key: &K, value: &V)` | Set with exclusive lock. One writer per block. |
| `delete(key: &K)` | Delete entry at `key`. |
| `delete_exclusive(key: &K)` | Delete with exclusive lock. |
| `entry(key: &K) -> Entry<K, V>` | Mutable view of a single entry. Flushed on drop. |

Maps do not support enumeration. No `keys()` method, no iteration.

### Entry API

| Method | Description |
|--------|-------------|
| `key() -> &K` | Reference to the entry's key. |
| `get() -> &Option<V>` | Reference to current value. |
| `get_mut() -> &mut Option<V>` | Mutable reference. Flushed on drop. |
| `set(value: &V)` | Set entry to new value. |
| `delete()` | Delete entry. |
| `flush()` | Write pending changes immediately. Called automatically on drop. |

## Bytestring

Arbitrary byte data.

| Method | Description |
|--------|-------------|
| `get() -> Box<[u8]>` | Read stored bytes. Empty if never set. Requires `alloc` feature. |
| `get_sized<const N: usize>() -> [u8; N]` | Read into fixed-size array. Aborts if length mismatch. |
| `set(buf: &[u8])` | Write bytes. |
| `set_exclusive(buf: &[u8])` | Write with exclusive lock. One writer per block. |
| `len() -> usize` | Length in bytes. |
| `is_empty() -> bool` | True if length is zero. |

## RetrocausalQueue

Multi-producer, single-consumer queue. Operates at the syscall level with raw byte buffers.

| Function | Description |
|----------|-------------|
| `retrocausal_queue_insert(key: &StorageKey, entry: &[u8])` | Insert entry. Always commutes with other inserts. |
| `retrocausal_queue_consume_sized<const N: usize>(key: &StorageKey) -> Result<[u8; N]>` | Consume next entry. Error if empty or size mismatch. |
| `retrocausal_queue_peek_sized<const N: usize>(key: &StorageKey) -> Result<[u8; N]>` | Read next entry without consuming. |

Constraints: entries at most 256 bytes, one consumer per queue per block, entries stored in sorted order within a block.

## Handle\<T\>

Typed reference to a storage location. Wraps a keypath with load/store operations.

| Method | Description |
|--------|-------------|
| `root() -> Handle<T>` | Handle to root storage location. |
| `load() -> HandleRef<T>` | Immutable load. Default if never written. |
| `load_mut() -> HandleRefMut<T>` | Mutable load. Flushed on drop. |

## Declaring Storage

The `#[sdk::storage]` macro on a struct generates keypath routing. Each field maps to a unique storage location. Nested types like `Map<K, Map<K2, V>>` extend the keypath automatically. See [SDK Macros](/reference/sdk-macros/) for details.

---

[Programming Model: Storage Types](/programming-model/storage-types/) for conflict semantics and usage guidance. [Syscalls](/reference/syscalls/) for the raw syscall interface.
