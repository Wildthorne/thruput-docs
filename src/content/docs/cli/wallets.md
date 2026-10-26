---
title: Keys and wallets
description: Create signing keys, save native wallet bindings, select an account, and request test funds.
---

A **key** signs transactions. A **wallet binding** gives an account address a reusable name within a profile. Keys are global; bindings can be global or project-local.

For first-time setup, the [CLI quickstart](/get-started/cli/) creates and funds a Futurenet account. This page covers account management after that setup.

## Create a key and wallet

```bash
thruput keys generate alice
thruput wallet create --key alice --profile futurenet
```

Confirm wallet creation. The CLI derives a native account and saves its address, owner, and account nonce. It does not deploy a wallet contract or request funds.

An ordinary stored key can also use its native account without a saved binding. Saving a binding is useful when you want a name for selection and inspection. Existing legacy wallet bindings keep their original account identity and transaction format.

### ML-DSA-65 keys

ML-DSA-65 keys require CLI `0.30.0` or later. Check with `thruput --version`.

```bash
thruput keys generate carol --scheme mldsa65
thruput airdrop carol --profile futurenet
```

An ML-DSA-65 key always uses its native account. `balance`, `transfer`, `tx`, and `call` work the same way as with Ed25519 keys. These commands are Ed25519 only:

- `wallet create` does not accept ML-DSA-65 keys.
- `keys import` accepts Ed25519 seeds only.
- `keys export --format strkey` does not apply, because ML-DSA-65 keys have no StrKey form.
- `init --generate-key` creates an Ed25519 key.

## Inspect accounts

```bash
thruput keys ls
thruput wallet ls --profile futurenet
thruput status --profile futurenet
```

Keys live under `${XDG_CONFIG_HOME:-$HOME/.config}/thruput/keys/`. Wallet bindings live in the selected configuration layer. Wallet mutations inside a project update its overlay; outside a project they update global configuration.

Address inputs accept base58 or a checksummed Thruput `Z` StrKey for native wallets
and deployed contracts. Stellar C addresses are rejected. Z does not distinguish
local, test, and production networks; select the intended profile. Reports and
saved public configuration use base58. G public keys identify Ed25519 signers,
not Thruput wallet addresses; S seeds remain valid for explicit key import.

## Select an account

```bash
thruput keys use alice
thruput wallet use alice --profile futurenet
thruput balance alice --profile futurenet
```

A profile's `default-key` can override the global key. Inspect it with `thruput config get futurenet --sources`. Selecting a key does not replace an explicitly selected wallet belonging to another key; the CLI checks ownership rather than silently switching accounts.

For one deployment or call, use `--wallet NAME`. When targets are omitted from `balance`, `airdrop`, or `tx list`, the CLI resolves the effective account from the selected profile and key.

## Fund and transfer

```bash
thruput airdrop alice --profile futurenet
thruput balance alice --profile futurenet
```

The hosted faucet selects the amount. Local-node requests can use `--amount`:

```bash
thruput airdrop alice --profile local --amount 25
```

To transfer native tokens to another saved wallet or an address:

```bash
thruput transfer RECIPIENT 1 --profile futurenet
```

Replace `RECIPIENT` with the destination. Confirm the transaction and inspect its result. A new recipient needs a sufficient first credit to cover its balance storage; funding amounts depend on the network. See [Faucet](/tools/faucet/) and [storage costs](/how-it-works/storage-economics/).

## Remove local records

`thruput wallet rm alice --profile futurenet` removes the saved binding, not the onchain account. `thruput keys rm alice` removes the local signing key and asks for confirmation. Keep a key if you still need it to control an account.

`thruput keys export NAME` prints private key material. Use it only for an intended export, not as a diagnostic or a way to put a signer into browser code.
