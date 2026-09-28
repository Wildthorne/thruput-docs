---
title: Getting Started
description: Set up the Groundhog CLI and build your first RV32 contract.
---

Working with a coding agent? Once the CLI is installed, run `groundhog docs`, give the agent its localhost URL, and have it read `groundhog --skill`. See [Build with an Agent](/start/build-with-an-agent/) for the handoff and access setup.

## How to Start

The **[Groundhog CLI](/tools/groundhog-cli/)** is the recommended way to get going. It scaffolds a project, manages the Rust toolchain, builds deployable RV32 artifacts, and wraps the local-node workflow. RV32 is Groundhog's 32-bit RISC-V contract target. The tutorials on this site all start from CLI-generated projects.

That said, the CLI is a convenience, not a requirement. You can also:

- Inspect `sdk_rs/example-contracts/` as the SDK's internal compatibility and test corpus
- Build a project from scratch using the SDK crate directly

The CLI is just a consumer of the SDK. It generates the same Rust crate you'd write by hand: a standard Cargo project that depends on the SDK and uses its storage types and macros. Normal `cargo build` and `cargo test` target the host. `groundhog build` and `groundhog test` target RV32 by default.

## Choose and Install a Client Bundle

Use the [Groundhog 0.1.27 client bundle](https://github.com/groundhogchain/packaging/releases/tag/v0.1.27). Keep the CLI, local node, runtime libraries, and contract artifacts together in the extracted directory.

| Component | Version in 0.1.27 |
| --- | --- |
| CLI and JSON-RPC gateway | `0.17.0` |
| Rust SDK used by the CLI scaffold | `0.34.3` |
| Rust JSON-RPC client used by the scaffold | `0.17.0` |
| Standard contract interfaces | `=0.1.30` |
| Local node | `0.1.27-rc.7` |

The node's RC version is the artifact selected by the final bundle. The [release manifest](https://github.com/groundhogchain/packaging/blob/v0.1.27/release-manifest.toml) records its exact source commit. The scaffold uses `nightly-2026-07-01`.

These docs are checked against those sources. Source review does not establish that every tutorial has been run against the hosted network. Before creating a Devnet wallet or submitting transactions, follow [Devnet version discovery](/tutorials/develop-on-devnet/#2-configure-devnet-identity) and select the bundle matching the serving release.

Before starting, obtain access to the [packaging releases](https://github.com/groundhogchain/packaging/releases) and the private Groundhog Cargo registry. Install Rust and Cargo through [rustup](https://rustup.rs/) if needed. Keep tokens and passwords out of agent conversations.

Download the selected release's client archive for your platform. The Apple Silicon archive is `groundhog-client-macos-arm64.tar.gz`; the Linux x86-64 archive is `groundhog-client-linux-x86_64.tar.gz`. Extract the complete archive and keep its directory layout intact.

On Ubuntu 26.04, install the build tools and Linux node's system libraries before checking the binaries:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl build-essential jq libjemalloc2 libsnappy1v5
```

Other Linux distributions may use different package names. The node requires `libjemalloc.so.2` and `libsnappy.so.1`; these system libraries are separate from the files in the client archive.

Set the actual extracted directory in each terminal you use:

```bash
export GROUNDHOG_CLIENT_HOME="/path/to/extracted/groundhog-client-<version>-<platform>"
export PATH="$GROUNDHOG_CLIENT_HOME/bin:$PATH"
command -v groundhog
groundhog --version
"$GROUNDHOG_CLIENT_HOME/bin/hog-devnode" --version
```

Confirm these are the versions in the selected release. An older `groundhog` elsewhere on your machine may lack `--skill` or use different commands. The CLI does not manage Cargo registry credentials.

The local tutorial includes a [runtime selection check](/tutorials/develop-locally/#verify-the-selected-runtime). An inherited `GROUNDHOG_DEVNODE_BINARY` can override the adjacent bundled node, even after you change `PATH`.

## Read the Docs Locally

```bash
groundhog docs
```

Keep this terminal running and open the printed URL. You and a coding agent on the same machine can read the bundled site without the hosted site's login. In another terminal, run `groundhog --skill` for the installed release's agent instructions. See [Build with an Agent](/start/build-with-an-agent/) for snapshot version notes and agents running on another machine.

## Initialize the CLI

Run the interactive setup before creating your first project:

```bash
groundhog init
```

Init creates reusable global `local` and `devnet` profiles. The Devnet profile includes its RPC and faucet settings. On a fresh setup with no stored keys, accept key generation to create and select the key named `default`.

Groundhog stores global profiles in `~/.config/groundhog/config.toml` by default. A project's `groundhog.toml` is an optional overlay for project defaults, profile overrides, and contract aliases. Same-named profiles merge, with project values taking precedence. Groundhog honors `XDG_CONFIG_HOME` when set.

Inspect the profiles created by init:

```bash
groundhog config profiles
groundhog config get devnet --sources
```

Use `groundhog config new`, `set`, `unset`, and `use` for routine profile management instead of editing TOML. See [Groundhog CLI configuration](/tools/groundhog-cli/#configuration) for merge behavior, selection precedence, and mutation scope.

### Optional: Create a Devnet Wallet

Skip this section if you are starting with local development. To prepare for the hosted Devnet tutorial, create a globally reusable wallet for the selected `default` key from outside a Groundhog project:

```bash
groundhog wallet create --profile devnet
groundhog airdrop --profile devnet
groundhog balance --profile devnet
```

The wallet inherits the key name and becomes the effective wallet. Wallet creation prefunds its future address only so the wallet contract can be created. Use airdrop to request more funds from the faucet. If you selected another key, the same omitted-target commands resolve its effective wallet. See [Faucet](/tools/faucet/) for funding and retry guidance.

## Create and Run

```bash
groundhog new my-counter
cd my-counter
```

### Configure Cargo Access

Generated projects define the Groundhog registry in `.cargo/config.toml`. Cargo also needs a credential provider to use your registry token. A token alone does not resolve `authenticated registries require a credential-provider to be configured`.

For an agent or automation session, have your onboarding contact or credential manager supply `CARGO_REGISTRIES_GROUNDHOG_TOKEN` in the task's environment. Then select Cargo's environment-token provider in that shell:

```bash
export CARGO_REGISTRIES_GROUNDHOG_CREDENTIAL_PROVIDER=cargo:token
```

This path does not require `cargo login` or write a token to disk. Repeat the provider selection in another terminal used for builds. Keep tokens out of command arguments, agent conversations, and project files.

If you already use a credential manager for this registry, keep its provider instead. For interactive login, configure your preferred provider using [Cargo's credential-provider documentation](https://doc.rust-lang.org/cargo/reference/registry-authentication.html), then run `cargo login --registry groundhog` from the project directory. The `cargo:token` provider stores interactive login tokens in Cargo's plaintext credentials file; OS keychain providers offer another storage option.

### Test and Build

SDK `0.34.3` downloads its test executor from public storage. No FFI download credentials are required. Cargo registry access is still required.

```bash
cargo test
groundhog build
```

You now have a working counter contract with passing native tests and a deployable RV32 artifact under `target/groundhog/`. The CLI also offers a `stub` template (`groundhog new my-contract --template stub`) if you want a bare-bones starting point.

Keep the dependency versions and toolchain generated by your installed CLI. Do not replace its `Cargo.toml` with one copied from a tutorial for another release.

The scaffold creates `.gitignore` entries for `/target/` and `/.groundhog/`.

## Main Commands

Generated projects work with both `cargo` and `groundhog`. Use `cargo` for native Rust development and `groundhog` for contract artifacts, local nodes, and RPC workflows:

| Command                          | What happens                                                                             | Use for                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| `cargo build`                    | Compiles as native code for your host machine                                            | IDE support, rust-analyzer               |
| `cargo test`                     | Runs tests natively. Faults are Rust panics caught by `catch_unwind`.                    | Fast logic tests, step-through debugging |
| `groundhog build`                | Builds the deployable RV32 artifact and lowering metadata                                | Deployable contract artifact             |
| `groundhog node`                 | Starts a standalone local `hog-devnode` on port `9545`                                   | Local deploy/call testing                |
| `groundhog deploy`               | Signs and submits the selected built artifact                                            | Deploy to the selected profile           |
| `groundhog config get [profile]` | Inspects merged persisted profile configuration                                          | Profile setup and troubleshooting        |
| `groundhog wallet create`        | Creates a contract wallet with creation-only prefunding                                  | Hosted-network setup                     |
| `groundhog balance [TARGET]`     | Reads a committed native HOG balance; omission uses the effective wallet                 | Funding checks                           |
| `groundhog test`                 | Runs executor-backed RV32 artifact tests                                                 | Contract artifact tests                  |
| `groundhog test --integration`   | Starts an ephemeral `hog-devnode`, deploys the contract, and runs `tests/integration.rs` | End-to-end RPC tests                     |

For a command-by-command map, including the Foundry/Anvil mental model for local development, see [Groundhog CLI](/tools/groundhog-cli/).

### What `groundhog build` Produces

`groundhog build` always builds the RV32 (32-bit RISC-V) target; there is no `--target` flag. It compiles the entrypoint binary, lowers it, and writes:

- `target/groundhog/<name>.rv32a`: deployable contract artifact
- `target/groundhog/<name>.rv32.json`: RV32 lowering metadata
- `target/groundhog/<name>.spec.xdr`: canonical contract spec, when metadata exists
- `target/groundhog/<name>.spec.json`: human-readable contract spec, when metadata exists

The effective Cargo build is:

```bash
cargo \
  --config .cargo/contract.toml \
  build \
  --release \
  --no-default-features \
  --features entrypoints \
  --target riscv32im-unknown-none-elf \
  -p my-counter \
  --bin my_counter
```

Then the CLI lowers the ELF into the `.rv32a` artifact consumed by the node.

### Integration Tests

`groundhog test --integration` is the production-shaped test path. It starts an ephemeral `hog-devnode`, builds and deploys the RV32 artifact, and runs the scaffolded `tests/integration.rs` with these environment variables:

| Variable                     | Value                                       |
| ---------------------------- | ------------------------------------------- |
| `GROUNDHOG_INTEGRATION_TEST` | `1`; activates the scaffolded live test     |
| `GROUNDHOG_RPC_URL`          | RPC URL for the ephemeral node              |
| `GROUNDHOG_CONTRACT_ADDRESS` | Address of the deployed contract            |
| `GROUNDHOG_PROFILE`          | `integration`                               |
| `GROUNDHOG_DEFAULT_KEY`      | Lowest-index `local_user`, normally `dev-1` |
| `GROUNDHOG_RUNTIME_MANIFEST` | Runtime manifest path, when available       |

The starter test confirms that the node is live and the contract was deployed. Add contract-specific RPC assertions in that file. See [Testing](/programming-model/testing/#what-the-scaffold-gives-you) for the generated feature and build-script wiring.

## What the CLI Generated

```
my-counter/
  Cargo.toml              # SDK dependency, RV32 bin wrapper, dev feature toggle
  AGENTS.md               # Groundhog instructions for coding agents working in this project
  build.rs                # Activates the RPC test during integration runs
  groundhog.toml          # project profile overlays, selection, and contract aliases
  rust-toolchain.toml     # Rust toolchain and targets
  .gitignore              # ignores /target/ and /.groundhog/
  .cargo/
    config.toml           # Cargo target configuration
    contract.toml         # CLI-only Cargo overlay for RV32 builds
  src/
    lib.rs                # Module wiring, no_std contract builds, mock registration
    implementation.rs     # Your contract: error type, storage struct, methods
    main.rs               # RV32 entrypoint wrapper
  tests/
    test.rs               # Native SDK tests through the generated client
    integration.rs        # RPC test, run by `groundhog test --integration`
    test_rv32.rs          # RV32 artifact test, run by `groundhog test`
```

The counter has four core methods: `initialize`, `increment`, `decrement`, and `get`. The scaffold also includes a small event example (`ping`) and an explicit error example (`error`). All counter mutations use `strict_inc`, which records signed changes instead of replacement values. Those [deltas can merge](/programming-model/execution/#merged-deltas) across concurrent calls. The native test deploys the contract into a mock environment and calls it through a generated client.

For a line-by-line walkthrough of this code, see [Build a Counter](/tutorials/build-a-counter/).

## SDK Surfaces

The CLI generates code using the macro layer (`#[sdk::storage]`, `#[contract]`). This is the fastest path to a working contract, but it's not the only way to build on Groundhog.

The SDK surfaces can be mixed: a contract can use the `#[contract]` macro while accessing storage through typed handles or raw syscall wrappers.

| Layer                     | What it provides                                                                                                                                                                                                              | When to use                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Macros**                | `#[storage]`, `#[contract]`, `#[contract_exception]`. Generates storage wiring, contract entrypoints, and client stubs.                                                                                                       | Default. Start here.                                              |
| **Typed storage handles** | `Balance`, `NNInt`, `CapacityConstraint`, `Map<K, V>`, `Value<T>`, `Bytestring`, `RCQ<T>`, `Vector<T>`. `Value`, map keys, and typed RCQ entries use CXS; integer and bytestring types expose specialized storage operations. | Default storage access without writing raw syscalls.              |
| **Raw syscalls**          | Direct `bytestring_set()`, `non_negative_int_strict_inc()` calls.                                                                                                                                                             | When you need full control or are building your own abstractions. |

The SDK's `erc20_low_level/` example implements ERC-20 storage through raw bytestring and NNInt syscall wrappers instead of typed storage handles. It still uses `#[contract]`, generated clients, events, and SDK error helpers. Compare it with `erc20/`, which implements the same interface with `Value`, `Map`, and `Balance`.

If the provided storage types don't fit your use case, drop down a layer. The syscall interface is documented in the [Syscalls Reference](/reference/syscalls/). Generated Rustdoc for exact SDK signatures lives at [crates.thruput.network](https://crates.thruput.network); see [Rust API Docs](/tools/rust-api-docs/) for common links.

## Deployment

The CLI uses profiles to target local and hosted networks with the same build, deploy, call, view, balance, and storage commands.

| Path                | Account model                                                                         | Start here                                                      |
| ------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Local `hog-devnode` | Built-in `dev-1+` local users from the active runtime manifest; `dev-0` is the faucet | [Develop Locally with the CLI](/tutorials/develop-locally/)     |
| Hosted Devnet       | Persistent key-owned contract wallet funded through the faucet                        | [Develop on Devnet with the CLI](/tutorials/develop-on-devnet/) |

Use local development first for fast, disposable iteration. Move to Devnet when you want to validate persistent wallet setup, hosted endpoint behavior, faucet funding, and shared-chain deployment.

The [Groundhog CLI reference](/tools/groundhog-cli/) documents individual commands, flags, profile precedence, node options, and artifact formats.

## Next Steps

- **[Groundhog CLI](/tools/groundhog-cli/)**: Map each CLI command to the development job it handles
- **[TypeScript SDK](/tools/typescript-sdk/)**: Connect a cluster-aware client and execute contract calls
- **[Faucet](/tools/faucet/)**: Understand wallet-creation prefunding and application funding
- **[Authorization](/how-it-works/authorization/)**: Understand network-bound transaction signatures
- **[Develop Locally with the CLI](/tutorials/develop-locally/)**: Build, deploy, and call the counter against `hog-devnode`
- **[Develop on Devnet with the CLI](/tutorials/develop-on-devnet/)**: Create a persistent key-owned wallet and deploy the counter to Devnet
- **[Rust API Docs](/tools/rust-api-docs/)**: Find generated Rustdoc for the SDK crates
- **[Build a Counter](/tutorials/build-a-counter/)**: Line-by-line walkthrough of the contract you just generated
- **[Merged Deltas](/programming-model/execution/#merged-deltas)**: Understand how concurrent state changes combine
- **[Build a Token](/tutorials/build-a-token/)**: Build a full ERC-20 token
