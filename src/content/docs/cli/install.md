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

## Install with Cargo

```bash
cargo install thruput-cli --registry thruput --locked
thruput --version
```

The first command installs the latest CLI with its release's dependency lockfile. The second should print the installed CLI version.

Cargo installs executables in `~/.cargo/bin`. If `thruput` is not found, add that directory to your shell's `PATH` and open a new terminal.

## Install a packaged client

Thruput client bundle `0.1.31-rc.5` includes CLI `0.27.0`, `hog-devnode` `0.1.31-rc.2`, and the genesis contract. Choose [macOS Apple Silicon](https://groundhog-public-release-artifacts-017820684264.s3.us-west-2.amazonaws.com/groundhog-client/v0.1.31-rc.5/thruput-client-macos-arm64.tar.gz) or [Linux x86-64](https://groundhog-public-release-artifacts-017820684264.s3.us-west-2.amazonaws.com/groundhog-client/v0.1.31-rc.5/thruput-client-linux-x86_64.tar.gz). The macOS bundle requires macOS 26 or newer on Apple Silicon, includes runtime libraries, and is Developer ID signed and notarized. The Linux bundle is tested on Ubuntu 24.04 and 26.04; Ubuntu 22.04 is unsupported.

Download the archive and its [SHA256SUMS](https://groundhog-public-release-artifacts-017820684264.s3.us-west-2.amazonaws.com/groundhog-client/v0.1.31-rc.5/SHA256SUMS). In the download directory, verify the archive before extracting it:

```bash
# Apple Silicon
shasum -a 256 -c SHA256SUMS --ignore-missing

# Linux x86-64
sha256sum -c SHA256SUMS --ignore-missing
```

Check that the output reports `OK` for the archive you downloaded. Extract it into a directory you own, then add that bundle's `bin` directory to `PATH`. Keep the complete directory together, including its runtime libraries, contract artifact, and manifest. Moving only `thruput` out of the bundle breaks this layout.

```bash
thruput --version
```

If `command -v thruput` selects an older Cargo installation, put the bundle's `bin` directory before `~/.cargo/bin` in `PATH`. Contract builds still require Rust and Cargo registry access.

CLI-only [component archives](https://github.com/groundhogchain/groundhog-rpc/releases/latest) are also available to users with repository access. They do not include the local runtime. On Linux, both the client tarball and component installations require system jemalloc and Snappy libraries for a local node. If an error names `libjemalloc.so.2` or `libsnappy.so.1`, install your distribution's corresponding packages (`libjemalloc2` and `libsnappy1v5` on Ubuntu).

## Set up the local runtime

Local nodes and RPC integration tests use `hog-devnode`. A packaged client includes its compatible runtime. For a Cargo or component installation, the CLI selects a compatible runtime from its bundled catalog and can download it when needed. To inspect available versions and install the selected runtime in advance:

```bash
thruput toolchain list
thruput toolchain install
thruput toolchain which
```

`list` shows the runtime catalog and installed versions. `install` downloads and verifies the selected runtime bundle. `which` shows the selected binary's path.

These commands manage the local-node runtime. Rust is managed through `rustup`, and the CLI is installed separately as shown above. You do not need a local node to use Futurenet.

See [runtime selection](/cli/local-node/#runtime-selection) for version and binary overrides.

## Update an existing installation

For a Cargo installation, run the same `cargo install` command to install the latest release. For a packaged client, download and verify the new complete bundle, then update `PATH` to select its `bin` directory. Keep the `Cargo.toml`, `Cargo.lock`, and `rust-toolchain.toml` generated for each project rather than replacing them with files from another example.

If an older executable is still selected, check its location:

```bash
command -v thruput
thruput --version
```
