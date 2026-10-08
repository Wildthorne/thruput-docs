---
title: SDK Macros
description: Macro targets, parameters, generated APIs, and constraints for the Rust SDK.
---

| Task | Guide |
| --- | --- |
| Define state and methods | [Methods and interfaces](/contracts/methods/) |
| Choose storage | [Storage types](/programming-model/storage-types/) |
| Declare and handle failures | [Handle errors](/contracts/errors/) |
| Call another contract | [Cross-Contract Calls](/contracts/cross-contract-calls/) |
| Define, emit, and test events | [Events](/contracts/events/) |
| Register a test contract | [Testing](/programming-model/testing/) |
| Find complete generated APIs | [Rust API Docs](/tools/rust-api-docs/) |

## `#[contract]`

### Applies to

| Target | Generates |
| --- | --- |
| Trait definition | Client struct and interface metadata |
| Trait implementation | Export functions and mock registration |
| Inherent implementation | Export functions, client struct, and interface metadata |
| Free function | Export function, no client |

### Parameters

| Parameter | Default | Meaning |
| --- | --- | --- |
| `throws = Error` or `throws(ErrorA, ErrorB)` | None | Error types recorded in the spec; does not restrict which exceptions callers can catch |
| `emits(EventA, EventB)` | None | Event types recorded in the spec |
| `client = ClientName` | `{Interface}Client` | Generated client name |
| `interface = "Name"` | Trait or self-type name | Interface identity used for entrypoints |
| `version = "0.1.0"` | `CARGO_PKG_VERSION` | Version used for entrypoint identity |
| `exports = "name"` | Generated | Internal exports module name |

### `throws` rules

| Constraint | Rule |
| --- | --- |
| Placement | Trait definition or inherent implementation; rejected on trait implementations |
| Duplicates | The same type cannot be listed twice; different paths with the same final name are allowed |
| Runtime | A known exception can be caught whether or not it is declared in `throws` |

### `emits` rules

| Constraint | Rule |
| --- | --- |
| Placement | Trait definition or inherent implementation; rejected on trait implementations |
| Type | Must implement `Event` |
| Spec | Records name, signature, topics, and payload layout |
| Undeclared event | May be emitted; use `#[event_spec(export)]` to include a library event without an interface declaration |

### Generated client

| Method | Behavior |
| --- | --- |
| `ClientName::new(&ContractAddress)` | Construct a client |
| `with_gas_limit(&self, u64) -> Self` | Return a configured copy with a child gas cap |
| `with_commit_locking(&self) -> Self` | Request commit locks before the child returns |
| `with_read_only(&self) -> Self` | Reject child state changes |
| `method(&self, ...) -> T` | Return the value or propagate failure |
| `try_method(&self, ...) -> Result<T, CallError>` | Return the value or an inspectable failure |
| Reserved names | `new`, `with_gas_limit`, `with_commit_locking`, `with_read_only`, and the `try_` prefix |

### Inspecting errors

