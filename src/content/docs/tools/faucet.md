---
title: Faucet
description: Request native test tokens for a Futurenet wallet and check the funding result.
---

Use the [hosted faucet](https://thruput-faucet.up.railway.app) to fund a Futurenet wallet or contract address with native test tokens. These tokens have no monetary value.

## Request funds in the browser

1. Copy your public address from the [Wallet Extension](/tools/wallet-extension/) or your [CLI wallet](/cli/wallets/#create-a-key-and-wallet).
2. Open the [faucet](https://thruput-faucet.up.railway.app).
3. Paste your wallet address into **Wallet address**.
4. Click **Request airdrop**. The faucet sets the amount.
5. Wait for the **Sent … native tokens** notice, then check the receiving wallet's balance. The notice also shows a shortened transaction hash.

If the page cannot connect, it shows **Faucet unavailable** and disables the request. Click **Retry** to connect again.

The faucet needs only a public address. Amounts, cooldowns, and quotas depend on the deployment; follow the values and errors shown by the service.

## Request funds in the wallet

In [Thruput Wallet](/tools/wallet-extension/#select-devnet-and-get-native-test-tokens), select **Devnet** (the wallet extension's label for Futurenet), open **Assets**, and click **Request test tokens**. The request funds the selected wallet account.

## CLI

With a Futurenet wallet already configured:

```bash
thruput airdrop --profile futurenet
thruput balance --profile futurenet
```

The faucet selects the amount, so omit `--amount` for remote requests. For initial key and wallet setup, follow the [CLI quickstart](/get-started/cli/).

The CLI retains a nonce for a pending remote airdrop. If the outcome is unclear, rerun the same command to resume that request. A timeout does not prove that funding failed.

## TypeScript

Use the client or wallet's `requestAirdrop` action. [Script accounts](/typescript/accounts/) covers funding and retaining a request nonce for recovery. The client must use a cluster with airdrop support.

For Localnet, use your local node's airdrop through the [CLI](/cli/local-node/) or SDK rather than the hosted Futurenet faucet.

## If funding does not appear

- Check that the recipient address and wallet network match the request.
- Follow the displayed cooldown before requesting again.
- If you have a transaction hash, inspect it in the [Explorer](/tools/block-explorer/). A committed transaction must also have a successful execution result.
- If the browser lost its connection, check the balance before starting a new request.
