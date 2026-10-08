---
title: Read events
description: Filter and decode contract events, walk historical pages, and save progress without missing rows.
---

Use a generated event descriptor to build filters and decode payloads. This page uses the supplied ERC-20 `TransferEvent`; a custom contract uses the event exported by its generated bindings.

## Query events

With the client from [Connect to a network](/typescript/connect/), create `src/events.ts`:

```ts
import { groundhog_erc20_if } from "@groundhogchain/client/contracts";
import { HOG_ADDRESS } from "@groundhogchain/protocol";
import { client } from "./client.js";

const { TransferEvent } = groundhog_erc20_if.v0_1.events;
const page = await client.getContractEvents({
  event: TransferEvent,
  contractAddresses: [HOG_ADDRESS],
  order: "descending",
  limit: 20,
});
for (const event of page.events) {
  console.log(event.blockHeight, event.sequenceNumber, event.fields.amount);
}
```

This fetches one typed page. An empty page is a valid result. Each row retains the emitting contract address, transaction hash, position, topics, and decoded fields.

## Filter topics

Add `topics: { to: owner }` to restrict transfers to a typed address. A named topic accepts one value or `{ oneOf: [...] }`. Filters require one to five contract addresses; each topic alternative list accepts 1–16 values.

Addresses, fixed 32-byte values, supported integer scalars, `U256`, `I256`, and bool have direct encodings. Strings and byte slices are hashed. Use the generated filter's input types; do not reconstruct topic bytes or assume a hashed value can be read back.

## Walk historical pages

For raw event pages, use the descriptor's filter and decoder:

```ts
const query = {
  filters: [TransferEvent.filter({ contractAddresses: [HOG_ADDRESS] })],
  order: "ascending" as const,
  anchor: "beginning" as const,
  limit: 20,
};
for await (const page of client.iterateEventPages(query)) {
  for (const row of page.events) {
    const decoded = TransferEvent.decode(row.event);
    console.log(row.blockHeight, decoded);
  }
}
```

The iterator requests pages on demand. It follows empty pages with non-empty continuation cursors and stops on an empty `Uint8Array`. Repeated cursors and RPC errors throw. `decode` returns `null` for a different signature and throws for malformed matching data.

Pass `{ signal }` as the iterator's second argument to cancel an in-flight read. Breaking the loop stops future requests. There is no automatic retry, polling, subscription, or persistence.

## Resume without missing events

A cursor continues one historical walk; it does not follow later blocks. Keep the network, target, and filters fixed. Store rows and progress in the same database transaction, deduplicating by `(txHash, sequenceNumber)` within that network and query.

After exhausting an ascending walk, start a new walk inclusively at the last stored row's block height. Replay and deduplicate that block so a partially processed block does not lose rows. `latestBlock` is the indexer's head, not proof that your application processed every row through that height. Check `oldestBlock` for a retention gap.

For a latest-first UI, refresh from the head rather than continuing an old cursor.

For durable ascending ingestion, provide an application-owned store. `loadProgress()` returns `{ height: bigint, cursor: Uint8Array }` or `undefined`; `savePage()` upserts rows by stable identity and saves progress in the same database transaction:

```ts
const saved = await store.loadProgress();
let height = saved?.height ?? 0n;

for await (const page of client.iterateEventPages({
  ...query,
  anchor: { height },
  cursor: saved?.cursor ?? new Uint8Array(),
})) {
  if (page.oldestBlock > height) {
    throw new Error("History gap: required blocks are no longer retained");
  }
  const last = page.events.at(-1);
  if (last) height = last.blockHeight;
  await store.savePage(page.events, { height, cursor: page.cursor.slice() });
}
```

The store methods are application code, not SDK APIs. A non-empty saved cursor resumes the previous walk; an empty cursor starts a new scan at the saved height. Serialize heights and cursor bytes exactly. If a block spans pages, restart inclusively at that block and deduplicate instead of skipping to the next height.

Raw JSON-RPC represents an empty cursor as `"0x"` and still requires `order` and `anchor` on continuation requests. Preserve cursor bytes rather than decoding or editing them. Corrupted cursors can resemble exhaustion on some indexers; retention bounds and a cursor alone do not prove complete or recoverable history.

## Decode receipt events

Use `TransferEvent.allFromReceipt(receipt, { contractAddress: HOG_ADDRESS })` to decode matching events in a receipt. `singleFromReceipt` requires exactly one matching event. Both select the emitter as well as the event type; a transaction can call several contracts that emit the same event.
