---
title: TypeScript quickstart
description: Connect to Futurenet and read the native-token contract with a typed TypeScript client.
---

Read the native token's total supply from Futurenet with a typed contract call. This experimental token has no monetary value. This path needs Node.js and npm, but no CLI, signing key, or contract deployment.

## 1. Create a project

```bash
mkdir my-thruput-app
cd my-thruput-app
npm init -y
npm pkg set type=module
mkdir -p src
```

Install the SDK and a TypeScript runner from the public npm registry. If you used GitHub Packages before, [remove the old registry setting](/typescript/setup/#give-npm-package-access) first. Client 0.25.0 requires protocol 0.19.1, so install these exact versions:

```bash
npm install --save-exact @thruputchain/client@0.25.0 @thruputchain/protocol@0.19.1
npm install --save-dev typescript tsx @types/node
```

## 2. Read a contract

Create `src/index.ts`:

```ts
import { createThruputClient, futurenet, formatUnits, getContract } from "@thruputchain/client";
import { ERC20 } from "@thruputchain/client/contracts";
import { NATIVE_TOKEN_ADDRESS } from "@thruputchain/protocol";

async function main() {
  const client = await createThruputClient({ cluster: futurenet() });
  const nativeToken = getContract({ binding: ERC20.v0_1, address: NATIVE_TOKEN_ADDRESS, client });
  const supply = await nativeToken.totalSupply.view({ args: undefined });

  console.log("Native-token supply:", formatUnits(supply.value, 7));
  console.log("Read at block:", supply.stateBlockHeight.toString());
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
```

`futurenet()` selects Futurenet. The SDK includes the native-token contract's standard binding, and `NATIVE_TOKEN_ADDRESS` is its protocol constant, so you do not need to generate a binding. `supply.value` is a typed integer; formatting it displays whole-token units rather than base units.

## 3. Run it

```bash
npx tsx src/index.ts
```

You should see **Native-token supply** and **Read at block**, each followed by a value. Run the command again to make another read. The values come from Futurenet and can change; there is no fixed expected block number.

This is a read-only call. It does not request wallet permission or submit a transaction.

## Next

Use [Read contract data](/typescript/reads/) for arguments, caller context, and cancellation, or [Connect a wallet](/tools/wallet-integration/) to add signing and transaction submission.

## Use a coding agent

```text
Build the Project Thruput TypeScript quickstart:
https://www.thruput.network/docs/get-started/typescript/
Use @thruputchain/client 0.25.0 with @thruputchain/protocol 0.19.1 and the hosted Futurenet.
Install the packages from public npm without GitHub authentication. Create the typed native-token
total-supply read shown in the guide and run it. Show the actual supply
and block height, or report the exact error if the request fails.
Do not install the Rust toolchain, deploy a contract, or create a wallet
for this read-only example. Keep the generated package lockfile.
```