| API | Purpose |
| --- | --- |
| `match_exn!` | Match typed exceptions; requires a final `_` arm |
| `try_as::<E>()` | Decode one known exception type; returns `None` for a different type or failed decoding |
| `try_decode::<E>()` | Distinguish unknown type from malformed payload |
| Usage | [Error matching examples](/contracts/cross-contract-calls/#matching-exceptions-with-match_exn) |

### Method behavior

| Method | Behavior |
| --- | --- |
| Public inherent method | Exported |
| Private inherent method | Internal helper |
| Trait implementation method | Exported |
| Storage receiver | Uses generated storage handles; see [Methods and interfaces](/contracts/methods/) |

## `#[contract_exception]`

| Property | Value |
| --- | --- |
| Targets | Structs and enums; no generics |
| Generated derives | `Debug`, `PartialEq`, `ReadXDR`, `WriteXDR`, `ContractTypeSpec` |
| Generated traits | `Exn` and `ContractTypeName` |
| Enum representation | Adds `#[repr(i32)]`; variants require explicit discriminants |
| `version = "0.1.0"` | Override `CARGO_PKG_VERSION` for identity |
| `name = "Name"` | Override the Rust type name for identity |
| `Clone` | Add the derive explicitly if needed |
| Examples | [Enum and struct errors](/contracts/errors/#defining-errors) |

### Selector computation

| Component | Rule |
| --- | --- |
| Selector | First 8 bytes of `sha256(MAJOR_VERSION :: CRATE_NAME :: TYPE_NAME)` |
| `MAJOR_VERSION` | Leftmost nonzero version component: `1.2.3` → `1`, `0.9.2` → `0.9`, `0.0.2` → `0.0.2` |
| `CRATE_NAME` | `CARGO_PKG_NAME` |
| `TYPE_NAME` | Type name or explicit `name` |
| Compatibility | Stable selector does not guarantee an older caller can decode every new payload; see [decoding errors](/contracts/cross-contract-calls/#telling-a-corrupt-error-from-an-unknown-one) |

## `#[exn]`

| Property | Value |
| --- | --- |
| Purpose | Low-level `Exn` implementation with computed selector |
| Derives and representation | Supplied by the author; prefer `#[contract_exception]` for normal contract errors |
| `version` | Optional selector-version override |

## `#[storage]` / `#[derive(Storage)]`

| Property | Value |
| --- | --- |
| Targets | Named-field structs and unit structs |
| Output | `From<Keypath>` implementation assigning each field a subpath |
| Fields | Storage handles; wrap plain data in `Value<T>` |
| Collections | Use `Node<T>` to place a compound storage struct inside `Map` or `Vector` |
| Usage | [Storage types](/programming-model/storage-types/) |

## `#[derive(Deletable)]`

| Property | Value |
| --- | --- |
| Targets | Named-field structs and unit structs |
| Requirement | Every field must implement `Deletable`; `Map` does not |
| Output | Calls each field's `delete_internal()`; exposes `delete()` and `delete_exclusive()` |

## `#[derive(Event)]`

| Property | Value |
| --- | --- |
| Target | Named-field struct |
| `#[topic]` | Mark an indexed field; at most two fields, in addition to the signature at topic 0 |
| Direct topics | `ContractAddress`, `SHA256Hash`, `[u8; 32]`, `U256`, `I256`, `u32`, `u64`, `u128`, `i32`, `i64`, `i128`, `bool` |
| Integer topics | Fixed 32-byte big-endian encoding with zero or sign extension |
| String and byte-slice topics | Hashed; filterable but not recoverable from the topic |
| Payload | Non-topic fields, serialized by the generated `WriteXDR` implementation |
| `#[event_spec(export)]` | Include the event in the linked contract spec without `emits(...)` |
| `SIGNATURE` | Full 32-byte hash of version, defining crate, and type identity |
| `Event` implementation | Topic access and payload decoding |
| `{Name}Payload` | Companion payload type with `ReadXDR` |
| Usage | [Event definitions, emission, and tests](/contracts/events/) |

## Utility Macros

| Macro | Output / usage |
| --- | --- |
| `static_key!("slot")` | Compile-time SHA-256 `StorageKey` |
| `sha256_static!("text")` | Compile-time `SHA256Hash` |
| `sha256_ident!(Name)` | `SHA256Hash` of an identifier |
| `hash_ident! { static NAME: SHA256Hash; }` | Named hash static; also supports `ContractAddress` and visibility |
| `sha256_array_ident!(Name)` | Identifier hash as `[u8; 32]` |
| `hash_to_array!("text")` | String or byte-string hash as `[u8; 32]` |
| `declare_mock_contract!()` | Crate-root mock registration when `dev` is enabled; see [test setup](/programming-model/testing/#test-setup) |

## `#[contract_type]`

| Property | Value |
| --- | --- |
| Targets | Named, tuple, or unit structs and enums |
| Output | Serialization derives and `ContractTypeSpec` |
| `name = "Name"` | Override spec type name |
| `export` | Include an otherwise unreachable type in the spec |
| Enum variants | Explicit discriminants required |
| Generic type parameters | Not supported |
| Spec inclusion | Types reachable through method signatures, errors, events, or other reachable types; otherwise requires `export` |
| Spec kind | Struct, enum without payloads, or union with payloads |
| Examples | [Argument and return types](/contracts/methods/#define-argument-and-return-types) |

## `#[derive(ContractTypeSpec)]`

| Property | Value |
| --- | --- |
| Targets | Structs and enums |
| Output | `ContractTypeSpec` only; serialization must be supplied separately |
| `#[contract_type_spec(export)]` | Include an otherwise unreachable type in the spec |
