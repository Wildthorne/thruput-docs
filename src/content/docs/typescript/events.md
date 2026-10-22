---
title: Read events
description: Filter and decode contract events, walk historical pages, and save progress without missing rows.
---

Use a generated event descriptor to build filters and decode payloads. This page uses the supplied ERC-20 `TransferEvent`; a custom contract uses the event exported by its generated bindings.

## Query events

With the client from [Connect to a network](/typescript/connect/), create `src/events.ts`:

```ts
import { groundhog_erc20_if } from "@thruputchain/client/contracts";
import { HOG_ADDRESS } from "@thruputchain/protocol";
import { client } from "./client.js";

const { TransferEvent } = groundhog_erc20_if.v0_1.events;
const page = await client.getContractEvents({
  event: TransferEvent,
  addresses: [HOG_ADDRESS],
  start: { order: "descending", anchor: { kind: "atEnd" } },
  limit: 20,
});
for (const event of page.events) {
  console.log(event.blockHeight, event.sequenceNumber, event.fields.amount);
}
```

This fetches one typed page. An empty page is a valid result. Each row retains the emitting contract `address`, `transactionHash`, `blockHeight`, `sequenceNumber`, topics, and decoded fields.

For the next page, repeat `event` and `addresses`, pass `cursor: page.nextCursor`, and omit `start`. `nextCursor: null` ends the walk. An empty page can still have a cursor.

## Filter topics

Add `topics: { to: owner }` to restrict transfers to a typed address. A named topic accepts one value or `{ oneOf: [...] }`. Filters require one to five contract addresses; each topic alternative list accepts 1–16 values.

Addresses, fixed 32-byte values, supported integer scalars, `U256`, `I256`, and bool have direct encodings. Strings and byte slices are hashed. Use the generated filter's input types; do not reconstruct topic bytes or assume a hashed value can be read back.

## Walk historical pages

For raw event pages, use the descriptor's filter and decoder:

```ts
import type { EventWalkQuery } from "@thruputchain/client";

const query: EventWalkQuery = {
  filters: [TransferEvent.filter({ addresses: [HOG_ADDRESS] })],
  start: { order: "ascending", anchor: { kind: "atBeginning" } },
  limit: 20,
};
for await (const page of client.iterateEventPages(query)) {
  for (const row of page.events) {
    const decoded = TransferEvent.decode(row.event);
    console.log(row.blockHeight, decoded);
  }
}
```

The iterator requests pages on demand and stops at `nextCursor: null`. It fixes the first page's `latestIndexedBlockHeight` as the walk's upper bound. It throws `HistoryWalkError` for regressed coverage, lost retention, duplicate or out-of-order rows, and repeated cursors. `decode` returns `null` for a different signature and throws for malformed matching data.

Pass `{ signal }` as the iterator's second argument to cancel an in-flight read. Breaking the loop stops future requests. There is no automatic retry, polling, subscription, or persistence.

## Resume without missing events

A walk does not follow later blocks. Keep the network, target, and filters fixed. Upsert rows by `(transactionHash, sequenceNumber)` within that network and query.

`for await` discards the iterator's return value. Call `next()` directly to receive its `HistoryCompletion` after the last page. For an ascending walk, `completedThroughBlockHeight` is the walk's upper bound. In this example, `store` is application code, not an SDK API:

```ts
const saved = await store.loadCheckpoint(); // bigint | undefined
const pages = client.iterateEventPages({
  ...query,
  start: {
    order: "ascending",
    anchor: saved === undefined
      ? { kind: "atBeginning" }
      : { kind: "atHeight", blockHeight: saved },
  },
});
for (;;) {
  const step = await pages.next();
  if (step.done) {
    const done = step.value.completedThroughBlockHeight;
    if (done !== undefined) await store.saveCheckpoint(done);
    break;
  }
  await store.savePage(step.value.events);
}
```

The next walk starts inclusively at the saved height, so deduplicate that boundary block. A walk that stops early saves no checkpoint; the next run replays from the previous one. A lost-retention `HistoryWalkError` means required blocks are no longer served. `oldestIndexedBlockHeight` and `latestIndexedBlockHeight` are serving bounds, not processed checkpoints.

For a latest-first UI, start a new descending walk from `atEnd` rather than continuing an old cursor. Descending completion is not an ingestion checkpoint.

Raw [`getEvents`](/reference/json-rpc-api/#getevents) continuation sends the cursor with the same filters and no `start`. Treat cursors as opaque strings. Retention bounds and a cursor alone do not prove complete or recoverable history.

## Decode receipt events

Use `TransferEvent.allFromReceipt(receipt, { address: HOG_ADDRESS })` to decode matching events in a receipt. `singleFromReceipt` requires exactly one matching event. Both select the emitter as well as the event type; a transaction can call several contracts that emit the same event.
