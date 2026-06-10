# Contract Spec Documentation — Design

**Date:** 2026-06-10
**Goal:** Document the contract spec (the ABI-like artifact produced by `groundhog build`) and how contract code — events, types, throws — surfaces into it.

## Background

The docs currently mention the spec only in passing (`tools/typescript-sdk.md` calls it "contract-spec.json" and feeds it to `groundhog codegen ts`). The spec's structure, the `emits(...)` parameter on `#[contract]`, `#[event_spec(export)]`, and the end-to-end events workflow are all undocumented. All facts below were verified against `sdk_rs`, `protocol-rs/groundhog-spec`, and `groundhog-rpc/crates/tools/cli` source.

## Verified facts (source of truth)

- `groundhog build` canonicalizes spec fragments emitted by the SDK macros into a `groundhogspecv0` WASM custom section and writes two sidecars next to the artifact: `<name>.spec.json` (human-readable, **not** round-trippable, tagged `"format": "gh_contract_spec_v1"`) and `<name>.spec.xdr` (canonical XDR). Source: `groundhog-rpc/crates/tools/cli/src/contract_spec.rs:16-22, 192-271`; `sdk_rs/crates/spec-tool/src/lib.rs:286-298`.
- `groundhog build --bindings ts` generates TypeScript bindings directly during build (`build.rs:232-249`); `groundhog codegen ts` does the same from a spec file.
- JSON structure (`render_spec_json`, `spec-tool/src/lib.rs:608-650`):
  - Top level: `format`, `interfaces[]`, `type_defs[]`, `events[]`.
  - Interface: `name`, `version`, `throws[]` (`{selector: "0x%016x", type}`), `methods[]` (`{name, args[], return_type}`); args/fields are `{name, ty}`.
  - Type kinds: `void`, `bool`, `u8`, `u32`, `i32`, `u64`, `i64`, `u128`, `i128`, `string`, `bytes`, `address`, `option{inner}`, `vec{inner, max_len}`, `tuple{items}`, `named{name}`, `array{len, element}`.
  - Type defs: `struct{name, fields}`, `enum{name, variants[{name, value}]}`, `union{name, cases[{name, discriminant, case_type}]}` — data-carrying Rust enums become unions; case_type is `void`, `tuple`, or `struct`.
  - Event: `{name, signature (64-char hex), topics[], fields[]}`.
- Events enter the spec via `emits(EventA, EventB)` on `#[contract]` — allowed on trait definitions and inherent impls, **compile error on trait impls** (`macros/src/contract.rs:165-169`). Alternatively `#[derive(Event)]` + `#[event_spec(export)]` forces the event into the spec of any contract linking it (example: `sdk_rs/example-contracts/spec_named_types/src/implementation.rs`).
- Event signature (topic 0) = `sha256(MAJOR_VERSION :: crate_name :: TypeName)` (`contract-util/src/lib.rs:155-175`). Exception selectors = first 8 bytes of the same hash construction (`:130-153`).
- `#[contract_type]` enum variants require explicit discriminants; generics rejected.

## Deliverables

### 1. New page: `src/content/docs/reference/contract-spec.md`

The detailed spec reference. Sections:

1. **What the spec is** — canonical machine-readable interface description; embedded in the WASM (`groundhogspecv0` custom section) and written as `.spec.json` / `.spec.xdr` sidecars by `groundhog build`. Consumers: `groundhog codegen ts`, `groundhog call`, indexers. Note `.spec.json` is for inspection/debugging; `.spec.xdr` is the canonical form.
2. **Top-level structure** — annotated example `.spec.json` for a small token-like contract showing all three arrays.
3. **Interfaces** — name/version, methods, args/return types; note entrypoint IDs are derived (sha256 of `MAJOR_VERSION::interface::method`, truncated to 8 bytes), not stored in the spec.
4. **Type encoding** — table of every `kind` value with the Rust type it corresponds to; JSON snippets for the composite kinds.
5. **Type definitions** — struct/enum/union JSON, with the Rust→spec mapping (fieldless enum → `enum`, data-carrying enum → `union`).
6. **Events** — signature computation, topics vs. fields, max-topics rule (topic 0 reserved for signature).
7. **Errors (`throws`)** — selector computation and JSON shape.
8. **How code surfaces into the spec** — table mapping each macro/attribute (`#[contract]` methods, `throws`, `emits`, `#[contract_type]`, `#[contract_exception]`, `#[event_spec(export)]`) to the spec section it populates.

Sidebar: Reference group, after `reference/sdk-macros` in `astro.config.mjs`.

### 2. Update: `src/content/docs/tools/typescript-sdk.md`

- Fix the spec filename (`<artifact>.spec.json`, written next to the WASM — not `contract-spec.json`).
- Document `groundhog build --bindings ts` as the one-step alternative.
- Link to the new contract-spec reference for the format.
- Fix the stale source pointer `groundhog-rpc/crates/cli/src/codegen.rs` → `groundhog-rpc/crates/tools/cli/src/codegen.rs`.

### 3. Update: `src/content/docs/reference/sdk-macros.md`

- `#[contract]`: add `emits` row to the parameters table; add an "emits rules" subsection (trait definition or inherent impl, never trait impl; events listed land in the spec's `events` array).
- `#[derive(Event)]`: document `#[event_spec(export)]`; state the signature formula; note the spec JSON representation; link to contract-spec page.
- `#[contract_type]`: add "in the spec" note (struct/enum/union mapping, explicit discriminants required, no generics).
- `#[contract_exception]`: note that thrown types appear in the interface's `throws` with the computed selector.

### 4. New tutorial: `src/content/docs/tutorials/add-events-to-a-contract.md`

Extends the counter contract from Build a Counter (user-confirmed scope):

1. Define `CounterIncremented` with `#[derive(Event)]` and a `#[topic]` field.
2. Declare it with `emits(CounterIncremented)` on the `#[contract]` impl.
3. Emit with `log_event(&event)` inside `increment`.
4. Assert on the event in a test.
5. `groundhog build`, then read the `events` entry in the `.spec.json` sidecar.
6. Query the deployed contract's events via `groundhog_getEvents` and match `signature`/topics.

Sidebar: Tutorials group, after `tutorials/build-a-token` (before `build-a-swap`).

## Non-goals

- No changes to `build-a-counter.md` / `build-a-token.md` beyond (optionally) a "next steps" link to the new tutorial.
- No documentation of the RV32/ELF spec path or spec-tool internals — WASM flow only, matching the rest of the site.
- No XDR schema listing for `.spec.xdr` (the existing `reference/xdr-protocol.md` owns XDR-level docs).

## Risks / accuracy guardrails

- Every JSON snippet in the new reference must match `render_spec_json` output field-for-field; where practical, derive the example spec from a real built contract rather than writing it by hand.
- Tutorial code must compile against the current SDK (`log_event` name, `emits` placement). Verify against `sdk_rs/example-contracts/` patterns; build the tutorial contract if a scratch workspace is feasible.
