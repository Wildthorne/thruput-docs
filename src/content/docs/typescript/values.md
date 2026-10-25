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
const oneToken = parseUnits("1", 7);  // 10000000n
```

Both helpers support 0–255 decimals and signed amounts. Parsing rejects whitespace, exponents, and excess precision rather than rounding. `ParseUnitsError.code` is `malformed` or `precision`; invalid decimal counts throw `RangeError`.

The native token has seven decimal places. Other tokens choose their own decimals. Check positivity and the contract's integer bounds separately. Avoid converting amounts to `number`, which can lose precision.

## Convert addresses and hashes

Addresses and transaction and network hashes are unprefixed, case-sensitive base58 in RPC responses, the CLI, and wallet providers. Use base58 for any identifier that users see or paste, that you store, or that you compare with those values:

```ts
import { addressFromBase58, hashFromBase58, toBase58 } from "@thruputchain/client";

export function parseIdentifiers(addressText: string, transactionText: string) {
  const address = addressFromBase58(addressText);
  const transactionHash = hashFromBase58(transactionText);
  return { address, transactionHash, displayAddress: toBase58(address) };
}
```

Both parsers require 32 decoded bytes. `parseAddress(text)` also accepts a `C` StrKey address.

Use `toHex0x` and `fromHex0x` for signed transaction bytes, calldata, raw event topics, and storage keys. These opaque byte fields stay `0x`-prefixed hex.

Use `gasAmount(500_000n)` for a typed gas budget. A gas amount is a computation limit, not a native-token amount.

## Store values in application data

JavaScript's default JSON serializer does not accept `bigint`. For application-owned storage, use decimal strings for integers and base58 for addresses and hashes. Store event and history cursors as the opaque strings the client returns. The client handles RPC serialization itself.
