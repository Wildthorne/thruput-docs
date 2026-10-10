---
title: Connect to a network
description: Create a public client, select Devnet or a local endpoint, and check network identity.
---

A public client performs RPC reads without signing. Create one per application network and share it across contract bindings and wallet clients.

## Connect to Devnet

Create `src/client.ts`:

```ts
import { createGroundhogClient, devnet } from "@groundhogchain/client";

export const client = await createGroundhogClient({ cluster: devnet() });
```

Client creation is asynchronous. It fetches the network identity before returning. Other examples import this client from `./client.js`.

To check the connection, create `src/network.ts`:

```ts
import { toHex0x } from "@groundhogchain/client";
import { client } from "./client.js";

const [tip, version] = await Promise.all([
  client.getChainTip(),
  client.getVersion(),
]);
console.log("Network:", toHex0x(client.network.networkHash));
console.log("Block:", tip.height.toString());
console.log("Wire format:", version.wireFormat);
```

```bash
npx tsx src/network.ts
```

No wallet permission or account funding is required.

## Select another endpoint

`devnet({ rpcUrl })` overrides the Devnet endpoint. For a local node, replace the cluster with `localnet()`:

```ts
import { createGroundhogClient, localnet } from "@groundhogchain/client";

const client = await createGroundhogClient({ cluster: localnet() });
```

Start the node with [the CLI](/cli/local-node/) first. Local account manifests and RPC endpoints must refer to the same node.

Use `defineCluster()` for a reusable custom descriptor. `mainnet()` requires an explicit endpoint. Cluster capabilities, such as `airdrop`, declare expected services; they are not server capability discovery.

## Pin a network identity

Devnet is unpinned by default. To require a specific deployment, provide the trusted hash from your environment:

```ts
import { createGroundhogClient, devnet, hashFromHex, networkHash } from "@groundhogchain/client";

const expected = process.env.THRUPUT_NETWORK_HASH;
if (!expected) throw new Error("Set THRUPUT_NETWORK_HASH to the expected 0x-prefixed hash");
const client = await createGroundhogClient({
  cluster: devnet({ networkHash: networkHash(hashFromHex(expected)) }),
});
```

An identity mismatch throws `NetworkMismatchError`. A Devnet reset can change the network hash. Update the trusted configuration deliberately rather than accepting a wallet-supplied hash as your application's network.

## Configure transport behavior

Use [HTTP transport](/typescript/transport/) for timeouts, batching, and custom transports. A transport-only client skips cluster identity validation; a wallet bound to it requires an explicit signing network hash.
