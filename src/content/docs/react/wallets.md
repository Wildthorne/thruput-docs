---
title: Connect a wallet
description: Build wallet and account selectors with explicit connection, network, and error states.
---

`useWallet` exposes discovered wallets, the selected account, and connection actions. `WalletProvider` manages discovery and session listeners; your components render the controls.

To install and fund a wallet for testing, follow [Wallet Extension](/tools/wallet-extension/).

## Select and connect a wallet

```tsx
import { useWallet } from "@thruputchain/react";

export function WalletControls() {
  const wallet = useWallet();
  const busy = wallet.status === "connecting" || wallet.status === "disconnecting";
  const authorized = wallet.status === "connected" || wallet.status === "wrongNetwork";

  return (
    <section aria-label="Wallet connection">
      <select
        aria-label="Wallet"
        value={wallet.provider?.info.id ?? ""}
        disabled={busy || wallet.providers.length === 0}
        onChange={event => wallet.selectProvider(event.target.value)}
      >
        <option value="" disabled>Choose a wallet</option>
        {wallet.providers.map(provider => (
          <option key={provider.info.id} value={provider.info.id}>{provider.info.name}</option>
        ))}
      </select>
      {wallet.providers.length === 0 ? <p>No wallet provider detected.</p> : null}
      {authorized ? (
        <button disabled={busy} onClick={() => void wallet.disconnect()}>Disconnect</button>
      ) : (
        <button disabled={busy || !wallet.provider} onClick={() => void wallet.connect()}>
          {wallet.status === "connecting" ? "Connecting…" : "Connect wallet"}
        </button>
      )}
      {wallet.status === "wrongNetwork" ? <p>Switch your wallet to the application's network.</p> : null}
      {wallet.error ? <p role="alert">{wallet.error.message}</p> : null}
    </section>
  );
}
```

Discovery selects the first provider without prompting. The user grants access through `connect()`. Provider names and IDs are display metadata, not proof of identity. The library supplies no branded buttons or wallet installation links.

## Select an authorized account

```tsx
import { useWallet } from "@thruputchain/react";

export function AccountSelector() {
  const wallet = useWallet();
  if (!wallet.session?.accounts.length) return null;

  return (
    <select
      aria-label="Account"
      value={wallet.address ?? ""}
      onChange={event => wallet.selectAccount(event.target.value)}
    >
      {wallet.session.accounts.map(account => (
        <option key={account.address} value={account.address}>{account.address}</option>
      ))}
    </select>
  );
}
```

Selection does not prompt. An unauthorized address or unknown provider sets `error` while preserving the current binding. Selecting another provider clears the local binding without revoking the previous provider's permission.

## Interpret connection state

| State | UI behavior |
| --- | --- |
| `disconnected` | Offer connection when a provider is available |
| `connecting` | Show progress and prevent duplicate connection requests |
| `connected` | Enable supported signing actions |
| `disconnecting` | Local authorization is already cleared; wait for revocation |
| `wrongNetwork` | Ask the user to switch networks; keep signing disabled |

`connect()` and `disconnect()` resolve after handling the request. Read failures from `wallet.error`; those actions do not throw provider request failures. Signing and submission operations do reject on failure.

## Handle changes and cleanup

Session changes invalidate old signing bindings immediately. The provider binds a fresh client after event dispatch when possible, retaining the selected account if still authorized. Do not retain an old signing client for future operations.

Disconnect clears local authorization immediately. If remote revocation fails, the UI remains disconnected and exposes an error. Unmounting disposes the local binding without requesting revocation. Connection is explicit; there is no automatic reconnect or persisted connection.

Use the shared [wallet-provider error codes](/tools/wallet-provider/#errors) for application-specific messages. Do not infer transaction failure from a disconnected wallet; [receipt observation](/react/transaction-status/) uses the public client.
