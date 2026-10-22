---
title: Setup
description: Install the React integration and connect its wallet and query providers to Futurenet.
---

Use the current Node.js LTS release. For a new app, create a React TypeScript project:

```bash
npm create vite@latest my-thruput-ui -- --template react-ts
cd my-thruput-ui
npm install
```

Complete the shared [registry access setup](/typescript/setup/#give-npm-package-access), then install the integration and its client together:

```bash
npm install @thruputchain/react @thruputchain/client @thruputchain/protocol @tanstack/react-query
```

The package manager resolves the React library's compatible client dependency. Keep the lockfile. In an existing application, satisfy the library's peer dependencies rather than forcing an incompatible client version. The integration uses React 19 and TanStack Query 5.

## Connect the application

Replace `src/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import { createThruputClient, devnet } from "@thruputchain/client";
import { WalletProvider } from "@thruputchain/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(<p>Connecting to Futurenet…</p>);

async function start() {
  const client = await createThruputClient({ cluster: devnet() });
  const queries = new QueryClient();

  root.render(
    <QueryClientProvider client={queries}>
      <WalletProvider client={client}>
        <App />
      </WalletProvider>
    </QueryClientProvider>,
  );
}

void start().catch((error: unknown) => {
  root.render(
    <p role="alert">{error instanceof Error ? error.message : "Could not connect to Futurenet"}</p>,
  );
});
```

The public client and query cache are created once, before rendering the app. `WalletProvider` does not request wallet permission automatically.

## Check the setup

Start the development server:

```bash
npm run dev
```

In another terminal, check the production build:

```bash
npm run build
```
