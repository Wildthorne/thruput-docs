---
title: Command reference
description: Thruput CLI commands, common options, and links to task instructions.
---

## First-Run Setup

| Command | Purpose | Usage |
| --- | --- | --- |
| `thruput --version` | Print the installed release | [Install](/cli/install/) |
| `thruput init` | Initialize profiles and check setup; offer initial key creation interactively | [CLI quickstart](/get-started/cli/) |
| `thruput init --non-interactive --generate-key` | Explicitly authorize initial key creation without prompts | [Automation](/cli/automation/) |
| `thruput status [--profile NAME]` | Inspect project, key, compiler, and runtime readiness | [Troubleshooting](/cli/troubleshooting/) |
| `thruput new [NAME] [--path PATH] [--template counter\|counter-app]` | Create a minimal contract by default; omit the name for interactive setup | [Create a project](/cli/create-project/) |
| `thruput templates list` / `thruput templates show NAME` | Discover named templates and their prerequisites offline | [Choose a template](/cli/create-project/#choose-a-template) |
| `thruput completion SHELL` | Print shell completions | `thruput completion --help` |
| `thruput COMMAND --help` | Print the installed command's options | Available on each command |

## Configuration

| Command | Purpose | Usage |
| --- | --- | --- |
| `config profiles` | List persisted profiles | [Profiles and networks](/cli/configuration/) |
| `config get [NAME] [--sources]` | Inspect merged persisted settings and their origins | [Inspect settings](/cli/configuration/#inspect-the-current-settings) |
| `config new NAME --network NETWORK` | Create a profile in one layer | [Add an endpoint](/cli/configuration/#add-another-endpoint) |
| `config set FIELD VALUE --profile NAME` | Set one typed field in an existing profile layer | [Overrides](/cli/configuration/#global-settings-and-project-overrides) |
| `config unset FIELD --profile NAME` | Remove a field from one layer | [Overrides](/cli/configuration/#global-settings-and-project-overrides) |
| `config use NAME` | Set the layer's default profile | [Select a profile](/cli/configuration/#choose-a-profile) |
| `config rm NAME` | Remove a profile from one layer | Requires confirmation; `--yes` for an intended automated removal |
| `--global` / `--project` | Choose the layer for a configuration mutation | Required inside a project; mutually exclusive |

## Keys and Wallets

| Command | Purpose | Usage |
| --- | --- | --- |
| `keys generate [NAME] [--scheme ed25519\|mldsa65]` | Generate a stored key; Ed25519 by default | [Keys and wallets](/cli/wallets/) |
| `keys import NAME` | Import an Ed25519 secret seed through the supported input flow | `thruput keys import --help` |
| `keys ls` / `keys use NAME` | List or select a global key | [Select an account](/cli/wallets/#select-an-account) |
| `keys export NAME` | Print private key material | Intended export only; exclude from logs |
| `keys rm NAME` | Delete a local key | Requires confirmation |
| `wallet create [--key NAME] [--name NAME]` | Derive and save an empty native account binding; Ed25519 keys only | [Create a wallet](/cli/wallets/#create-a-key-and-wallet) |
| `wallet ls` / `wallet use NAME` | List or select a profile wallet | [Select an account](/cli/wallets/#select-an-account) |
| `wallet rm NAME` | Remove a local binding | Does not remove onchain state |
| `balance [TARGET]` | Read the native-token balance | [Funding](/cli/wallets/#fund-and-transfer) |
| `airdrop [RECIPIENT]` | Request test funding | [Faucet](/tools/faucet/) |
| `transfer RECIPIENT AMOUNT` | Transfer native tokens from the selected account | [Funding and transfers](/cli/wallets/#fund-and-transfer) |

## Build and Test

| Command or option | Purpose | Usage |
| --- | --- | --- |
| `build [-p PACKAGE]` | Build a deployable RV32 artifact | [Build and test](/cli/build-and-test/) |
| `build --bindings ts` | Also generate TypeScript bindings | [Code generation](/cli/codegen/) |
| `build --stack-size SIZE` | Set guest stack size within configured memory | `thruput build --help` |
| `test [-p PACKAGE]` | Build and run the RV32 artifact test target | [Test modes](/cli/build-and-test/#choose-a-test-boundary) |
| `test --integration` | Run an isolated local-node integration target | [Integration tests](/programming-model/testing/#integration-test-environment) |
| `test --workspace` | Run eligible workspace members | [Workspace runs](/cli/build-and-test/#integration-and-workspace-runs) |
| `test --match-test TEXT` / `--skip TEXT` | Filter test names | [Focused runs](/cli/build-and-test/#focus-a-test-run) |
| `test --rerun` / `--watch` | Repeat failures or watch files | Not supported with `--integration` |
| `test --show-output` / `--no-capture` | Control test output | [Focused runs](/cli/build-and-test/#focus-a-test-run) |

## Local Node

| Command or option | Purpose | Usage |
| --- | --- | --- |
| `node` | Start an ephemeral local node | [Run a local node](/cli/local-node/) |
| `node --data-dir PATH` | Preserve chain state | [Persistent state](/cli/local-node/#preserve-state) |
| `node --port PORT` / `--host ADDRESS` | Configure the public listener | [Endpoint and logging](/cli/local-node/#change-the-endpoint-or-logging) |
| `node --verbose` | Forward node diagnostics | [Troubleshooting](/cli/troubleshooting/) |
| `node --network-config NAME=VALUE` | Override a supported genesis parameter | Repeatable; preserve settings when reopening a data directory |
| `node --key NAME` / `--initial-account-tokens AMOUNT` | Fund a stored key on a fresh chain | Default: the selected key and 100 native tokens |
| `node --bootstrap-accounts FILE` | Fund fixture-owned public keys at genesis | JSON array; cannot be combined with `--key` or `--initial-account-tokens` |
| `toolchain list` / `install` / `which` | Inspect or acquire managed runtimes | [Local runtime setup](/cli/install/#set-up-the-local-runtime) |
| `toolchain use VERSION` / `clean VERSION` | Select or remove a managed version | `thruput toolchain --help` |
| `chain dump --data-dir PATH --output FILE` | Back up a stopped local chain | [Persistent state](/cli/local-node/#preserve-state) |
| `chain restore --data-dir PATH --input FILE` | Restore a stopped local chain | Requires confirmation before replacing populated state |

## Deploy and Interact

| Command or option | Purpose | Usage |
| --- | --- | --- |
| `deploy --fund AMOUNT` | Deploy and fund a contract with native tokens | [Deploy and call](/cli/deploy-and-call/) |
| `deploy --estimate [--json]` | Read deployment collateral and configuration context without loading a signing key or submitting | [Estimate funding](/cli/deploy-and-call/#estimate-deployment-funding) |
| `deploy --fund minimum` | Fund a fresh deployment's balance-item deposit and code collateral; leaves no free balance and cannot include initialization | [Minimum funding](/cli/deploy-and-call/#estimate-deployment-funding) |
| `deploy --init METHOD --init-arg VALUE` | Initialize atomically with deployment | [Initialization](/cli/deploy-and-call/#include-initialization) |
| `deploy --artifact PATH --alias NAME` | Select an artifact and saved alias | [Deployment](/cli/deploy-and-call/#deploy-an-artifact) |
| `call CONTRACT METHOD [ARGS...]` | Submit a signed contract invocation | [Calls](/cli/deploy-and-call/#submit-a-call) |
| `view CONTRACT METHOD [ARGS...]` | Run a sandboxed read without submitting | [Views](/cli/deploy-and-call/#read-without-submitting) |
| `storage CONTRACT KEY` | Read a raw committed storage item | [Views and storage](/cli/deploy-and-call/#read-without-submitting) |
| `--dry-run` | Prepare deploy/call transactions without broadcast | Still requires signing context and network access |
| `--yes` (alias `--force`) | Confirm an intended write without a prompt; `skill` commands accept only `--yes` | [Automation](/cli/automation/#confirm-intended-writes) |
| `--profile NAME` / `--rpc-url URL` | Select configuration or override the endpoint | [Profiles](/cli/configuration/) |

## Transactions, Events, and Tokens

| Command | Purpose | Usage |
| --- | --- | --- |
| `tx show HASH` | One public status and receipt lookup | [Inspect transactions](/cli/transactions/#look-up-one-transaction) |
| `tx list [TARGET]` | One page of root-invocation history | [History](/cli/transactions/#list-history) |
| `events list CONTRACT` | One page of raw or spec-decoded contract events | [Events](/cli/transactions/#read-contract-events) |
| `token transfers TOKEN` | One page of token transfer records | [Token transfers](/cli/transactions/#inspect-token-transfers) |
| `--limit N` / `--cursor CURSOR` | Control a historical list page | [Pagination](/cli/transactions/#continue-a-page) |

## TypeScript Bindings

| Command | Input/output | Usage |
| --- | --- | --- |
| `build --bindings ts` | Contract build plus generated bindings | [Generate bindings](/cli/codegen/) |
| `codegen ts SPEC -o FILE` | Canonical `.spec.xdr` to TypeScript; stdout if output is omitted | [Write into an app](/cli/codegen/#write-bindings-into-an-application) |

## Skills and Local Documentation

| Command | Purpose | Usage |
| --- | --- | --- |
| `thruput skill install [--global] [--agent NAME]` | Install the maintained skill through `npx skills`; `--agent` is repeatable | [Install the skill](/cli/agent-tools/#install-the-maintained-skill) |
| `thruput skill update [--global]` | Update only the `thruput` skill in the selected scope; requires an existing installation | [Update the skill](/cli/agent-tools/#update-an-installed-skill) |
| `skill install --yes` / `skill update --yes` | Authorize npm execution and skill changes; unattended installation also needs `--agent` | [Automate setup](/cli/agent-tools/#automate-skill-setup) |
| `thruput skill show [TOPIC] [--global]` | Read an installed skill file offline; current-directory installation before global unless `--global` is set | [Read guidance](/cli/agent-tools/#read-installed-guidance-offline) |
| `thruput skill list [--global]` | List reference names from the selected installed skill | [Read guidance](/cli/agent-tools/#read-installed-guidance-offline) |
| `thruput docs [--foreground] [--port PORT]` | Serve the bundled site in the foreground; default port `4321`, `0` selects a free port | [Serve docs](/cli/agent-tools/#serve-local-documentation) |
| `thruput docs --dir PATH` | Serve a trusted local snapshot | [Snapshot override](/cli/agent-tools/#use-a-trusted-site-snapshot) |
| `thruput docs --background [--port PORT]` | Start or reuse a matching background server; conflicts with `--foreground` | [Serve docs](/cli/agent-tools/#serve-local-documentation) |
| `thruput docs status` | Inspect the current user's background server and log path | [Serve docs](/cli/agent-tools/#serve-local-documentation) |
| `thruput docs stop` | Stop the managed background server while retaining extracted Markdown | [Serve docs](/cli/agent-tools/#serve-local-documentation) |
| `thruput docs export --output PATH [--dir SNAPSHOT]` | Export portable Markdown into a new directory without serving | [Export Markdown](/cli/agent-tools/#export-markdown-without-a-server) |

## Shared Flags

| Global flag | Effect |
| --- | --- |
| `--non-interactive` | Disable prompts and terminal UI; does not grant confirmation |
| `--json` | Emit structured output |
| `--quiet` | Suppress status messages |
| `--show-cargo-commands` | Print Cargo invocations |
| `--offline` | Disable managed runtime downloads and skill installation/updates; does not disable RPC or Cargo traffic |

### JSON output

| Output concern | Rule | Usage |
| --- | --- | --- |
| Success and failure | Check exit status and `ok`; command failures may use stderr | [Use the CLI in scripts](/cli/automation/) |
| Payload shape | Check command-specific `data.schemaVersion` | [Structured output](/cli/automation/#request-structured-output) |
| Watch mode | One JSON record per completed test run | [Structured output](/cli/automation/#request-structured-output) |
