---
title: SDK Macros
description: "Reference for #[contract], #[contract_exception], #[contract_type], #[storage], #[derive(Event)], #[derive(ContractTypeSpec)], and other SDK macros."
---

## `#[contract]`

Generates WASM entrypoints, a client struct for cross-contract calls, and a client error enum.

### Applies to

| Target | What it generates |
|--------|-------------------|
| Trait definition | Client struct, client error enum, entrypoints metadata |
| Trait impl | Export functions, mock registration (dev builds) |
| Inherent impl | Export functions, client struct, client error enum |
| Free function | Export function only (no client) |

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `throws` | Type path or list | None | Error type(s) the contract may throw. Accepts `throws = MyError` or `throws(ErrorA, ErrorB)`. |
| `emits` | Type path list | None | Event type(s) the interface declares. Accepts `emits(EventA, EventB)`. Declared events are recorded in the [contract spec](/reference/contract-spec/#events). |
| `client` | Identifier | `{Interface}Client` | Name of the generated client struct. On traits, defaults to trait name + `Client`. On inherent impls, defaults to self type + `Client`. |
| `interface` | String | Trait name or self type name | Overrides the interface name used in entrypoint identifiers. |
| `version` | String | `CARGO_PKG_VERSION` | Version used for entrypoint identifier computation. |
| `storage` | Bool | `true` | When `true`, contract state is loaded from storage before method calls. Set to `false` for stateless contracts. |
| `exports` | String | Auto-generated | Overrides the internal exports module name. Rarely needed. |

### `throws` rules

- `throws` belongs on the trait definition or inherent impl, not on the trait impl. The compiler rejects `throws` on a trait impl.
- Accepts a single type (`throws = MyError`) or a list (`throws(AlphaError, BetaError)`).
- The last path segment becomes the variant name in the generated error enum. `throws(errors::MyError)` produces `ClientError::MyError(...)`.
- Duplicate variant names (e.g. `foo::Error` and `bar::Error`) are rejected at compile time.
- `Library`, `Fault`, and `Unknown` are reserved variant names.

### `emits` rules

- `emits` belongs on the trait definition or inherent impl, not on the trait impl. Like `throws`, events are part of the interface, and the compiler rejects `emits` on a trait impl.
- Each listed type must derive [`Event`](#deriveevent).
- Declaring an event records its name, signature, topics, and payload layout in the [contract spec](/reference/contract-spec/#events), which is what lets codegen, indexers, and explorers decode it. Emitting an undeclared event is not a runtime error, but the event won't appear in the spec unless its type is marked `#[event_spec(export)]`.

### Generated client

The generated client struct provides:

| Method | Description |
|--------|-------------|
| `ClientName::new(&ContractAddress)` | Constructor. |
| `client.with_gas_limit(u64)` | Returns a new client with the specified gas limit. |
| `client.method(args...)` | Calls the contract method. Re-throws on exception. |
| `client.try_method(args...)` | Calls the contract method. Returns `Result<T, ClientError>` so exceptions can be inspected. |

The names `new`, `with_gas_limit`, and any name starting with `try_` are reserved. Contract methods using these names are rejected at compile time.

### Generated error enum

When `throws` is specified, the macro generates a `{Client}Error` enum:

```rust
pub enum CounterClientError {
    MyError(MyError),       // one variant per thrown type
    Library(LibraryExn),    // SDK-internal errors
    Fault(FaultString),     // panics and host faults
    Unknown(RawException),  // unrecognized exception selectors
    BadDecode(RawException) // recognized selector, payload decode failed
}
```

### Examples

Trait definition with client and error:

```rust
#[contract(client = ERC20Client, throws = ERC20Error)]
pub trait ERC20 {
    fn transfer(&mut self, receiver: &ContractAddress, amount: Amount);
    fn get_balance(&self) -> Amount;
}
```

Trait implementation (exports entrypoints):

```rust
#[contract(version = "0.1.0")]
impl ERC20 for TokenContract {
    fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
        // ...
    }

    fn get_balance(&self) -> Amount {
        // ...
    }
}
```

Inherent impl (self-contained contract):

```rust
#[contract(throws = Error)]
impl Counter {
    pub fn increment(&mut self, amount: u64) {
        self.value.strict_inc(amount as i128);
    }

    pub fn get(&self) -> u64 {
        self.value.try_get().unwrap_or(0) as u64
    }
}
```

Multiple error types:

```rust
#[contract(client = Client, throws(MyExn, BigExn))]
pub trait Interface {
    fn hello();
    fn throws_my_exn() -> u32;
}
```

### Method behavior

- `&mut self` methods: state is loaded from storage before the call and written back on success. Exceptions and faults revert the frame.
- `&self` methods: state is loaded read-only. Nothing is written back.
- Public methods on inherent impls are exported. Private methods are not.
- On trait impls, all trait methods are exported regardless of visibility.

---

## `#[contract_exception]`

Convenience macro for defining contract error types. Applies `#[repr(i32)]` (enums only), derives serialization traits, and implements `Exn` with a computed selector.

### Applies to

Enums and structs.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `version` | String | `CARGO_PKG_VERSION` | Overrides the version used for selector computation. |

### What it generates

For an enum:

```rust
// Input
#[contract_exception]
pub enum Error {
    NotAuthorized = 1,
}

// Generates equivalent of:
#[derive(Debug, Clone, PartialEq, ReadXDR, WriteXDR)]
#[repr(i32)]
pub enum Error {
    NotAuthorized = 1,
}

impl Exn for Error {
    const SELECTOR: u64 = /* computed from crate name, version, type name */;
}
```

For a struct:

```rust
// Input
#[contract_exception]
pub struct MyExn;

// Generates equivalent of:
#[derive(Debug, Clone, PartialEq, ReadXDR, WriteXDR)]
pub struct MyExn;

impl Exn for MyExn {
    const SELECTOR: u64 = /* computed */;
}
```

### Selector computation

The selector is the first 8 bytes of `sha256(MAJOR_VERSION :: CRATE_NAME :: TYPE_NAME)`, where:

1. `MAJOR_VERSION` is the leftmost non-zero component of the crate version (or the `version` parameter): `1.2.3` → `1`, `0.9.2` → `0.9`, `0.0.2` → `0.0.2`
2. `CRATE_NAME` is the crate name (`CARGO_PKG_NAME`)
3. `TYPE_NAME` is the type name

SemVer-compatible releases keep the same selector; a breaking version bump changes it, which makes error types from incompatible contract versions distinguishable. Error types named in `throws` are recorded with their selectors in the [contract spec](/reference/contract-spec/#errors).

### Example

```rust
#[contract_exception]
#[non_exhaustive]
pub enum ERC20Error {
    AlreadyInitialized = 1,
    MustBeContractOwner = 2,
    TooLarge = 3,
    Internal = 100,
}
```

Struct errors carry data:

```rust
#[contract_exception]
pub struct BigExn {
    pub payload: [u8; 600],
}
```

---

## `#[exn]`

Low-level version of `#[contract_exception]`. Implements `Exn` with a computed selector but does not add any derives. Use this when you handle your own `#[derive(...)]` and `#[repr(...)]`.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `version` | String | `CARGO_PKG_VERSION` | Overrides the version used for selector computation. |

### Example

```rust
#[derive(Debug, Clone, PartialEq, ReadXDR, WriteXDR)]
#[sdk::exn]
#[repr(i32)]
pub enum ERC20Error {
    AlreadyInitialized = 1,
    MustBeContractOwner = 2,
}
```

---

## `#[storage]` / `#[derive(Storage)]`

Marks a struct as contract state. `#[storage]` is shorthand for `#[derive(Storage)]`.

### Applies to

Structs with named fields, or unit structs.

### What it generates

A `From<Keypath>` implementation that assigns a sub-keypath to each field. This is what allows the `#[contract]` macro to load and store your state automatically.

All fields must be SDK storage types. Plain data must be wrapped in `Value<T>`.

### Storage types

| Type | Description |
|------|-------------|
| `Value<T>` | Single XDR-serializable value |
| `NNInt` | Integer storage with commutative arithmetic and a commit-time floor |
| `Bytestring` | Variable-length byte blob |
| `Map<K, V>` | Key-addressed collection (entries not enumerable) |
| `Vector<T>` | Indexed collection backed by `Map<u32, T>` plus a length counter |
| `RCQ<T>` | Retrocausal queue (insert-commutes; consume is sequential) |
| `Node<T>` | Nested storage struct for use inside collections |

### Example

```rust
use sdk::storage::{Map, NNInt, Value};

#[derive(Debug)]
#[sdk::storage]
pub struct TokenContract {
    contract_owner: Value<ContractAddress>,
    balances: Map<ContractAddress, NNInt>,
    allowances: Map<ContractAddress, Map<ContractAddress, NNInt>>,
    total_supply: NNInt,
}
```

---

## `#[derive(Deletable)]`

Generates a `Deletable` implementation that calls `delete_internal()` on every field. Provides `delete()` and `delete_exclusive()` methods for clearing stored data.

### Applies to

Structs with named fields, or unit structs. Every field type must implement `Deletable`. If a field's type is not `Deletable` (e.g. `Map`), the derive produces a compile error.

### Example

```rust
#[sdk::storage]
#[derive(Deletable)]
struct Counters {
    a: NNInt,
    b: Value<u64>,
}
// Counters::delete() will delete both `a` and `b`.
```

---

## `#[derive(Event)]`

Generates an `Event` implementation for emitting on-chain events.

### Applies to

Structs with named fields.

### Field attributes

| Attribute | Description |
|-----------|-------------|
| `#[topic]` | Marks a field as an indexed topic. Topics are searchable. Fields without `#[topic]` go into the serialized payload. |

Events support at most 3 topics. Topic 0 is always the event signature (see below), so up to 2 fields can be marked `#[topic]`. Topic values that are already 32 bytes wide (`ContractAddress`, `[u8; 32]`) are used directly; other types are XDR-encoded and SHA-256 hashed, which makes them filterable but not recoverable from the event — data you need to read back belongs in the payload.

### Container attributes

| Attribute | Description |
|-----------|-------------|
| `#[event_spec(export)]` | Forces the event into the contract spec of any contract that links this type, even when no interface declares it via `emits(...)`. Useful for events emitted by library code. |

### What it generates

| Item | Description |
|------|-------------|
| `SIGNATURE` const | A `&'static Topic` containing the event's computed signature bytes. |
| `Event` impl | Provides `num_topics()`, `topic(index)`, and `decode_payload()`. |
| `WriteXDR` impl | Serializes only the non-topic (payload) fields. |
| `{Name}Payload` struct | A companion struct with `ReadXDR` for decoding the payload from raw event data. |

### Example

```rust
#[derive(Event, Clone, Debug)]
pub struct TransferEvent<'a> {
    #[topic]
    pub from: &'a ContractAddress,
    #[topic]
    pub to: &'a ContractAddress,
    pub amount: u128,
}
```

Emitting:

```rust
let event = TransferEvent { from: &sender, to: &receiver, amount: 100 };
log_event(&event);
```

Decoding from raw event data:

```rust
if sig == TransferEvent::SIGNATURE {
    let from: &ContractAddress = event.topic(1).unwrap().into();
    let to: &ContractAddress = event.topic(2).unwrap().into();
    let payload: TransferEventPayload = TransferEvent::decode_payload(event.payload())?;
}
```

### Signature and the spec

The signature is the full 32-byte `sha256(MAJOR_VERSION :: CRATE_NAME :: TYPE_NAME)`, where `CRATE_NAME` is the crate defining the event type and `MAJOR_VERSION` is its major version (leftmost non-zero component: `1.2.3` → `1`, `0.9.2` → `0.9`). Every emitted instance carries the signature as topic 0, and clients filter [`groundhog_getEvents`](/reference/json-rpc-api/#groundhog_getevents) on it to find instances of the event.

Deriving `Event` alone does not put an event in the contract spec. An event appears in the [contract spec](/reference/contract-spec/#events) — name, signature, topic layout, and payload layout — only when it is declared via `emits(...)` on `#[contract]`, or when the type is marked `#[event_spec(export)]` (the counterpart of `#[contract_type(export)]` for types).

---

## Utility Macros

### `static_key!`

Computes a `StorageKey` from a string literal at compile time (SHA-256 hash).

```rust
let key: StorageKey = static_key!("my_storage_slot");
```

### `sha256_static!`

Computes a `SHA256Hash` from a string literal at compile time.

```rust
let hash: SHA256Hash = sha256_static!("some_string");
```

### `sha256_ident!`

Computes a SHA-256 hash from a Rust identifier (rather than a string literal) at compile time. Useful when the input is a type name or other identifier that should not appear as a quoted string.

```rust
let hash: SHA256Hash = sha256_ident!(MyType);
```

### `sha256_array_ident!`

Same as `sha256_ident!` but returns a `[u8; 32]` array instead of a `SHA256Hash`.

```rust
let bytes: [u8; 32] = sha256_array_ident!(MyType);
```

### `hash_to_array!`

Computes the SHA-256 hash of a string or byte-string literal and returns it as a `[u8; 32]` array at compile time.

```rust
let bytes: [u8; 32] = hash_to_array!("my_data");
let bytes: [u8; 32] = hash_to_array!(b"raw bytes");
```

### `declare_mock_contract!`

Registers the current crate as a mock contract for the test environment. Place this at crate root. Only active when the `dev` feature is enabled.

```rust
sdk::declare_mock_contract!();
```

---

## `#[contract_type]`

Annotates a user-defined struct or enum so that the SDK knows how to serialize, deserialize, and describe it across contract boundaries. Required for any type used as an argument, return value, or storage value where the SDK needs a typed schema.

The deprecated spelling `#[contracttype]` is still accepted but should not be used in new code.

### Applies to

Structs (named or unit) and enums.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `export` | Bool | `false` | When `true` (`#[contract_type(export)]`), forces the type into the contract spec even when nothing references it. |

### What it generates

| Item | Description |
|------|-------------|
| Serialization derives | `ReadXDR`, `WriteXDR` |
| `ContractTypeSpec` impl | Describes the layout to introspection tooling (used by codegen and JSON-RPC). |

### Example

```rust
use sdk::*;

#[contract_type]
pub struct Config {
    pub administrator: ContractAddress,
    pub paused: bool,
}

#[contract_type]
pub enum Status {
    Active,
    Closed { reason: u32 },
}
```

### In the spec

Each `#[contract_type]` produces a `type_defs` entry in the [contract spec](/reference/contract-spec/#type-definitions) when it is reachable from a contract interface (used in a method signature, thrown error, declared event, or another reachable type):

- Structs become `struct` definitions.
- Enums whose variants carry no data become `enum` definitions.
- Enums with data-carrying variants become `union` definitions.

Enum variants must have explicit discriminants (`Active = 1`), and generic type parameters are not supported.

A type that nothing references can be forced into the spec with `#[contract_type(export)]` — the counterpart of `#[event_spec(export)]` for events. Use it for types that off-chain tools need to decode but that don't appear in any interface signature.

---

## `#[derive(ContractTypeSpec)]`

Low-level derive that only adds the `ContractTypeSpec` impl, without any serialization derives. Use this when you already provide your own `ReadXDR` / `WriteXDR` implementations.

### Applies to

Structs and enums.

### Container attributes

| Attribute | Description |
|-----------|-------------|
| `#[contract_type_spec(export)]` | Forces the type into the contract spec even when nothing references it. This is what `#[contract_type(export)]` expands to. |

### Example

```rust
#[derive(Debug, ReadXDR, WriteXDR, ContractTypeSpec)]
pub struct MyType {
    pub field: u64,
}
```
