---
title: Cache and refresh data
description: Share query results, reuse query factories, and refresh the original data after a transaction.
---

Stellar Thruput query hooks use your application's TanStack Query cache. Keep the public client and QueryClient stable so components reading the same inputs can share data and in-flight requests.

## Understand cache scope

Keys include network and public-client instance identity. Balance keys also include owner and token where applicable. Contract-view keys include the method decoder, target, encoded arguments, and caller.

Different client instances do not share cached reads, even on the same network. Use the `queryKey` returned by a hook or factory rather than constructing a library-owned key yourself.

`staleTime` controls when data becomes stale. Polling and post-transaction invalidation are explicit application choices. Independent queries do not guarantee a common read height.

## Reuse query options

Factories work outside components when given an initialized client and explicit inputs:

```ts
import type { ConnectedThruputClient } from "@thruputchain/client";
import { tokenBalanceQueryOptions, type BalanceAddress } from "@thruputchain/react";
import type { QueryClient } from "@tanstack/react-query";

export function prefetchBalance(
  queries: QueryClient,
  client: ConnectedThruputClient,
  owner: BalanceAddress,
  token: BalanceAddress,
) {
  return queries.prefetchQuery(tokenBalanceQueryOptions({
    client,
    address: owner,
    token,
    query: { staleTime: 10_000 },
  }));
}
```

The same client and inputs produce the key used by `useTokenBalance`. Factories also exist for native balances, contract views, and receipts.

Balance factories do not resolve the connected wallet. Missing inputs produce a skipped query for hook use; call imperative `fetchQuery` or `prefetchQuery` only when inputs are present. `enabled` controls observers, not imperative fetching. `select` transforms observer data, not the cache's raw data.

## Read a dynamic list

Use one balance component per token, or compose factory options with `useQueries`:

```tsx
import { toBase58 } from "@thruputchain/client";
import { useQueries } from "@tanstack/react-query";
import { tokenBalanceQueryOptions, useClient, useWallet, type BalanceAddress } from "@thruputchain/react";

export function TokenBalances({ tokens }: { tokens: BalanceAddress[] }) {
  const client = useClient();
  const wallet = useWallet();
  const tokenKeys = tokens.map(token => typeof token === "string" ? token : toBase58(token));
  const balances = useQueries({
    queries: tokenKeys.map(token => tokenBalanceQueryOptions({
      client,
      address: wallet.status === "connected" ? wallet.address : null,
      token,
      query: { staleTime: 10_000 },
    })),
  });

  return (
    <ul>
      {balances.map((balance, index) => (
        <li key={tokenKeys[index]}>
          {balance.isLoading ? "Loading…" : balance.error ? balance.error.message : balance.data?.rawBalance.toString() ?? "No balance loaded"}
        </li>
      ))}
    </ul>
  );
}
```

Pass a list of unique tokens. Base58 is case-sensitive, so do not change the case of address strings. These are independent queries, not one atomic read or a concurrency-limited batch. Use a grouped application query and check heights when several values must describe the same snapshot.

## Refresh after a write

After observing a committed transaction, invalidate the key for the account and token that operation affected:

```ts
import type { QueryClient } from "@tanstack/react-query";
import type { BalanceQueryKey } from "@thruputchain/react";

export function refreshBalance(queries: QueryClient, originalKey: BalanceQueryKey) {
  return queries.invalidateQueries({ queryKey: originalKey, exact: true });
}
```

Capture the original key when starting the operation. An account change while waiting should not redirect the refresh to the newly selected account. Invalidating a query requests another read; check its height when the application needs post-transaction state.

For custom queries, append an application namespace and every read input to `getClientQueryKey(client)`. Canonicalize addresses and hashes with `toBase58`, other byte arrays with `toHex0x`, and bigints as decimal strings. [Read events](/react/events/) shows a custom query with fixed inputs.

## Keep persistence separate

Query keys contain in-memory identities and are not portable across server/browser processes or persisted cache sessions. Store application records, such as pending transaction hashes and their networks, separately from the query cache. See [Track transaction results](/react/transaction-status/).
