---
title: React quickstart
description: Display live Futurenet contract data in React with a typed query and a refresh action.
---

Build a React page that reads the native token's total supply from Futurenet and refreshes it on demand. This experimental token has no monetary value. You do not need a wallet, the CLI, or your own contract.

## 1. Create the application

Use the current Node.js LTS release:

```bash
npm create vite@latest my-thruput-ui -- --template react-ts
cd my-thruput-ui
```

Configure [npm package access](/typescript/setup/#give-npm-package-access) in this directory, then install the application dependencies:

```bash
npm install
npm install @thruputchain/react @thruputchain/client @thruputchain/protocol @tanstack/react-query
```

## 2. Connect the providers

Replace `src/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import { createThruputClient, futurenet } from "@thruputchain/client";
import { WalletProvider } from "@thruputchain/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(<p>Connecting to Futurenet…</p>);

async function start() {
  const client = await createThruputClient({ cluster: futurenet() });
  const queries = new QueryClient();

  root.render(
    <QueryClientProvider client={queries}>
      <WalletProvider client={client}>
        <App />
      </WalletProvider>
    </QueryClientProvider>,
  );
}

start().catch((error: unknown) => {
  root.render(
    <p role="alert">{error instanceof Error ? error.message : "Could not connect to Futurenet"}</p>,
  );
});
```

The client and query cache are created once. `WalletProvider` makes the client available to Project Thruput hooks; it does not connect a wallet automatically.

## 3. Display the result

Replace `src/App.tsx`:

```tsx
import { formatUnits } from "@thruputchain/client";
import { ERC20 } from "@thruputchain/client/contracts";
import { NATIVE_TOKEN_ADDRESS } from "@thruputchain/protocol";
import { useContractView } from "@thruputchain/react";

export default function App() {
  const supply = useContractView({
    method: ERC20.v0_1.totalSupply,
    address: NATIVE_TOKEN_ADDRESS,
    args: undefined,
  });

  return (
    <main>
      <h1>Native token on Futurenet</h1>
      {supply.isPending && <p>Reading the contract…</p>}
      {supply.error && <p role="alert">{supply.error.message}</p>}
      {supply.data && (
        <>
          <p>Supply: {formatUnits(supply.data.value, 7)} native tokens</p>
          <p>Read at block: {supply.data.stateBlockHeight.toString()}</p>
        </>
      )}
      <button disabled={supply.isFetching} onClick={() => void supply.refetch()}>
        {supply.isFetching ? "Refreshing…" : "Refresh"}
      </button>
    </main>
  );
}
```

The hook runs the typed view and exposes loading, error, and data states. Refresh makes another network read; it does not send a transaction.

## 4. Open the app

```bash
npm run dev
```

Open the local URL printed by Vite. The page should show a supply value and block height. Click **Refresh** and confirm that the page finishes another read. Also check that the project builds:

```bash
npm run build
```

## Next

See [Read contract data](/react/reads/) for arguments and query behavior, or [Connect a wallet](/react/wallets/) to add wallet controls. [Send transactions](/react/transactions/) covers approval and execution state.

## Use a coding agent

```text
Build the Project Thruput React quickstart:
https://www.thruput.network/docs/get-started/react/
Use a React TypeScript Vite project, the latest published Project Thruput
packages, and hosted Futurenet. Configure package access through my environment.
Display the native-token total supply and its read height with useContractView.
Include loading and error states and a Refresh button. Run the build
and verify the actual page result. No CLI, contract deployment, or wallet
connection is needed for this read-only example. Report package or network
errors rather than forcing incompatible dependencies or faking results.
```
