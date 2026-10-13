---
title: Use a signer in scripts
description: Bind a Node.js signer to a native account, request Devnet funds, and use local bootstrap accounts.
---

Use a signer when your Node.js script or service manages an account's key. This page sets up a pubkey account. See [Accounts and wallet clients](/typescript/wallet-clients/) for account models and client construction, or [Connect a wallet](/tools/wallet-integration/) for a browser application.

## Bind a signer

Supply a 32-byte Ed25519 private-key seed through your process environment as `THRUPUT_PRIVATE_KEY`, using `0x`-prefixed hex. For a disposable Devnet test account, generate one once in your terminal:

```bash
export THRUPUT_PRIVATE_KEY="$(node -e 'process.stdout.write("0x" + require("node:crypto").randomBytes(32).toString("hex"))')"
```

Keep that environment for the funding and send commands. Generating another seed selects another account. For a persistent account, load the existing seed from your secret configuration.

Create `src/wallet.ts`:

```ts
import {
  PrivateKeySigner, createPubkeyAccount, createWalletClient, fromHex0x,
} from "@thruputchain/client";
import { client } from "./client.js";

const secret = process.env.THRUPUT_PRIVATE_KEY;
if (!secret) throw new Error("Set THRUPUT_PRIVATE_KEY for this script account");

export const account = createPubkeyAccount({
  signer: new PrivateKeySigner(fromHex0x(secret)),
});
export const wallet = createWalletClient({ client, account });
```

Keep the key in the process's secret configuration, not browser code or committed files.

## Request Devnet funds

Create `src/fund.ts`:

```ts
import { toHex0x } from "@thruputchain/client";
import { account, wallet } from "./wallet.js";

const result = await wallet.requestAirdrop();
if (result.status.result !== "ok") {
  throw new Error(`Airdrop execution failed: ${result.status.result}`);
}
console.log("Account:", toHex0x(account.address));
console.log("Funding transaction:", toHex0x(result.txHash));
```

```bash
npx tsx src/fund.ts
```

The client must use a cluster that declares airdrop support. The hosted faucet selects the allocation. `requestAirdrop` polls one attempt with a stable nonce; retain an explicit `clientNonce` if your application must recover the request across process restarts. `requestAirdropAttempt` exposes application-controlled polling.

## Use a local development account

For a node started by [the CLI](/cli/local-node/), create a disposable signer and fund it from the local faucet. In the terminal that runs the script:

```bash
export THRUPUT_SIGNING_PRIVATE_KEY="$(node -e 'process.stdout.write("0x" + require("node:crypto").randomBytes(32).toString("hex"))')"
```

```ts
import { createThruputClient, createPubkeyAccount, createWalletClient, fromHex0x, localnet, PrivateKeySigner } from "@thruputchain/client";

const seed = process.env.THRUPUT_SIGNING_PRIVATE_KEY;
if (!seed) throw new Error("Set THRUPUT_SIGNING_PRIVATE_KEY");
const client = await createThruputClient({ cluster: localnet() });
const signer = new PrivateKeySigner(fromHex0x(seed));
const account = createPubkeyAccount({ signer });
const wallet = createWalletClient({ client, account });
await wallet.requestAirdrop();
```

`localnet()` selects the local endpoint and checks its network identity. Keep the signer seed in this terminal environment for later calls. Use an existing seed from secret configuration when the account must persist. The SDK does not load CLI account files or runtime manifests.
