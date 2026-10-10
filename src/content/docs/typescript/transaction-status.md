---
title: Track transaction results
description: Observe a submitted hash, distinguish commitment from execution success, and handle transaction errors.
---

Submission, commitment, execution, and decoding are separate steps. Keep the transaction hash and network so the application can continue observing the same operation after a timeout or wallet disconnect.

## Inspect a submitted transaction

Use the public client from [Connect to a network](/typescript/connect/). Create `src/status.ts`:

```ts
import { ExecResult, hashFromHex } from "@groundhogchain/client";
import { client } from "./client.js";

const text = process.env.THRUPUT_TX_HASH;
if (!text) throw new Error("Set THRUPUT_TX_HASH to the submitted transaction hash");
const hash = hashFromHex(text);
const status = await client.getTransactionStatus(hash);

if (status.status === "committed") {
  const receipt = await client.getTransactionReceipt(hash);
  if (!receipt) throw new Error("The committed receipt is not available from this endpoint");
  console.log("Execution succeeded:", receipt.execResult === ExecResult.ExecResultOK);
  console.log("Block:", receipt.height.toString());
} else {
  console.log("Status:", status.status);
}
```

This performs one status check. `waitForTransactionReceipt(hash)` polls for a receipt, but does not itself require successful execution. Check `execResult` or use `waitForExecution(client, hash)` to require success.

## Interpret status

| Status | Application meaning |
| --- | --- |
| `pending` | The gateway knows the transaction; keep waiting |
| `committed` | Fetch the receipt and check execution; status `height` can be absent until indexing supplies it |
| `invalid` | Show the reported reason |
| `recentFailure` | Advisory failure of an attempt; the transaction can still commit |
| `retry` | Scheduler processing failed; resubmitting the same signed transaction may succeed |
| `dropped` | Scheduler processing failed permanently; modify the transaction before resubmitting |
| `unknown` or `other` | No conclusive successful or failed execution result |

A timeout or canceled observation does not cancel onchain execution. Query the original hash on the original network rather than automatically signing a replacement.

## Handle scheduler processing errors

`waitForTransactionReceipt()` throws `TransactionProcessingError` on `retry` or `dropped`. It stops polling and never resubmits. Keep the hash, status, and scheduler diagnostics:

```ts
import { TransactionProcessingError } from "@groundhogchain/client";

try {
  const receipt = await client.waitForTransactionReceipt(hash);
  console.log("Execution succeeded:", receipt.execResult === ExecResult.ExecResultOK);
} catch (error) {
  if (error instanceof TransactionProcessingError) {
    console.error({ txHash: error.txHash, status: error.status, error: error.error });
  }
  throw error;
}
```

`error.error` is a `SchedulerTransactionError`: `source` is `auth`, `scheduler`, `executor`, or `other`, and `code` is a signed 32-bit number. Interpret the code using that source's protocol error enum. The client maps unrecognized sources to `other` and preserves the code.

## Handle execution-helper errors

| Error | What happened | What to retain |
| --- | --- | --- |
| `TransactionExecutionError` | Committed execution failed | `receipt` |
| `TransactionObservationError` | Observation failed after submission was attempted | `txHash`, `cause`, and any `submissionCause` |
| `ExecutionDecodeError` | Execution succeeded, but child return decoding failed | Successful `receipt` and decoding cause |
| `ExecutionReturnUnavailableError` | Execution succeeded, but the wallet did not provide child returns | Successful `receipt` |

For example, classify errors from a wallet execution helper:

```ts
import { TransactionExecutionError, TransactionObservationError, toHex0x } from "@groundhogchain/client";

export function describeExecutionError(error: unknown): string {
  if (error instanceof TransactionObservationError) {
    return `Check transaction ${toHex0x(error.txHash)} on its original network`;
  }
  if (error instanceof TransactionExecutionError) {
    return `Committed execution failed: ${error.receipt.execResult}`;
  }
  return error instanceof Error ? error.message : "Transaction operation failed";
}
```

A decoding failure is not a reason to repeat a successful write. Keep the submitted call descriptors if you need to decode the receipt again later.

## Decode the correct method

`decodeReceipt` and `decodeReceiptOutcome` apply to a known **root method**. A wallet-root receipt is not a receipt for the application method it called. Use `executeCallsAndWait` or `decodeExecution(receipt, calls)` for ordered DefaultWallet child returns.

Do not decode a root abort with a child method's exception schema merely because the transaction contained one child call. The wallet itself may have failed before the child executed.

## Restore application state

After a reload, use the saved hash and network to resume public observation. This does not require the wallet to remain connected. A provider's `onSigned` callback provides the pre-submission record; see [Send transactions](/typescript/transactions/#send-through-a-browser-wallet).

For protocol-level outcomes, see [Transaction Lifecycle](/how-it-works/transaction-lifecycle/).
