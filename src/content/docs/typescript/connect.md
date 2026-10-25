---
title: Connect to a network
description: Create a public client, select Futurenet or a local endpoint, and check network identity.
---

A public client performs RPC reads without signing. Create one per application network and share it across contract bindings and wallet clients.

## Connect to Futurenet

Create `src/client.ts`:

```ts
import { createThruputClient, futurenet } from "@thruputchain/client";

export const client = await createThruputClient({ cluster: futurenet() });
```

Client creation is asynchronous. It checks that the endpoint uses RPC wire format 14 and reads its network identity before returning. Other examples import this client from `./client.js`.

To check the connection, create `src/network.ts`:

```ts
import { toBase58 } from "@thruputchain/client";
import { client } from "./client.js";

const [tip, version] = await Promise.all([
  client.getChainTip(),
  client.getVersionInfo(),
]);
console.log("Network:", toBase58(client.network.networkHash));
console.log("Block:", tip.blockHeight.toString());
console.log("Wire format:", version.wireFormat);
```

```bash
npx tsx src/network.ts
```

No wallet permission or account funding is required.

## Select another endpoint

`futurenet({ rpcUrl })` overrides the Futurenet endpoint. The deprecated `devnet()` helper remains available for existing applications and retains its `"devnet"` cluster name. For a local node, replace the cluster with `localnet()`:

```ts
import { createThruputClient, localnet } from "@thruputchain/client";

const client = await createThruputClient({ cluster: localnet() });
```

Start the node with [the CLI](/cli/local-node/) first. The SDK does not read CLI runtime manifests. `localnet()` expects the all-zero network hash unless you provide a custom `networkHash`.

Use `defineCluster()` for a reusable custom descriptor. `mainnet()` requires an explicit endpoint. Cluster capabilities, such as `airdrop`, declare expected services. Client creation throws `RpcCompatibilityError` when the endpoint does not advertise the matching method.

## Pin a network identity

Futurenet is unpinned by default. To require a specific deployment, provide the trusted hash from your environment:

```ts
import { createThruputClient, futurenet, hashFromBase58, networkHash } from "@thruputchain/client";

const expected = process.env.THRUPUT_NETWORK_HASH;
if (!expected) throw new Error("Set THRUPUT_NETWORK_HASH to the expected base58 network hash");
const client = await createThruputClient({
  cluster: futurenet({ networkHash: networkHash(hashFromBase58(expected)) }),
});
```

An identity mismatch throws `RpcCompatibilityError`. Use the base58 `networkHash` from [`getNetworkInfo`](/reference/json-rpc-api/#getnetworkinfo). A Futurenet reset can change the network hash. Update the trusted configuration deliberately rather than accepting a wallet-supplied hash as your application's network.

## Configure transport behavior

Use [HTTP transport](/typescript/transport/) for timeouts, batching, and custom transports. A transport-only client reads the endpoint's network but does not pin it. A wallet bound to it requires an explicit signing network hash that matches that network.
