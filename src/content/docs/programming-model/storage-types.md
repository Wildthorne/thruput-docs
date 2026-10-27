---
title: Storage Types
description: "SDK storage types, their conflict semantics, and how to choose between them."
---

Start with `Balance` for nonnegative counts and amounts. It exposes reads, increases, and decreases without requiring you to manage the underlying integer base. The storage type you choose determines whether concurrent writes merge, conflict, or ignore each other.

This page explains behavior and tradeoffs. For exact method signatures, see [Storage Types Reference](/reference/storage-types/).

## Balance

Nonnegative, zero-defaulting storage for counters, balances, allowances, and supply. `Balance` uses `i128` amounts in `0..=i128::MAX`, rejects negative inputs, and exposes no signed adjustment or absolute `set`.

```rust
use thruput_sdk::storage::Balance;

#[derive(Debug)]
#[thruput_sdk::storage]
pub struct Counter {
    value: Balance,
}
```

Read with `self.value.get()`. A never-written value returns zero; other storage failures still abort. With a snapshot value of `100`, these changes can merge:

```rust
// Two transactions run against a snapshot value of 100:
self.value.increase(5);   // Tx A: "add 5"
self.value.decrease(3);   // Tx B: "subtract 3"
// If both transactions are admitted, the result is 102.
```

