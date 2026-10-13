---
title: Addresses and amounts
description: Parse and display exact amounts, addresses, and hashes in a TypeScript application.
---

Contract integers are JavaScript `bigint` values. Addresses and hashes are typed byte arrays. Convert at the application's input and display boundaries.

## Parse and display amounts

```ts
import { parseUnits, formatUnits } from "@thruputchain/client";

const amount = parseUnits("12.05", 2); // 1205n
console.log(formatUnits(amount, 2));  // "12.05"
const oneHog = parseUnits("1", 7);    // 10000000n
```

Both helpers support 0–255 decimals and signed amounts. Parsing rejects whitespace, exponents, and excess precision rather than rounding. `ParseUnitsError.code` is `malformed` or `precision`; invalid decimal counts throw `RangeError`.

The native token has seven decimal places. Other tokens choose their own decimals. Check positivity and the contract's integer bounds separately. Avoid converting amounts to `number`, which can lose precision.

## Convert addresses and hashes

```ts
import { addressFromHex, hashFromHex, toHex0x } from "@thruputchain/client";

export function parseInputs(addressText: string, transactionText: string) {
  const address = addressFromHex(addressText);
  const txHash = hashFromHex(transactionText);
  return { address, txHash, displayAddress: toHex0x(address) };
}
```

These inputs use `0x`-prefixed hex. Provider session network hashes use a different wire format: 64 lowercase hex characters without `0x`. Convert explicitly when crossing the [wallet provider](/tools/wallet-provider/#canonical-data-and-limits) boundary.

Use `gasAmount(500_000n)` for a typed gas budget. A gas amount is a computation limit, not a native-token amount.

## Store values in application data

JavaScript's default JSON serializer does not accept `bigint`. For application-owned storage, use decimal strings for integers and a defined byte encoding for addresses, hashes, and cursors. The client handles RPC serialization itself.
