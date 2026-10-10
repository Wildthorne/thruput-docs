---
title: Build and test
description: Build RV32 artifacts and choose native, artifact, or RPC integration tests.
---

Run these commands inside a [CLI-generated project](/cli/create-project/) with [Cargo access](/cli/install/#configure-cargo-access) configured.

## Build a deployable artifact

```bash
thruput build
```

The CLI compiles for RV32 and lowers the result into `target/thruput/<package>.rv32a`. It also writes lowering metadata and contract-spec sidecars. Artifact names use the package's snake-case name. See [Project structure](/contracts/project-structure/#build-artifacts).

Plain `cargo build` targets your host. Use it for Rust tooling and IDE checks, not to produce the deployable artifact.

At a workspace root, select a package:

```bash
thruput build -p my-counter
```

Use `--show-cargo-commands` to inspect the compiler invocation. Arguments after `--` go to Cargo. Keep the scaffold's compiler and feature configuration instead of recreating the cross-compilation command by hand.

## Choose a test boundary

| Command | What it exercises |
| --- | --- |
| `cargo test` | Native contract logic through the SDK test environment |
| `thruput test` | The built RV32 artifact through `tests/test_rv32.rs` |
| `thruput test --integration` | Artifact build, disposable local node, deployment, and `tests/integration.rs` |

The first two do not require a running RPC node. Integration mode starts and stops its own node; it does not submit transactions to Devnet.

```bash
cargo test
thruput test
```

For test code, assertions, and storage-cost setup, use [Test contracts](/programming-model/testing/).

## Focus a test run

```bash
thruput test --match-test counter
thruput test --skip slow
thruput test --show-output
thruput test --no-capture --test-threads 1
```

`--match-test` and `--skip` filter test names. `--show-output` includes output from passing tests; `--no-capture` streams output as tests run.

```bash
thruput test --rerun
thruput test --watch
```

`--rerun` uses the previous failure cache. `--watch` runs immediately, then repeats after source or configuration changes. They can be combined.

## Integration and workspace runs

```bash
thruput test --integration
thruput test --workspace
```

These are separate modes. `--workspace` runs members with a `test_rv32` target in package-name order. It cannot be combined with `-p` or `--integration`. Integration mode does not support `--watch` or `--rerun`.

The CLI can acquire its selected local runtime for integration tests. See [runtime selection](/cli/local-node/#runtime-selection) for explicit overrides, and [Automation](/cli/automation/) for structured test reports.
