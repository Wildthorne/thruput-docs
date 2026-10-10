---
title: "Build a counter, part 4: Connect a wallet"
description: Let the user switch from the development signer to a connected wallet in the same counter application.
sidebar:
  label: "Counter 4: Wallet"
---

Keep the app from [part 3](/tutorials/build-a-counter-with-react/). It already works through the development signer. Add wallet controls so a successful connection switches new updates to the user's wallet; explicit disconnect returns to the development signer.

The display, contract, public client, and transaction-status component stay the same. Only preparation and submission differ.

## Prepare the wallet

Install the [Wallet Extension](/tools/wallet-extension/) and select the app's network. Request native test tokens for that wallet's account; it is independent of the server's development signer.

`WalletProvider` is already mounted from part 3. It discovers providers without requesting permission.

## Add wallet controls

```tsx title="src/WalletControls.tsx"
import { useWallet } from "@groundhogchain/react";

export function WalletControls({ busy, walletMode, disconnect }: {
  busy: boolean; walletMode: boolean; disconnect(): void;
}) {
  const wallet = useWallet();
  const connecting = wallet.status === "connecting" || wallet.status === "disconnecting";
  return <section aria-label="Wallet connection">
    <label>Wallet <select name="wallet" value={wallet.provider?.info.id ?? ""}
      disabled={busy || connecting || wallet.providers.length === 0}
      onChange={event => wallet.selectProvider(event.target.value)}>
      <option value="" disabled>No wallet detected</option>
      {wallet.providers.map(provider => <option key={provider.info.id} value={provider.info.id}>{provider.info.name}</option>)}
    </select></label>
    <button type="button" disabled={busy || connecting || !wallet.provider || wallet.status === "connected"}
      onClick={() => void wallet.connect()}>Connect wallet</button>
    {walletMode ? <button type="button" disabled={busy || connecting} onClick={disconnect}>Disconnect wallet</button> : null}
    {wallet.session && wallet.session.accounts.length > 1 ? <label>Account
      <select name="account" value={wallet.address ?? ""} disabled={busy || connecting}
        onChange={event => wallet.selectAccount(event.target.value)}>
        {wallet.session.accounts.map(account => <option key={account.address} value={account.address}>{account.address}</option>)}
      </select>
    </label> : null}
    {wallet.status === "wrongNetwork" ? <p role="alert">Select the app's network in your wallet.</p> : null}
    {wallet.error ? <p role="alert">{wallet.error.message}</p> : null}
  </section>;
}
```

## Add the wallet preparer

```ts title="src/wallet-update.ts"
import { addressFromHex, gasAmount } from "@groundhogchain/client";
import type { ProviderWalletClient } from "@groundhogchain/client/wallet";
import { Counter } from "./contracts/counter";
import type { Config, Direction, Prepared } from "./updates";

export async function prepareWallet(wallet: ProviderWalletClient, account: string, config: Config, direction: Direction): Promise<Prepared> {
  const transaction = await wallet.prepareExecution({
    invocation: Counter.v0_1[direction].invocation(addressFromHex(config.counterAddress), gasAmount(500_000n), { amount: 1n }),
    gasLimit: gasAmount(1_000_000n),
  });
  const signed = await wallet.signTransaction(transaction);
  return {
    record: { ...signed, account, networkId: config.networkId },
    submit: () => wallet.submitTransaction(signed),
  };
}
```

The same `useUpdate` hook saves the signed record before invoking `submit`. A wallet rejection prevents submission. The application never receives the wallet's private key.

## Switch signing paths

Replace `src/App.tsx`:

```tsx title="src/App.tsx"
import { useEffect, useState } from "react";
import { useClient, useWallet, useWalletClient } from "@groundhogchain/react";
import { CounterPanel, UpdateStatus } from "./Counter";
import { WalletControls } from "./WalletControls";
import { prepareDevelopment, useUpdate, type Config, type Direction } from "./updates";
import { prepareWallet } from "./wallet-update";

export function App({ config }: { config: Config }) {
  const client = useClient();
  const wallet = useWallet();
  const signingClient = useWalletClient();
  const update = useUpdate(config);
  const [selected, setSelected] = useState<"development" | "wallet">("development");
  const authorized = wallet.status === "connected" || wallet.status === "wrongNetwork";
  useEffect(() => { if (authorized) setSelected("wallet"); }, [authorized]);
  const walletMode = authorized || selected === "wallet";
  const connecting = wallet.status === "connecting" || wallet.status === "disconnecting";
  const canSend = walletMode ? wallet.status === "connected" && signingClient !== null : config.signerAddress !== null;

  function disconnect() {
    void wallet.disconnect();
    setSelected("development");
  }
  function send(direction: Direction) {
    if (!canSend || connecting || update.blocked) return;
    if (walletMode) {
      if (!signingClient || !wallet.address) return;
      const originalClient = signingClient;
      const originalAccount = wallet.address;
      void update.send(() => prepareWallet(originalClient, originalAccount, config, direction));
    } else {
      void update.send(() => prepareDevelopment(client, config, direction));
    }
  }
  return <main>
    <h1>Counter</h1>
    <p>{walletMode ? "Using connected wallet" : "Using development signer"}: {walletMode ? wallet.address ?? "Unavailable" : config.signerAddress ?? "Unavailable"}</p>
    <WalletControls busy={update.busy} walletMode={walletMode} disconnect={disconnect} />
    <CounterPanel address={config.counterAddress} disabled={!canSend || connecting || update.blocked} send={send} />
    <UpdateStatus update={update} />
  </main>;
}
```

A successful connection selects wallet signing immediately. A later session loss or wrong network keeps wallet mode selected and pauses writes. It does not silently send through the development key. Explicit disconnect opts back into development signing.

Each update captures its original signing client and account. A receipt is observed through the public client, so disconnecting does not cancel an already-submitted transaction.

## Verify both paths

1. Open the app disconnected. Increment with the development signer and inspect its hash and result.
2. Connect your wallet on the correct network. Confirm the displayed account changes.
3. Increment again and approve the request in the wallet. Wait for the receipt and refreshed value.
4. Reject another approval. The page should show the error without sending through the development signer.
5. Disconnect explicitly. The development-signer label and immediate-update path return.

After a committed result, **Finish** clears its saved record. For an unresolved result, **Check transaction** observes the original hash without submitting again. Reload with a saved hash to verify recovery.

A session change can stop submission after the signed record was saved. Once the signed transaction expires, use **Archive expired update** from part 3 to preserve its evidence and release the active slot. This never switches signers, resubmits, or treats a missing receipt as proof of failure.

```bash
npm run build
```

**Checkpoint:** a small, complete app built without a repository clone. Its default signer is convenient for development, and connected users can approve their own transactions.

You can also explore the [full counter example on GitHub](https://github.com/groundhogchain/groundhog-examples/tree/main/apps/counter).

## Work with an agent

```text
Follow Build a counter, part 4:
https://thruput.network/docs/tutorials/connect-a-wallet-to-your-app/
Extend my part-3 app using the listed files. Keep development signing
as the default, switch on wallet connection, and return only on explicit
disconnect. Let me approve wallet requests. Verify both paths, rejection,
wrong-network handling, receipt recovery, and the build. Do not clone
the examples repo or add keyboard/concurrency features to this tutorial.
```
