---
title: Wallet Integration
description: Discover a Groundhog wallet, connect an account, and prepare, sign, save, submit, and observe a transaction.
---

Use a wallet provider to request account access and transaction approval without exposing a raw signer to your application. The SDK adapter separates signing from broadcasting so you can save a recovery record first. Wallet and extension authors should implement the [Wallet Provider contract](/tools/wallet-provider/).

## Choose the Integration

For a runnable browser app, start with [Connect a Wallet to Your App](/tutorials/connect-a-wallet-to-your-app/).

| Application | API |
| --- | --- |
| Dapp using an external wallet | `/provider` discovery and `/wallet` `createProviderWalletClient()` |
| Script or service managing its own keys | `Signer`, `createPubkeyAccount()`, and `createWalletClient()` in the [SDK wallet workflow](/tools/typescript-sdk/#bind-a-wallet-client) |
| Existing source-address wallet such as DevWallet | Local-signer wallet client with an explicit [invocation adapter](/tools/typescript-sdk/) |

Provider contract `1.0.0` supports protocol pubkey accounts only. A wire `WalletAccount` from `/provider` contains `address`, `publicKey`, and an account-derivation `nonce`. It is distinct from the local-signer account type exported by `/wallet`. There are no official React bindings in this implementation; this flow is framework-neutral.

## Discover and Connect

Start discovery when your wallet picker mounts. Show all discovered providers and let the user choose one. Discovery handles either load order, validates announcements, and reports up to 32 distinct IDs. The first valid announcement for an ID wins. IDs and names are display metadata, not proof of wallet identity. Render names as text, never HTML.

```ts
import {
  discoverWalletProviders,
  type WalletProvider,
} from "@groundhogchain/client/provider";

export function mountWalletPicker(
  showChoice: (provider: WalletProvider) => void,
) {
  const stopDiscovery = discoverWalletProviders(showChoice);
  return stopDiscovery; // Call when the picker unmounts.
}
```

Call `connect` from the user's chosen wallet action. Validate its result with `parseWalletSession()`, then let the user select an authorized account. `getSession` reads existing access without prompting. An unauthorized session has no accounts but still reports the wallet's current network hash.

Choose the application's network explicitly. Compare the session's `networkHash` with your trusted configuration, and use an RPC client connected to that same network. This wire hash is 64 lowercase hex characters without `0x`. The adapter checks any validated client network identity; an unqualified transport client leaves endpoint identity verification to your application. Requests do not switch networks implicitly.

## Prepare, Sign, Save, Submit, Observe

This example accepts an already discovered provider and a client connected to the application's expected network. Its selection, persistence, and UI callbacks are application code, not SDK options. Build `request.invocation` with your [generated bindings](/tools/typescript-bindings/), and supply its wallet gas limit in `PrepareExecutionRequest`. Error-reporting callbacks must not throw. `onApplicationError` handles session parsing or UI callback failures without letting them escape the event listener.

```ts
import type { CoreGroundhogClient } from "@groundhogchain/client";
import { fromHex, sha256Hash } from "@groundhogchain/protocol";
import {
  parseWalletSession,
  type SignTransactionResult,
  type WalletAccount,
  type WalletProvider,
  type WalletSession,
} from "@groundhogchain/client/provider";
import {
  createProviderWalletClient,
  type PrepareExecutionRequest,
} from "@groundhogchain/client/wallet";

type PendingTransaction = SignTransactionResult & {
  account: WalletAccount;
  networkHash: string;
};

type SendStage =
  | { stage: "before-submit" }
  | { stage: "possibly-broadcast"; pending: PendingTransaction };

class WalletSendError extends Error {
  constructor(cause: unknown, readonly progress: SendStage) {
    super("Wallet transaction flow failed", { cause });
  }
}

export async function sendWithWallet(
  client: CoreGroundhogClient,
  provider: WalletProvider,
  expectedNetworkHash: string,
  request: PrepareExecutionRequest,
  chooseAccount: (session: WalletSession) => WalletAccount,
  persistPending: (pending: PendingTransaction) => Promise<void>,
  onSessionChange: (session: WalletSession) => void,
  onApplicationError: (error: unknown) => void,
) {
  let progress: SendStage = { stage: "before-submit" };
  let stopChanges: (() => void) | undefined;
  try {
    stopChanges = provider.on("change", (value) => {
      try {
        onSessionChange(parseWalletSession(value));
      } catch (error) {
        onApplicationError(error);
      }
    });
    const session = parseWalletSession(
      await provider.request({ method: "connect" }),
    );
    if (session.accounts.length === 0) throw new Error("No authorized account");
    if (session.networkHash !== expectedNetworkHash) {
      throw new Error("Select the application's network in your wallet");
    }
    const account = chooseAccount(session);
    if (!session.accounts.includes(account)) {
      throw new Error("Select an account from the authorized session");
    }
    const wallet = createProviderWalletClient({
      client, provider, account, networkHash: session.networkHash,
    });
    try {
      const transaction = await wallet.prepareExecution(request);
      const signed = await wallet.signTransaction(transaction);
      const pending = { ...signed, account, networkHash: session.networkHash };
      // Await a durable write. If it fails, do not request broadcast.
      await persistPending(pending);
      // Any failure from here onward may occur after broadcast.
      progress = { stage: "possibly-broadcast", pending };
      const { hash } = await wallet.submitTransaction(signed);
      const receipt = await client.waitForTransactionReceipt(
        sha256Hash(fromHex(hash.slice(2))),
      );
      // Inspect receipt.execResult before reporting execution success.
      return receipt;
    } finally {
      wallet.dispose();
    }
  } catch (error) {
    throw new WalletSendError(error, progress);
  } finally {
    stopChanges?.();
  }
}

// Invoke from the user's Send action, passing a closure that calls sendWithWallet.
export async function onSendClick(
  send: () => ReturnType<typeof sendWithWallet>,
  showReceipt: (receipt: Awaited<ReturnType<typeof sendWithWallet>>) => void,
  showError: (message: string, error: unknown, pending?: PendingTransaction) => void,
) {
  try {
    const receipt = await send();
    showReceipt(receipt); // Inspect execResult; a receipt can describe failed execution.
  } catch (error) {
    if (error instanceof WalletSendError) {
      const progress = error.progress;
      if (progress.stage === "possibly-broadcast") {
        // Keep the durable record. Offer status lookup on its original network.
        showError("Broadcast may have occurred. Check the saved transaction.", error, progress.pending);
      } else {
        showError("Failed before submission; no broadcast was requested.", error);
      }
    } else {
      showError("Application error. Keep any saved transaction record.", error);
    }
  }
}
```

`prepareExecution()` wraps the application invocation through DefaultWallet and uses the existing transaction nonce and expiry handling. Its random transaction nonce is separate from the account-derivation nonce. `signTransaction()` verifies the exact unsigned bytes, account claim, strict network-bound Ed25519 signature, and canonical transaction hash. It never broadcasts. Signature verification needs Web Crypto, available on HTTPS or localhost in browsers.

`persistPending` must finish saving the signed bytes, canonical hash, account, and original network before submission. Keep that record available for recovery even if the wallet disconnects or the page reloads. `submitTransaction()` accepts only this adapter's latest verified approval and checks the returned hash. Its result acknowledges broadcast, not successful execution. Observe the receipt on the original network and inspect `receipt.execResult`.

## Handle Changes and Cleanup

The synchronous adapter factory does not connect or modify the RPC client. It snapshots its configuration, checks `getSession` before preparation, signing, and submission, and checks for changes while work is pending. It permits one in-flight operation; overlapping calls fail with `-32002`.

Every `change` permanently invalidates the adapter, even if the snapshot looks unchanged. Failed session reads and mismatched sessions also invalidate it. Update your account/network UI, stop offering actions from the old binding, and create a new adapter for a newly authorized session. Do not automatically resume or re-sign interrupted work. A conforming provider delivers changes caused by `connect` before that request resolves, so constructing the adapter after `await connect` is safe.

Call `dispose()` when the binding is no longer needed, and unsubscribe application change listeners and discovery listeners on teardown. Disposal is idempotent and permanent. It neither revokes permission nor cancels pending provider requests; late results cannot reactivate the adapter or cause it to submit. Providers and bridges own request deadlines; the adapter adds no UI timeout. For the user's Disconnect action, call:

```ts
await provider.request({ method: "disconnect" }); // Resolves to null.
```

## Recover an Ambiguous Submission

Once submission starts, treat every failure as potentially broadcast, including timeouts, disconnects, network changes, or an invalid response hash. Keep the saved canonical hash and query `getTransactionStatus()`, `getTransactionReceipt()`, or `waitForTransactionReceipt()` on the **original network**. Report the uncertainty to the user rather than declaring the transaction unsent.

Never automatically prepare or sign a replacement, change its nonce, or retry execution. The adapter consumes its approval when submission starts, including on error. Re-sending identical bytes requires an explicit recovery policy and a still-valid provider approval. A failed persistence write before submit means this adapter has not requested broadcast.

Provider errors carry numeric `code` and human-readable `message`. Use `parseWalletProviderError()` across realms rather than relying on `instanceof`. See the [error table](/tools/wallet-provider/#errors) for refusal, authorization, network, transport, and validation failures.

## Related Documentation

- [Wallet Provider](/tools/wallet-provider/) for the normative wallet and bridge contract
- [TypeScript SDK](/tools/typescript-sdk/) for local signers, account models, funding, and wallet construction
- [TypeScript Bindings](/tools/typescript-bindings/) for typed application invocations
- [Authorization](/how-it-works/authorization/) for protocol account and signature rules
