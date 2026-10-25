---
title: CLI quickstart
description: Create a Futurenet wallet, request native test tokens, and inspect your first transaction from the terminal.
---

Create a wallet on Futurenet, fund it with native test tokens, and inspect the funding transaction. These tokens have no monetary value. You do not need a contract project or a local node.

**Before you start:** [install the latest CLI](/cli/install/). Run these commands outside an existing Project Thruput project so they use your global configuration.

## 1. Set up the CLI

```bash
thruput init
thruput config use futurenet
```

On a fresh installation, accept signing-key creation and decline starter-project creation. Setup creates the `default` key and the `local` and `futurenet` network profiles. Selecting `futurenet` sets the global default, so later commands and new projects use it without a `--profile` flag.

## 2. Create a wallet

```bash
thruput wallet create
```

Confirm the prompt. The CLI saves a wallet address for your selected key. Creating this wallet does not fund it or send a transaction.

```bash
thruput wallet ls
```

You should see your wallet's name and address. With a fresh setup, its name is `default`.

## 3. Request test funds

```bash
thruput airdrop
thruput balance
```

Confirm the airdrop and wait for its result. You should have a positive native-token balance. Save the transaction hash printed by the airdrop command.

The faucet selects the test-token amount; you do not need an amount flag.

## 4. Inspect the transaction

Replace `TX_HASH` with the hash from the airdrop:

```bash
thruput tx show TX_HASH
```

Check that the transaction committed successfully. You now have a funded wallet and have verified an onchain result.

## Next

[Deploy your first contract](/get-started/contract/) using this wallet.

If funding is pending, rerun the same airdrop command to resume the request. For network errors or faucet limits, see [Faucet](/tools/faucet/).

## Use a coding agent

Copy this prompt into your agent:

```text
Help me complete the Thruput CLI quickstart:
https://thruput.network/docs/get-started/cli/
Use the latest CLI, install the thruput skill, and read thruput skill show cli.
Run thruput init, then thruput config use futurenet outside a project.
Set up a Futurenet wallet without creating a contract project or running a local node.
Preserve any existing keys and configuration. Request test funds,
check the wallet balance, and inspect the airdrop transaction.
Report success only after checking the committed transaction result.
Ask me to supply any required registry access through my environment,
not in this conversation. Report a network failure rather than bypassing it.
```
