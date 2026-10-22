---
title: Events
description: Define, declare, emit, and test typed events in a Rust contract.
---

Events expose contract activity to applications. A contract emits topics for filtering and a payload for the data consumers need to read. Use storage for state your contract must read later; contracts cannot read events back.

## Define an event

```rust
use thruput_sdk::*;

#[derive(Event, Clone, Debug)]
pub struct CounterIncremented {
    #[topic]
    pub by: ContractAddress,
    pub amount: u64,
}
```

`#[derive(Event)]` generates the event signature, topic encoding, and a payload type. Topic 0 is the signature. Up to two fields can use `#[topic]`; fields without it go into the CXS-encoded payload.

Here, consumers can filter on `by` and read `amount` from the payload. Strings and byte slices used as topics retain only a hash, so also include them in the payload if consumers need their original values. The total size of topics and payload is limited to 1,024 bytes.

## Declare and emit it

Add the event to a counter method to record the amount and caller:

```rust
use thruput_sdk::storage::Balance;

#[derive(Debug)]
#[thruput_sdk::storage]
pub struct Counter {
    value: Balance,
}

#[contract(emits(CounterIncremented))]
impl Counter {
    pub fn increment(&mut self, amount: u64) {
        self.value.increase(amount as i128);
        log_event(&CounterIncremented {
            by: get_caller(),
            amount,
        });
    }
}
```

`get_caller()` identifies the immediate caller of this frame. For a forwarded call, that is the forwarding contract.

`emits(...)` records the event in the contract spec. Put it on the inherent implementation or interface trait definition, not on a trait implementation. When adding an event to an existing contract, retain its other event and error declarations.

## Test an emitted event

Export the event alongside the generated client from your contract library. In a native test, call `increment` and inspect the returned `TransactResult`:

```rust
let result = env.transact(|tx| {
    tx.call(&caller).run(|| {
        CounterClient::new(&address).increment(5);
    })
});
result.assert_success();
result.assert_event_count(1);
result.assert_event::<CounterIncremented>(0, |event| {
    assert_eq!(event.topic(0), Some(CounterIncremented::SIGNATURE));
    let by: &ContractAddress = event.topic(1).unwrap().into();
    assert_eq!(by, &caller);
    assert_eq!(event.payload().amount, 5);
});
```

Here, `env` is the test environment, `caller` is the calling address, and `address` is the deployed test contract. See [Testing](/programming-model/testing/#basic-pattern) for registration and deployment setup.

The event count covers all contracts called by the test transaction. Assert both topics and payload so the test checks the event's content, not only its presence.

## Include the event in the interface

Rebuild after changing an event declaration. The generated spec records its name, signature, topic layout, and payload layout. [Client bindings](/contracts/client-bindings/) use that metadata to expose the event to applications.

For library-emitted events that no interface declares, `#[event_spec(export)]` explicitly includes the type in the linked contract's spec. See the [event macro reference](/reference/sdk-macros/#deriveevent) for the generated API.

Use [Read events](/typescript/events/) for application queries, receipt decoding, and pagination.