Both methods check bounds during execution and record relative changes. The runtime also checks aggregate bounds when it reserves concurrent transactions. Two decreases that each fit the snapshot may still exceed it together, and credits from other transactions in the same block do not count toward a decrease. Successful execution alone does not guarantee inclusion. See [Merged Deltas](/programming-model/execution/#merged-deltas).

### Checked and lazy updates

For per-account amounts, combine Balance with a Map:

```rust
use thruput_sdk::{storage::{Balance, Map}, ContractAddress};

#[derive(Debug)]
#[thruput_sdk::storage]
pub struct Token {
    balances: Map<ContractAddress, Balance>,
}
```

Each direction has a checked and lazy form:

```rust
let sender = get_caller();

// Load the sender and fail during execution if funds are insufficient.
self.balances.at_mut(&sender).decrease(amount);

// Skip the receiver load and defer its bound check.
self.balances.at_mut(&receiver).lazy_increase(amount);
```

All four adjustment methods record deltas that can merge with compatible transactions:

| Method | Snapshot base | Snapshot-bound result | Deltas merge? |
|--------|---------------|-----------------------|---------------|
| `increase(amount)` | Loaded if needed | Overflow detected during contract execution | Yes |
| `decrease(amount)` | Loaded if needed | Underflow detected during contract execution | Yes |
| `lazy_increase(amount)` | Not forced to load | Overflow decided during delta reservation | Yes |
| `lazy_decrease(amount)` | Not forced to load | Underflow decided during delta reservation | Yes |

The `try_` variants report errors that are available during contract execution, so a contract can translate an immediate failure into a domain error. Lazy variants cannot report a snapshot-bound failure that they deliberately did not load. They can still report conversion and transaction-local accumulated-delta errors.

## NNInt

`NNInt` is the lower-level integer API behind Balance. Use it when your state model needs a signed delta or an explicit base. For ordinary nonnegative counts and amounts, keep using Balance.

```rust
use thruput_sdk::storage::NNInt;

#[derive(Debug)]
#[thruput_sdk::storage]
pub struct IntegerState {
    value: NNInt,
}
```

The direction is part of the delta:

```rust
// Two transactions run against a nonnegative snapshot value of 100:
self.value.strict_inc(5);    // Tx A: "add 5"
self.value.strict_inc(-3);   // Tx B: "subtract 3"
// If both transactions are admitted, the result is 102.
```

`strict_inc` loads the base for an immediate underflow check; `inc` skips the forced read. Both produce deltas that can merge when their resolved bases match and aggregate bounds permit. Unlike Balance, `NNInt::get` fails on missing storage, and `set` can replace the base, including with a negative value. Negative bases change the commit-time floor.

Continue with [NNInt and concurrent updates](/programming-model/nnint/) for the `set_add` representation, base matching, and negative-base rules. Balance provides a narrower API over that same storage primitive; it does not use a different merge mechanism.

## Map\<K, V\>

Key-value store. Different keys use independent storage locations. Same-key behavior follows the value type's rules. Other shared writes or storage-funding limits can still prevent the complete transactions from landing together.

```rust
use thruput_sdk::{storage::{Balance, Map}, ContractAddress};

#[derive(Debug)]
#[thruput_sdk::storage]
pub struct Token {
    balances: Map<ContractAddress, Balance>,
}
```

```rust
// Different keys: always independent, never conflict
self.balances.at_mut(&alice).lazy_increase(10);  // Tx A
self.balances.at_mut(&bob).lazy_increase(20);    // Tx B, no interaction

// Same key: follows Balance rules (compatible deltas merge)
self.balances.at_mut(&alice).increase(10);       // Tx A
self.balances.at_mut(&alice).lazy_increase(20);  // Tx B, merges to +30
```

Maps can nest: `Map<K, Map<K2, Balance>>` gives composite keys with independent conflict domains at each level. The ERC-20 allowance pattern uses this for owner and spender pairs.

Maps cannot enumerate keys, so a whole `Map` cannot be deleted. Delete one entry with `delete_at(&key)`, or call `delete()` on a deletable handle. Deleting data returns its [storage deposit](/how-it-works/storage-economics/#storage-refundable-deposits).

## Bytestring

Raw bytes. Concurrent writes of the same value commute. Concurrent writes of different values conflict.

```rust
use thruput_sdk::storage::Bytestring;

#[derive(Debug)]
#[thruput_sdk::storage]
pub struct Config {
    owner: Bytestring,
}
```

```rust
self.owner.set(&new_owner);    // Tx A
self.owner.set(&other_owner);  // Tx B: conflict, one excluded
```

Use Bytestring for raw configuration or metadata. Writers of different values to the same location conflict; writers of identical values can coexist.

## RCQ\<T\> / RetrocausalQueue

Multi-producer, single-consumer queue. Inserts from different transactions merge. Persisted entries are ordered by queue block, then lexicographically within that block. Concurrent observations follow the proposer-recorded order.

```rust
// These two transactions can both land:
self.requests.insert(&entry_a);  // Tx A
self.requests.insert(&entry_b);  // Tx B: no conflict

// Consumes pull from the front of the queue
let entry = self.requests.try_consume();
```

Only one transaction per block can consume from a given queue; a second consumer is excluded. A queue accepts at most 250 inserted entries per block, and each entry is at most 256 bytes. Use `RCQ<T>` when producers are concurrent and one consumer processes items in order. Lower-level raw functions are available when you need byte-level control.

## CapacityConstraint

A commit-time limit shared by changes from multiple transactions. Use it for a rule that spans transactions, such as a supply cap or an aggregate withdrawal limit. A check against a snapshot read cannot enforce that rule, because [reads are not checked at commit](/programming-model/execution/#snapshot-isolation).

```rust
use thruput_sdk::storage::CapacityConstraint;

#[thruput_sdk::storage]
pub struct WithdrawalLimit {
    remaining: CapacityConstraint,
}
```

```rust
// Reset at the start of a period.
self.remaining.set_capacity(period_limit);

// Each withdrawal consumes capacity without loading competing withdrawals.
self.remaining.consume_capacity(amount);
```

Consumption is staged on the handle and written when the handle is flushed or dropped. Call `try_flush()` to catch a flush error instead of aborting in drop. A negative amount releases capacity. The runtime enforces that the committed remaining capacity does not fall below its floor. As with `Balance`, all consumption in a block must fit the capacity the block started with; releases in other transactions do not count.

`set_capacity` must be the first write to that constraint in the transaction, except that repeating the same value is allowed. A reset uses `NNInt::set` rules: it conflicts with consumers in the same block unless it sets the current capacity value.

## Vector\<S\>

Ordered collection. Each element is an independent storage slot. Internally backed by a `Map<u32, S>` for elements and a length counter.

```rust
use thruput_sdk::storage::{Vector, Node, Value};

#[derive(Debug)]
#[thruput_sdk::storage]
pub struct Item {
    value: Value<u64>,
}

#[derive(Debug)]
#[thruput_sdk::storage]
pub struct Registry {
    items: Vector<Node<Item>>,
}
```

```rust
// Push a new element
self.items.push_with(|item| {
    item.value.set(&42);
});

// Read by index (bounds-checked)
let val = self.items.at(0).value.get();

// Mutate by index
*self.items.at_mut(0).value.load_mut() = 99;

// Iterate
for item in &self.items {
    let v = item.value.get();
}
```

Different indices are independent and never conflict (same as Map). Same-index writes follow the element type's rules. Pushes and pops write the length with an exclusive lock, so only one transaction per block can change a vector's length. That transaction can push or pop several times.

Use Vector for ordered collections where elements are accessed by index. Wrap compound structs in `Node<T>` so storage derivation works through the nesting. For hot concurrent writes, Map with application-managed keys is more parallelism-friendly than Vector with pushes.

## Value\<T\>

Typed storage slot. Stores any CXS-serializable value. Conflict semantics are the same as Bytestring: concurrent writes of the same value commute, different values conflict.

```rust
use thruput_sdk::{storage::Value, ContractAddress};

#[derive(Debug)]
#[thruput_sdk::storage]
pub struct Config {
    owner: Value<ContractAddress>,
    threshold: Value<u64>,
}
```

```rust
let owner = self.owner.get();             // read (aborts if unset)
let result = self.threshold.try_get();    // read without aborting
self.owner.set(&new_owner);               // write
*self.threshold.load_mut() = 10;          // read-modify-write
```

Use `Value<T>` for typed single-slot storage. Use `Bytestring` when you need raw byte access or variable-length data without a fixed schema.

## Choosing a Type

| If your write pattern is... | Use | Why |
|-----------------------------|-----|-----|
| Nonnegative count, balance, allowance, or supply | Balance | Nonnegative amounts, zero default, and checked or lazy deltas. |
| Signed delta or explicit integer base | NNInt | Signed deltas merge and `set` controls the base. |
| Cap or limit that spans transactions | CapacityConstraint | The runtime enforces the limit across the block; a snapshot read cannot. |
| `INSERT INTO ... (key, value)` with unique keys | Map | Different keys are independent. |
| Ordered list, accessed by index | Vector | Per-element independence. One transaction per vector per block can push or pop. |
| Store a typed value | Value\<T\> | Typed Bytestring. Same conflict rules. |
| `col = absolute_value` (raw bytes) | Bytestring | Accept that concurrent writes conflict. |
| Append to a log or work queue | RCQ\<T\> | Inserts merge. One consumer per queue per block. |

## Exclusive Writes

Use exclusive writes when an operation needs sole write access to a storage location for the duration of a block. Compatible deltas normally merge; an exclusive write prevents concurrent modifications to that key.

- `Value<T>::set_exclusive(&v)`: one exclusive write to a typed slot.
- `Map::at_mut_exclusive(&key)`: every write through the returned handle (`Value`, `Balance`, `NNInt`, `Bytestring`, or nested fields) requests the lock.
- `Deletable::delete_exclusive()`: delete, then request the lock.
- Raw keys: `non_negative_int_set_exclusive`, `bytestring_set_exclusive`, `delete_exclusive`, or `set_storage_flags`.

```rust
self.config.set_exclusive(&new_value);          // Value<Config>
self.integer_state.at_mut_exclusive(&owner).set(v);  // Map<_, NNInt>
```

If two transactions write exclusively to the same key, one is excluded. An exclusive write is also excluded if another transaction in the block has already written that key. Once an exclusive write is admitted, every later write to the key in that block is excluded. Whichever transaction reserves first wins. Prefer `Balance` or `NNInt` deltas when the operation can tolerate concurrent updates.

### Lock Requests

An exclusive write requests `ExclusiveLock` after the write succeeds. Later ordinary writes to the key in the same transaction keep the request, including writes from other call frames. The admitted transaction then holds the key's exclusive lock for the whole block. `clear_flags` withdraws the request.

```rust
self.integer_state.at_mut_exclusive(&owner).set(0);
self.integer_state.at_mut(&owner).inc(1);  // The lock request remains.
```

A reverted frame or failed `try_invoke` discards its flag changes along with its writes. Leaf handles implement `Flaggable` to read, add, or clear flags; see [Flaggable Trait](/reference/storage-types/#flaggable-trait) and [Storage Flags](/reference/syscalls/#storage-flags).

If `Balance` covers your state model, you do not need its lower-level representation. Read [NNInt and concurrent updates](/programming-model/nnint/) when you need signed changes, an explicit base, or the exact `set_add` commutativity rules. For runtime reservation details, continue to [Parallel Execution](/how-it-works/execution-model/).
