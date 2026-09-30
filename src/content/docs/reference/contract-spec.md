---
title: Contract Spec
description: Canonical contract metadata, structured identities, methods, types, events, and exceptions.
---

Source baseline: CLI 0.19.0, SDK/spec-tool 0.41.1. For usage, see
[TypeScript Bindings](/tools/typescript-bindings/) and [Build a Counter](/tutorials/build-a-counter/).

## Where the Spec Lives

| Artifact | Purpose |
| --- | --- |
| `<crate>.spec.xdr` | Canonical contract API, consumed by standalone TypeScript codegen |
| `<crate>.spec.json` | Human-readable rendering for inspection; not the codegen input |
| `<crate>.rv32a` | Deployable RV32 artifact |
| Generation | SDK macros emit fragments; build canonicalizes, sorts, validates, and writes sidecars under `target/groundhog/` by default |

## Top-Level Structure

| JSON key | Contents |
| --- | --- |
| `format` | `gh_contract_spec_v1`, the inspection-rendering tag |
| `interfaces` | Exported interfaces, methods, and declared exceptions |
| `type_defs` | Reachable named type layouts |
| `events` | Declared event identities, signatures, topics, and payload fields |

## Structured Identity

| Identity field | Meaning |
| --- | --- |
| `crate` | Declaring crate in the JSON rendering (`crate_name` in the canonical type) |
| `major` | Compatibility major, such as `1`, `0.1`, or `0.0.2` |
| `module_path` | Module within that crate |
| `declared` | Declaration name |
| Used by | Named type references, type definitions, and event names |
| TypeScript projection | Crate, compatibility-major namespace, module path, then declaration; interface methods use interface name and major |

The compatibility major is the leftmost non-zero SemVer component. Use canonical
IDs and generated descriptors; short declaration names are not globally unique.

## Interfaces

| Field | Meaning |
| --- | --- |
| `name` | Interface name from the trait, inherent self type, or explicit override |
| `version` | Full interface version |
| `throws` | Declared exception selectors and types |
| `methods` | Exported methods in canonical order |
| Method `name` | ABI name |
| Method `args` | Ordered fields with `name` and `type` |
| Method `return_type` | Contract type of the result |
| Entrypoint ID | Derived by tooling from interface/version/signature; not an additional JSON field |
| Effect metadata | The spec does not provide an authoritative read-only/initializer capability flag |

## Type Encoding

| `kind` | Other JSON fields | Meaning |
| --- | --- | --- |
| `void`, `bool`, `u8` | None | Unit, boolean, or byte |
| `u32`, `i32`, `u64`, `i64`, `u128`, `i128`, `u256`, `i256` | None | Corresponding integer |
| `string`, `bytes`, `address` | None | String, variable bytes, or contract address |
| `option` | `inner` | Optional value |
| `vec` | `element`, `max_len` | Variable-length sequence |
| `array` | `element`, `len` | Fixed-length sequence |
| `tuple` | `items` | Ordered element types |
| `named` | `name` | Structured identity of a named type |
| `signed_token` | `preimage` | Payload type, or null when erased |

Contract arguments, results, and exception payloads use CXS. The spec sidecar
uses its canonical XDR encoding. JSON is the inspection projection, not either
binary encoding.

## Type Definitions

| Kind | Fields beyond structured `name` |
| --- | --- |
| `struct` | `fields`, each with name/type |
| `enum` | `variants`, each with name/value |
| `union` | `cases`, each with name, discriminant, and case_type |
| Union case `void` | No payload |
| Union case `tuple` | `items` |
| Union case `struct` | `fields` |

## Events

| Field | Meaning |
| --- | --- |
| `name` | Structured event identity |
| `signature` | 32-byte event signature rendered as hex; topic 0 for derived events |
| `topics` | User topic fields and their types |
| `fields` | CXS payload fields and their types |
| Limits | At most three topics including signature; 1,024 bytes for topics plus payload |
| Discovery | Events must be declared by the interface or explicitly exported through supported SDK metadata |

Use the generated signature rather than copying a literal from another contract.
See [Add Events](/tutorials/add-events-to-a-contract/) for emission, filtering, and restart.

## Errors

| Field or case | Meaning |
| --- | --- |
| Exception `selector` | Hex rendering of its 64-bit selector |
| Exception `type` | Payload type, potentially a structured named reference |
| Known selector | Generated decoder interprets the declared payload and rejects trailing bytes |
| Unknown selector | Client preserves selector and raw abort bytes |
| Runtime fault | May have no contract exception payload; do not infer a child ABI from root failure bytes |

## Related Documentation

- [SDK Macros](/reference/sdk-macros/)
- [TypeScript Bindings](/tools/typescript-bindings/)
- [XDR Protocol](/reference/xdr-protocol/)
