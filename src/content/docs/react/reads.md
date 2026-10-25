---
title: Read contract data
description: Display a typed contract view with loading, error, data, and refresh states.
---

`useContractView` reads a generated method descriptor and infers its arguments and result. Mount the [application providers](/react/setup/) first.

## Display native-token supply

Use this as `src/App.tsx`. The binding and deployed address are supplied by the SDK packages:

```tsx
import { formatUnits } from "@thruputchain/client";
import { ERC20 } from "@thruputchain/client/contracts";
import { NATIVE_TOKEN_ADDRESS } from "@thruputchain/protocol";
import { useContractView } from "@thruputchain/react";

export default function App() {
  const supply = useContractView({
    method: ERC20.v0_1.totalSupply,
    address: NATIVE_TOKEN_ADDRESS,
    args: undefined,
  });

  return (
    <main>
      <h1>Native-token supply</h1>
      {supply.isLoading ? <p>Reading the contract…</p> : null}
      {supply.error ? <p role="alert">{supply.error.message}</p> : null}
      {supply.data ? (
        <>
          <p>{formatUnits(supply.data.value, 7)} native tokens</p>
          <p>Read at block {supply.data.stateBlockHeight.toString()}</p>
        </>
      ) : null}
      <button disabled={supply.isFetching} onClick={() => void supply.refetch()}>
        {supply.isFetching ? "Refreshing…" : "Refresh"}
      </button>
    </main>
  );
}
```

No wallet, signer, or new deployment is needed. The result retains `value`, `stateBlockHeight`, `gasUsed`, and simulated `events`.

## Pass method arguments

For a method with arguments, pass its generated argument object:

```tsx
import type { ContractAddress } from "@thruputchain/client";
import { ERC20 } from "@thruputchain/client/contracts";
import { NATIVE_TOKEN_ADDRESS } from "@thruputchain/protocol";
import { useContractView } from "@thruputchain/react";

export function RawBalance({ owner }: { owner: ContractAddress }) {
  const balance = useContractView({
    method: ERC20.v0_1.getBalanceOf,
    address: NATIVE_TOKEN_ADDRESS,
    args: { addr: owner },
  });
  if (balance.error) return <p role="alert">{balance.error.message}</p>;
  if (!balance.data) return <p>Reading balance…</p>;
  return <p>{balance.data.value.toString()} base units</p>;
}
```

Pass `caller` when a view needs simulated caller context. It does not authorize a transaction. Custom contracts use their own [generated bindings](/tools/typescript-bindings/).

## Control when a read runs

`enabled: false` disables automatic reads and retains cached data. `staleTime` controls freshness. Arguments must still be valid: the hook encodes them while constructing the query, even when disabled. Mount a read component only after required inputs are ready.

Keep generated descriptors stable. Cache identity includes the client, method decoder, contract address, encoded arguments, and caller. Equivalent argument values share a query; changing an input selects a different query.

## Handle refresh and cancellation

Use `isLoading` for the first active fetch and `isFetching` for any active fetch, including refresh. A disabled query can be pending without loading. Display read errors separately from cached data when a refresh fails.

Query cancellation aborts contract-view requests and ignores late results from custom transports. Independent views can use different snapshots. After a write, check that a view's `stateBlockHeight` has reached the receipt's `blockHeight` before treating its data as post-transaction state.
