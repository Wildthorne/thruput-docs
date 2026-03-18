---
title: Storage Types
description: Reference for Groundhog's commutative storage types.
---

Groundhog provides typed storage primitives with built-in commutativity rules. Instead of raw key-value writes, you use types that know how to merge concurrent modifications. This page documents each type's API and merge behavior.

For conflict semantics and usage guidance, see [Programming Model: Storage Types](/programming-model/storage-types/). For the execution model internals, see [How It Works: Execution Model](/how-it-works/execution-model/).

## NNInt

Non-negative integer. The workhorse of Groundhog storage. Used for balances, counters, supply tracking.

### Commutativity

Increments (`strict_inc`, `inc`) always commute with each other. They all resolve to the same snapshot base, so their deltas merge by addition. If the merged result would be negative, the offending transaction is excluded at reservation. `set(value)` commutes only when all concurrent callers set the same value. For the full commutativity rules, see [NNInt In Depth](/programming-model/nnint/).

### API

| Method | Description |
|--------|-------------|
| `get() -> i128` | Read current value. Aborts if the location has never been set. |
| `try_get() -> Option<i128>` | Read current value. Returns `None` if never set. |
| `set(value: i128)` | Set the value directly. Commutes only when concurrent writers set the same base value. |
| `set_exclusive(value: i128)` | Set the value with an exclusive lock. Only one writer succeeds per block. |
| `inc(increment: i128)` | Add `increment` to the value without reading it first. If the result would be negative, the transaction fails at merge time, not immediately. |
| `strict_inc(increment: i128)` | Add `increment` to the value. Aborts immediately if the result would be negative. Use this for transfers and balance changes where you want early failure. |

Use `strict_inc` by default. It catches underflow at execution time rather than deferring failure to merge. Pass a negative value to decrement.

### Example

From the ERC20 contract, adjusting a balance:

```rust
use sdk::storage::{Map, NNInt};

type Balance = NNInt;

#[sdk::storage]
pub struct TokenContract {
    balances: Map<ContractAddress, Balance>,
    total_supply: NNInt,
}

impl TokenContract {
    fn _adjust_balance(&mut self, owner: &ContractAddress, diff: Difference) {
        let mut balance = self.balances.get(owner);
        // For never-stored-to addresses, this acts as if the value was zero.
        // If the resulting balance would be negative, this aborts.
        balance.strict_inc(diff)
    }
}
```

Two concurrent transfers from different owners parallelize. Two concurrent transfers from the same owner parallelize as long as the account has sufficient balance to cover both.

## Map\<K, V\>

Key-value map. The keys are XDR-serializable types. The values can be any storage type, including nested Maps.

### Commutativity

Operations on different keys always commute. Operations on the same key follow the commutativity rules of the value type. For example, two increments to different `NNInt` values in the same map always parallelize.

Maps do not support enumeration. There is no `keys()` method and no iteration over all entries. This is deliberate: enumeration does not commute. If you need to list entries, maintain a separate index alongside the map.

### API

| Method | Description |
|--------|-------------|
| `get(key: &K) -> V` | Get the value at `key`. Returns a default-constructed value if the key has never been set. Aborts on internal error. |
| `try_get(key: &K) -> Option<V>` | Get the value at `key`. Returns `None` if the key has never been set. |
| `set(key: &K, value: &V)` | Set the value at `key`. |
| `set_exclusive(key: &K, value: &V)` | Set the value at `key` with an exclusive lock. Only one writer succeeds per block. |
| `delete(key: &K)` | Delete the entry at `key`. |
| `delete_exclusive(key: &K)` | Delete the entry at `key` with an exclusive lock. |
| `entry(key: &K) -> Entry<K, V>` | Get a mutable view of a single entry. Changes are flushed to storage when the `Entry` is dropped. |

### Entry API

The `entry` method returns an `Entry` that acts as a mutable view into a single map slot. This is useful when you need to read, modify, and write back a value in one operation.

| Method | Description |
|--------|-------------|
| `key() -> &K` | Reference to the entry's key. |
| `get() -> &Option<V>` | Reference to the current value. `None` if the key was not set. |
| `get_mut() -> &mut Option<V>` | Mutable reference. Changes are flushed on drop. |
| `set(value: &V)` | Set the entry to a new value. |
| `delete()` | Delete the entry. |
| `flush()` | Write pending changes to storage immediately. Called automatically on drop. |

### Example

Nested maps for allowances in an ERC20 contract:

```rust
#[sdk::storage]
pub struct TokenContract {
    allowances: Map<ContractAddress, Map<ContractAddress, Allowance>>,
}

impl TokenContract {
    fn _allowance(
        &self,
        owner: &ContractAddress,
        spender: &ContractAddress,
    ) -> Amount {
        let owner_allowances = self.allowances.get(owner);
        let spender_allowance = owner_allowances.get(spender);
        spender_allowance.try_get().unwrap_or(0) as Amount
    }
}
```

## Bytestring

Arbitrary byte data. Used for configuration, serialized records, metadata, and any data that does not need arithmetic merge semantics.

### Commutativity

Concurrent writes of the same value commute. Concurrent writes of different values conflict, and only one transaction lands per block. Reads always commute with other reads.

### API

