---
title: Contract quickstart
description: Create, test, and deploy a Rust counter contract to Stellar Thruput Futurenet.
---

Deploy a counter to Futurenet, increase its value, and read the result.

**Before you start:** complete the [CLI quickstart](/get-started/cli/) so you have the latest CLI and a funded Futurenet wallet. Keep your [Cargo registry access](/cli/install/#configure-cargo-access) available in this terminal.

## 1. Create a contract

```bash
thruput new my-counter --template counter
cd my-counter
```

The project includes a Rust counter and tests. Its main methods are `initialize`, `increment`, `decrement`, and `get`. The counter uses [Balance](/programming-model/storage-types/#balance) for nonnegative counts.

## 2. Build and test

```bash
thruput build
thruput test
```

The first build installs the compiler components selected by the project. Wait for the build and tests to finish successfully.

These commands run on your machine. You do not need to start a local blockchain.

The generated project follows your global Futurenet selection. Check it with
`thruput config get` before deploying.

## 3. Deploy to Futurenet

```bash
thruput deploy --estimate
```

Read the reported minimum funding in whole native tokens. Add **10 native test tokens** as this walkthrough's storage allowance, then replace `TOTAL_FUNDING` below with that decimal total. The allowance is an example budget, not an estimate of initializer writes or a universal requirement. These tokens have no monetary value. See [deployment estimates](/cli/deploy-and-call/#estimate-deployment-funding) for the breakdown.

```bash
thruput deploy --fund TOTAL_FUNDING \
  --init initialize --init-arg 10
```

Confirm the deployment. Funding, deployment, and initialization happen atomically. The CLI prints the contract address and saves the alias `my-counter` in the project's Futurenet profile. The sender also needs its own storage and scheduling capacity.

## 4. Change the counter

Increase the counter initialized during deployment:

```bash
thruput call my-counter increment 5
```

Confirm the call and wait for success. Do not initialize again: this example method adds the initial amount rather than enforcing one-time initialization.

## 5. Read the result

```bash
thruput view my-counter get
```

The result should be **15**. You have built, tested, deployed, and called a contract on Futurenet.

## Next

[Build a Counter](/tutorials/build-a-counter/) explains the contract and its tests. For the generated files and build artifacts, see [Project structure](/contracts/project-structure/).

## Use a coding agent

```text
Help me complete the Stellar Thruput contract quickstart:
https://thruput.network/docs/get-started/contract/
Use the latest CLI, install the thruput skill for this project, and read
thruput skill show contracts. Scaffold with --template counter. Check CLI setup and
Futurenet funding first. Scaffold my-counter, preserve its generated
dependency and compiler settings, then build and test it.
Read the deployment estimate and add the documented storage allowance to its
minimum. Deploy with that explicit total and initialize atomically to 10,
increment by 5, and verify that the view returns 15.
Do not start a local node or repeat initialization on an existing counter.
Report the actual build, test, deployment, and read results separately.
```
