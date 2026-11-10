---
title: Faucet
description: Request native test tokens for a Futurenet wallet and check the funding result.
---

## Hosted Faucet

Use the [hosted faucet](https://faucet.thruput.network) to fund a Futurenet wallet or contract address with native test tokens. Paste your wallet address and click **Request airdrop**.

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
