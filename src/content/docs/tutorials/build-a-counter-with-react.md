---
title: "Build a counter, part 3: React"
description: Build a small React counter that can read and update the contract immediately through the development signer.
sidebar:
  label: "Counter 3: React"
---

Add a React interface to the project from [part 2](/tutorials/work-with-thruput-from-typescript/). It will work through the funded development signer as soon as you open it. There is no wallet connection requirement yet.

Keep the API server running on port 3001. All files below are inside the `app` directory you created in part 2.

## Install React

From `app`, install the React packages and browser tooling:

```bash
npm install @thruputchain/react @tanstack/react-query react react-dom
npm install --save-dev vite @types/react @types/react-dom
```

## Add the browser entry point

```bash
npm pkg set scripts.dev="vite" scripts.build="tsc --noEmit && vite build"
```

```json title="tsconfig.json"
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "jsx": "react-jsx", "strict": true, "noUncheckedIndexedAccess": true,
    "skipLibCheck": true, "noEmit": true, "types": ["vite/client", "node"]
  },
  "include": ["*.ts", "src"]
}
```

```ts title="vite.config.ts"
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/thruput-rpc": "http://127.0.0.1:3001",
    },
  },
});
```

```html title="index.html"
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Counter</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

## Connect the public client

```tsx title="src/main.tsx"
import { createRoot } from "react-dom/client";
import { createThruputClient, defineCluster, hashFromHex, networkHash } from "@thruputchain/client";
import { WalletProvider } from "@thruputchain/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import type { Config } from "./updates";
import "./style.css";

const root = createRoot(document.getElementById("root")!);
root.render(<p>Connecting…</p>);

async function start() {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error("Could not load counter configuration");
  const config: Config = await response.json();
  const client = await createThruputClient({
    cluster: defineCluster({
      rpcUrl: new URL("/thruput-rpc", location.origin).href,
      networkHash: networkHash(hashFromHex(config.networkId)),
      capabilities: [],
    }),
  });
  const queries = new QueryClient();
  root.render(
    <QueryClientProvider client={queries}>
      <WalletProvider client={client}><App config={config} /></WalletProvider>
    </QueryClientProvider>,
  );
}
void start().catch((error: unknown) => root.render(
  <p role="alert">{error instanceof Error ? error.message : "Could not start the app"}</p>,
));
```

The React provider shares the public client and discovers wallet providers without asking for permission. The next part uses that wallet context. The development signer remains on the API server.

Add a small stylesheet to keep the example readable on narrow screens:

```css title="src/style.css"
body { margin: 0; font-family: system-ui, sans-serif; }
main { max-width: 48rem; margin: auto; padding: 1.5rem; }
section { margin-block: 1.5rem; }
p { overflow-wrap: anywhere; }
button, select { max-width: 100%; margin: .25rem; padding: .5rem .75rem; font: inherit; }
output { font-size: 3rem; font-variant-numeric: tabular-nums; }
```

## Separate preparation from submission

Create a small shared update module. It retains the hash before submitting and can observe a saved operation after a reload:

```ts title="src/updates.ts"
import { useRef, useState } from "react";
import { deserializeSignedTransaction, fromHex0x, hashSignedTransaction, toHex0x, type ConnectedThruputClient } from "@thruputchain/client";
import { parseSignTransactionResult } from "@thruputchain/client/provider";
import { useClient, useWaitForTransactionReceipt } from "@thruputchain/react";

export type Config = { networkId: string; counterAddress: string; signerAddress: string | null };
export type Direction = "increment" | "decrement";
export type Pending = { hash: string; signedTransaction: string; account: string; networkId: string };
export type Prepared = { record: Pending; submit(): Promise<unknown> };

