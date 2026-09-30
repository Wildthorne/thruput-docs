---
title: Add Events to a Contract
description: "Tutorial: define an event, emit it from a Groundhog contract, test it, and find it in the contract spec and on chain."
---

We're extending the counter from [Build a Counter](/tutorials/build-a-counter/) with a `CounterIncremented` event: define the event type, declare it as part of the contract's interface, emit it, assert on it in a test, find it in the contract spec, and query it over JSON-RPC.

**Prerequisites:** A working counter contract from [Build a Counter](/tutorials/build-a-counter/).

:::note[Version checked]
This workflow targets CLI `0.19.0`, SDK `0.41.1`, and TypeScript client `0.12.0`.
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

- **`#[derive(Event)]`** generates the signature, topic/payload encoding, and typed decoding view. See [SDK Macros](/reference/sdk-macros/#deriveevent) or [`#[derive(Event)]` Rustdoc](https://crates.thruput.network/docs/sdk/0.41.1/doc/sdk/derive.Event.html).
- **`#[topic]`** makes `by` an indexed topic (topic 1), so consumers can filter events by address. Fields without the attribute, here `amount`, go into the payload.
- **The lifetime** lets the topic borrow the address. Addresses, fixed 32-byte values, supported integer scalars, `U256`, `I256`, and bool have direct topic encodings. Strings and byte slices are hashed; keep their original value in the payload if consumers need it. See [topic encodings](/tools/typescript-bindings/#events).

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
- **[`log_event`](https://crates.thruput.network/docs/sdk/0.41.1/doc/sdk/event/fn.log_event.html)** emits topics and payload through `LogEvent`. Events become part of the block's event trie; contracts cannot read them back.
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

The build writes `counter.spec.json` for inspection and canonical `counter.spec.xdr`
for codegen. Inspect the event's structured spec identity, signature, topic `by`,
and payload field `amount`. Use that generated signature for topic 0 instead of
copying a hash from another crate/version. See [Contract Spec](/reference/contract-spec/).

Anything that consumes the spec now understands the event. Generate [TypeScript bindings](/tools/typescript-bindings/) from the RV32 spec sidecar:

```bash
mkdir -p web/src/contracts
groundhog codegen ts target/groundhog/counter.spec.xdr \
  --output web/src/contracts/counter.ts
```

The generated `CounterIncremented` descriptor builds a typed filter, decodes matching events, and extracts events from transaction receipts:

```ts
import { counter } from "./contracts/counter.js";
const { CounterIncremented } = counter.v0_1.implementation;

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
              "0x<signature-from-your-generated-descriptor>"
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

Replace the address and signature placeholders above before sending the request.
With the TypeScript client, use the generated filter instead:

```ts
const page = await client.getContractEvents({
  event: CounterIncremented,
  contractAddresses: [contract],
  topics: { by: caller },
  order: "ascending",
  limit: 20,
}, { signal });
for (const event of page.events) {
  console.log(event.txHash, event.blockHeight, event.sequenceNumber, event.fields.amount);
}
```

This fetches exactly one typed page. To walk raw pages on demand:

```ts
const query = {
  filters: [CounterIncremented.filter({ contractAddresses: [contract] })],
  order: "ascending" as const,
  anchor: "beginning" as const,
  limit: 20,
};
for await (const page of client.iterateEventPages(query, { signal })) {
  for (const row of page.events) {
    const decoded = CounterIncremented.decode(row.event);
    console.log(row.blockHeight, decoded);
  }
}
```

The iterator follows empty pages with continuation cursors and stops on an empty
cursor. Breaking stops future requests; the signal can cancel an in-flight read.
There is no prefetch, retry, polling, or persistence. Repeated cursors and RPC
errors throw. Typed decoding rejects malformed matching events.

## Resume Without Missing Events

A cursor continues one bounded historical walk. It does not follow blocks added
later. Raw JSON-RPC uses `"0x"` to start and returns `"0x"` at exhaustion; the
TypeScript client uses an empty `Uint8Array`. An empty page alone is not exhaustion.
Raw continuation requests still require `order` and `anchor`, even though the
cursor contains continuation state. Keep the network, target, and filters fixed.

Store rows and progress in one database transaction. For events, use a unique key
of `(txHash, sequenceNumber)` within the network/query's store. Transaction-reference
pages can use `txHash`; their query matches root invocation targets, not every
address touched by a transaction.

Continue the ascending `query` above with application-owned storage. Use one store
per network and query; changing filters needs a separate store or an explicit rebuild.

| Application method | Responsibility |
| --- | --- |
| `store.loadProgress()` | Return the saved `{ height, cursor }`, or `undefined` for a new scan. Heights are bigint and cursors are `Uint8Array`. |
| `store.savePage(rows, progress)` | Upsert rows by their stable identity and save progress in the **same database transaction**. |

```ts
const saved = await store.loadProgress();
let height = saved?.height ?? 0n;

for await (const page of client.iterateEventPages({
  ...query,
  anchor: { height },
  cursor: saved?.cursor ?? new Uint8Array(),
}, { signal })) {
  if (page.oldestBlock > height) {
    throw new Error("History gap: required blocks are no longer retained");
  }
  const last = page.events.at(-1);
  if (last) height = last.blockHeight;
  await store.savePage(page.events, { height, cursor: page.cursor.slice() });
}
```

The store methods are application code, not SDK APIs. A non-empty saved cursor
resumes the old walk. An empty one starts a fresh scan at the saved height.
Serialize heights and cursor bytes exactly, and test interruption and replay
against your database implementation.

For example, block 100 contains events A and B on different pages:

1. Save A and its continuation cursor together. The last stored row height is 100.
2. If the process stops, resume that exact saved walk when its cursor is valid.
3. If starting a fresh scan, start inclusively at height 100, not 101. Upsert A
   again and store B. This prevents losing the unfinished part of the block.
4. After exhaustion, a later call starts a new walk at the last stored height.
   It rereads that block, deduplicates it, and can discover newer blocks.

`latestBlock` is the indexer's head at response time, not proof that you processed
every matching row through that height. Never set the application checkpoint to
it. An empty completed walk may leave the last-row checkpoint unchanged.

Check `oldestBlock` before accepting data as complete. If retention has removed
needed history, report a gap and choose an explicit rebuild/archive policy.
Current indexers do not reliably reject malformed cursors: corrupt bytes can look
like an exhausted walk. Preserve cursors exactly; do not decode them in the client
or silently restart on arbitrary errors. These checks do not prove that corrupted
or pruned history is recoverable.

## Next Steps

- [Contract Spec](/reference/contract-spec/) for the full spec format the event landed in
- [SDK Macros](/reference/sdk-macros/#deriveevent) for `#[derive(Event)]` details, including `#[event_spec(export)]` for library-emitted events
- [TypeScript Bindings](/tools/typescript-bindings/) to generate a typed client that knows about your event
- [Build a Token](/tutorials/build-a-token/) for a contract emitting standard ERC-20 events
