---
title: Providers and clients
description: Understand the React contexts, public and signing clients, and their lifetimes.
---

The [setup page](/react/setup/) mounts two contexts. They have different responsibilities:

| Provider | Responsibility |
| --- | --- |
| `WalletProvider` | Public client, wallet discovery, authorized session, selected account, signing-client lifecycle |
| `QueryClientProvider` | Read cache, query state, refresh policies, and mutations |

`WalletProvider`, `useClient`, `useWallet`, and `useWalletClient` work without TanStack Query context. Balance, contract-view, receipt, and execution hooks require both providers.

The React `WalletProvider` is a context component. A discovered wallet provider is the external wallet object that handles permission and signing requests. See [Accounts and wallet clients](/typescript/wallet-clients/) for that shared model.

## Use the public client

`useClient()` returns the initialized client supplied to `WalletProvider`. It remains available while disconnected and stays on the application's network when the wallet changes networks.

Use it with SDK actions or [custom queries](/react/events/). Contract reads do not require a connected wallet.

Choose a cluster or pin its identity through the TypeScript [network configuration](/typescript/connect/), then supply that cluster-validated client to `WalletProvider`.

Configure HTTP timeouts and batching through the [client transport](/typescript/transport/). Configure caching and refresh behavior through [TanStack Query](/react/queries/).

## Use the signing client

`useWalletClient()` returns the current provider-backed signing client, or `null` when unavailable. `useWallet()` exposes the connection state and selection actions.

Enable writes only when `wallet.status === "connected"`. An account address can still be present in a wrong-network session, so an address alone is not evidence that signing is available.

The provider owns the signing client's lifecycle. Session changes invalidate the old binding immediately and create a fresh binding after event dispatch when the session is valid. Use the current hook result for new operations.

## Keep identities stable

Create the public client and `QueryClient` once for the application's lifetime. Replacing the public client starts a disconnected wallet lifecycle, even when the new client points to the same network. Reads through different client instances have separate cache identities.

Unmounting `WalletProvider` disposes its signing binding without revoking remote permission. The user's [Disconnect action](/react/wallets/) requests permission revocation. Calling the current signing client's `dispose()` also clears the local React connection.

## Use a client-rendered boundary

In a server-rendered framework, initialize the client and mount these providers in the application's client-rendered boundary. Server rendering starts disconnected; browser discovery runs after mounting.

Project Thruput query keys contain in-memory client identities. Use them within one query-cache lifetime, not as persisted keys or server-to-browser hydration identifiers. See [Cache and refresh data](/react/queries/) for cache scope and reusable query factories.