export async function archiveExpiredUpdate(client: ConnectedThruputClient, record: Pending, key: string, storage: Pick<Storage, "setItem" | "removeItem">) {
  if (toHex0x(client.network.networkHash) !== record.networkId) throw new Error("Select the original network before recovery");
  const signed = deserializeSignedTransaction(fromHex0x(record.signedTransaction));
  const hash = hashSignedTransaction(signed);
  if (toHex0x(hash) !== record.hash) throw new Error("Saved transaction hash does not match its bytes");
  const tip = await client.getChainTip();
  if (tip.height < signed.tx.uniquifier.block_expiry_height) throw new Error("The transaction has not expired; keep observing it");
  if (await client.getTransactionReceipt(hash)) throw new Error("A receipt is available; check the transaction and finish it");
  // Expiry prevents future inclusion, but a missing receipt does not prove it never committed.
  storage.setItem(`${key}:archived:${record.hash}`, JSON.stringify({ ...record, outcome: "unresolved", archivedAtHeight: tip.height.toString() }));
  storage.removeItem(key);
}

export async function prepareDevelopment(client: ConnectedThruputClient, config: Config, direction: Direction): Promise<Prepared> {
  if (!config.signerAddress) throw new Error("Development signer unavailable");
  const response = await fetch("/api/prepare", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ direction }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Preparation failed");
  const signed = deserializeSignedTransaction(fromHex0x(body.transaction));
  return {
    record: { hash: toHex0x(hashSignedTransaction(signed)), signedTransaction: body.transaction, account: config.signerAddress, networkId: config.networkId },
    submit: () => client.sendTransaction(signed),
  };
}

