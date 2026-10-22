---
title: Connect a wallet
description: Discover browser wallets, connect an account on the intended network, and manage its session.
---

A browser wallet provider owns account access and transaction approval. Your application receives authorized account information and requests signatures without handling the user's private key.

For installation and test funds, follow [Wallet Extension](/tools/wallet-extension/).

## Choose the Integration

This page covers the provider-backed path described in [Accounts and wallet clients](/typescript/wallet-clients/). For a Node.js process that manages its own key, use [Use a signer in scripts](/typescript/accounts/). Wallet implementers should use [Wallet provider reference](/tools/wallet-provider/).

## Discover and Connect

Start discovery when the wallet picker mounts and let the user select a provider:

```ts
import { discoverWalletProviders, type WalletProvider } from "@thruputchain/client/provider";

export function mountWalletPicker(showChoice: (provider: WalletProvider) => void) {
  return discoverWalletProviders(showChoice);
}
```

Call the returned cleanup function when the picker unmounts. Discovery supports either load order and reports each provider ID once. Provider IDs and names are display metadata, not proof of identity; render names as text.

Connect from the user's chosen-wallet action. This helper accepts a public client, the application's trusted network hash, and an account picker:

```ts
import type { CoreThruputClient } from "@thruputchain/client";
import { parseWalletSession, type WalletAccount, type WalletProvider } from "@thruputchain/client/provider";
import { createProviderWalletClient } from "@thruputchain/client/wallet";

export async function connectWallet(
  client: CoreThruputClient,
  provider: WalletProvider,
  expectedNetworkHash: string,
  chooseAccount: (accounts: readonly WalletAccount[]) => WalletAccount,
) {
  const session = parseWalletSession(await provider.request({ method: "connect" }));
  if (session.networkHash !== expectedNetworkHash) {
    throw new Error("Select the application's network in your wallet");
  }
  if (session.accounts.length === 0) throw new Error("No authorized account");
  const account = chooseAccount(session.accounts);
  if (!session.accounts.includes(account)) throw new Error("Choose an authorized account");

  const wallet = createProviderWalletClient({
    client, provider, account, networkHash: expectedNetworkHash,
  });
  return { wallet, account };
}
```

For a [cluster-aware client](/typescript/connect/), convert its validated network identity with `toBase58(client.network.networkHash)`. Provider network hashes are 32 bytes in unprefixed base58. Do not adopt the wallet's network as the application's expected network.

`connect` prompts for access; `getSession` reads existing access without prompting. A disconnected session has no accounts but still reports the wallet's current network. The adapter does not switch networks.

## Handle Changes and Cleanup

Every provider `change` invalidates the current adapter. A failed session read or mismatched session also invalidates it. Stop offering actions through that binding, update the account/network UI, and construct a new adapter for a newly authorized session.

```ts
import type { WalletProvider } from "@thruputchain/client/provider";
import type { ProviderWalletClient } from "@thruputchain/client/wallet";

export function watchWallet(
  provider: WalletProvider,
  wallet: ProviderWalletClient,
  resetAccountUI: () => void,
) {
  const stopChanges = provider.on("change", () => {
    wallet.dispose();
    resetAccountUI();
  });
  return () => {
    stopChanges();
    wallet.dispose();
  };
}
```

Application callbacks should handle their own UI errors. Call cleanup when the binding is no longer needed. `dispose()` invalidates the adapter but does not revoke wallet permission. The user's Disconnect action calls `provider.request({ method: "disconnect" })`.

## Prepare, Sign, Save, Submit, Observe

For routine writes, use [Send transactions](/typescript/transactions/#send-through-a-browser-wallet). The provider helpers require `onSigned` to save the approved transaction before broadcast.

For explicit control, the sequence is:

1. `wallet.prepareExecution(request)` builds the unsigned transaction.
2. `wallet.signTransaction(transaction)` requests approval and verifies the returned bytes, signature, and hash. It does not broadcast.
3. Your application saves the signed result, account, and original network.
4. `wallet.submitTransaction(signed)` broadcasts the latest verified approval once.
5. The public client observes the hash and checks execution.

The adapter allows one in-flight operation. A session change invalidates pending work; do not automatically re-sign it. Signature verification requires Web Crypto, available in browsers on HTTPS or localhost.

## Recover an Ambiguous Submission

Once submission begins, an error may arrive after broadcast. Use the saved hash and original network to [track the transaction](/typescript/transaction-status/), including after disconnect or reload. Do not create a replacement merely because observation timed out.

Use `parseWalletProviderError` for provider errors across browser contexts rather than relying on `instanceof`. The [error table](/tools/wallet-provider/#errors) distinguishes rejection, authorization, network, and transport errors.

For a complete counter interface with wallet-approved updates, follow [Counter, part 4: Connect a wallet](/tutorials/connect-a-wallet-to-your-app/).
