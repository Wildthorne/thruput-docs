---
title: Contract Spec
description: "Reference for the Groundhog contract spec: the machine-readable interface description produced by `groundhog build`: methods, types, events, and errors."
---

Every Groundhog contract carries a **spec**: a machine-readable description of its interfaces, the types they use, the events they emit, and the errors they throw. The spec is Groundhog's equivalent of an EVM ABI. It is generated at compile time by the SDK macros and consumed by `groundhog codegen ts`, `groundhog call`, indexers, and any other tool that needs to encode calldata or decode results and events.

:::note[Version checked]
This page was source-checked against Groundhog CLI `0.6.3` and SDK `0.17.9` on August 5, 2026.
:::

## Where the Spec Lives

`groundhog build` produces the spec sidecars next to the built artifact:

| Artifact | Format | Purpose |
|----------|--------|---------|
| `<artifact>.spec.xdr` sidecar | XDR | Canonical, as a standalone file. Accepted by `groundhog codegen ts`. |
| `<artifact>.spec.json` sidecar | JSON | Human-readable rendering for inspection and debugging. Not designed to be parsed back. |
| `groundhogspecv0` custom section inside a `.wasm` | XDR | WASM-only. Lets legacy WASM tooling read the spec from the binary. |

For a contract crate named `counter`, the default RV32 build writes `target/groundhog/counter.rv32a`, `target/groundhog/counter.spec.json`, and `target/groundhog/counter.spec.xdr`.

Under the hood, the SDK macros embed raw spec fragments in the compiled binary. `groundhog build` collects the fragments, canonicalizes them (deduplication, sorting, validation), and writes the sidecars. WASM builds also get a finalized `groundhogspecv0` custom section in the `.wasm`.

## Top-Level Structure

The JSON rendering has four top-level keys:

| Key | Contents |
|-----|----------|
| `format` | Version tag for the JSON rendering. Currently `gh_contract_spec_v1`. |
| `interfaces` | One entry per `#[contract]` interface the binary exports: its methods and declared error types. |
| `type_defs` | The layout of every named user type (struct, enum, union) reachable from an interface. |
| `events` | Every event the contract declares. |

