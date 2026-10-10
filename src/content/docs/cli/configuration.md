---
title: Profiles and networks
description: Select Devnet, local development, or a custom endpoint and manage global and project configuration.
---

A profile selects the network, endpoint, and account settings for a command. Global profiles are reusable across projects; a project's `thruput.toml` can override them.

## Inspect the current settings

```bash
thruput config profiles
thruput config get devnet --sources
thruput status --profile devnet
```

`config get` shows persisted configuration and where it came from. `status` adds environment diagnostics, including the effective key and local-runtime selection. Neither command requests funds or deploys a contract.

## Choose a profile

For one command:

```bash
thruput balance --profile devnet
```

To make Devnet the default for a project:

```bash
thruput config use devnet --project
```

Profile selection checks, in order:

1. `--profile`
2. `THRUPUT_PROFILE`
3. Project `default_profile`
4. Global `default_profile`

If none selects a profile, commands that require one fail. The name `default` has no special fallback meaning.

## Devnet

`thruput init` creates the built-in Devnet profile with its RPC and faucet settings. For a first funded account, follow the [CLI quickstart](/get-started/cli/).

The CLI validates the selected network before signing. An explicit `network-hash` pins the network identity. Without a pin, hosted native-account operations use the configured network descriptor and RPC identity. Do not copy a hash from a different deployment; a Devnet reset can change the identity.

## Local development

Profiles with `network = "local"` can use the endpoint and runtime manifest recorded by a running `thruput node`. See [Run a local node](/cli/local-node/).

For a one-off endpoint override on an RPC command:

```bash
thruput balance --profile local --rpc-url http://127.0.0.1:9546
```

Commands that use local `dev-N` accounts also need that node's runtime manifest. Use `--runtime-manifest PATH` when automatic discovery does not apply.

## Global settings and project overrides

| Layer | Location | Purpose |
| --- | --- | --- |
| Global | `~/.config/thruput/config.toml` | Shared profiles, key defaults, and wallet bindings |
| Project | Nearest ancestor `thruput.toml` | Project defaults, profile overrides, and contract aliases |

`XDG_CONFIG_HOME` changes the global configuration root. Same-named profiles merge field by field; project values win. Contract aliases and wallet bindings merge by name.

Inside a project, choose `--global` or `--project` when changing configuration. Outside a project, omitted scope means global.

```bash
thruput config set default-key alice --profile devnet --project
thruput config unset default-key --profile devnet --project
```

The second command removes the project override and reveals any inherited value. The editable fields are `network`, `rpc-url`, `network-hash`, `faucet-url`, and `default-key`. Use [wallet commands](/cli/wallets/) to select wallets and deployment commands to create contract aliases.

## Add another endpoint

Replace the example URLs with the RPC and faucet for the same deployment:

```bash
thruput config new staging --network devnet \
  --rpc-url https://rpc.example.com \
  --faucet-url https://faucet.example.com \
  --global
```

Use `config new` to create a profile in a layer before changing its fields there. `config rm staging --global` removes that layer's profile, including its saved aliases and wallet bindings. It does not delete onchain state.
