---
title: "Build a counter, part 2: TypeScript"
description: Create a typed client and a small server-side development signer for the counter, without cloning a repository.
sidebar:
  label: "Counter 2: TypeScript"
---

Build the TypeScript layer for the contract from [part 1](/tutorials/build-a-counter/). It will read the counter and prepare signed updates with a funded development key. The key stays in Node.js. Part 3 adds a React interface that can start counting immediately.

## Create the app directory

Inside the `counter` project from part 1:

```bash
mkdir app
cd app
npm init -y
npm pkg set type=module
```

Configure [npm registry access](/typescript/setup/#give-npm-package-access), then install the TypeScript dependencies:

```bash
npm install @thruputchain/client @thruputchain/protocol
npm install --save-dev typescript tsx @types/node
mkdir -p src/contracts
```

Keep the generated lockfile. Add these entries to `.gitignore`:

```text title=".gitignore"
node_modules/
dist/
.env
```

## Generate the TypeScript binding

Use Thruput CLI 0.29.0 or newer. Its TypeScript generator imports the `@thruputchain` packages used by this app. Generate the binding from the contract spec built in part 1. Run this from `app`:

```bash
thruput codegen ts ../target/thruput/counter.spec.xdr \
  --output src/contracts/counter.ts
```

The binding provides typed methods and decodes the contract's results. Regenerate it when the contract interface changes.

## Configure the client

Create `.env`. Set `COUNTER_ADDRESS` to the deployment address from part 1 and use the endpoint and network hash for that deployment:

```dotenv title=".env"
RPC_URL=https://rpc.thruput.network
NETWORK_HASH=0xabb9cdbc56285d0e71c9845273ca06211fedf7ee2f58c43cfac6060f9402aa0f
COUNTER_ADDRESS=<your-deployed-counter-address>
```

These public values identify one deployment. A different network needs its own endpoint, hash, and contract address.

```ts title="chain.ts"
import {
  addressFromHex, createThruputClient, createPubkeyAccount, createWalletClient,
  defineCluster, fromHex0x, hashFromHex, networkHash, PrivateKeySigner,
} from "@thruputchain/client";
import { Counter } from "./src/contracts/counter.js";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} in .env or the process environment`);
  return value;
}

export const rpcUrl = required("RPC_URL");
export const contract = addressFromHex(required("COUNTER_ADDRESS"));
export const client = await createThruputClient({
  cluster: defineCluster({
    rpcUrl,
    networkHash: networkHash(hashFromHex(required("NETWORK_HASH"))),
    capabilities: ["airdrop"],
  }),
});
export { Counter };

export function developmentWallet() {
  const signer = new PrivateKeySigner(fromHex0x(required("COUNTER_SIGNING_PRIVATE_KEY")));
  return createWalletClient({ client, account: createPubkeyAccount({ signer }) });
}
```

## Read and fund

```ts title="read.ts"
import { client, contract, Counter } from "./chain.js";

const result = await Counter.v0_1.get.view({ client, contract });
console.log("Counter:", result.value.toString());
console.log("Read at block:", result.height.toString());
```

```bash
node --env-file=.env --import tsx read.ts
```

For a disposable development signer, generate a seed once in this terminal:

```bash
export COUNTER_SIGNING_PRIVATE_KEY="$(node -e 'process.stdout.write("0x" + require("node:crypto").randomBytes(32).toString("hex"))')"
```

Keep this terminal environment for funding and the server. A persistent account should load its existing seed from secret configuration. Never put this key in a browser file or a `VITE_` variable.

```ts title="fund.ts"
import { toHex0x } from "@thruputchain/client";
import { developmentWallet } from "./chain.js";

const wallet = developmentWallet();
const funding = await wallet.requestAirdrop();
if (funding.status.result !== "ok") throw new Error("Funding did not execute successfully");
console.log("Development signer:", toHex0x(wallet.account.address));
console.log("Funding transaction:", toHex0x(funding.txHash));
```

```bash
node --env-file=.env --import tsx fund.ts
```

## Add the development server

The server exposes public configuration, proxies the app's RPC requests, and prepares only a `+1` or `-1` call to the configured counter. Preparation signs but does not broadcast. The browser can therefore retain the hash before submission.

```ts title="server.ts"
import { createServer, type ServerResponse } from "node:http";
import { gasAmount, serializeSignedTransaction, toHex0x } from "@thruputchain/client";
import { client, contract, Counter, developmentWallet, rpcUrl } from "./chain.js";

const wallet = process.env.COUNTER_SIGNING_PRIVATE_KEY ? developmentWallet() : null;
const allowed = new Set([
  "groundhog_networkInfo", "groundhog_chainTip", "groundhog_view",
  "groundhog_getBalance", "groundhog_getTransactionStatus",
  "groundhog_getTransactionReceipt", "groundhog_sendRawTransaction",
]);
function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/api/config") {
      return json(response, 200, {
        counterAddress: toHex0x(contract), networkId: toHex0x(client.network.networkHash),
        signerAddress: wallet ? toHex0x(wallet.account.address) : null,
      });
    }
    if (request.method !== "POST") return json(response, 404, { error: "Not found" });
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 65_536) return json(response, 413, { error: "Request too large" });
      chunks.push(Buffer.from(chunk));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (request.url === "/api/prepare") {
      if (!wallet) return json(response, 503, { error: "Development signer unavailable" });
      if (body?.direction !== "increment" && body?.direction !== "decrement") {
        return json(response, 400, { error: "Choose increment or decrement" });
      }
      const direction: "increment" | "decrement" = body.direction;
      const transaction = await wallet.prepareExecution({
        invocation: Counter.v0_1[direction].invocation(contract, gasAmount(500_000n), { amount: 1n }),
        gasLimit: gasAmount(1_000_000n),
      });
      const signed = await wallet.signTransaction(transaction);
      return json(response, 200, { transaction: toHex0x(serializeSignedTransaction(signed)) });
    }
    if (request.url === "/thruput-rpc" && allowed.has(body?.method)) {
      const upstream = await fetch(rpcUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
      });
      return json(response, upstream.status, await upstream.json());
    }
    json(response, 404, { error: "Not found" });
  } catch (error) {
    json(response, 500, { error: error instanceof Error ? error.message : "Request failed" });
  }
}).listen(3001, "127.0.0.1", () => console.log("Counter API: http://127.0.0.1:3001"));
```

Run it in the terminal holding the development key:

```bash
node --env-file=.env --import tsx server.ts
```

**Checkpoint:** the typed read works, the development account is funded, and the API is running. The server keeps its private key; `/api/config` exposes only public identity. Part 3 turns these pieces into a usable React counter.

This server is for local development.

## Work with an agent

```text
Follow Build a counter, part 2:
https://thruput.network/docs/tutorials/work-with-thruput-from-typescript/
Generate the binding from my part-1 contract spec and create the listed
files using my deployment address. Verify the read, funding, and
public configuration endpoint. Keep the development key server-side.
Do not claim success for failed checks or submit replacement transactions
merely because observation failed.
```
