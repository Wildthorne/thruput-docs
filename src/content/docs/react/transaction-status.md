---
title: Track transaction results
description: Observe a saved transaction hash without wallet permission and distinguish query errors from execution failures.
---

`useWaitForTransactionReceipt` observes a hash through the public client. It works while the wallet is disconnected. Use a client on the transaction's original network.

## Display a receipt

```tsx
import { ExecResult } from "@thruputchain/client";
import { useWaitForTransactionReceipt } from "@thruputchain/react";

export function TransactionStatus({ hash }: { hash: string | null }) {
  const receipt = useWaitForTransactionReceipt({
    hash: hash || null,
    wait: { timeoutMs: 60_000, pollingIntervalMs: 500 },
  });

  if (!hash) return <p>No transaction selected.</p>;
  if (receipt.error) {
    return (
      <section>
        <p role="alert">Observation stopped: {receipt.error.message}</p>
        <button disabled={receipt.isFetching} onClick={() => void receipt.refetch()}>
          Check again
        </button>
      </section>
    );
  }
  if (!receipt.data) return <p>Waiting for a committed receipt…</p>;

  const succeeded = receipt.data.execResult === ExecResult.ExecResultOK;
  return (
    <p>
      {succeeded ? "Execution succeeded" : "Execution failed"}
      {" at block "}{receipt.data.height.toString()}
    </p>
  );
}
```

A failed committed execution is **receipt data**, not a query error. A query timeout means observation stopped, not that the transaction failed.

## Resume observation

Restore the saved hash and its network from the application's pending record. Missing hashes disable the query. Refetch explicitly to resume after a timeout; do not submit a new operation merely to obtain a result.

The SDK owns polling. The receipt query disables retries and automatic focus/reconnect refetching. Committed receipts have infinite stale time. Observers of the same hash share the query, so configure their timeout and polling settings consistently.

Canceling the query cancels observation, never the transaction.

## Interpret contract results

The receipt is for the transaction's root method. A wallet-wrapped application call must be decoded through the wallet's child results, not by treating the root as the application method. Use the [TypeScript receipt model](/typescript/transaction-status/#decode-the-correct-method).

Generated event descriptors can select receipt events by emitter and type. The application decides whether commitment completes its workflow; a queued request may require later events before the requested action is complete.
