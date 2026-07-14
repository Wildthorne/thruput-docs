---
title: Develop on Devnet with the CLI
description: Create a persistent key-owned wallet, deploy a counter to Devnet, and exercise the Groundhog CLI end to end.
---

This tutorial moves the local development loop onto Devnet. You will create a persistent signing key and contract wallet, build and test a counter locally, deploy it to the hosted network, submit calls, and inspect committed state.

Complete [Develop Locally with the CLI](/tutorials/develop-locally/) first if you have not yet built, deployed, and called a contract against `hog-devnode`.

:::note[Version checked]
This tutorial was last checked against Groundhog CLI `0.5.17` on July 13, 2026.
:::

## Before You Start

You need:

- Rust and Cargo through [rustup](https://rustup.rs/)
- `curl` and `jq`
- Access to the private Groundhog Cargo registry
- A Devnet RPC URL supplied during onboarding
- The matching Devnet faucet URL

:::caution[Persistent development key]
This tutorial writes a signing key to your normal Groundhog configuration. Use a dedicated Devnet key, protect the file like any other development credential, and do not use a key that controls anything valuable.
:::

## 1. Validate the Devnet Endpoints

Set the URLs supplied during onboarding:

```bash
export DEVNET_RPC_URL="<DEVNET_RPC_URL>"
export DEVNET_FAUCET_URL="<DEVNET_FAUCET_URL>"
```

Check the faucet and its public network descriptor:

```bash
curl -fsS "$DEVNET_FAUCET_URL/health" | jq .
curl -fsS "$DEVNET_FAUCET_URL/v1/network" | jq .
```

Confirm that the faucet advertises the same RPC URL:

```bash
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

## 2. Install and Initialize the CLI

Authenticate Cargo and install the current CLI if needed:

```bash
cargo login --registry groundhog
cargo install groundhog-cli \
  --version "=0.5.17" \
  --registry groundhog \
  --locked

groundhog --version
```

Run the guided setup on first use:

```bash
groundhog init
```

Decline starter-project creation because step 6 creates it explicitly. Executor credentials are separate from Cargo registry credentials. They are not required for the Devnet wallet, deploy, call, view, or balance commands in this tutorial.

## 3. Create a Devnet Signing Key

Create a dedicated key if you do not already have one for Devnet:

```bash
groundhog keys generate alice
groundhog keys use alice
groundhog keys ls
```

Key names are global. If `alice` already exists, use that key or choose another name and substitute it throughout the tutorial.

The private key is stored under the Groundhog configuration directory, normally `~/.config/groundhog/keys/`.

## 4. Configure the Devnet Profile

Open the global configuration created by `groundhog init`:

```bash
"${EDITOR:-vi}" "${XDG_CONFIG_HOME:-$HOME/.config}/groundhog/config.toml"
```

Find the existing `[profile.devnet]` section. Add the endpoint values and select the key:

```toml
[profile.devnet]
network = "devnet"
rpc_url = "<DEVNET_RPC_URL>"
faucet_url = "<DEVNET_FAUCET_URL>"
default_key = "alice"
```

Replace the placeholders with literal URLs. Preserve the existing HOG alias:

```toml
[profile.devnet.contracts]
HOG = "0x0000000000000000000000000000000000000000000000000000000000000001"
```

Inspect the resolved profile:

```bash
groundhog status --profile devnet
```

`status` may exit with status 1 if executor credentials are absent. That warning does not block this Devnet flow. Verify that the report shows the expected RPC URL and default key.

## 5. Create a Devnet Wallet

Run wallet creation from a directory outside a Groundhog project. This saves the binding in your global Devnet profile:

```bash
groundhog wallet create --key alice --profile devnet
groundhog wallet ls --profile devnet
groundhog balance alice --profile devnet
```

Wallet creation performs a prefund-first flow through the hosted faucet. The faucet funds the future address, deploys the wallet contract, and initializes it for your public key. It never receives your private key.

Keep the wallet name equal to the signing-key name by omitting `--name`. Deploy and call resolve the saved wallet through `alice`.

If wallet creation reports a pending attempt, rerun the exact same command:

```bash
groundhog wallet create --key alice --profile devnet
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
groundhog --json balance alice --profile devnet \
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
groundhog balance alice --profile devnet
```

If a later deployment needs more HOG:

```bash
groundhog airdrop alice --profile devnet
groundhog balance alice --profile devnet
```

Do not pass `--amount` for a hosted Devnet airdrop. The faucet sets the amount and enforces deployment-specific quotas.

Remote airdrops are idempotent. If an airdrop reports a pending attempt, rerun the exact same command and keep the CLI cache intact until it completes.

## Troubleshooting

### RPC and faucet mismatch

Recheck the two URLs with the commands in step 1. Do not combine endpoints from different Devnet deployments.

### Missing RPC or faucet URL

Make sure both values are in `[profile.devnet]`, not `[profile.devnet.contracts]`, in your global Groundhog configuration.

### No wallet for the selected key

Run `groundhog wallet ls --profile devnet`. The saved wallet name must match the selected key name for this flow. Create it with `--key alice` and omit `--name`.

### Insufficient funds

Check `groundhog balance alice --profile devnet`, then request one airdrop if needed. Avoid unnecessary requests because quotas apply to shared infrastructure.

## Persistent State and Cleanup

Devnet is shared and persistent. Deleting local files does not remove your wallet or deployed contracts from the chain.

Removing a wallet binding only removes local configuration. Removing the signing key permanently removes your ability to control that wallet unless you backed up the key first. Because this tutorial saved the binding globally, run these commands from outside a Groundhog project:

```bash
groundhog wallet rm alice --profile devnet
groundhog keys rm alice
```

Do not run those commands as routine tutorial cleanup. Keep the key if you intend to reuse the wallet or deployed contract.

## Next Steps

- [Build a Counter](/tutorials/build-a-counter/) for the generated contract's implementation details
- [Groundhog CLI](/tools/groundhog-cli/) for command and flag reference
- [Faucet](/tools/faucet/) for wallet funding behavior and retries