| Method | Description |
|--------|-------------|
| `get() -> Box<[u8]>` | Read the stored bytes. Returns an empty slice if never set. Requires the `alloc` feature. |
| `get_sized<const N: usize>() -> [u8; N]` | Read the stored bytes into a fixed-size array. Aborts if the stored length does not match `N`. |
| `set(buf: &[u8])` | Write bytes. Concurrent writes of the same value commute. |
| `set_exclusive(buf: &[u8])` | Write bytes with an exclusive lock. Only one writer succeeds per block. |
| `len() -> usize` | Length of the stored bytestring in bytes. |
| `is_empty() -> bool` | Returns `true` if length is zero. |

### When to use Bytestring vs. NNInt

Use `NNInt` for any numeric value that gets incremented or decremented. Use `Bytestring` for opaque data like addresses, hashes, serialized structs, or configuration blobs. The key difference: `NNInt` supports commutative arithmetic; `Bytestring` does not.

## RetrocausalQueue

Multi-producer, single-consumer queue. Used for event streams, message passing, and task distribution.

### Commutativity

| Operation pair | Parallel? | Why |
|----------------|-----------|-----|
| Two inserts to the same queue | Yes | Entries are sorted; insertion order does not matter |
| Insert and consume on the same queue | No | Consumer is exclusive per block |
| Two deletions of the same queue | Yes | Same outcome regardless of order |
| Deletion and insert/consume on the same queue | No | Different operation types conflict |

### Two-phase pattern

Production and consumption happen in separate blocks. In block N, any number of transactions insert entries. In block N+1, a consumer transaction dequeues and processes those entries. This separation keeps the insert path conflict-free.

The name "retrocausal" reflects this: the consumer's decision to dequeue is made before the current block's insertions are finalized, so the consumed set is determined retroactively.

### Delete semantics

Deleting a queue destroys it. All entries are removed and the storage deposit is returned. A delete is not a consume: it does not process entries, it discards them.

Do not mix delete with insert or consume on the same key in a single transaction. If you need to drain a queue and then remove it, consume entries in one transaction and delete the key in a subsequent transaction.

### Constraints

- Each entry is at most 256 bytes.
- One consumer per queue per block. Multiple consumers on the same queue conflict.
- Entries within a block are stored in sorted order, not insertion order.

### API

The retrocausal queue API operates at the syscall level with raw byte buffers.

| Function | Description |
|----------|-------------|
| `retrocausal_queue_insert(key: &StorageKey, entry: &[u8])` | Insert an entry into the queue. Always commutes with other inserts. |
| `retrocausal_queue_consume_sized<const N: usize>(key: &StorageKey) -> Result<[u8; N]>` | Consume the next entry from the queue. Returns an error if the queue is empty or the entry size does not match `N`. |
| `retrocausal_queue_peek_sized<const N: usize>(key: &StorageKey) -> Result<[u8; N]>` | Read the next entry without consuming it. Same size constraints as consume. |

Use `peek` when you need to inspect the next entry before deciding whether to consume it. Use `consume` when you are ready to process and remove the entry.

### Example

A job queue where multiple contracts submit tasks and a single processor handles them:

```rust
use sdk::retrocausal_queue::{retrocausal_queue_insert, retrocausal_queue_consume_sized};

// Block N: any number of producers insert tasks
retrocausal_queue_insert(&TASK_QUEUE_KEY, &task_bytes)?;

// Block N+1: single consumer processes tasks
let task = retrocausal_queue_consume_sized::<32>(&TASK_QUEUE_KEY)?;
```

## Handle\<T\>

A typed reference to a storage location. Handles wrap a keypath and provide load/store operations for any storage type.

### Commutativity

Follows the commutativity rules of the inner type `T`. A `Handle<NNInt>` commutes like an `NNInt`. A `Handle<Bytestring>` commutes like a `Bytestring`.

### API

| Method | Description |
|--------|-------------|
| `root() -> Handle<T>` | Create a handle to the root storage location. |
| `load() -> HandleRef<T>` | Load the value, returning an immutable smart-pointer. Returns a default value if the location has never been written. |
| `load_mut() -> HandleRefMut<T>` | Load the value, returning a mutable smart-pointer. Changes are flushed to storage on drop. |

`HandleRefMut` dereferences to the inner type and writes back automatically when dropped. This is the standard pattern for working with top-level storage fields.

### Example

```rust
use sdk::storage::Handle;

fn read_and_update(handle: Handle<NNInt>) {
    // Immutable load
    let value = handle.load();
    let current = value.try_get().unwrap_or(0);

    // Mutable load - writes back on drop
    let mut value = handle.load_mut();
    value.strict_inc(10);
    // flushed to storage when `value` is dropped
}
```

## Declaring Storage

Use the `#[sdk::storage]` attribute on a struct to declare your contract's storage layout. Each field becomes a storage location with its type determining the merge behavior.

```rust
use sdk::storage::{Map, NNInt, Bytestring};

#[sdk::storage]
pub struct MyContract {
    owner: ContractAddress,
    balances: Map<ContractAddress, NNInt>,
    metadata: Bytestring,
    total_supply: NNInt,
}
```

The `#[sdk::storage]` macro generates keypath routing so each field maps to a unique storage location. Nested types like `Map<K, Map<K2, V>>` extend the keypath automatically.

For a hands-on introduction to using these types, see [Getting Started](/start/getting-started/). For conflict semantics and when to use each type, see [Programming Model: Storage Types](/programming-model/storage-types/). For the raw syscall interface that these types wrap, see [Syscalls](/reference/syscalls/).
