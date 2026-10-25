---
title: Use a signer in scripts
description: Bind a Node.js signer to a native account, request Futurenet funds, and use local bootstrap accounts.
---

Use a signer when your Node.js script or service manages an account's key. This page sets up a pubkey account. See [Accounts and wallet clients](/typescript/wallet-clients/) for account models and client construction, or [Connect a wallet](/tools/wallet-integration/) for a browser application.

## Bind a signer

Supply a 32-byte Ed25519 private-key seed through your process environment as `THRUPUT_PRIVATE_KEY`, using `0x`-prefixed hex. For a disposable Futurenet test account, generate one once in your terminal:

```bash
export THRUPUT_PRIVATE_KEY="$(node -e 'process.stdout.write("0x" + require("node:crypto").randomBytes(32).toString("hex"))')"
```

Keep that environment for the funding and send commands. Generating another seed selects another account. For a persistent account, load the existing seed from your secret configuration.

Create `src/wallet.ts`:

```ts
import {
  Ed25519Signer, createPubkeyAccount, createWalletClient, fromHex0x,
} from "@thruputchain/client";
import { client } from "./client.js";

const secret = process.env.THRUPUT_PRIVATE_KEY;
if (!secret) throw new Error("Set THRUPUT_PRIVATE_KEY for this script account");

export const account = createPubkeyAccount({
  signer: Ed25519Signer.fromSeed(fromHex0x(secret)),
});
export const wallet = createWalletClient({ client, account });
```

Keep the key in the process's secret configuration, not browser code or committed files.

For an ML-DSA-65 account, use the same kind of 32-byte seed with `MlDsa65Signer`:

```ts
import { MlDsa65Signer, createPubkeyAccount, fromHex0x } from "@thruputchain/client";

export const account = createPubkeyAccount({
  signer: MlDsa65Signer.fromSeed(fromHex0x(secret)),
});
```

One seed gives a different account under each scheme. ML-DSA-65 keys have no StrKey form, and an ML-DSA-65 signed transaction is about 5 KB larger than an Ed25519 one.

<span id="request-devnet-funds"></span>

## Request Futurenet funds

Create `src/fund.ts`:

```ts
import { toBase58 } from "@thruputchain/client";
import { account, wallet } from "./wallet.js";

const result = await wallet.requestAirdrop();
console.log("Account:", toBase58(account.address));
console.log("Funding transaction:", toBase58(result.transactionHash));
```

```bash
npx tsx src/fund.ts
```

The client must use a cluster that declares airdrop support. The hosted faucet selects the allocation. `requestAirdrop` calls the faucet once, then observes any returned transaction hash. It throws if the funding transaction does not execute successfully. `requestAirdropAttempt` performs one faucet call and leaves observation to the application.

## Use a local development account

For a node started by [the CLI](/cli/local-node/), create a disposable signer and fund it from the local faucet. In the terminal that runs the script:

```bash
export THRUPUT_SIGNING_PRIVATE_KEY="$(node -e 'process.stdout.write("0x" + require("node:crypto").randomBytes(32).toString("hex"))')"
```

```ts
import { createThruputClient, createPubkeyAccount, createWalletClient, Ed25519Signer, fromHex0x, localnet } from "@thruputchain/client";

const seed = process.env.THRUPUT_SIGNING_PRIVATE_KEY;
if (!seed) throw new Error("Set THRUPUT_SIGNING_PRIVATE_KEY");
const client = await createThruputClient({ cluster: localnet() });
const signer = Ed25519Signer.fromSeed(fromHex0x(seed));
const account = createPubkeyAccount({ signer });
const wallet = createWalletClient({ client, account });
await wallet.requestAirdrop();
```

`localnet()` selects the local endpoint and checks its network identity. Keep the signer seed in this terminal environment for later calls. Use an existing seed from secret configuration when the account must persist. The SDK does not load CLI account files or runtime manifests.
