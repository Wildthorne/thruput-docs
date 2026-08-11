---
title: Develop on Devnet with the CLI
description: Create a persistent key-owned wallet, deploy a counter to Devnet, and exercise the Groundhog CLI end to end.
---

This tutorial moves the local development loop onto Devnet. You will use the signing key and profiles created during setup, create a contract wallet, build and test a counter locally, deploy it to the hosted network, submit calls, and inspect committed state.

Complete [Develop Locally with the CLI](/tutorials/develop-locally/) first if you have not yet built, deployed, and called a contract against `hog-devnode`.

:::note[Version checked]
This tutorial was source-checked against Groundhog CLI `0.6.3` on August 5, 2026.
:::

## Before You Start

You need:

- Rust and Cargo through [rustup](https://rustup.rs/)
- `curl` and `jq`
- Access to the private Groundhog Cargo registry
- Network access to Groundhog Devnet

:::caution[Persistent development key]
This tutorial writes a signing key to your normal Groundhog configuration. Use a dedicated Devnet key, protect the file like any other development credential, and do not use a key that controls anything valuable.
:::

:::note[Fresh setup]
The commands below assume a fresh Groundhog configuration with no stored keys. If you are reusing an installation, follow the [Groundhog CLI configuration and wallet guidance](/tools/groundhog-cli/) to align the Devnet key and wallet selections before adapting this tutorial.
:::

## 1. Install and Initialize the CLI

Authenticate Cargo and install the current CLI if needed:

```bash
cargo login --registry groundhog
cargo install groundhog-cli \
  --version "=0.6.3" \
  --registry groundhog \
  --locked

groundhog --version
```

Run the guided setup on first use:

```bash
groundhog init
```

On a fresh setup with no stored keys, accept key generation. Init creates and selects the key named `default`, and creates global `local` and `devnet` profiles. Decline starter-project creation because step 6 creates it explicitly.

Executor credentials are separate from Cargo registry credentials and are not required for this workflow.

## 2. Validate the Devnet Endpoints

Read the RPC and faucet URLs created by init:

```bash
DEVNET_RPC_URL=$(groundhog --json config get devnet | jq -er '.data.rpcUrl')
DEVNET_FAUCET_URL=$(groundhog --json config get devnet | jq -er '.data.faucetUrl')
```

Check the faucet and its public network descriptor:

```bash
curl -fsS "$DEVNET_FAUCET_URL/health" | jq .
curl -fsS "$DEVNET_FAUCET_URL/v1/network" | jq .
curl -fsS "$DEVNET_FAUCET_URL/v1/network" \
  | jq -e --arg rpc "$DEVNET_RPC_URL" '.endpoints.rpcUrl == $rpc'
```

The final command should print `true`. Obtain the correct endpoint pair before continuing if it prints `false` or exits with an error.

Check the RPC directly:

```bash
curl -fsS \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"groundhog_version","params":[]}' \
  "$DEVNET_RPC_URL" | jq .
```

The manual comparison is required. Deploy and call validate the descriptor against the profile RPC, but wallet creation and airdrop currently consume the descriptor without making that comparison.

## 3. Check the Devnet Signing Key

Confirm that the key created by init is selected:

```bash
groundhog keys ls
```

`default` should be marked as selected. If you skipped key generation, create it with `groundhog keys generate default`. The first generated key becomes the global default automatically.

The private key is stored under the Groundhog configuration directory, normally `~/.config/groundhog/keys/`.

## 4. Inspect the Devnet Profile

Init created the global `devnet` profile with its network, RPC, faucet, and HOG contract settings. Inspect it rather than recreating it:

```bash
groundhog config get devnet --sources
```

The report should show the Devnet RPC and faucet URLs from global config. The globally selected `default` key applies because the fresh Devnet profile does not override it. Later, inside a project, the project's `devnet` profile merges over this global profile.

## 5. Create a Devnet Wallet

Run wallet creation from a directory outside a Groundhog project so it updates the global Devnet profile:

```bash
groundhog wallet create --profile devnet
groundhog wallet ls --profile devnet
groundhog balance default --profile devnet
```

Wallet creation performs a prefund-first flow through the hosted faucet. The faucet funds the future address, deploys the wallet contract, and initializes it for your public key. It never receives your private key.

With no `--key` or `--name`, the CLI uses the selected key and saves the wallet under the same name. Deploy and call resolve the saved wallet through `default`.

If wallet creation reports a pending attempt, rerun the exact same command:

```bash
groundhog wallet create --profile devnet
```

Keep the CLI cache intact until the attempt completes. Its retry record preserves the request's idempotency data.

## 6. Create and Test a Counter

From the directory where you keep development projects:

```bash
groundhog new my-counter
cd my-counter
```

Build and run the local test paths before submitting anything to Devnet:

```bash
cargo test
groundhog build --profile devnet
groundhog test --profile devnet
```

These commands build and test locally. They do not submit transactions to Devnet.

Inspect the artifacts:

```bash
ls -lh target/groundhog/
```

Expect:

```text
my_counter.rv32a
my_counter.rv32.json
my_counter.spec.xdr
my_counter.spec.json
```

The project and global `devnet` profiles merge. The project supplies contract aliases while the global wallet binding remains available.

## 7. Dry-Run and Deploy

Prepare a current signed deployment without broadcasting it:

```bash
groundhog deploy --profile devnet --dry-run
```

Then submit the deployment:

```bash
groundhog deploy --profile devnet
```

On success, the CLI prints the contract address and saves `my-counter` under `[profile.devnet.contracts]` in the project's `groundhog.toml`.

## 8. Initialize, Mutate, and Read State

Deployment does not initialize the counter automatically. Call `initialize` once:

```bash
groundhog call my-counter initialize 10 --profile devnet
groundhog view my-counter get --profile devnet
```

The first view should return `10`.

Submit another state change:

```bash
groundhog call my-counter increment 5 --profile devnet
groundhog view my-counter get --profile devnet
```

The counter should now return `15`.

Check structured output with pipeline failure propagation enabled:

```bash
set -o pipefail
groundhog --json view my-counter get --profile devnet \
  | jq -e '.ok == true and .data.returnValue == 15'
groundhog --json balance default --profile devnet \
  | jq -e '.ok == true and .command == "balance"'
```

## 9. Confirm Dry Runs Do Not Commit

Prepare an increment without broadcasting it:

```bash
groundhog call my-counter increment 100 --profile devnet --dry-run
groundhog view my-counter get --profile devnet
```

The value should remain `15`.

Submit a final real mutation:

```bash
groundhog call my-counter decrement 3 --profile devnet
groundhog view my-counter get --profile devnet
```

The final value should be `12`.

## 10. Request More HOG If Needed

Wallet creation includes prefunding for the initial flow. Check the balance before requesting more:

```bash
groundhog balance default --profile devnet
```

If a later deployment needs more HOG:

```bash
groundhog airdrop default --profile devnet
groundhog balance default --profile devnet
```

Do not pass `--amount` for a hosted Devnet airdrop. The faucet sets the amount and enforces deployment-specific quotas.

Remote airdrops are idempotent. If an airdrop reports a pending attempt, rerun the exact same command and keep the CLI cache intact until it completes.

## Troubleshooting

### RPC and faucet mismatch

Recheck the two URLs with the commands in step 2. Do not combine endpoints from different Devnet deployments.

### Missing RPC or faucet URL

Run `groundhog config get devnet --sources`. If either value is missing, rerun interactive `groundhog init`, which fills missing built-in profile defaults without replacing existing values.

### No wallet for the selected key

Run `groundhog wallet ls --profile devnet`. On a fresh setup, the saved wallet and selected key are both named `default`. Rerun `groundhog wallet create --profile devnet` if needed.

### Insufficient funds

Check `groundhog balance default --profile devnet`, then request one airdrop if needed. Avoid unnecessary requests because quotas apply to shared infrastructure.

## Persistent State and Cleanup

Devnet is shared and persistent. Deleting local files does not remove your wallet or deployed contracts from the chain.

Removing a wallet binding only removes local configuration. Removing the signing key permanently removes your ability to control that wallet unless you backed up the key first. Because this tutorial saved the binding globally, run these commands from outside a Groundhog project:

```bash
groundhog wallet rm default --profile devnet
groundhog keys rm default
```

Do not run those commands as routine tutorial cleanup. Keep the key if you intend to reuse the wallet or deployed contract.

## Next Steps

- [Build a Counter](/tutorials/build-a-counter/) for the generated contract's implementation details
- [Groundhog CLI](/tools/groundhog-cli/) for command and flag reference
- [Faucet](/tools/faucet/) for wallet funding behavior and retries
