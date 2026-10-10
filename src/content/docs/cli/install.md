---
title: Install the CLI
description: Install the latest Thruput CLI and prepare Cargo access for contract development.
---

Install the latest `thruput` release. The CLI selects the dependencies and compiler settings for projects it creates; you do not need to choose SDK or node versions.

## Before you start

- Install the current stable Rust toolchain with [rustup](https://rustup.rs/).
- Obtain access to the Stellar Thruput Cargo registry from your onboarding contact. Repository access alone does not grant package access.

Check that Cargo is available:

```bash
cargo --version
```

## Configure Cargo access

Set the registry address and credential provider in your shell:

```bash
export CARGO_REGISTRIES_THRUPUT_INDEX="sparse+https://crates.thruput.network/api/v1/crates/"
export CARGO_REGISTRIES_THRUPUT_CREDENTIAL_PROVIDER=cargo:token
```

Supply `CARGO_REGISTRIES_THRUPUT_TOKEN` through your credential manager or onboarding environment. Keep the token out of project files and agent prompts. If you already use a Cargo credential manager for this registry, keep its provider instead.

Use the same registry access in terminals where you build contracts. The generated project includes the registry address, but it does not include your credentials.

## Install

```bash
cargo install thruput-cli --registry thruput --locked
thruput --version
```

The first command installs the latest CLI with its release's dependency lockfile. The second should print the installed CLI version.

Cargo installs executables in `~/.cargo/bin`. If `thruput` is not found, add that directory to your shell's `PATH` and open a new terminal.

Prebuilt archives for supported macOS and Linux systems are also available on the [latest release page](https://github.com/groundhogchain/groundhog-rpc/releases/latest). Contract builds still require Rust and Cargo registry access.

On Linux, tests or a local node may also require your distribution's jemalloc and Snappy runtime libraries. If an error names `libjemalloc.so.2` or `libsnappy.so.1`, install the corresponding system package. These are separate from the CLI archive.

## Set up the local runtime

Local nodes and RPC integration tests use `hog-devnode`. The CLI selects a compatible runtime from its bundled catalog and can download it when needed. To inspect available versions and install the selected runtime in advance:

```bash
thruput toolchain list
thruput toolchain install
thruput toolchain which
```

`list` shows the runtime catalog and installed versions. `install` downloads and verifies the selected runtime bundle. `which` shows the selected binary's path.

These commands manage the local-node runtime. Rust is managed through `rustup`, and the CLI is installed separately as shown above. You do not need a local node to use Devnet.

See [runtime selection](/cli/local-node/#runtime-selection) for version and binary overrides.

## Update an existing installation

Run the same `cargo install` command to install the latest release. Keep the `Cargo.toml`, `Cargo.lock`, and `rust-toolchain.toml` generated for each project rather than replacing them with files from another example.

If an older executable is still selected, check its location:

```bash
command -v thruput
thruput --version
```
