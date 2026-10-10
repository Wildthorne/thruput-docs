---
title: Keys and wallets
description: Create signing keys, save native wallet bindings, select an account, and request test funds.
---

A **key** signs transactions. A **wallet binding** gives an account address a reusable name within a profile. Keys are global; bindings can be global or project-local.

For first-time setup, the [CLI quickstart](/get-started/cli/) creates and funds a Devnet account. This page covers account management after that setup.

## Create a key and wallet

```bash
thruput keys generate alice
thruput wallet create --key alice --profile devnet
```

Confirm wallet creation. The CLI derives a native account and saves its address, owner, and account nonce. It does not deploy a wallet contract or request funds.

An ordinary stored key can also use its native account without a saved binding. Saving a binding is useful when you want a name for selection and inspection. Existing legacy wallet bindings keep their original account identity and transaction format.

## Inspect accounts

```bash
thruput keys ls
thruput wallet ls --profile devnet
thruput status --profile devnet
```

Keys live under `${XDG_CONFIG_HOME:-$HOME/.config}/thruput/keys/`. Wallet bindings live in the selected configuration layer. Wallet mutations inside a project update its overlay; outside a project they update global configuration.

## Select an account

```bash
thruput keys use alice
thruput wallet use alice --profile devnet
thruput balance alice --profile devnet
```

A profile's `default-key` can override the global key. Inspect it with `thruput config get devnet --sources`. Selecting a key does not replace an explicitly selected wallet belonging to another key; the CLI checks ownership rather than silently switching accounts.

For one deployment or call, use `--wallet NAME`. When targets are omitted from `balance`, `airdrop`, or `tx list`, the CLI resolves the effective account from the selected profile and key.

## Fund and transfer

```bash
thruput airdrop alice --profile devnet
thruput balance alice --profile devnet
```

The hosted faucet selects the amount. Local-node requests can use `--amount`:

```bash
thruput airdrop alice --profile local --amount 25
```

To transfer native tokens to another saved wallet or an address:

```bash
thruput transfer RECIPIENT 1 --profile devnet
```

Replace `RECIPIENT` with the destination. Confirm the transaction and inspect its result. A new recipient needs a sufficient first credit to cover its balance storage; funding amounts depend on the network. See [Faucet](/tools/faucet/) and [storage costs](/how-it-works/storage-economics/).

## Remove local records

`thruput wallet rm alice --profile devnet` removes the saved binding, not the onchain account. `thruput keys rm alice` removes the local signing key and asks for confirmation. Keep a key if you still need it to control an account.

`thruput keys export NAME` prints private key material. Use it only for an intended export, not as a diagnostic or a way to put a signer into browser code.