export function useUpdate(config: Config) {
  const client = useClient();
  const key = `counter:${config.networkId}:${config.counterAddress}`;
  const [state, setState] = useState<{ record: Pending | null; error: string | null }>(() => {
    try {
      const text = localStorage.getItem(key);
      if (!text) return { record: null, error: null };
      const value = JSON.parse(text);
      const signed = parseSignTransactionResult({ hash: value.hash, signedTransaction: value.signedTransaction });
      if (value.networkId !== config.networkId || typeof value.account !== "string") throw new Error("Invalid saved transaction");
      return { record: { ...signed, account: value.account, networkId: value.networkId }, error: null };
    } catch { return { record: null, error: "Cannot read the saved transaction. Check browser storage before sending." }; }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lock = useRef(false);
  const receipt = useWaitForTransactionReceipt({ hash: busy ? null : state.record?.hash ?? null });

  async function send(prepare: () => Promise<Prepared>) {
    if (lock.current || state.record || state.error) return;
    lock.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      const update = await prepare();
      localStorage.setItem(key, JSON.stringify(update.record));
      setState({ record: update.record, error: null });
      await update.submit();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Update failed");
    } finally { lock.current = false; setBusy(false); }
  }
  function finish() {
    if (!receipt.data) return;
    try { localStorage.removeItem(key); setState({ record: null, error: null }); setError(null); }
    catch { setError("Could not clear the saved record"); }
  }
  async function archiveExpired() {
    if (lock.current || !state.record) return;
    const record = state.record;
    if (!window.confirm("Archive this expired update? Its past outcome may still be unknown. This does not resend or cancel it. Inspect its original hash before repeating the operation.")) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      await archiveExpiredUpdate(client, record, key, localStorage);
      setState({ record: null, error: null });
      setNotice(`Archived ${record.hash} in browser storage. Its outcome is unresolved; inspect this hash before repeating the operation.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recovery failed");
    } finally { lock.current = false; setBusy(false); }
  }
  return { pending: state.record, error: state.error ?? error, notice, busy, blocked: busy || Boolean(state.record || state.error), receipt, send, finish, archiveExpired };
}
```

The preparer returns a signed record and a submission function. This keeps the UI independent of how the signature was obtained. A failed storage write stops before submission. A later submission error retains the hash for observation.

## Build the small components

```tsx title="src/Counter.tsx"
import { addressFromHex, ExecResult } from "@thruputchain/client";
import { contractViewQueryOptions, useClient } from "@thruputchain/react";
import { useQuery } from "@tanstack/react-query";
import { Counter } from "./contracts/counter";
import type { Direction, useUpdate } from "./updates";

export function CounterPanel({ address, disabled, send }: {
  address: string; disabled: boolean; send(direction: Direction): void;
}) {
  const client = useClient();
  const counter = useQuery({
    ...contractViewQueryOptions({ client, method: Counter.v0_1.get, contract: addressFromHex(address) }),
    refetchInterval: 2_000,
  });
  return <section>
    {counter.isLoading ? <p>Reading counter…</p> : null}
    {counter.error ? <p role="alert">{counter.error.message}</p> : null}
    <p><output aria-label="Counter value">{counter.data?.value.toString() ?? "Not loaded"}</output></p>
    <button type="button" disabled={disabled || !counter.data || counter.data.value === 0n} onClick={() => send("decrement")}>Decrement</button>
    <button type="button" disabled={disabled || !counter.data} onClick={() => send("increment")}>Increment</button>
  </section>;
}

export function UpdateStatus({ update }: { update: ReturnType<typeof useUpdate> }) {
  return <section aria-label="Transaction">
    {update.busy ? <p>Preparing or submitting…</p> : null}
    {update.error ? <p role="alert">{update.error}</p> : null}
    {update.notice ? <p role="status">{update.notice}</p> : null}
    {update.pending ? <>
      <p>Original signer: {update.pending.account}</p>
      <p>Transaction: {update.pending.hash}</p>
      {update.receipt.data ? <>
        <p role="status">{update.receipt.data.execResult === ExecResult.ExecResultOK ? "Update committed" : "Execution failed"}</p>
        <button type="button" onClick={update.finish}>Finish</button>
      </> : <>
        <p>Waiting for a result. A timeout does not cancel the transaction.</p>
        {update.receipt.error ? <p role="alert">{update.receipt.error.message}</p> : null}
        <button type="button" disabled={update.busy || update.receipt.isFetching} onClick={() => void update.receipt.refetch()}>Check transaction</button>
        <button type="button" disabled={update.busy} onClick={() => void update.archiveExpired()}>Archive expired update</button>
      </>}
    </> : null}
  </section>;
}
```

```tsx title="src/App.tsx"
import { useClient } from "@thruputchain/react";
import { CounterPanel, UpdateStatus } from "./Counter";
import { prepareDevelopment, useUpdate, type Config } from "./updates";

export function App({ config }: { config: Config }) {
  const client = useClient();
  const update = useUpdate(config);
  return <main>
    <h1>Counter</h1>
    <p>Using development signer: {config.signerAddress ?? "Not configured"}</p>
    <CounterPanel address={config.counterAddress} disabled={update.blocked || !config.signerAddress}
      send={direction => void update.send(() => prepareDevelopment(client, config, direction))} />
    <UpdateStatus update={update} />
  </main>;
}
```

## Run and verify

In a second terminal inside `app`, leaving the API server running:

```bash
npm run dev
```

Open Vite's URL. Click **Increment**, wait for **Update committed**, and confirm the refreshed counter value. Click **Finish** before another update. Try **Decrement** too.

The public read refreshes independently of signing. An error or timeout does not cause another transaction to be submitted. A saved hash remains available after reload; this minimal example keeps one unresolved update per counter and network in one browser tab.

If submission was stopped after signing, a receipt may never arrive. **Archive expired update** checks the original network, signed bytes, expiry height, and receipt before releasing the active slot. It preserves the complete record under `counter:NETWORK:CONTRACT:archived:HASH` in browser storage. It does not resend the transaction or prove it never committed: an unavailable or lagging indexer can still hide a past receipt. Inspect the original hash before repeating the operation. Recovery errors, including a failed archive write, keep the active record.

```bash
npm run build
```

**Checkpoint:** a working React counter using a server-held development signer. No wallet connection or keyboard/concurrency machinery is needed. Part 4 adds a different signing path to these same components.

## Work with an agent

```text
Follow Build a counter, part 3:
https://thruput.network/docs/tutorials/build-a-counter-with-react/
Create the listed files in my existing app directory. Do not clone an
examples repo. Verify reads, increment/decrement, transaction feedback,
and the build. Keep the development key on the server and retain an
unresolved transaction's hash instead of submitting a replacement.
```
