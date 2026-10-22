---
title: React
description: Use Project Thruput's React provider and hooks for wallets and contract data.
sidebar:
  label: Overview
---

Build wallet controls and contract-data interfaces with `@thruputchain/react`. The library supplies state and hooks; you supply the components, styling, and application workflow.

## How the layers fit

- The **TypeScript client** connects to a network and executes typed contract operations.
- **WalletProvider** shares that client and manages wallet discovery, connection, and account selection.
- **TanStack Query** manages read state, caching, and mutations through your application's `QueryClient`.
- **Contract bindings** describe each contract's methods, results, errors, and events.

The library manages one configured application network and one selected wallet connection. Public reads work without wallet permission. A connected wallet supplies the signing client for writes.

## Start with a read

The [React quickstart](/get-started/react/) displays Futurenet's native-token supply using the supplied ERC-20 binding and contract address. You do not need Rust, the CLI, or your own deployment.

For an existing app, follow [Setup](/react/setup/) and [Providers and clients](/react/providers/). Then use [Read contract data](/react/reads/) or [Read balances](/react/balances/). [Cache and refresh data](/react/queries/) explains the query behavior shared by those hooks.

## Add wallet actions

[Connect a wallet](/react/wallets/) covers discovery, account selection, and connection states. [Send transactions](/react/transactions/) and [Track transaction results](/react/transaction-status/) cover the approval-to-receipt flow.

Use the [TypeScript account model](/typescript/wallet-clients/) for shared signing concepts and the [React API reference](/react/reference/) for exact hook inputs and results. Complete application walkthroughs belong in [Guides](/guides/).