The complete spec for the counter contract from [Build a Counter](/tutorials/build-a-counter/), built as crate `counter` at version `0.1.0` (the `version` and `selector` values below depend on the crate's name and version):

```json
{
  "format": "gh_contract_spec_v1",
  "interfaces": [
    {
      "name": "Counter",
      "version": "0.1.0",
      "throws": [
        {
          "selector": "0x7a90653c020cb9ec",
          "type": { "kind": "named", "name": "Error" }
        }
      ],
      "methods": [
        {
          "name": "decrement",
          "args": [{ "name": "amount", "ty": { "kind": "u64" } }],
          "return_type": { "kind": "void" }
        },
        {
          "name": "get",
          "args": [],
          "return_type": { "kind": "u64" }
        },
        {
          "name": "increment",
          "args": [{ "name": "amount", "ty": { "kind": "u64" } }],
          "return_type": { "kind": "void" }
        },
        {
          "name": "initialize",
          "args": [{ "name": "initial_value", "ty": { "kind": "u64" } }],
          "return_type": { "kind": "void" }
        }
      ]
    }
  ],
  "type_defs": [
    {
      "kind": "enum",
      "name": "Error",
      "variants": [{ "name": "NotAuthorized", "value": 1 }]
    }
  ],
  "events": []
}
```

## Interfaces

Each interface entry corresponds to one `#[contract]` trait or inherent impl:

| Field | Description |
|-------|-------------|
| `name` | The interface name: the trait name, the self type name, or the `interface = "..."` override. |
| `version` | The full `MAJOR.MINOR.PATCH` version (the crate version, or the `version = "..."` override). |
| `throws` | Error types any method of this interface may throw, with their selectors. See [Errors](#errors). |
| `methods` | The exported methods, sorted by name. |

Each method lists its `name`, `args` (each `{ "name", "ty" }`), and `return_type`.

Entrypoint IDs are **not** stored in the spec. Clients derive them deterministically from the interface name, the major version, and the normalized method signature. See [Contracts](/how-it-works/contracts/) for how entrypoint IDs are encoded into wasm export names.

:::note[What "major version" means]
Selectors, event signatures, and entrypoint IDs all hash the interface or crate's *major version*, defined as the leftmost non-zero version component (mirroring Cargo's SemVer-compatibility rule): `1.2.3` → `1`, `0.9.2` → `0.9`, `0.0.2` → `0.0.2`. SemVer-compatible releases therefore keep the same identifiers; a breaking version bump changes all of them.
:::

## Type Encoding

Every type that appears in a method signature, type definition, or event is an object with a `kind` tag.

Primitive kinds:

| `kind` | Rust type |
|--------|-----------|
| `void` | `()` |
| `bool` | `bool` |
| `u8` | `u8` (only valid inside `vec` or `array`) |
| `u32`, `i32`, `u64`, `i64`, `u128`, `i128` | the corresponding integer |
| `string` | `String` |
| `bytes` | variable-length byte string |
| `address` | `ContractAddress` |

Composite kinds:

```json
{ "kind": "option", "inner": { "kind": "u64" } }
{ "kind": "vec", "element": { "kind": "address" }, "max_len": 4294967295 }
{ "kind": "array", "len": 32, "element": { "kind": "u8" } }
{ "kind": "tuple", "items": [{ "kind": "u32" }, { "kind": "bool" }] }
{ "kind": "named", "name": "Payload" }
{ "kind": "signed_token", "preimage": { "kind": "named", "name": "Payload" } }
```

These correspond to `Option<u64>`, `Vec<ContractAddress>`, `[u8; 32]`, `(u32, bool)`, a user-defined type named `Payload`, and `Signed<Payload>`. A `named` reference points at an entry in `type_defs` by name. The nested-type key differs by kind: `inner` for `option`, `element` for `vec` and `array`, `items` for `tuple`, and `preimage` for `signed_token`. `preimage` is `null` for `Signed<Opaque>`. `max_len` is the vector's declared bound (`4294967295`, i.e. `u32::MAX`, when unbounded).

## Type Definitions

`type_defs` carries the layout of every named type, generated from [`#[contract_type]`](/reference/sdk-macros/#contract_type) (or the lower-level `#[derive(ContractTypeSpec)]`). There are three kinds.

**Structs:**

```rust
#[contract_type]
pub struct Payload {
    pub count: u32,
}
```

```json
{
  "kind": "struct",
  "name": "Payload",
  "fields": [{ "name": "count", "ty": { "kind": "u32" } }]
}
```

**Enums**: Rust enums whose variants carry no data:

```rust
#[contract_type]
pub enum Choice {
    Left = 1,
    Right = 2,
}
```

```json
{
  "kind": "enum",
  "name": "Choice",
  "variants": [
    { "name": "Left", "value": 1 },
    { "name": "Right", "value": 2 }
  ]
}
```

**Unions**: Rust enums where at least one variant carries data. Each case records its discriminant and payload shape (`void`, `tuple`, or `struct`):

```rust
#[contract_type]
pub enum Envelope {
    Empty = 0,
    Wrapped { payload: Payload } = 1,
    Pair(Payload, Choice) = 3,
}
```

```json
{
  "kind": "union",
  "name": "Envelope",
  "cases": [
    {
      "name": "Empty",
      "discriminant": 0,
      "case_type": { "kind": "void" }
    },
    {
      "name": "Wrapped",
      "discriminant": 1,
      "case_type": {
        "kind": "struct",
        "fields": [{ "name": "payload", "ty": { "kind": "named", "name": "Payload" } }]
      }
    },
    {
      "name": "Pair",
      "discriminant": 3,
      "case_type": {
        "kind": "tuple",
        "items": [
          { "kind": "named", "name": "Payload" },
          { "kind": "named", "name": "Choice" }
        ]
      }
    }
  ]
}
```

Only types reachable from an interface are included. This covers method arguments and returns, thrown error types, declared events, and fields of other reachable types. A `#[contract_type]` that nothing references does not appear in the spec, unless it is marked `#[contract_type(export)]`, which forces the type into the spec of any contract that links it.

## Events

Each entry in `events` describes one event the contract declares. Inclusion works the same way as for named types: deriving `Event` alone does not put an event in the spec. An event appears only when an interface declares it via `emits(...)` on `#[contract]`, or when the type is marked `#[event_spec(export)]`.

```json
{
  "name": "TransferEvent",
  "signature": "5ff62377bf52711e75461f4d8f9b4585f17d1c20f7e1eceb280194a7764bae5f",
  "topics": [
    { "name": "from", "ty": { "kind": "address" } },
    { "name": "to", "ty": { "kind": "address" } }
  ],
  "fields": [{ "name": "amount", "ty": { "kind": "u128" } }]
}
```

| Field | Description |
|-------|-------------|
| `name` | The Rust type name of the `#[derive(Event)]` struct. |
| `signature` | The 32-byte event signature, hex-encoded without a `0x` prefix. Every emitted instance carries it as topic 0. |
| `topics` | The `#[topic]` fields in declaration order. These occupy the topic slots after the signature (at most two). |
| `fields` | The remaining fields, XDR-serialized into the event's data payload. |

The signature is computed as:

```
signature = sha256(MAJOR_VERSION ++ "::" ++ CRATE_NAME ++ "::" ++ TYPE_NAME)
```

where `CRATE_NAME` is the crate that defines the event type and `MAJOR_VERSION` is its major version. For `TransferEvent` defined in `groundhog-erc20-if` version `0.1.7`: `sha256("0.1::groundhog-erc20-if::TransferEvent")` = `5ff62377…` above.

To find instances of an event on chain, query [`groundhog_getEvents`](/reference/json-rpc-api/#groundhog_getevents) with the contract's address and `topic0 = "0x" + signature` (filters always require a contract address).

Topic *values* that are not already 32 bytes wide (integers, strings) are XDR-encoded and SHA-256 hashed when emitted, so they can be filtered on but not recovered from the event. Data you need to read back belongs in `fields`.

## Errors

The `throws` array of an interface lists every error type its methods may throw:

```json
{
  "selector": "0xb19947acb2fa14ff",
  "type": { "kind": "named", "name": "ERC20Error" }
}
```

The selector is the first 8 bytes of the same hash construction used for event signatures:

```
selector = sha256(MAJOR_VERSION ++ "::" ++ CRATE_NAME ++ "::" ++ TYPE_NAME)[0..8]
```

Unlike event signatures, selectors are rendered with a `0x` prefix. When a contract throws, the exception payload is tagged with the selector. Clients use the spec to map a selector back to its named type and decode the payload; unrecognized selectors surface as `Unknown` in generated clients (see [SDK Macros](/reference/sdk-macros/#contract)).

## How Code Surfaces Into the Spec

| In your code | In the spec |
|--------------|-------------|
| [`#[contract]`](https://groundhog.dev/docs/sdk/latest/sdk/attr.contract.html) on a trait or inherent impl | An `interfaces` entry with one method per exported fn |
| `throws = E` / `throws(E1, E2)` on [`#[contract]`](https://groundhog.dev/docs/sdk/latest/sdk/attr.contract.html) | The interface's `throws` array |
| `emits(E1, E2)` on [`#[contract]`](https://groundhog.dev/docs/sdk/latest/sdk/attr.contract.html) | `events` entries |
| [`#[contract_exception]`](https://groundhog.dev/docs/sdk/latest/sdk/attr.contract_exception.html) type named in `throws` | A `type_defs` entry plus the `throws` selector |
| [`#[contract_type]`](https://groundhog.dev/docs/sdk/latest/sdk/attr.contract_type.html) struct or enum reachable from an interface | A `type_defs` entry |
| `#[contract_type(export)]` | A `type_defs` entry, even when nothing references the type |
| [`#[derive(Event)]`](https://groundhog.dev/docs/sdk/latest/sdk/derive.Event.html) + `#[event_spec(export)]` | An `events` entry, even with no `emits(...)` declaration |

See [SDK Macros](/reference/sdk-macros/) for the full macro reference and [Add Events to a Contract](/tutorials/add-events-to-a-contract/) for an end-to-end walkthrough.

## Consuming the Spec

- [`groundhog codegen ts`](/tools/typescript-bindings/) generates TypeScript bindings from a `.spec.xdr`. It can also read a legacy `.wasm` artifact with an embedded spec.
- `groundhog build --target wasm --bindings ts` generates TypeScript in one step for the WASM compatibility path. For RV32, build first and run `groundhog codegen ts target/groundhog/<name>.spec.xdr`.
- `groundhog call` uses local contract metadata when it can resolve it from the project or artifact.
- Indexers and explorers can read the `.spec.json` sidecar to label methods and decode events.

## Related Documentation

- [SDK Macros](/reference/sdk-macros/) for the macros that generate spec metadata
- [Add Events to a Contract](/tutorials/add-events-to-a-contract/) for the events workflow end to end
- [TypeScript Bindings](/tools/typescript-bindings/) for spec-driven codegen
- [JSON-RPC API](/reference/json-rpc-api/) for querying emitted events
- [Contracts](/how-it-works/contracts/) for entrypoint ID encoding and deployment
