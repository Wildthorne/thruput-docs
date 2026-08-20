---
title: Wallet Integration Status
description: Current signer APIs and the support boundary for browser-wallet integration.
---

No official browser-wallet provider or adapter is published yet. The current supported user flow is the Groundhog CLI: it creates a key-owned contract wallet, resolves network-specific wallet entrypoints, wraps application calls in the wallet's `do_action` invocation, signs, and submits them.

This page was source-checked against published `@groundhogchain/client` `0.2.0` and Groundhog CLI `0.9.6` on August 20, 2026.

See [Develop on Devnet with the CLI](/tutorials/develop-on-devnet/) for that end-to-end flow.

## Current TypeScript Extension Point

`@groundhogchain/client` exports a generic signer interface for integrating a wallet, hardware signer, remote signer, or custom key manager:

```typescript
import type { PublicKey, Signature } from "@groundhogchain/protocol";

export interface Signer {
  sign(message: Uint8Array): Promise<Signature>;
  publicKey: PublicKey;
}
```

Implementing `Signer` only supplies signatures over canonical transaction bytes. It does not provide:

- Browser connection or account-selection UX
- Permission prompts
- Network discovery
- Wallet creation or recovery
- Construction of the wallet contract's root `do_action` invocation
- Mapping a public key to its deployed contract-wallet address

The client package provides the low-level pieces needed to construct, sign, submit, and poll transactions. The responsibilities are split:

- Standalone helpers such as `createTransaction()` and `signTransaction()` construct and sign transactions.
- `GroundhogClient.sendTransaction()` submits a signed transaction.
- `GroundhogClient.getTransactionReceipt()` and `GroundhogClient.waitForTransactionReceipt()` read or poll receipts.

`GroundhogClient` does not construct or sign transactions. See the [TypeScript SDK transaction model](/tools/typescript-sdk/#transaction-model) for the package APIs and receipt flow.

## Transaction Shape

Groundhog authorization is rooted at the transaction's invoked address. In the current CLI-supported wallet flow, that root address is the user's DevWallet contract. Generated method descriptors build application invocations, which the CLI encodes as inner invocations for the DevWallet's `do_action` entrypoint. Custom wallet contracts can expose a different root method or calldata shape.

The current CLI resolves wallet entrypoints from the active local runtime manifest or hosted `/v1/network` descriptor. Wallet integrations should do the same rather than hard-coding entrypoint IDs.

:::caution[TypeScript support boundary]
Published client `0.2.0` provides low-level transaction construction, signing, submission, and polling primitives, but it does not provide the descriptor-driven wallet transaction builder used by the CLI. Do not submit a generated target-contract invocation as the root transaction unless that contract is intentionally the authorization root.
:::

Until the wallet builder and browser adapter are published, use the CLI for state-changing calls and the [TypeScript SDK](/tools/typescript-sdk/) for supported reads and views.

## Planned Integration Surface

A complete browser-wallet integration will need a published contract between the app and wallet for:

- Connecting and selecting accounts
- Reporting network identity and wallet address
- Reviewing the inner application invocation
- Building or validating the wallet-root invocation
- Signing canonical transaction bytes
- Returning submission results and user-facing errors

This page will become an implementation guide when that adapter and protocol are available.
