---
title: Read contract data
description: Read an existing contract with typed views, handle read failures, and cancel stale requests.
---

A view simulates a contract call against committed state without submitting a transaction. It needs a public client and a binding, not a signer.

<span id="read-the-existing-hog-contract"></span>

## Read the existing native-token contract

Use the `src/client.ts` from [Connect to a network](/typescript/connect/). Create `src/read.ts`:

```ts
import { formatUnits, getContract } from "@groundhogchain/client";
import { ERC20 } from "@groundhogchain/client/contracts";
import { HOG_ADDRESS } from "@groundhogchain/protocol";
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
import { addressFromHex } from "@groundhogchain/client";

export async function readBalance(ownerText: string, signal?: AbortSignal) {
  const owner = addressFromHex(ownerText);
  return hog.getBalanceOf.view({ args: { addr: owner }, signal });
}
```

A view result includes the typed `value`, snapshot `height`, and simulated `events`. Independent reads can use different snapshots or lag a recent transaction receipt. When checking state after a write, compare the view's height with the committed receipt's height before treating it as the post-transaction state.

Pass `caller` when the method needs a simulated caller. This changes call context; it does not prove control of that address or authorize a transaction.

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
import { classifyReadError } from "@groundhogchain/client";

export async function refreshSupply(signal: AbortSignal) {
  try {
    return await hog.totalSupply.view({ args: undefined, signal });
  } catch (error) {
    if (classifyReadError(error, { signal }) === "cancelled") return;
    throw error;
  }
}
```

Create an `AbortController` for the operation and call `abort()` when its result is no longer needed. RPC actions take `{ signal }` as request options; bound views take it inside their options object.

`classifyReadError` returns `transient`, `permanent`, `cancelled`, or `unknown`. It does not retry or replace the error. Applications choose retry limits; an unclassified `TypeError` is not proof of a network failure.
