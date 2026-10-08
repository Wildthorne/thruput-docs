---
title: Read balances
description: Read native-token and contract-token balances for a connected account or an explicit address.
---

Use `useBalance` for the native token and `useTokenBalance` for a standard ERC-20 contract. Both return query state, a `queryKey`, and data containing `rawBalance` and `height`.

## Follow the connected account

```tsx
import { formatUnits } from "@groundhogchain/client";
import { useBalance } from "@groundhogchain/react";

export function NativeBalance() {
  const balance = useBalance();
  if (balance.isLoading) return <p>Loading balance…</p>;
  if (balance.error) return <p role="alert">{balance.error.message}</p>;
  if (!balance.data) return <p>Connect a wallet on this network to see its balance.</p>;
  return <p>{formatUnits(balance.data.rawBalance, 7)} native tokens</p>;
}
```

With no address, the hook follows the selected account only while the wallet is connected to the application's network. Account changes select a different query rather than displaying the previous account's balance.

## Read an explicit address

Pass an address to read without wallet permission:

```tsx
import { formatUnits } from "@groundhogchain/client";
import { useTokenBalance, type BalanceAddress } from "@groundhogchain/react";

export function TokenBalance({ token, owner, decimals }: {
  token: BalanceAddress;
  owner: BalanceAddress;
  decimals: number;
}) {
  const balance = useTokenBalance({ token, address: owner });
  if (balance.error) return <p role="alert">{balance.error.message}</p>;
  if (!balance.data) return <p>Loading token balance…</p>;
  return (
    <p>{formatUnits(balance.data.rawBalance, decimals)} at block {balance.data.height.toString()}</p>
  );
}
```

Addresses accept hex strings or SDK-branded bytes. Equivalent inputs share a key. The hook does not fetch token metadata or choose decimals; supply those from the application or a metadata read. The native token has seven decimals.

## Handle missing inputs

| Input | Behavior |
| --- | --- |
| Omitted or undefined `address` | Resolve the connected account on the app's network |
| Explicit address | Read even while disconnected or while the wallet is on another network |
| `address: null` | Disable account resolution and fetching |
| Missing or null `token` | Disable token fetching |

Missing-input queries are idle with `isLoading: false`. Invalid addresses surface through query error state.

## Set refresh behavior

Pass options through `query`, for example `{ staleTime: 10_000, refetchInterval: 15_000 }`. The balance hooks also support retry, garbage-collection, focus/reconnect, and `select` options. Defaults come from your QueryClient and TanStack Query.

Abandoned balance results are discarded, but their underlying RPC may still finish. Use [Cache and refresh data](/react/queries/) for polling, reusable query options, and invalidation after writes.
