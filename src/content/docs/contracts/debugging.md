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

Once the logic passes, run `thruput test` to check the RV32 artifact. A passing host test does not replace the artifact test.

## Inspect the build or artifact test

```bash
thruput --show-cargo-commands build
thruput test --match-test counter --show-output
```

Confirm the package, toolchain, and features. In a workspace, use `-p PACKAGE`. See [Build and test](/cli/build-and-test/).

## Classify a deployed failure

| Observation | Next check |
| --- | --- |
| Submission rejected | Inspect the signing account, profile, network identity, and reported admission error |
| Committed exception | Decode the typed error; check input and authorization conditions |
| Committed fault | Reproduce in tests; inspect execution limits and panics |
| `pending`, `recentFailure`, or `unknown` status | Observe the original transaction on the same network |
| `retry` or `dropped` status | Read the reported error. A `retry` can succeed if you resubmit the same transaction. For a `dropped` transaction, change it before you resubmit, unless the error is insufficient native tokens: then fund the sender and resubmit the same transaction before it expires |
| Unexpected view result | Check address, interface/spec, read height, and simulated caller |

```bash
thruput tx show TX_HASH --profile futurenet
```

See [Transaction Lifecycle](/how-it-works/transaction-lifecycle/#outcomes-to-distinguish) for outcomes and [CLI troubleshooting](/cli/troubleshooting/) for configuration checks.

## Reproduce through RPC

Start a local node with `thruput node --verbose` and retain its logs while reproducing the problem. CLI transaction inspection shows public status and receipt data, not a full execution trace.

For repeatable build, deployment, and RPC checks, use `thruput test --integration` and add contract-specific assertions to the generated test.
