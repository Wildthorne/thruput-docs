---
title: Add Events to a Contract
description: "Tutorial: define an event, emit it from a Groundhog contract, test it, and find it in the contract spec and on chain."
---

We're extending the counter from [Build a Counter](/tutorials/build-a-counter/) with a `CounterIncremented` event: define the event type, declare it as part of the contract's interface, emit it, assert on it in a test, find it in the contract spec, and query it over JSON-RPC.

**Prerequisites:** A working counter contract from [Build a Counter](/tutorials/build-a-counter/).

:::note[Version checked]
This workflow targets Groundhog `0.1.27`: CLI `0.17.0`, SDK `0.34.3`, and TypeScript client `0.8.0`.
:::

## How Events Work on Groundhog

An event is up to three 32-byte **topics** plus a CXS-serialized **payload** (at most 1 KB in total). Topics are indexed: off-chain consumers filter on them via [`groundhog_getEvents`](/reference/json-rpc-api/#groundhog_getevents). The payload is not indexed; it carries the data you want to read back.

Topic 0 is always the event's **signature**, a hash that identifies the event type, so up to two topics are available for your own fields. There is no `indexed` keyword as in Solidity: you mark struct fields with `#[topic]`.

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

- **`#[derive(Event)]`** generates everything the event needs: a `SIGNATURE` constant, serialization for the payload, and a `CounterIncrementedPayload` companion struct for decoding. See [SDK Macros](/reference/sdk-macros/#deriveevent) or [`#[derive(Event)]` Rustdoc](https://groundhog.dev/docs/sdk/latest/sdk/derive.Event.html).
- **`#[topic]`** makes `by` an indexed topic (topic 1), so consumers can filter events by address. Fields without the attribute, here `amount`, go into the payload.
- **The lifetime** lets the topic borrow the address instead of copying it. `ContractAddress`, `SHA256Hash`, `[u8; 32]`, `U256`, and `I256` are used as topics directly; other types are CXS-encoded and hashed, which makes them filterable but not recoverable. Anything you need to _read_ from the event belongs in the payload.

## Step 2: Declare and Emit It

Declare the event on the `#[contract]` attribute and emit it from `increment`:

```rust
#[contract(
    throws = CounterError,
    emits(PingEvent, CounterIncremented)
)]
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

The generated counter already declares and emits `PingEvent`. Keep it in the `emits(...)` list unless you also remove the scaffold's `ping` method. Export the new event from `src/lib.rs` so integration tests can import it:

```rust
pub use implementation::CounterIncremented;
```

- **`emits(CounterIncremented)`** declares the event as part of the contract's interface, which records it in the [contract spec](/reference/contract-spec/#events) so codegen and indexers can decode it. Like `throws`, `emits` belongs on the interface: the trait definition or inherent impl, never a trait impl.
- **[`log_event`](https://groundhog.dev/docs/sdk/latest/sdk/event/fn.log_event.html)** serializes the topics and payload and emits the event via the `LogEvent` syscall. Events become part of the block's event trie; they are not readable by contracts.
- **`get_caller()`** returns the address of the immediate caller, which becomes the event's indexed topic.

## Step 3: Test It

Every event emitted during a test transaction is captured on the `TransactResult` that `env.transact` returns. Add to `tests/test.rs`:

```rust
use sdk::*;

use counter::{CounterClient, CounterIncremented, register_mock_contract};

static NONCE: SHA256Hash = sdk::sha256_static!("COUNTER_NONCE");

#[test]
fn test_increment_emits_event() {
    let env = TestEnvironment::no_cost();
    let test_contract = register_mock_contract(&env);
    let contract_hash = *test_contract.as_hash();

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
4. **`event.topic(1)`** is the `by` field. A 32-byte topic converts back to `&ContractAddress` with `.into()`. The caller is the address the transaction originated from: `ContractAddress::named("test")`.
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

Alongside the RV32 artifact, the CLI writes the contract's [spec](/reference/contract-spec/): `counter.spec.json` (human-readable) and `counter.spec.xdr` (canonical). Because of the `emits` declaration, the spec now carries the event:

```json
"events": [
  {
    "name": "CounterIncremented",
    "signature": "66e9e0dfc1e9d3815c880cbd26ab9635ed58a7d544a989998a483797c45ea1a0",
    "topics": [{ "name": "by", "type": { "kind": "address" } }],
    "fields": [{ "name": "amount", "type": { "kind": "u64" } }]
  }
]
```

The `signature` is `sha256(MAJOR_VERSION :: CRATE_NAME :: TYPE_NAME)`. Here it is `sha256("0.1::counter::CounterIncremented")`, for the crate `counter` at version `0.1.x`. Yours will differ if your crate's name or major version differs. This is the hash that appears as topic 0 of every emitted instance, and it's stable across SemVer-compatible releases of your contract.

Anything that consumes the spec now understands the event. Generate [TypeScript bindings](/tools/typescript-bindings/) from the RV32 spec sidecar:

```bash
mkdir -p web/src/contracts
groundhog codegen ts target/groundhog/counter.spec.xdr \
  --output web/src/contracts/counter.ts
```

The generated `CounterIncremented` descriptor builds a typed filter, decodes matching events, and extracts events from transaction receipts:

```ts
import { CounterIncremented } from "./contracts/counter.js";

const filter = CounterIncremented.filter({
  contractAddresses: [contract],
  topics: { by: caller },
});

const decoded = CounterIncremented.decode(event);
if (decoded) {
  console.log(decoded.topics.by, decoded.fields.amount);
}

const matches = CounterIncremented.allFromReceipt(receipt, {
  contractAddress: contract,
});
const match = CounterIncremented.singleFromReceipt(receipt, {
  contractAddress: contract,
});
```

`decode()` returns `null` when the signature differs and throws for malformed data with the matching signature. `allFromReceipt()` returns every matching event from the selected emitter. `singleFromReceipt()` requires exactly one match. Each receipt match retains its emitting `contractAddress`.

## Step 5: Query It On Chain

After deploying (see [Develop Locally with the CLI](/tutorials/develop-locally/#6-dry-run-and-deploy) for the deploy flow) and calling `increment`, the event is queryable through the gateway. Filter on the contract address and the signature from the spec as `topic0`, with a `0x` prefix:

```json
{
  "jsonrpc": "2.0",
  "method": "groundhog_getEvents",
  "params": [
    {
      "filters": [
        {
          "contractAddresses": ["0x<64-character-contract-address>"],
          "topics": {
            "topic0": [
              "0x66e9e0dfc1e9d3815c880cbd26ab9635ed58a7d544a989998a483797c45ea1a0"
            ],
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
  ],
  "id": 1
}
```

Each returned event carries its topics (topic 1 is the caller's address, directly comparable) and the CXS payload (`amount`). To filter on a _specific_ caller, put that address in `topic1`. See [`groundhog_getEvents`](/reference/json-rpc-api/#groundhog_getevents) for pagination and filter semantics.

## Next Steps

- [Contract Spec](/reference/contract-spec/) for the full spec format the event landed in
- [SDK Macros](/reference/sdk-macros/#deriveevent) for `#[derive(Event)]` details, including `#[event_spec(export)]` for library-emitted events
- [TypeScript Bindings](/tools/typescript-bindings/) to generate a typed client that knows about your event
- [Build a Token](/tutorials/build-a-token/) for a contract emitting standard ERC-20 events
