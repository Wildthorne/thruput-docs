---
title: Project structure
description: Understand the files, build artifacts, and SDK layers in a CLI-generated contract project.
---

`groundhog new` creates a minimal Cargo contract project by default. Use `groundhog new my-counter --template counter` for the counter layout below, including its example methods and tests. Keep the generated dependency versions, compiler settings, and CLI configuration together.

## Generated files

```text
my-counter/
  Cargo.toml              # Package, SDK dependencies, and build features
  AGENTS.md               # Instructions for coding agents
  build.rs                # Integration-test setup
  groundhog.toml          # Project profiles and contract aliases
  rust-toolchain.toml     # Selected compiler and targets
  .cargo/
    config.toml           # Registry and Cargo configuration
    contract.toml         # Contract-build configuration
  src/
    lib.rs                # Library modules
    implementation.rs     # Contract logic, storage, errors, and events
    main.rs               # Contract entrypoint wrapper
  tests/
    test.rs               # Native logic tests
    test_rv32.rs          # Contract artifact tests
    integration.rs        # Tests against a running node
```

The `.gitignore` excludes build output and project-local runtime state.

## Build artifacts

`groundhog build` compiles the entrypoint for RV32, Stellar Thruput's 32-bit RISC-V contract target. It lowers the compiler output into an artifact the node can execute.

For `my-counter`, the output under `target/groundhog/` includes:

- `my_counter.rv32a`: deployable contract artifact.
- `my_counter.rv32.json`: lowering metadata.
- `my_counter.spec.xdr`: binary contract specification.
- `my_counter.spec.json`: readable contract specification.

The specification describes the contract interface and supports [TypeScript binding generation](/tools/typescript-bindings/).

## Test modes

- `cargo test` runs the native contract tests.
- `groundhog test` runs the RV32 artifact tests.
- `groundhog test --integration` manages a local node for the integration tests.

See [Testing](/programming-model/testing/) for the execution modes, generated integration environment, and how to add assertions.

## SDK layers

Generated projects start with the SDK's contract and storage macros. Use typed storage handles for normal state access. Lower-level syscall wrappers are available when you need a custom abstraction.

These layers can be combined within a contract. Use [Storage Types](/programming-model/storage-types/) to choose an API, [SDK Macros](/reference/sdk-macros/) for macro reference, and [Rust API Docs](/tools/rust-api-docs/) for exact signatures.
