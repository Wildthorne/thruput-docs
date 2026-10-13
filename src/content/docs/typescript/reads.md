---
title: Read contract data
description: Read typed contract values, require a minimum height, and group related reads at one committed snapshot.
---

A view simulates a contract call against committed state without submitting a transaction. It needs a public client and a binding, not a signer.

<span id="read-the-existing-hog-contract"></span>

## Read the existing native-token contract

Use the `src/client.ts` from [Connect to a network](/typescript/connect/). Create `src/read.ts`:

```ts
import { formatUnits, getContract } from "@thruputchain/client";
import { ERC20 } from "@thruputchain/client/contracts";
import { HOG_ADDRESS } from "@thruputchain/protocol";
import { client } from "./client.js";

const hog = getContract({ binding: ERC20.v0_1, address: HOG_ADDRESS, client });
const result = await hog.totalSupply.view({ args: undefined });
console.log("Native-token supply:", formatUnits(result.value, 7));
console.log("Read at block:", result.height.toString());
```

```bash
npx tsx src/read.ts
```

The client supplies the standard ERC-20 binding, and the protocol package supplies the deployed native-token address as `HOG_ADDRESS`. No Rust contract or generated application file is needed for this example.

## Pass arguments and caller context

For an address held by your application:

```ts
import { addressFromHex } from "@thruputchain/client";

export async function readBalance(ownerText: string, signal?: AbortSignal) {
  const owner = addressFromHex(ownerText);
  return hog.getBalanceOf.view({ args: { addr: owner }, signal });
}
```

A view result includes the typed `value`, snapshot `height`, `gasUsed`, and simulated `events`. Independent reads can use different snapshots or lag a recent transaction receipt.

Pass `caller` when the method needs a simulated caller. This changes call context; it does not prove control of that address or authorize a transaction.

## Read after confirmation

Pass a successful receipt's `height` as `minHeight` when the read must include that committed transaction:

```ts
export async function readBalanceAtLeast(ownerText: string, minHeight: bigint, signal?: AbortSignal) {
  return hog.getBalanceOf.view({
    args: { addr: addressFromHex(ownerText) },
    minHeight,
    signal,
  });
}
```

`minHeight` is an optional nonnegative `bigint` freshness floor, not an exact historical height. The same option works with generated `.view()`, `.viewOutcome()`, bound views, and raw `client.view()`. Omit it for an unconstrained read.

A backend whose selected snapshot is behind returns `ViewHeightUnavailable` (`-32011`) with requested and observed heights. The request does not wait for a block or force a refresh, and the client does not poll or retry it. Keep the confirmed receipt and decide when to retry the read; this error is not a reason to repeat the write.

## Read related values from one snapshot

Prepare calls with `viewRequest()` and send them together through `readViews()`:

```ts
export async function readTokenSnapshot(ownerText: string, minHeight?: bigint, signal?: AbortSignal) {
  const owner = addressFromHex(ownerText);
  const snapshot = await client.readViews({
    calls: [
      ERC20.v0_1.totalSupply.viewRequest({ contract: HOG_ADDRESS }),
      ERC20.v0_1.getBalanceOf.viewRequest({
        contract: HOG_ADDRESS,
        args: { addr: owner },
      }),
    ],
    minHeight,
  }, { signal });

  const [supply, balance] = snapshot.results;
  if (supply.kind === "return" && balance.kind === "return") {
    console.log("Shared snapshot:", snapshot.height.toString());
    console.log("Supply and balance:", supply.value, balance.value);
  } else {
    console.error("Read outcomes:", supply.kind, balance.kind);
  }
  return snapshot;
}
```

`viewRequest()` performs no I/O. `readViews()` returns results in input order, retaining each call's inferred return and exception types, events, and gas use. Each result is `return`, `abort`, or `fault`. Transport, freshness, and decoding failures reject the group.

All calls use one committed snapshot, and simulated writes stay within their own call. Put `minHeight` on the group, not on individual prepared calls. Two separate reads with the same minimum height can still use different snapshots.

Shared reads require a batch-capable RPC endpoint and runtime. Inspect `(await client.getServerLimits()).viewBatch` for advertised call, gas, calldata, response-size, and timeout limits. The client never splits a group or falls back to separate views. [HTTP batching](/typescript/transport/#http-batching) alone does not provide this guarantee. Raw requests use `client.viewBatch({ calls, minHeight }, { signal })`.

## Handle contract outcomes

`view()` throws `ContractViewError` for an abort or fault. Use `viewOutcome()` when those outcomes belong in your application's normal control flow:

```ts
const outcome = await hog.totalSupply.viewOutcome({ args: undefined });
if (outcome.kind === "return") {
  console.log(outcome.value);
} else {
  console.error("Contract view failed:", outcome.kind);
}
```

Malformed contract bytes throw `ContractDecodeError`. Transport and RPC failures remain separate from contract outcomes.

## Cancel stale reads

```ts
import { classifyReadError } from "@thruputchain/client";

export async function refreshSupply(signal: AbortSignal) {
  try {
    return await hog.totalSupply.view({ args: undefined, signal });
  } catch (error) {
    if (classifyReadError(error, { signal }) === "cancelled") return;
    throw error;
  }
}
```

Create an `AbortController` for the operation and call `abort()` when its result is no longer needed. RPC actions, including `readViews`, take `{ signal }` as request options; bound views take it inside their options object. Canceling a group ends the client's wait but does not guarantee that backend execution has stopped.

`classifyReadError` returns `transient`, `permanent`, `cancelled`, or `unknown`. It does not retry or replace the error. Applications choose retry limits; an unclassified `TypeError` is not proof of a network failure.
