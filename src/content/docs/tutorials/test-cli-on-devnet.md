---
title: Test the CLI on Devnet
description: Start with isolated local state, create a Devnet wallet, deploy a counter, and exercise the Groundhog CLI end to end.
---

This workshop exercises the Groundhog CLI from a clean local state. You will create a signing key and wallet, build a counter contract, deploy it to Devnet, submit calls, inspect state, and check the CLI's machine-readable output.

At the end, you will have:

- An isolated Groundhog configuration that does not touch your normal keys
- A funded wallet on Devnet
- A locally tested RV32 counter artifact
- A deployed counter that you can call and inspect
- A checklist for testing human and JSON CLI output

:::note[Version checked]
This tutorial was last checked against Groundhog CLI `0.5.17` on July 13, 2026.
:::

## Prerequisites

Before the workshop, install:

- Rust and Cargo through [rustup](https://rustup.rs/)
- `curl`
- `jq`
- A text editor available through `$EDITOR`

You also need:

- Access to the private Groundhog Cargo registry
- A Groundhog RPC URL from the workshop facilitator
- A matching Groundhog faucet URL from the workshop facilitator

The faucet and RPC must belong to the same Devnet deployment. The CLI verifies this before wallet creation, deployment, and contract calls.

:::caution[Use a workshop key]
Signing keys are stored locally under the Groundhog configuration directory. Use the isolated setup below and do not use a key that controls anything valuable.
:::

## 1. Set the Devnet URLs

Replace the placeholders with the URLs supplied by the facilitator:

```bash
export DEVNET_RPC_URL="<DEVNET_RPC_URL>"
export DEVNET_FAUCET_URL="<DEVNET_FAUCET_URL>"
```

Check the faucet and its public network descriptor:

```bash
curl -fsS "$DEVNET_FAUCET_URL/health" | jq .
curl -fsS "$DEVNET_FAUCET_URL/v1/network" | jq .
```

Confirm that the faucet advertises the RPC URL you were given:

```bash
curl -fsS "$DEVNET_FAUCET_URL/v1/network" \
  | jq -e --arg rpc "$DEVNET_RPC_URL" '.endpoints.rpcUrl == $rpc'
```

The final command should print `true`. Stop and ask the facilitator for the correct pair of URLs if it prints `false` or exits with an error.

Check the RPC directly:

```bash
curl -fsS \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"groundhog_version","params":[]}' \
  "$DEVNET_RPC_URL" | jq .
```

## 2. Install the Current CLI

Authenticate Cargo using the token from your onboarding instructions:

```bash
cargo login --registry groundhog
```

From a checkout of the `groundhog-rpc` repository, install the current CLI:

```bash
cd /path/to/groundhog-rpc
cargo install --locked --force --path crates/tools/cli

groundhog --version
groundhog --help
```

The version should match the version selected for the workshop.

## 3. Create Isolated Local State

The CLI follows the XDG configuration and cache environment variables. Point them at a temporary workshop directory:

```bash
export GH_TUTORIAL_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/groundhog-devnet.XXXXXX")"
export XDG_CONFIG_HOME="$GH_TUTORIAL_ROOT/config"
export XDG_CACHE_HOME="$GH_TUTORIAL_ROOT/cache"

mkdir -p "$GH_TUTORIAL_ROOT/work"
printf 'Workshop state: %s\n' "$GH_TUTORIAL_ROOT"
```

Keep using this terminal for the rest of the tutorial. A new terminal will not inherit these variables unless you export them again.

Your Groundhog state will be stored under:

```text
$XDG_CONFIG_HOME/groundhog/config.toml
$XDG_CONFIG_HOME/groundhog/keys/
$XDG_CACHE_HOME/groundhog/
```

Do not delete this directory during the workshop. It contains the private key for your Devnet wallet and retry records for pending wallet creation.

## 4. Initialize the CLI

Run the guided setup:

```bash
groundhog init
```

For this tutorial, use these answers:

| Prompt | Answer |
|--------|--------|
| Generate a local signing key now? | No. We will create a named key next. |
| Configure executor credentials now? | No, unless the facilitator supplied them. |
| Create a starter project? | No. We will scaffold it explicitly. |

Executor credentials are separate from Cargo registry credentials. They are not required for the Devnet wallet, deploy, call, view, or balance commands used here.

## 5. Create a Signing Key

Generate a named key and make it the default:

```bash
groundhog keys generate alice
groundhog keys use alice
groundhog keys ls
```

The first command creates an Ed25519 keypair. The private key remains on your machine.

## 6. Configure the Devnet Profile

Open the global configuration created by `groundhog init`:

```bash
"${EDITOR:-vi}" "$XDG_CONFIG_HOME/groundhog/config.toml"
```

Find the existing `[profile.devnet]` section. Add the supplied URLs and select `alice`:

```toml
[profile.devnet]
network = "devnet"
rpc_url = "<DEVNET_RPC_URL>"
faucet_url = "<DEVNET_FAUCET_URL>"
default_key = "alice"
```

Replace the placeholders with the literal URL values. Preserve the existing HOG alias:

```toml
[profile.devnet.contracts]
HOG = "0x0000000000000000000000000000000000000000000000000000000000000001"
```

Inspect the resolved profile:

```bash
groundhog status --profile devnet
```

`status` may report a warning and exit with status 1 if executor credentials were skipped. That warning does not block the Devnet commands in this tutorial. Verify that the report shows the expected profile, RPC URL, and default key.

## 7. Create a Devnet Wallet

Run wallet creation outside a contract project so the binding is saved in your global profile:

```bash
cd "$GH_TUTORIAL_ROOT/work"

groundhog wallet create --key alice --profile devnet
groundhog wallet ls --profile devnet
groundhog balance alice --profile devnet
```

Wallet creation performs a prefund-first flow through the hosted faucet. The faucet derives and funds the future address, deploys the wallet contract, and initializes it for your public key. The hosted faucet never receives your private key.

If wallet creation reports a pending attempt, rerun the exact same command:

```bash
groundhog wallet create --key alice --profile devnet
```

Do not delete the cache directory while an attempt is pending. Its retry record preserves the operation's idempotency data.

Check the structured output too:

```bash
groundhog --json wallet ls --profile devnet | jq .
groundhog --json balance alice --profile devnet | jq .
```

## 8. Scaffold and Test a Counter

Create the project inside the workshop directory:

```bash
cd "$GH_TUTORIAL_ROOT/work"

groundhog new my-counter
cd my-counter
```

Build and run the local test paths:

```bash
groundhog build --profile devnet
cargo test
groundhog test --profile devnet
```

These commands do not submit transactions to Devnet:

| Command | What it checks |
|---------|----------------|
| `groundhog build` | Builds and lowers the deployable RV32 artifact. |
| `cargo test` | Runs fast native contract tests. |
| `groundhog test` | Builds and runs the executor-backed RV32 tests. |

Inspect the build output:

```bash
ls -lh target/groundhog/
```

The directory should contain files similar to:

```text
my_counter.rv32a
my_counter.rv32.json
```

## 9. Dry-Run the Deployment

Exercise profile resolution, RPC access, wallet selection, artifact selection, and signing without broadcasting a transaction:

```bash
groundhog deploy --profile devnet --dry-run
```

A dry run still contacts the RPC to prepare a current transaction. It signs the transaction locally but does not submit it.

## 10. Deploy to Devnet

Submit the deployment:

```bash
groundhog deploy --profile devnet
```

On success, the CLI prints the deployed address and saves a project-local contract alias under `[profile.devnet.contracts]` in `groundhog.toml`.

Inspect the saved alias:

```bash
grep -A5 '\[profile.devnet.contracts\]' groundhog.toml
```

The remaining commands can use `my-counter` instead of copying the deployed address.

## 11. Initialize, Mutate, and Read State

Initialize the counter and read it through a sandboxed view:

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

Check the same state through the JSON interface:

```bash
groundhog --json view my-counter get --profile devnet | jq .
groundhog --json balance alice --profile devnet | jq .
```

## 12. Prove That Dry Runs Do Not Commit

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

## 13. Request More HOG If Needed

Wallet creation includes enough prefunding for the initial workflow. Check your balance before requesting more:

```bash
groundhog balance alice --profile devnet
```

If a later deployment fails because the wallet needs more HOG, request an airdrop:

```bash
groundhog airdrop alice --profile devnet
groundhog balance alice --profile devnet
```

Do not pass `--amount` for a hosted Devnet airdrop. The faucet sets the amount and enforces its rate limits.

## What to Evaluate

As you work through the tutorial, check more than whether each command exits successfully:

- Human-readable output explains what happened and what to do next.
- `--json` output parses cleanly and contains enough data for scripts.
- Profile and key selection are visible when they matter.
- Wallet creation survives an idempotent retry.
- Balance lookup works by wallet name.
- Deployment saves a usable contract alias.
- `call` changes committed state and `view` reads it.
- Dry runs prepare signed transactions without committing state.
- Errors identify the failing endpoint or missing configuration.

## Troubleshooting

### RPC and faucet mismatch

The CLI rejects a faucet whose `/v1/network` descriptor advertises a different RPC URL. Recheck the two URLs with the commands in step 1. Do not work around the check with unrelated endpoints.

### Missing RPC or faucet URL

Make sure both values are under the existing `[profile.devnet]` table in `$XDG_CONFIG_HOME/groundhog/config.toml`, not under `[profile.devnet.contracts]`.

### No wallet for `alice`

Run `groundhog wallet ls --profile devnet`. For this workflow, the saved wallet name should match the signing key name. Create it with `--key alice` and omit `--name`.

### `status` exits with status 1

Read the report. A warning about missing executor credentials is expected when you skip that optional setup. Missing Cargo, key, profile, or RPC configuration should be fixed before continuing.

### A remote command reports insufficient funds

Check `groundhog balance alice --profile devnet`, then use the hosted airdrop once if needed. Faucet quotas are shared infrastructure, so avoid unnecessary wallet creation and airdrop requests.

## Cleanup

Devnet is shared. Removing local files does not remove your wallet or deployed contract from the chain.

:::caution[Permanent key deletion]
The following cleanup permanently deletes the private key that controls the tutorial wallet. Run it only after you no longer need that wallet.
:::

```bash
cd "$HOME"
rm -rf -- "$GH_TUTORIAL_ROOT"
unset GH_TUTORIAL_ROOT XDG_CONFIG_HOME XDG_CACHE_HOME
unset DEVNET_RPC_URL DEVNET_FAUCET_URL
```

For the broader command map, local-node workflow, and CLI reference, see [Groundhog CLI](/tools/groundhog-cli/).
