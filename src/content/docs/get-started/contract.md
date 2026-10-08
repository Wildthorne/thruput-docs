---
title: Contract quickstart
description: Create, test, and deploy a Rust counter contract to Stellar Thruput Devnet.
---

Deploy a counter to Devnet, increase its value, and read the result.

**Before you start:** complete the [CLI quickstart](/get-started/cli/) so you have the latest CLI and a funded Devnet wallet. Keep your [Cargo registry access](/cli/install/#configure-cargo-access) available in this terminal.

## 1. Create a contract

```bash
groundhog new my-counter --template counter
cd my-counter
```

The project includes a Rust counter and tests. Its main methods are `initialize`, `increment`, `decrement`, and `get`.

## 2. Build and test

```bash
groundhog build
groundhog test
```

The first build installs the compiler components selected by the project. Wait for the build and tests to finish successfully.

These commands run on your machine. You do not need to start a local blockchain.

## 3. Deploy to Devnet

```bash
groundhog deploy --profile devnet --fund 10
```

Confirm the deployment. The CLI prints the contract address and saves the alias `my-counter` in the project's Devnet profile.

`--fund 10` transfers 10 native test tokens to the contract for this example's storage. These tokens have no monetary value. This is a funding amount, not a fixed deployment fee.

## 4. Change the counter

Initialize this new counter, then increase it:

```bash
groundhog call my-counter initialize 10 --profile devnet
groundhog call my-counter increment 5 --profile devnet
```

Confirm each call and wait for success. Run `initialize` only once for this walkthrough; this example method adds the initial amount rather than enforcing one-time initialization.

## 5. Read the result

```bash
groundhog view my-counter get --profile devnet
```

The result should be **15**. You have built, tested, deployed, and called a contract on Devnet.

## Next

[Build a Counter](/tutorials/build-a-counter/) explains the contract and its tests. For the generated files and build artifacts, see [Project structure](/contracts/project-structure/).

## Use a coding agent

```text
Help me complete the Stellar Thruput contract quickstart:
https://docs.groundhog.dev/get-started/contract/
Use the latest CLI, install the groundhog skill for this project, and read
groundhog skill show contracts. Scaffold with --template counter. Check CLI setup and
Devnet funding first. Scaffold my-counter, preserve its generated
dependency and compiler settings, then build and test it.
Deploy to Devnet with the documented contract funding, initialize
the new counter to 10, increment by 5, and verify that its view returns 15.
Do not start a local node or repeat initialization on an existing counter.
Report the actual build, test, deployment, and read results separately.
```
