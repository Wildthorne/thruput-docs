---
title: Storage Types
description: "SDK storage types, their conflict semantics, and how to choose between them."
---

The SDK storage layer exposes the types you use to model contract state. The type you choose determines whether concurrent writes merge, conflict, or ignore each other. At the protocol level, the primitives are `NNInt`, `Bytestring`, and `RetrocausalQueue`. `Balance` and `CapacityConstraint` provide narrower APIs over the integer primitive. `Map`, `Value`, `Vector`, and `Node` provide typed composition.

This page explains behavior and tradeoffs. For exact method signatures, see [Storage Types Reference](/reference/storage-types/) or [`sdk::storage` Rustdoc](https://groundhog.dev/docs/sdk/latest/sdk/storage/index.html).

## NNInt

Integer storage for signed changes that concurrent transactions can combine. Use it for counters or state models that need signed adjustments or an explicit `set`.

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

Pass negative values to `strict_inc` to subtract. With a nonnegative base, the runtime prevents concurrent decrements from driving the value below zero. `NNInt` also permits an explicit negative `set`, which changes its commit-time floor. Use `Balance` when negative values and absolute replacement should not be part of the contract API.

See [Merged Deltas](/programming-model/execution/#merged-deltas) for the contract-level model. The underlying `set_add` representation and exact commutativity rules are covered in [NNInt In Depth](/programming-model/nnint/).

## Balance

Nonnegative, zero-defaulting storage for balances, allowances, and supply. `Balance` uses `u128` amounts and exposes no signed adjustment or absolute `set`.

```rust
use sdk::storage::{Balance, Map};

#[derive(Debug)]
#[sdk::storage]
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
self.balances.at_mut(receiver).lazy_increase(amount);
```

All four adjustment methods record deltas that can merge with compatible transactions:

| Method | Snapshot base | Snapshot-bound result | Deltas merge? |
|--------|---------------|-----------------------|---------------|
| `increase(amount)` | Loaded if needed | Overflow detected during contract execution | Yes |
| `decrease(amount)` | Loaded if needed | Underflow detected during contract execution | Yes |
| `lazy_increase(amount)` | Not forced to load | Overflow decided during delta reservation | Yes |
| `lazy_decrease(amount)` | Not forced to load | Underflow decided during delta reservation | Yes |

The `try_` variants report errors that are available during contract execution, so a contract can translate an immediate failure into a domain error. Lazy variants cannot report a snapshot-bound failure that they deliberately did not load. They can still report conversion and transaction-local accumulated-delta errors.

## Map\<K, V\>

Key-value store. Different keys are fully independent and never conflict. Same-key behavior follows the value type's rules.

```rust
use sdk::storage::{Balance, Map};

#[derive(Debug)]
#[sdk::storage]
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

## RCQ\<T\> / RetrocausalQueue

FIFO queue. Inserts always commute. Consumes are sequential.

```rust
// These two transactions can both land:
self.requests.insert(&entry_a);  // Tx A
self.requests.insert(&entry_b);  // Tx B -- no conflict

// Consumes pull from the front of the queue
let entry = self.requests.try_consume();
```

Use `RCQ<T>` when producers are concurrent but consumers process items in order. Lower-level raw functions are available when you need byte-level control.

## CapacityConstraint

A commit-time limit shared by changes from multiple transactions. Use it when one transaction cannot determine whether a block-wide linear constraint will still hold, such as an aggregate withdrawal limit.

```rust
use sdk::storage::CapacityConstraint;

#[sdk::storage]
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

Consumption is staged on the handle and written when the handle is flushed or dropped. The runtime enforces that the committed remaining capacity does not fall below its floor. `set_capacity` must be the first write to that constraint in the transaction, except that repeating the same value is allowed.

## Vector\<S\>

Ordered collection. Each element is an independent storage slot. Internally backed by a `Map<u32, S>` for elements and a length counter.

```rust
use sdk::storage::{Vector, Node, Value};

#[derive(Storage)]
pub struct Item {
    value: Value<u64>,
}

#[derive(Debug)]
#[sdk::storage]
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

Different indices are independent and never conflict (same as Map). Same-index writes follow the element type's rules. Pushes conflict with other pushes (the length counter is not an NNInt, so concurrent length changes are mutually exclusive).

Use Vector for ordered collections where elements are accessed by index. Wrap compound structs in `Node<T>` so storage derivation works through the nesting. For hot concurrent writes, Map with application-managed keys is more parallelism-friendly than Vector with pushes.

## Value\<T\>

Typed storage slot. Stores any XDR-serializable value. Conflict semantics are the same as Bytestring: concurrent writes of the same value commute, different values conflict.

```rust
use sdk::storage::Value;

#[derive(Debug)]
#[sdk::storage]
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
| Nonnegative balance, allowance, or supply | Balance | Unsigned API, zero default, and checked or lazy deltas. |
| Signed delta or explicit integer base | NNInt | Signed deltas merge and `set` controls the base. |
| Block-wide linear limit | CapacityConstraint | Concurrent transactions consume shared commit-time capacity. |
| `INSERT INTO ... (key, value)` with unique keys | Map | Different keys are independent. |
| Ordered list, accessed by index | Vector | Per-element independence. Pushes are exclusive. |
| Store a typed value | Value\<T\> | Typed Bytestring. Same conflict rules. |
| `col = absolute_value` (raw bytes) | Bytestring | Accept that concurrent writes conflict. |
| Append to a log or work queue | RCQ\<T\> | Inserts merge, consumers are sequential. |

:::tip[Exclusive Writes]
If you need mutex-like semantics (only one transaction can write to a storage location per block), each type exposes exclusivity differently:

- `Value<T>::set_exclusive(&v)`: typed slot, exclusive write.
- `Map::at_mut_exclusive(&key)`: exclusive mutator on a Map entry.
- `NNInt` and `Bytestring` honour the **exclusive keypath flag** set on the field at storage-derivation time, or via the lower-level free functions `non_negative_int_set_exclusive` / `bytestring_set_exclusive`.

This is a blunt instrument. Prefer `Balance` or `NNInt` deltas on hot paths. Reserve exclusive writes for operations that genuinely cannot tolerate concurrent access.
:::

If `Balance` covers your state model, you do not need its lower-level representation. Read [NNInt In Depth](/programming-model/nnint/) when you need signed changes, an explicit base, or the exact `set_add` commutativity rules. For runtime reservation details, continue to [How It Works: Execution Model](/how-it-works/execution-model/).
