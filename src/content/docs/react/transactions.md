---
title: Send transactions
description: Use an explicit mutation to request approval, save signed transaction data, submit once, and show the result.
---

`useExecute` runs a wallet-backed transaction from a user action. It prepares, signs, awaits your persistence callback, submits once, and waits for successful execution. Both [providers](/react/providers/) are required.

## Execute a typed call

This component sends a small native-token transfer to an already funded recipient. The application supplies `savePending`, which must durably save the approved transaction before resolving:

```tsx
import { gasAmount, parseUnits, toBase58, TransactionObservationError, type ContractAddress } from "@thruputchain/client";
import { ERC20 } from "@thruputchain/client/contracts";
import { NATIVE_TOKEN_ADDRESS } from "@thruputchain/protocol";
import { useExecute, useWallet, type ExecuteVariables } from "@thruputchain/react";

type SavePending = ExecuteVariables["options"]["onSigned"];

export function SendNativeTokens({ receiver, savePending }: {
  receiver: ContractAddress;
  savePending: SavePending;
}) {
  const wallet = useWallet();
  const execution = useExecute();
  const unresolved = execution.error instanceof TransactionObservationError;

  function send() {
    execution.mutate({
      request: {
        invocation: ERC20.v0_1.transfer.invocation(NATIVE_TOKEN_ADDRESS, gasAmount(500_000n), {
          receiver,
          amount: parseUnits("0.0001", 7),
        }),
        gasLimit: gasAmount(1_000_000n),
      },
      options: { onSigned: savePending, wait: { timeoutMs: 60_000 } },
    });
  }

  return (
    <section aria-label="Send native tokens">
      <button disabled={wallet.status !== "connected" || execution.isPending || unresolved} onClick={send}>
        {execution.isPending ? "Waiting for approval or confirmation…" : "Send native tokens"}
      </button>
      {execution.error ? <p role="alert">{execution.error.message}</p> : null}
      {unresolved ? <p>Check the saved transaction before starting another transfer.</p> : null}
      {execution.data ? <p>Committed: {toBase58(execution.data.transactionHash)}</p> : null}
    </section>
  );
}
```

`mutate` exposes failures through mutation state. Use `mutateAsync` when an event handler needs to await the result, and handle its rejected promise. Trigger writes from user actions, not render effects.

The example budgets apply to this transfer, not every contract. See [gas and funding](/typescript/transactions/#set-gas-and-funding) for root and child limits and first-address storage funding.

## Save before submission

`onSigned` receives the `0x` hex signed transaction, its base58 `hash`, the account, and the original base58 network hash. Await the application's durable write. A rejected callback prevents broadcast.

The query cache is not the pending-transaction store. Keep the saved record available after a reload, account change, or disconnect. Use it to [observe the original transaction](/react/transaction-status/) rather than automatically signing a replacement.

## Handle mutation state

| State | Meaning |
| --- | --- |
| `isPending` | Preparation, approval, persistence, submission, or receipt observation is in progress |
| `data` | Successful committed execution with `transactionHash` and `receipt` |
| `error` | Inspect the error boundary; an observation failure is not proof of failed execution |

Mutation retries are disabled, including when the QueryClient's defaults enable retries. A wallet change invalidates the captured signing binding; observation after broadcast can continue on the original network.

`reset()` clears mutation UI state. It does not cancel a transaction or resolve an unknown outcome. See the shared [execution error model](/typescript/transaction-status/#handle-execution-helper-errors).

## Decode returns and refresh reads

For typed child returns, use the current `useWalletClient()` binding's `executeCallsAndWait` with the required persistence options. Keep its promise and UI state in the application's write handler; `useExecute` returns the root execution result.

After commitment, explicitly [invalidate affected queries](/react/queries/#refresh-after-a-write). Capture their original account/token keys before starting the operation so a later account selection does not change the refresh target.
