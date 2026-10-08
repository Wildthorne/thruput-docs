---
title: Debug a contract
description: Isolate failures in native tests, RV32 artifact tests, and submitted transactions.
---

Start at the boundary that failed. A compiler error, a contract exception, and an uncertain network submission need different checks.

## Reproduce the logic

Use the smallest input that reproduces the problem:

```bash
RUST_BACKTRACE=1 cargo test test_counter -- --nocapture
```

Native tests provide Rust diagnostics and work with host debugging tools. Use generated `try_*` client methods to assert on expected errors.

Once the logic passes, run `groundhog test` to check the RV32 artifact. A passing host test does not replace the artifact test.

## Inspect the build or artifact test

```bash
groundhog --show-cargo-commands build
groundhog test --match-test counter --show-output
```

Confirm the package, toolchain, and features. In a workspace, use `-p PACKAGE`. See [Build and test](/cli/build-and-test/).

## Classify a deployed failure

| Observation | Next check |
| --- | --- |
| Submission rejected | Inspect the signing account, profile, network identity, and reported admission error |
| Committed exception | Decode the typed error; check input and authorization conditions |
| Committed fault | Reproduce in tests; inspect execution limits and panics |
| Pending or unknown | Observe the original transaction on the same network |
| Unexpected view result | Check address, interface/spec, read height, and simulated caller |

```bash
groundhog tx show TX_HASH --profile devnet
```

See [Transaction Lifecycle](/how-it-works/transaction-lifecycle/#outcomes-to-distinguish) for outcomes and [CLI troubleshooting](/cli/troubleshooting/) for configuration checks.

## Reproduce through RPC

Start a local node with `groundhog node --verbose` and retain its logs while reproducing the problem. CLI transaction inspection shows public status and receipt data, not a full execution trace.

For repeatable build, deployment, and RPC checks, use `groundhog test --integration` and add contract-specific assertions to the generated test.
