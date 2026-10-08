---
title: Read events
description: Use the public client and TanStack Query to display typed contract events in React.
---

Compose the TypeScript client's event actions with TanStack Query. Generated bindings provide filtering and decoding; React components provide loading, empty, error, and refresh states.

<span id="display-recent-hog-transfers"></span>

## Display recent native-token transfers

```tsx
import { toHex0x } from "@groundhogchain/client";
import { groundhog_erc20_if } from "@groundhogchain/client/contracts";
import { HOG_ADDRESS } from "@groundhogchain/protocol";
import { getClientQueryKey, useClient } from "@groundhogchain/react";
import { useQuery } from "@tanstack/react-query";

const { TransferEvent } = groundhog_erc20_if.v0_1.events;

export function RecentTransfers() {
  const client = useClient();
  const transfers = useQuery({
    queryKey: [...getClientQueryKey(client), "app", "recent-hog-transfers"],
    queryFn: ({ signal }) => client.getContractEvents({
      event: TransferEvent,
      contractAddresses: [HOG_ADDRESS],
      order: "descending",
      limit: 20,
    }, { signal }),
    staleTime: 10_000,
  });

  return (
    <section aria-label="Recent native-token transfers">
      {transfers.isLoading ? <p>Loading transfers…</p> : null}
      {transfers.error ? <p role="alert">{transfers.error.message}</p> : null}
      {transfers.data?.events.length === 0 ? <p>No transfers in this page.</p> : null}
      <ul>
        {transfers.data?.events.map(event => (
          <li key={`${toHex0x(event.txHash)}:${event.sequenceNumber}`}>
            {event.fields.amount.toString()} base units at block {event.blockHeight.toString()}
          </li>
        ))}
      </ul>
      <button disabled={transfers.isFetching} onClick={() => void transfers.refetch()}>
        Refresh transfers
      </button>
    </section>
  );
}
```

The query has fixed contract, event, ordering, and page-size inputs. If you make them configurable, include each input in the key. Include a cursor when caching separate historical pages.

## Choose a history workflow

Refreshing the example starts at the head again. A saved cursor continues an older historical walk; it is not a subscription. Use the TypeScript [event pagination guidance](/typescript/events/) for iteration and durable checkpoints.

For live refresh, choose an explicit polling policy. Query caching does not create a background indexer or save progress across reloads.

## Decode transaction events

A receipt returned by an execution or receipt hook contains events. Use a generated descriptor's `allFromReceipt` or `singleFromReceipt` with the emitting contract address.

A committed receipt can report failed execution. Check the result before treating its events as successful application activity. See [Track transaction results](/react/transaction-status/).
