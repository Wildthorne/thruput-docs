# Contract Spec Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document the contract spec (the ABI-like artifact produced by `groundhog build`) and how events, types, and errors surface into it — a new reference page, updates to two existing pages, a new tutorial, and a fix for stale test-API snippets.

**Architecture:** Pure documentation changes to the Astro/Starlight site at `/Users/geofframseyer/groundhog/developers-site`, grounded in verified SDK/CLI source. One validation task compiles the tutorial's Rust code against the real SDK before any docs are written. Work happens on branch `geoff/contract-spec-docs` (already created; design doc committed).

**Tech Stack:** Astro + Starlight (markdown in `src/content/docs/`, sidebar in `astro.config.mjs`, build via `pnpm build`). Rust validation against `/Users/geofframseyer/groundhog/sdk_rs`.

**Spec:** `docs/superpowers/specs/2026-06-10-contract-spec-docs-design.md`

---

## Verified facts (do not re-derive; cite these in content)

All verified against source on 2026-06-10:

- `groundhog build` writes `<artifact>.spec.json` and `<artifact>.spec.xdr` sidecars next to the wasm, and embeds the canonical spec in a `groundhogspecv0` wasm custom section (`groundhog-rpc/crates/tools/cli/src/contract_spec.rs:16-22,192-271`). Raw macro-emitted fragments live in a `groundhogspecrawv0` section pre-finalization.
- `groundhog codegen ts <source>` takes a **`.wasm` or `.spec.xdr`** path (NOT `.spec.json` — current docs are wrong). `groundhog build --bindings ts` writes `<artifact>.ts` next to the wasm. The CLI has a global `--json` output flag.
- `.spec.json` is a human-readable rendering, explicitly "not guaranteed to be parseable back" (`sdk_rs/crates/spec-tool/src/lib.rs:283-298`).
- JSON: top-level `format: "gh_contract_spec_v1"`, `interfaces[]` (`name`, `version`, `throws[]`, `methods[]`), `type_defs[]`, `events[]`. Methods sorted by name. Throws: `{"selector": "0x%016x", "type": ...}`. Events: `{"name", "signature" (64 hex chars, no 0x), "topics[]", "fields[]"}`. Fields: `{"name", "ty"}`.
- Type kinds: `void`, `bool`, `u8`, `u32`, `i32`, `u64`, `i64`, `u128`, `i128`, `string`, `bytes`, `address`, `option{inner}`, `vec{inner,max_len}`, `tuple{items}`, `named{name}`, `array{len,element}`. Type defs: `struct{name,fields}`, `enum{name,variants[{name,value}]}`, `union{name,cases[{name,discriminant,case_type}]}` with case_type `void`/`tuple`/`struct`.
- **Major version rule** (`sdk_rs/crates/contract-util/src/semver.rs:12-15`): leftmost non-zero component — `1.2.3` → `1`, `0.9.2` → `0.9`, `0.0.2` → `0.0.2`.
- Event signature = `sha256(MAJOR_VERSION ++ "::" ++ CRATE_NAME ++ "::" ++ TYPE_NAME)`, full 32 bytes. **Verified:** `sha256("0.1::groundhog-erc20-if::TransferEvent")` = `5ff62377bf52711e75461f4d8f9b4585f17d1c20f7e1eceb280194a7764bae5f` matches the built fixture.
- Exception selector = first 8 bytes of the same construction. **Verified:** `sha256("0.4::counter::Error")[0..8]` = `0x9a3b85912e16f01e` matches the built fixture.
- Entrypoint ID = `sha256(INTERFACE_NAME ++ MAJOR_VERSION ++ NORMALIZED_METHOD_SIGNATURE)[0..8]` (`contract-util/src/lib.rs:101-118`) — derived by clients, NOT stored in the spec.
- `emits(EventA, EventB)` on `#[contract]`: allowed on trait definitions and inherent impls; compile error on trait impls (`sdk_rs/crates/macros/src/contract.rs:165-169`).
- `#[event_spec(export)]` on a `#[derive(Event)]` struct forces the event into the spec of any linking contract (`sdk_rs/example-contracts/spec_named_types/src/implementation.rs:43-47`).
- Max 3 topics total: signature at index 0 + up to 2 `#[topic]` fields (`kMaxTopics = 3`, `protocol-rs/groundhog-xdr/src/event.rs:50`). 32-byte topic values (e.g. `&ContractAddress`) are used directly; other types are XDR-encoded then SHA-256 hashed (`sdk_rs/crates/sdk/src/event.rs:8-66`).
- `#[contract_type]` enums require explicit discriminants; generics rejected. Types appear in the spec only when reachable from an interface (anchoring).
- `contract_exec` was **deleted from the SDK** (sdk_rs PR #234 "Standardize tests on the fluent native-exec pattern; delete legacy wrapper API"). Current pattern: `env.transact(|tx| tx.call(&ContractAddress::named("test")).run(move || { ... })).assert_success()`. `TransactResult` exposes `.events()`, `.assert_event_count(n)`, `.assert_event::<E>(index, |typed| ...)`, `.assert_emitted::<E>(addr, predicate)` (`sdk_rs/crates/native-exec/src/transact_result.rs:121-178`).
- `TypedEvent<E>` gives `.topic(i) -> Option<&Topic>` and `.payload() -> &E::Payload` (the generated `{Name}Payload` companion). `&Topic` converts to `&ContractAddress` via `.into()`.
- `get_caller() -> ContractAddress` (`sdk_rs/crates/sdk/src/contract_op.rs:139`).
- Precomputed tutorial constants (crate `counter`, version 0.1.x):
  - event signature `sha256("0.1::counter::CounterIncremented")` = `66e9e0dfc1e9d3815c880cbd26ab9635ed58a7d544a989998a483797c45ea1a0`
  - error selector `sha256("0.1::counter::Error")[0..8]` = `0x7a90653c020cb9ec`
- `groundhog call` resolves methods against the spec embedded in the wasm (`cli/src/call.rs:22,407`).

---

### Task 1: Validate the tutorial's Rust code against the real SDK

The tutorial code must compile and its assertions must pass before we publish it. We temporarily add the tutorial's event code to the SDK's own counter example, run its tests, then revert. **Nothing in this task is committed (to either repo).**

**Files (all in `/Users/geofframseyer/groundhog/sdk_rs`, temporarily):**
- Modify: `example-contracts/counter/src/implementation.rs`
- Modify: `example-contracts/counter/src/lib.rs`
- Create: `example-contracts/counter/tests/event_test.rs`

- [ ] **Step 1: Confirm the sdk_rs counter example is clean**

Run: `git -C /Users/geofframseyer/groundhog/sdk_rs status --porcelain example-contracts/counter`
Expected: no output. If dirty, STOP and ask the user before touching it.

- [ ] **Step 2: Add the event to the example contract**

In `/Users/geofframseyer/groundhog/sdk_rs/example-contracts/counter/src/implementation.rs`, insert after the `Counter` struct definition (after the `pub struct Counter { value: NNInt }` block):

```rust
#[derive(Event, Clone, Debug)]
pub struct CounterIncremented<'a> {
    #[topic]
    pub by: &'a ContractAddress,
    pub amount: u64,
}
```

Change the attribute line `#[contract(throws = Error, client = CounterClient)]` to:

```rust
#[contract(throws = Error, client = CounterClient, emits(CounterIncremented))]
```

Change the `increment` method to:

```rust
    pub fn increment(&mut self, amount: u64) {
        self.value.strict_inc(amount as i128);
        let caller = get_caller();
        log_event(&CounterIncremented { by: &caller, amount });
    }
```

In `/Users/geofframseyer/groundhog/sdk_rs/example-contracts/counter/src/lib.rs`, add to the re-exports:

```rust
pub use implementation::CounterIncremented;
```

- [ ] **Step 3: Write the event test**

Create `/Users/geofframseyer/groundhog/sdk_rs/example-contracts/counter/tests/event_test.rs`:

```rust
use counter::{CounterClient, CounterIncremented};
use sdk::*;

static NONCE: SHA256Hash = sdk::sha256_static!("COUNTER_EVENT_NONCE");

#[test]
fn test_increment_emits_event() {
    let env = TestEnvironment::no_cost();
    let test_contract = counter::register_mock_contract(&env);
    let contract_hash = test_contract.as_hash().clone();

    let result = env.transact(|tx| {
        tx.call(&ContractAddress::named("test")).run(move || {
            let addr = deploy_contract(&NONCE, &contract_hash);
            let client = CounterClient::new(&addr);
            client.initialize(10);
            client.increment(5);
        })
    });
    result.assert_success();

    // initialize emits nothing; increment emits exactly one event
    result.assert_event_count(1);
    result.assert_event::<CounterIncremented>(0, |event| {
        assert_eq!(event.topic(0), Some(CounterIncremented::SIGNATURE));
        let by: &ContractAddress = event.topic(1).unwrap().into();
        assert_eq!(by, &ContractAddress::named("test"));
        assert_eq!(event.payload().amount, 5);
    });
}
```

- [ ] **Step 4: Run the tests**

Run: `cd /Users/geofframseyer/groundhog/sdk_rs/example-contracts && cargo test -p counter`
Expected: PASS, including `test_increment_emits_event` and all pre-existing counter tests.

If anything fails: fix the test/contract code, note exactly what differed (API name, import, assertion), and carry the corrected code forward into Task 7's tutorial content. The tutorial MUST contain code identical (modulo crate/module naming used by the site tutorials) to what passed here.

- [ ] **Step 5: Revert sdk_rs completely**

Run:
```bash
rm /Users/geofframseyer/groundhog/sdk_rs/example-contracts/counter/tests/event_test.rs
git -C /Users/geofframseyer/groundhog/sdk_rs checkout -- example-contracts/counter
git -C /Users/geofframseyer/groundhog/sdk_rs status --porcelain example-contracts/counter
```
Expected: final status command prints nothing.

---

### Task 2: Modernize stale `contract_exec` test snippets

**Scope note:** This task was added during planning. The SDK deleted `contract_exec` (PR #234); three docs pages still show it. The new tutorial uses the current fluent API, so these must be updated for site consistency. The user approved the plan containing this task.

**Files:**
- Modify: `src/content/docs/programming-model/testing.md:31-62`
- Modify: `src/content/docs/tutorials/build-a-counter.md:128-203`
- Modify: `src/content/docs/tutorials/build-a-token.md:333-360`

- [ ] **Step 1: Update `testing.md` basic pattern**

Replace the code block at lines 31-53 (the `test_counter` example) with:

```rust
use my_counter::{register_mock_contract, CounterClient};
use sdk::*;

static NONCE: SHA256Hash = sdk::sha256_static!("COUNTER_NONCE");

#[test]
fn test_counter() {
    let env = TestEnvironment::no_cost();
    let test_contract = register_mock_contract(&env);
    let contract_hash = test_contract.as_hash().clone();

    env.transact(|tx| {
        tx.call(&ContractAddress::named("test")).run(move || {
            let addr = deploy_contract(&NONCE, &contract_hash);
            let client = CounterClient::new(&addr);

            client.initialize(10);
            client.increment(5);
            assert_eq!(client.get(), 15);
        })
    })
    .assert_success();
}
```

Replace numbered item 4 (line 60), currently `4. **\`contract_exec\`** runs the closure in a simulated execution context.`, with:

```markdown
4. **`env.transact(...)`** runs the closure as a single auto-committed transaction. `tx.call(&ContractAddress::named("test"))` sets the address the transaction originates from, and `.run(closure)` executes the closure in a simulated execution context. The returned `TransactResult` records the outcome, return value, and emitted events; `.assert_success()` panics with details if the transaction did not commit.
```

- [ ] **Step 2: Update `build-a-counter.md` tests**

Replace the `test_counter_basic` code block (lines 128-158) with:

```rust
use counter::{register_mock_contract, CounterClient};
use sdk::*;

static NONCE: SHA256Hash = sdk::sha256_static!("COUNTER_NONCE");

#[test]
fn test_counter_basic() {
    let env = TestEnvironment::no_cost();
    let test_contract = register_mock_contract(&env);
    let contract_hash = test_contract.as_hash().clone();

    env.transact(|tx| {
        tx.call(&ContractAddress::named("test")).run(move || {
            let addr = deploy_contract(&NONCE, &contract_hash);
            let client = CounterClient::new(&addr);

            // Initialize with value 10
            client.initialize(10);
            assert_eq!(client.get(), 10);

            // Increment by 5
            client.increment(5);
            assert_eq!(client.get(), 15);

            // Decrement by 3
            client.decrement(3);
            assert_eq!(client.get(), 12);
        })
    })
    .assert_success();
}
```

Replace numbered item 4 in the "Breaking down the test setup" list (currently `4. **\`contract_exec\`** runs the closure in a simulated contract execution context.`) with:

```markdown
4. **`env.transact(...)`** runs the closure as a single auto-committed transaction. `tx.call(&ContractAddress::named("test"))` sets the address the transaction originates from; `.assert_success()` panics with details if the transaction did not commit. The returned `TransactResult` also records emitted events — see [Add Events to a Contract](/tutorials/add-events-to-a-contract/).
```

Replace the `test_counter_underflow` code block (lines 173-201) with:

```rust
use counter::{register_mock_contract, CounterClient, CounterClientError};

#[test]
fn test_counter_underflow() {
    let env = TestEnvironment::no_cost();
    let test_contract = register_mock_contract(&env);
    let contract_hash = test_contract.as_hash().clone();

    env.transact(|tx| {
        tx.call(&ContractAddress::named("test")).run(move || {
            let addr = deploy_contract(&NONCE, &contract_hash);
            let client = CounterClient::new(&addr);

            client.initialize(5);

            // Decrementing by 10 should abort: NNInt can't go negative
            match client.try_decrement(10) {
                Ok(_) => panic!("expected underflow"),
                Err(err) => assert!(
                    matches!(err, CounterClientError::Library(
                        LibraryExn::NonNegativeIntUnderflow
                    )),
                    "expected underflow, got: {err:?}"
                ),
            }
        })
    })
    .assert_success();
}
```

Leave the "Native vs WASM" section (lines 205-224) untouched — it illustrates crash behavior; the exact panic text shown there is illustrative either way.

- [ ] **Step 3: Update `build-a-token.md` test**

Replace the `test_transfer` code block (lines 333-360) with:

```rust
use erc20::{register_mock_contract, ERC20Client};
use sdk::*;

static NONCE: SHA256Hash = sdk::sha256_static!("ERC20_NONCE");

#[test]
fn test_transfer() {
    let env = TestEnvironment::no_cost();
    let test_contract = register_mock_contract(&env);
    let contract_hash = test_contract.as_hash().clone();

    env.transact(|tx| {
        tx.call(&ContractAddress::named("alice")).run(move || {
            let addr = deploy_contract(&NONCE, &contract_hash);
            let client = ERC20Client::new(&addr);
            let owner = get_caller();
            let receiver = ContractAddress::named("bob");

            client.initialize(&owner);
            client.mint(&owner, 1000);
            client.transfer(&receiver, 100);

            assert_eq!(client.get_balance_of(&owner), 900);
            assert_eq!(client.get_balance_of(&receiver), 100);
        })
    })
    .assert_success();
}
```

- [ ] **Step 4: Verify no `contract_exec` remains**

Run: `grep -rn "contract_exec" /Users/geofframseyer/groundhog/developers-site/src/content/docs/`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/content/docs/programming-model/testing.md src/content/docs/tutorials/build-a-counter.md src/content/docs/tutorials/build-a-token.md
git commit -m "update test snippets to the fluent transact API (contract_exec was removed in SDK #234)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Create the contract spec reference page

**Files:**
- Create: `src/content/docs/reference/contract-spec.md`

- [ ] **Step 1: Write the page**

Create `src/content/docs/reference/contract-spec.md` with exactly this content:

````markdown
---
title: Contract Spec
description: "Reference for the Groundhog contract spec: the machine-readable interface description produced by `groundhog build` — methods, types, events, and errors."
---

Every Groundhog contract carries a **spec**: a machine-readable description of its interfaces, the types they use, the events they emit, and the errors they throw. The spec is Groundhog's equivalent of an EVM ABI. It is generated at compile time by the SDK macros and consumed by `groundhog codegen ts`, `groundhog call`, indexers, and any other tool that needs to encode calldata or decode results and events.

## Where the Spec Lives

`groundhog build` produces the spec in three places:

| Artifact | Format | Purpose |
|----------|--------|---------|
| `groundhogspecv0` custom section inside the `.wasm` | XDR | Canonical. Travels with the binary, so tools can work from the wasm alone. |
| `<artifact>.spec.xdr` sidecar | XDR | Canonical, as a standalone file. Accepted by `groundhog codegen ts`. |
| `<artifact>.spec.json` sidecar | JSON | Human-readable rendering for inspection and debugging. Not designed to be parsed back. |

For a contract crate named `counter`, `groundhog build` writes `counter.spec.json` and `counter.spec.xdr` next to the compiled `counter.wasm`.

Under the hood, the SDK macros embed raw spec fragments in the compiled binary (a `groundhogspecrawv0` section). `groundhog build` collects the fragments, canonicalizes them (deduplication, sorting, validation), rewrites the wasm with the final `groundhogspecv0` section, and writes the sidecars.

## Top-Level Structure

The JSON rendering has four top-level keys:

| Key | Contents |
|-----|----------|
| `format` | Version tag for the JSON rendering. Currently `gh_contract_spec_v1`. |
| `interfaces` | One entry per `#[contract]` interface the binary exports: its methods and declared error types. |
| `type_defs` | The layout of every named user type (struct, enum, union) reachable from an interface. |
| `events` | Every event the contract declares. |

The complete spec for the counter contract from [Build a Counter](/tutorials/build-a-counter/):

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

Entrypoint IDs are **not** stored in the spec. Clients derive them deterministically from the interface name, the major version, and the normalized method signature. See [Contracts](/how-it-works/contracts/) for the entrypoint encoding.

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
| `bytes` | opaque byte string |
| `address` | `ContractAddress` |

Composite kinds:

```json
{ "kind": "option", "inner": { "kind": "u64" } }
{ "kind": "vec", "inner": { "kind": "address" }, "max_len": 4294967295 }
{ "kind": "array", "len": 32, "element": { "kind": "u8" } }
{ "kind": "tuple", "items": [{ "kind": "u32" }, { "kind": "bool" }] }
{ "kind": "named", "name": "Payload" }
```

These correspond to `Option<u64>`, `Vec<ContractAddress>`, `[u8; 32]`, `(u32, bool)`, and a user-defined type named `Payload`. A `named` reference points at an entry in `type_defs` by name.

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

**Enums** — Rust enums whose variants carry no data:

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

**Unions** — Rust enums where at least one variant carries data. Each case records its discriminant and payload shape (`void`, `tuple`, or `struct`):

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

Only types reachable from an interface — through method arguments and returns, thrown error types, declared events, or the fields of other reachable types — are included. A `#[contract_type]` that nothing references does not appear in the spec.

## Events

Each entry in `events` describes one event the contract declares:

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
| `topics` | The `#[topic]` fields in declaration order. These occupy topics 1 and 2 of the emitted event. |
| `fields` | The remaining fields, XDR-serialized into the event's data payload. |

The signature is computed as:

```
signature = sha256(MAJOR_VERSION ++ "::" ++ CRATE_NAME ++ "::" ++ TYPE_NAME)
```

where `CRATE_NAME` is the crate that defines the event type and `MAJOR_VERSION` is its major version. For `TransferEvent` defined in `groundhog-erc20-if` version `0.1.2`: `sha256("0.1::groundhog-erc20-if::TransferEvent")` = `5ff62377…` above.

To find instances of an event on chain, filter [`groundhog_getEvents`](/reference/json-rpc-api/#groundhog_getevents) on `topic0 = "0x" + signature`.

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

When a contract throws, the exception payload is tagged with the selector. Clients use the spec to map a selector back to its named type and decode the payload; unrecognized selectors surface as `Unknown` in generated clients (see [SDK Macros](/reference/sdk-macros/#contract)).

## How Code Surfaces Into the Spec

| In your code | In the spec |
|--------------|-------------|
| `#[contract]` on a trait or inherent impl | An `interfaces` entry with one method per exported fn |
| `throws = E` / `throws(E1, E2)` on `#[contract]` | The interface's `throws` array |
| `emits(E1, E2)` on `#[contract]` | `events` entries |
| `#[contract_exception]` type named in `throws` | A `type_defs` entry plus the `throws` selector |
| `#[contract_type]` struct or enum reachable from an interface | A `type_defs` entry |
| `#[derive(Event)]` + `#[event_spec(export)]` | An `events` entry, even with no `emits(...)` declaration |

See [SDK Macros](/reference/sdk-macros/) for the full macro reference and [Add Events to a Contract](/tutorials/add-events-to-a-contract/) for an end-to-end walkthrough.

## Consuming the Spec

- [`groundhog codegen ts`](/tools/typescript-sdk/) generates TypeScript bindings from a `.wasm` or `.spec.xdr`; `groundhog build --bindings ts` does the same in one step.
- `groundhog call` resolves method names against the spec embedded in a built artifact.
- Indexers and explorers can read the `.spec.json` sidecar or extract the spec from the deployed wasm to label methods and decode events.

## Related Documentation

- [SDK Macros](/reference/sdk-macros/) for the macros that generate spec metadata
- [Add Events to a Contract](/tutorials/add-events-to-a-contract/) for the events workflow end to end
- [TypeScript Bindings](/tools/typescript-sdk/) for spec-driven codegen
- [JSON-RPC API](/reference/json-rpc-api/) for querying emitted events
- [Contracts](/how-it-works/contracts/) for entrypoint ID encoding and deployment
````

- [ ] **Step 2: Commit**

```bash
git add src/content/docs/reference/contract-spec.md
git commit -m "add contract spec reference page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Add both new pages to the sidebar

**Files:**
- Modify: `astro.config.mjs:38` and `astro.config.mjs:70`

- [ ] **Step 1: Add the tutorial entry**

In `astro.config.mjs`, change:

```js
            'tutorials/build-a-token',
```

to:

```js
            'tutorials/build-a-token',
            'tutorials/add-events-to-a-contract',
```

- [ ] **Step 2: Add the reference entry**

Change:

```js
            'reference/sdk-macros',
```

to:

```js
            'reference/sdk-macros',
            'reference/contract-spec',
```

- [ ] **Step 3: No commit yet**

The site won't build until the tutorial page exists (Task 7). Leave `astro.config.mjs` staged-but-uncommitted, or commit it together with Task 7. (Starlight fails the build on sidebar entries pointing at missing pages — committing now would leave a broken-building commit.) Recommended: commit this file as part of Task 7's commit.

---

### Task 5: Update the TypeScript bindings page

**Files:**
- Modify: `src/content/docs/tools/typescript-sdk.md`

- [ ] **Step 1: Fix the Overview spec sentence**

Replace (line 12):

```markdown
The Groundhog CLI ships a `codegen` subcommand that emits a self-contained TypeScript file from a contract's spec. The generated module gives you:
```

with:

```markdown
The Groundhog CLI ships a `codegen` subcommand that emits a self-contained TypeScript file from a contract's [spec](/reference/contract-spec/). The generated module gives you:
```

- [ ] **Step 2: Fix the Generating Bindings section**

Replace (lines 22-30):

```markdown
After building your contract, run:

```bash
groundhog codegen ts ./path/to/contract-spec.json -o ./web/src/contracts/my-contract.ts
```

`./path/to/contract-spec.json` is the contract spec produced by `groundhog build` (the CLI writes the spec alongside the compiled wasm artifact). Pass `--output` to write the result to disk, or omit it to print to stdout (the JSON-machine-readable form is available via the `--json` flag).

See `groundhog codegen ts --help` for the full set of flags.
```

with:

```markdown
After building your contract, run:

```bash
groundhog codegen ts ./target/wasm32-unknown-unknown/release/my-contract.wasm -o ./web/src/contracts/my-contract.ts
```

The source is a built contract artifact: either the `.wasm` itself (the spec is embedded in it) or the `.spec.xdr` sidecar that `groundhog build` writes next to it. Pass `--output`/`-o` to write the result to disk, or omit it to print to stdout.

You can also generate the bindings as part of the build:

```bash
groundhog build --bindings ts
```

which writes `<artifact>.ts` next to the wasm.

`groundhog build` additionally writes a human-readable `<artifact>.spec.json` sidecar for inspecting the contract's interface; see [Contract Spec](/reference/contract-spec/) for the full format.

See `groundhog codegen ts --help` for the full set of flags.
```

- [ ] **Step 3: Fix the stale source path**

Replace (line 79):

```markdown
`u8` is intentionally rejected as a bare type: it must appear inside a `Vec` or `Array` so the generated TypeScript can use `Uint8Array`. See `groundhog-rpc/crates/cli/src/codegen.rs` for the full mapping.
```

with:

```markdown
`u8` is intentionally rejected as a bare type: it must appear inside a `Vec` or `Array` so the generated TypeScript can use `Uint8Array`. See `groundhog-rpc/crates/tools/cli/src/codegen.rs` for the full mapping.
```

- [ ] **Step 4: Add the reference link to Related Documentation**

Replace (lines 95-97):

```markdown
- [JSON-RPC API](/reference/json-rpc-api/) for the underlying gateway surface
- [Cross-Contract Calls](/reference/cross-contract-calls/) for the Rust client codegen story (parallel concept on the contract side)
- [Getting Started](/start/getting-started/) for the CLI workflow that produces the contract spec
```

with:

```markdown
- [Contract Spec](/reference/contract-spec/) for the format of the spec the codegen consumes
- [JSON-RPC API](/reference/json-rpc-api/) for the underlying gateway surface
- [Cross-Contract Calls](/reference/cross-contract-calls/) for the Rust client codegen story (parallel concept on the contract side)
- [Getting Started](/start/getting-started/) for the CLI workflow that produces the contract spec
```

- [ ] **Step 5: Commit**

```bash
git add src/content/docs/tools/typescript-sdk.md
git commit -m "correct codegen input format and document build --bindings ts and spec sidecars

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Update the SDK macros reference

**Files:**
- Modify: `src/content/docs/reference/sdk-macros.md`

- [ ] **Step 1: Add `emits` to the `#[contract]` parameters table**

After the `throws` row (line 23):

```markdown
| `throws` | Type path or list | None | Error type(s) the contract may throw. Accepts `throws = MyError` or `throws(ErrorA, ErrorB)`. |
```

insert:

```markdown
| `emits` | Type path list | None | Event type(s) the interface declares. Accepts `emits(EventA, EventB)`. Declared events are recorded in the [contract spec](/reference/contract-spec/#events). |
```

- [ ] **Step 2: Add the `emits` rules section**

After the `### \`throws\` rules` section (ends line 36 with the reserved-names bullet), insert:

```markdown
### `emits` rules

- `emits` belongs on the trait definition or inherent impl, not on the trait impl. Like `throws`, events are part of the interface, and the compiler rejects `emits` on a trait impl.
- Each listed type must derive [`Event`](#deriveevent).
- Declaring an event records its name, signature, topics, and payload layout in the [contract spec](/reference/contract-spec/#events), which is what lets codegen, indexers, and explorers decode it. Emitting an undeclared event is not a runtime error, but the event won't appear in the spec unless its type is marked `#[event_spec(export)]`.
```

- [ ] **Step 3: Make the exception selector computation precise**

In the `#[contract_exception]` section, replace (lines 179-186):

```markdown
### Selector computation

The selector is derived from:
1. The crate version (or `version` parameter)
2. The crate name (`CARGO_PKG_NAME`)
3. The type name

Changing any of these changes the selector, which makes error types from different contract versions distinguishable.
```

with:

```markdown
### Selector computation

The selector is the first 8 bytes of `sha256(MAJOR_VERSION :: CRATE_NAME :: TYPE_NAME)`, where:

1. `MAJOR_VERSION` is the leftmost non-zero component of the crate version (or the `version` parameter): `1.2.3` → `1`, `0.9.2` → `0.9`, `0.0.2` → `0.0.2`
2. `CRATE_NAME` is the crate name (`CARGO_PKG_NAME`)
3. `TYPE_NAME` is the type name

SemVer-compatible releases keep the same selector; a breaking version bump changes it, which makes error types from incompatible contract versions distinguishable. Error types named in `throws` are recorded with their selectors in the [contract spec](/reference/contract-spec/#errors).
```

- [ ] **Step 4: Tighten the `#[derive(Event)]` topics paragraph and add container attributes**

Replace (line 315):

```markdown
There is a maximum number of topics per event. Topic index 0 is always the event signature (computed automatically from crate name, version, and type name). User-defined `#[topic]` fields occupy the remaining slots.
```

with:

```markdown
Events support at most 3 topics. Topic 0 is always the event signature (see below), so up to 2 fields can be marked `#[topic]`. Topic values that are already 32 bytes wide (`ContractAddress`, `[u8; 32]`) are used directly; other types are XDR-encoded and SHA-256 hashed, which makes them filterable but not recoverable from the event — data you need to read back belongs in the payload.

### Container attributes

| Attribute | Description |
|-----------|-------------|
| `#[event_spec(export)]` | Forces the event into the contract spec of any contract that links this type, even when no interface declares it via `emits(...)`. Useful for events emitted by library code. |
```

- [ ] **Step 5: Add the signature/spec subsection to `#[derive(Event)]`**

After the "Decoding from raw event data" code block (ends line 354, before the `---` separator), insert:

```markdown
### Signature and the spec

The signature is the full 32-byte `sha256(MAJOR_VERSION :: CRATE_NAME :: TYPE_NAME)`, where `CRATE_NAME` is the crate defining the event type and `MAJOR_VERSION` is its major version (leftmost non-zero component: `1.2.3` → `1`, `0.9.2` → `0.9`). Every emitted instance carries the signature as topic 0, and clients filter [`groundhog_getEvents`](/reference/json-rpc-api/#groundhog_getevents) on it to find instances of the event.

An event appears in the [contract spec](/reference/contract-spec/#events) — name, signature, topic layout, and payload layout — when it is declared via `emits(...)` on `#[contract]`, or when the type is marked `#[event_spec(export)]`.
```

- [ ] **Step 6: Add the in-the-spec note to `#[contract_type]`**

At the end of the `#[contract_type]` section (after the example ending line 444, before the `---` separator), insert:

```markdown
### In the spec

Each `#[contract_type]` produces a `type_defs` entry in the [contract spec](/reference/contract-spec/#type-definitions) when it is reachable from a contract interface (used in a method signature, thrown error, declared event, or another reachable type):

- Structs become `struct` definitions.
- Enums whose variants carry no data become `enum` definitions.
- Enums with data-carrying variants become `union` definitions.

Enum variants must have explicit discriminants (`Active = 1`), and generic type parameters are not supported.
```

- [ ] **Step 7: Commit**

```bash
git add src/content/docs/reference/sdk-macros.md
git commit -m "document emits, event_spec(export), and spec surfacing in the macros reference

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Create the events tutorial

**Files:**
- Create: `src/content/docs/tutorials/add-events-to-a-contract.md`
- Commit alongside: `astro.config.mjs` (from Task 4)

**Important:** If Task 1's validation required code corrections, apply the same corrections here. The code below is what passed validation as of planning.

- [ ] **Step 1: Write the tutorial**

Create `src/content/docs/tutorials/add-events-to-a-contract.md` with exactly this content:

````markdown
---
title: Add Events to a Contract
description: "Tutorial: define an event, emit it from a Groundhog contract, test it, and find it in the contract spec and on chain."
---

We're extending the counter from [Build a Counter](/tutorials/build-a-counter/) with a `CounterIncremented` event: define the event type, declare it as part of the contract's interface, emit it, assert on it in a test, find it in the contract spec, and query it over JSON-RPC.

**Prerequisites:** A working counter contract from [Build a Counter](/tutorials/build-a-counter/).

## How Events Work on Groundhog

An event is up to three 32-byte **topics** plus an XDR-serialized **payload** (at most 1 KB in total). Topics are indexed: off-chain consumers filter on them via [`groundhog_getEvents`](/reference/json-rpc-api/#groundhog_getevents). The payload is not indexed; it carries the data you want to read back.

Topic 0 is always the event's **signature** — a hash that identifies the event type — so up to two topics are available for your own fields. There is no `indexed` keyword as in Solidity: you mark struct fields with `#[topic]`.

## Step 1: Define the Event

Add the event type to `src/implementation.rs`:

```rust
#[derive(Event, Clone, Debug)]
pub struct CounterIncremented<'a> {
    #[topic]
    pub by: &'a ContractAddress,
    pub amount: u64,
}
```

- **`#[derive(Event)]`** generates everything the event needs: a `SIGNATURE` constant, serialization for the payload, and a `CounterIncrementedPayload` companion struct for decoding. See [SDK Macros](/reference/sdk-macros/#deriveevent).
- **`#[topic]`** makes `by` an indexed topic (topic 1), so consumers can filter events by address. Fields without the attribute — here `amount` — go into the payload.
- **The lifetime** lets the topic borrow the address instead of copying it. 32-byte values like `ContractAddress` are used as topics directly; other types are XDR-encoded and hashed, which makes them filterable but not recoverable. Anything you need to *read* from the event belongs in the payload.

## Step 2: Declare and Emit It

Declare the event on the `#[contract]` attribute and emit it from `increment`:

```rust
#[contract(throws = Error, emits(CounterIncremented))]
impl Counter {
    pub fn initialize(&mut self, initial_value: u64) {
        self.value.strict_inc(initial_value as i128);
    }

    pub fn increment(&mut self, amount: u64) {
        self.value.strict_inc(amount as i128);
        let caller = get_caller();
        log_event(&CounterIncremented { by: &caller, amount });
    }

    // decrement and get are unchanged
}
```

- **`emits(CounterIncremented)`** declares the event as part of the contract's interface, which records it in the [contract spec](/reference/contract-spec/#events) so codegen and indexers can decode it. Like `throws`, `emits` belongs on the interface — the trait definition or inherent impl, never a trait impl.
- **`log_event`** serializes the topics and payload and emits the event via the `LogEvent` syscall. Events become part of the block's event trie; they are not readable by contracts.
- **`get_caller()`** returns the address of the immediate caller, which becomes the event's indexed topic.

## Step 3: Test It

Every event emitted during a test transaction is captured on the `TransactResult` that `env.transact` returns. Add to `tests/test.rs`:

```rust
use counter::{register_mock_contract, CounterClient, CounterIncremented};
use sdk::*;

static NONCE: SHA256Hash = sdk::sha256_static!("COUNTER_NONCE");

#[test]
fn test_increment_emits_event() {
    let env = TestEnvironment::no_cost();
    let test_contract = register_mock_contract(&env);
    let contract_hash = test_contract.as_hash().clone();

    let result = env.transact(|tx| {
        tx.call(&ContractAddress::named("test")).run(move || {
            let addr = deploy_contract(&NONCE, &contract_hash);
            let client = CounterClient::new(&addr);
            client.initialize(10);
            client.increment(5);
        })
    });
    result.assert_success();

    // initialize emits nothing; increment emits exactly one event
    result.assert_event_count(1);
    result.assert_event::<CounterIncremented>(0, |event| {
        assert_eq!(event.topic(0), Some(CounterIncremented::SIGNATURE));
        let by: &ContractAddress = event.topic(1).unwrap().into();
        assert_eq!(by, &ContractAddress::named("test"));
        assert_eq!(event.payload().amount, 5);
    });
}
```

Walking through the assertions:

1. **`assert_event_count(1)`** counts every event the transaction emitted, across all contracts it touched.
2. **`assert_event::<CounterIncremented>(0, ...)`** decodes the event at index 0 as a `CounterIncremented` and hands you a typed view.
3. **`event.topic(0)`** is the signature; `CounterIncremented::SIGNATURE` is the constant the derive generated.
4. **`event.topic(1)`** is the `by` field. A 32-byte topic converts back to `&ContractAddress` with `.into()`. The caller is the address the transaction originated from — `ContractAddress::named("test")`.
5. **`event.payload()`** is the decoded `CounterIncrementedPayload`; payload fields are read back directly.

Run it:

```bash
cargo test
```

## Step 4: Find It in the Spec

Build the contract:

```bash
groundhog build
```

Alongside the wasm, the CLI writes the contract's [spec](/reference/contract-spec/) — `counter.spec.json` (human-readable) and `counter.spec.xdr` (canonical). Because of the `emits` declaration, the spec now carries the event:

```json
"events": [
  {
    "name": "CounterIncremented",
    "signature": "66e9e0dfc1e9d3815c880cbd26ab9635ed58a7d544a989998a483797c45ea1a0",
    "topics": [{ "name": "by", "ty": { "kind": "address" } }],
    "fields": [{ "name": "amount", "ty": { "kind": "u64" } }]
  }
]
```

The `signature` is `sha256(MAJOR_VERSION :: CRATE_NAME :: TYPE_NAME)` — here `sha256("0.1::counter::CounterIncremented")`, for the crate `counter` at version `0.1.x`. Yours will differ if your crate's name or major version differs. This is the hash that appears as topic 0 of every emitted instance, and it's stable across SemVer-compatible releases of your contract.

Anything that consumes the spec now understands the event — including `groundhog codegen ts`, which regenerates [TypeScript bindings](/tools/typescript-sdk/) aware of it.

## Step 5: Query It On Chain

After deploying (see [Getting Started](/start/getting-started/) for the deploy flow) and calling `increment`, the event is queryable through the gateway. Filter on the contract address and the signature from the spec — as `topic0`, with a `0x` prefix:

```json
{
  "jsonrpc": "2.0",
  "method": "groundhog_getEvents",
  "params": {
    "query": {
      "filters": [
        {
          "contractAddresses": ["0x<your contract address>"],
          "topics": {
            "topic0": ["0x66e9e0dfc1e9d3815c880cbd26ab9635ed58a7d544a989998a483797c45ea1a0"],
            "topic1": [],
            "topic2": []
          }
        }
      ],
      "order": "descending",
      "anchor": { "kind": "atEnd" },
      "cursor": "0x",
      "limit": 50
    }
  },
  "id": 1
}
```

Each returned event carries its topics (topic 1 is the caller's address, directly comparable) and the XDR payload (`amount`). To filter on a *specific* caller, put that address in `topic1`. See [`groundhog_getEvents`](/reference/json-rpc-api/#groundhog_getevents) for pagination and filter semantics.

## Next Steps

- [Contract Spec](/reference/contract-spec/) for the full spec format the event landed in
- [SDK Macros](/reference/sdk-macros/#deriveevent) for `#[derive(Event)]` details, including `#[event_spec(export)]` for library-emitted events
- [TypeScript Bindings](/tools/typescript-sdk/) to generate a typed client that knows about your event
- [Build a Token](/tutorials/build-a-token/) for a contract emitting standard ERC-20 events
````

- [ ] **Step 2: Add a Next Steps link from the counter tutorial**

In `src/content/docs/tutorials/build-a-counter.md`, in the `## Next Steps` list, insert as the second bullet (after the Build a Token line):

```markdown
- [Add Events to a Contract](/tutorials/add-events-to-a-contract/) to extend this counter with an emitted event
```

- [ ] **Step 3: Build the site**

Run: `cd /Users/geofframseyer/groundhog/developers-site && pnpm build`
Expected: build succeeds, no broken-link or missing-page errors.

- [ ] **Step 4: Commit (including the sidebar from Task 4)**

```bash
git add src/content/docs/tutorials/add-events-to-a-contract.md src/content/docs/tutorials/build-a-counter.md astro.config.mjs
git commit -m "add events tutorial and wire new pages into the sidebar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full site build**

Run: `cd /Users/geofframseyer/groundhog/developers-site && pnpm build`
Expected: success.

- [ ] **Step 2: Consistency greps**

```bash
grep -rn "contract-spec.json" src/content/docs/        # expect: no hits (old wrong filename)
grep -rn "contract_exec" src/content/docs/             # expect: no hits
grep -rn "spec.json" src/content/docs/ | grep -v "\.spec\.json"  # expect: no hits
grep -rln "add-events-to-a-contract" src/content/docs/ astro.config.mjs  # expect: ≥4 files
```

- [ ] **Step 3: Fact spot-check against the verified-facts list**

Re-read the rendered `contract-spec.md` and confirm every JSON key matches the "Verified facts" section at the top of this plan (`format`, `version` not `vers`, `ty` in fields, `type` in throws, `selector` hex string, `signature` without 0x, `max_len`, `len`/`element`, `discriminant`/`case_type`).

- [ ] **Step 4: Report**

Summarize the diff and remind the user the branch is `geoff/contract-spec-docs`, ready for PR via the finishing-a-development-branch flow.
