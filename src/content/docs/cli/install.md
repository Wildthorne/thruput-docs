---
title: Install the CLI
description: Install the latest Thruput CLI and the local runtime for contract development.
---

Install the latest `thruput` release. The CLI selects the dependencies and compiler settings for projects it creates; you do not need to choose SDK or node versions.

## Before you start

Install Rust with [rustup](https://rustup.rs/).

Check that Cargo is available:

```bash
cargo --version
```

## Install with Cargo

The CLI, SDK, and testkit are published on [crates.io](https://crates.io/crates/thruput).

```bash
cargo install thruput --locked
thruput --version
```

The first command installs the latest CLI with its release's dependency lockfile. The second should print the installed CLI version.

Cargo installs executables in `~/.cargo/bin`. If `thruput` is not found, add that directory to your shell's `PATH` and open a new terminal.

## Set up the local runtime

Local nodes and RPC integration tests use `hog-devnode`. The CLI selects a compatible runtime from its bundled catalog and can download it when needed. To inspect available versions and install the selected runtime in advance:

```bash
thruput toolchain list
thruput toolchain install
thruput toolchain which
```

`list` shows the runtime catalog and installed versions. `install` downloads and verifies the selected runtime bundle. `which` shows the selected binary's path.

On Linux, a local node requires the system jemalloc and Snappy libraries. If an error names `libjemalloc.so.2` or `libsnappy.so.1`, install your distribution's corresponding packages (`libjemalloc2` and `libsnappy1v5` on Ubuntu).

These commands manage the local-node runtime. Rust is managed through `rustup`, and the CLI is installed separately as shown above. You do not need a local node to use Futurenet.

See [runtime selection](/cli/local-node/#runtime-selection) for version and binary overrides.

## Update an existing installation

Run the same `cargo install` command to install the latest release. Keep the `Cargo.toml`, `Cargo.lock`, and `rust-toolchain.toml` generated for each project rather than replacing them with files from another example.

If an older executable is still selected, check its location:

```bash
command -v thruput
thruput --version
```
