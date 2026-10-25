---
title: Profiles and networks
description: Select Futurenet, local development, or a custom endpoint and manage global and project configuration.
---

A profile selects the network, endpoint, and account settings for a command. Global profiles are reusable across projects; a project's `thruput.toml` can override them.

## Inspect the current settings

```bash
thruput config profiles
thruput config get futurenet --sources
thruput status --profile futurenet
```

`config get` shows persisted configuration and where it came from. `status` adds environment diagnostics, including the effective key and local-runtime selection. Neither command requests funds or deploys a contract.

## Choose a profile

For one command:

```bash
thruput balance --profile futurenet
```

To make Futurenet your global default, including in new projects:

```bash
thruput config use futurenet --global
```

New project templates omit `default_profile`. Existing projects can still have
a project default that overrides the global selection. To select Futurenet
for one project:

```bash
thruput config use futurenet --project
```

Profile selection checks, in order:

1. `--profile`
2. `THRUPUT_PROFILE`
3. Project `default_profile`
4. Global `default_profile`

If none selects a profile, network commands fail. Offline builds and tests can
use a scaffold's local overlay without a selected default. The name `default` has no special fallback meaning.

## <span id="devnet">Futurenet</span>

`thruput init` creates `local` and `futurenet`, with `local` as the initial default. Futurenet uses `https://rpc.thruput.network` and `https://faucet.thruput.network`. Initialization preserves existing defaults and custom profile fields. For a first funded account, follow the [CLI quickstart](/get-started/cli/).

The CLI validates the selected network before signing. An explicit `network-hash` pins the network identity. Without a pin, hosted native-account operations use the configured network descriptor and RPC identity. Do not copy a hash from a different deployment; a Futurenet reset can change the identity.

`network = "devnet"` remains a compatibility alias for the hosted network.
Existing Devnet profiles and saved wallets keep their names and settings.
New installations create only the `futurenet` hosted profile. To add it to an
older installation, rerun `thruput init`, then select it with
`thruput config use futurenet --global`. Profile names are distinct; the network
alias does not copy wallets or contract aliases between profiles.
Older CLIs do not recognize `network = "futurenet"` and can fail to update a
global config containing it. Upgrade those CLIs or keep their configuration
separate.

`config new --network futurenet` stores only the supplied fields. A project
overlay inherits omitted endpoints from the same-named global profile.

## Local development

Profiles with `network = "local"` can use the endpoint and runtime manifest recorded by a running `thruput node`. See [Run a local node](/cli/local-node/).

For a one-off endpoint override on an RPC command:

```bash
thruput balance --profile local --rpc-url http://127.0.0.1:9546
```

Local airdrops also need that node's runtime manifest, which identifies the node's faucet. Use `--runtime-manifest PATH` when automatic discovery does not apply.

## Global settings and project overrides

| Layer | Location | Purpose |
| --- | --- | --- |
| Global | `~/.config/thruput/config.toml` | Shared profiles, key defaults, and wallet bindings |
| Project | Nearest ancestor `thruput.toml` | Project defaults, profile overrides, and contract aliases |

`XDG_CONFIG_HOME` changes the global configuration root. Same-named profiles merge field by field; project values win. Contract aliases and wallet bindings merge by name.

Inside a project, choose `--global` or `--project` when changing configuration. Outside a project, omitted scope means global.

```bash
thruput config set default-key alice --profile futurenet --project
thruput config unset default-key --profile futurenet --project
```

The second command removes the project override and reveals any inherited value. The editable fields are `network`, `rpc-url`, `network-hash`, `faucet-url`, and `default-key`. Use [wallet commands](/cli/wallets/) to select wallets and deployment commands to create contract aliases.

## Add another endpoint

Replace the example URLs with the RPC and faucet for the same deployment:

```bash
thruput config new staging --network futurenet \
  --rpc-url https://rpc.example.com \
  --faucet-url https://faucet.example.com \
  --global
```

Use `config new` to create a profile in a layer before changing its fields there. `config rm staging --global` removes that layer's profile, including its saved aliases and wallet bindings. It does not delete onchain state.
