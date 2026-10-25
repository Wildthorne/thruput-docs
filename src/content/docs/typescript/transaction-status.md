---
title: Track transaction results
description: Observe a submitted hash, distinguish commitment from execution success, and handle transaction errors.
---

Submission, commitment, execution, and decoding are separate steps. Keep the transaction hash and network so the application can continue observing the same operation after a timeout or wallet disconnect.

## Inspect a submitted transaction

Use the public client from [Connect to a network](/typescript/connect/). Create `src/status.ts`:

```ts
import { hashFromBase58 } from "@thruputchain/client";
import { client } from "./client.js";

const text = process.env.THRUPUT_TX_HASH;
if (!text) throw new Error("Set THRUPUT_TX_HASH to the base58 transaction hash");
const transactionHash = hashFromBase58(text);
const status = await client.getTransactionStatus({ transactionHash });
if (!("status" in status)) throw new Error("Unsupported status from a newer server");

if (status.status === "committed") {
  const receipt = await client.getTransactionReceipt({ transactionHash });
  if (!receipt) throw new Error("The committed receipt is not available from this endpoint");
  const { execution } = receipt;
  console.log("Execution succeeded:", "result" in execution && execution.result === "return");
  console.log("Block:", receipt.blockHeight.toString());
} else {
  console.log("Status:", status.status);
}
```

This performs one status check. `client.waitForTransactionReceipt(hash)` polls for a receipt, but does not itself require successful execution. Check `receipt.execution.result` or use `waitForExecution(client, hash)` to require success.

## Interpret status

| Status | Application meaning |
| --- | --- |
| `pending` | The scheduler has the transaction; keep waiting |
| `committed` | Fetch the receipt and check execution; `blockHeight` is always present |
| `recentFailure` | Advisory failure of an attempt; the transaction can still commit |
| `retry` | Scheduler processing failed; resubmitting the same signed transaction may succeed |
| `dropped` | Scheduler processing failed; inspect `error`. For insufficient native tokens (`SchedulerErrorInsufficientNativeTokens`), fund the sender before resubmitting the same signed transaction while valid. For errors that require changing the transaction, resolve the original outcome before signing a replacement. See [Resubmission and replacement](#resubmission-and-replacement) |
| `unknown` or `other` | No conclusive successful or failed execution result |

`pending`, `retry`, and `dropped` can include an advisory `recentFailure` diagnostic. It can describe an earlier attempt. A value from a newer server arrives as `UnsupportedRpcValue`. See [`getTransactionStatus`](/reference/json-rpc-api/#gettransactionstatus) for the wire fields.

A timeout or canceled observation does not cancel onchain execution. Query the original hash on the original network rather than automatically signing a replacement.

## Handle scheduler processing errors

`waitForTransactionReceipt()` keeps polling through `retry`, `dropped`, and `recentFailure` statuses, and it never resubmits. It reports each observed status through `onStatus`. When observation stops, it throws `TransactionReceiptObservationError`, or its subclass `TransactionReceiptTimeoutError`:

```ts
import { TransactionReceiptObservationError } from "@thruputchain/client";

try {
  const receipt = await client.waitForTransactionReceipt(transactionHash, {
    onStatus(status) {
      if ("error" in status) console.warn(status.status, status.error.source, status.error.code);
    },
  });
  console.log("Committed at block:", receipt.blockHeight.toString());
} catch (error) {
  if (error instanceof TransactionReceiptObservationError) {
    console.error({ lastStatus: error.lastStatus, knownCommitment: error.knownCommitment });
  }
  throw error;
}
```

`error` on a `retry` or `dropped` status is a `SchedulerTransactionError`: `source` is `auth`, `scheduler`, `executor`, or `other`, and `code` is a signed 32-bit number. Interpret the code using that source's protocol error enum. To stop waiting early, pass a `signal` and abort it. Neither a timeout nor cancellation proves the transaction did not execute.

## Resubmission and replacement

Keep the original signed bytes, transaction hash, and signing network so recovery does not create a different transaction. Query the original hash on that network and preserve any known commitment. A missing receipt from one endpoint does not erase a known commitment.

An excluded proposal attempt does not consume the replay nonce. Scheduler requeue depends on the proposal outcome; it is not guaranteed. See [Exclusion, requeue, and resubmission](/how-it-works/transaction-lifecycle/#exclusion-requeue-and-resubmission).

When the reported scheduler error permits another attempt and the transaction remains valid, resubmit the same signed bytes with bounded backoff. Receipt polling alone will not do this. `recentFailure` is advisory and does not authorize resubmission or replacement.

Stop resubmitting once the transaction expires. Expiration prevents future inclusion, but an earlier attempt may already have committed. A timeout, `unknown`, or expiration alone is not proof of nonexecution. Resolve the original outcome before deciding whether to sign a replacement. For a receipt-confirmed abort or fault, fix the cause before signing a new transaction; its replay nonce has already been consumed.

## Handle execution-helper errors

| Error | What happened | What to retain |
| --- | --- | --- |
| `TransactionExecutionError` | Committed execution failed | `receipt` |
| `TransactionObservationError` | Submission or observation stopped; `phase` is `beforeSubmission`, `submission`, or `observation` | `transactionHash`, `submission` (signed bytes and network), `cause`, and any `submissionCause` or `knownCommitment` |
| `ExecutionDecodeError` | Execution succeeded, but child return decoding failed | Successful `receipt` and decoding cause |
| `ExecutionReturnUnavailableError` | Execution succeeded, but the wallet did not provide child returns | Successful `receipt` |

For example, classify errors from a wallet execution helper:

```ts
import { TransactionExecutionError, TransactionObservationError, toBase58 } from "@thruputchain/client";

export function describeExecutionError(error: unknown): string {
  if (error instanceof TransactionObservationError) {
    return `Check transaction ${toBase58(error.transactionHash)} on its original network`;
  }
  if (error instanceof TransactionExecutionError) {
    const { execution } = error.receipt;
    return `Committed execution failed: ${"result" in execution ? execution.result : "unsupported result"}`;
  }
  return error instanceof Error ? error.message : "Transaction operation failed";
}
```

A decoding failure is not a reason to repeat a successful write. Keep the submitted call descriptors if you need to decode the receipt again later.

## Decode the correct method

`decodeReceipt` and `decodeReceiptOutcome` apply to a known **root method**. A wallet-root receipt is not a receipt for the application method it called. Use `executeCallsAndWait` or `decodeExecution(receipt, calls)` for ordered DefaultWallet child returns.

Do not decode a root abort with a child method's exception schema merely because the transaction contained one child call. The wallet itself may have failed before the child executed.

## Restore application state

After a reload, use the saved hash and network to resume public observation. Decode a saved base58 hash with `hashFromBase58`. This does not require the wallet to remain connected. A provider's `onSigned` callback provides the pre-submission record; see [Send transactions](/typescript/transactions/#send-through-a-browser-wallet).

For protocol-level outcomes, see [Transaction Lifecycle](/how-it-works/transaction-lifecycle/).
