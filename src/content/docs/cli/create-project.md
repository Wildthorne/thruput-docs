---
title: Create a project
description: Create a contract project and keep its generated compiler, build, and test configuration together.
---

Use `thruput new` to create a Rust contract project. If this is your first setup, [install the CLI](/cli/install/) and run `thruput init` first.

## Choose a template

```bash
thruput new my-counter --template counter
cd my-counter
```

The explicit `counter` template includes counter methods, an event, an error, and tests. Without `--template`, the CLI creates a minimal contract:

```bash
thruput new my-contract
```

The minimal project and named templates include the files needed for native tests, RV32 builds, and integration tests. Keep the generated `Cargo.toml`, `rust-toolchain.toml`, and `.cargo/` configuration together. You do not need to select SDK or compiler versions yourself.

Discover named templates and their prerequisites without network access:

```bash
thruput templates list
thruput templates show counter-app
```

`counter-app` adds a local React application, generated bindings, and a temporary browser wallet. It separates contract deployment (`npm run contract:deploy`) from frontend startup (`npm run dev`). Use [Build a counter](/tutorials/build-a-counter/) to build the application step by step instead.

Run `thruput new` without a name for interactive setup, or pass `--path PATH` to select a destination. The destination must be new or empty.

## Find the code

- `src/implementation.rs`: contract logic and storage.
- `tests/test.rs`: native logic tests.
- `tests/test_rv32.rs`: artifact tests.
- `tests/integration.rs`: RPC integration test entry point.
- `thruput.toml`: project profiles and deployment aliases.

See [Project structure](/contracts/project-structure/) for the complete layout and generated artifacts.

## Select a network

New projects omit `default_profile` and follow your global selection. After
`thruput config use futurenet --global`, new projects use Futurenet. Inspect
the selected profile before deploying:

```bash
thruput config get --sources
```

Use `thruput config use futurenet --project` to set a project override, or
`--profile futurenet` for one command. Builds and native/artifact tests run on your machine regardless of the profile. See [Profiles and networks](/cli/configuration/).

## Work in a Cargo workspace

Keep shared `thruput.toml`, `.cargo/`, and `rust-toolchain.toml` files at the workspace root. Select a package when building from that root:

```bash
thruput build -p my-counter
thruput test -p my-counter
```
