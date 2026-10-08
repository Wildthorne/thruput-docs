---
title: CLI
description: Install the Groundhog CLI, configure networks, and build, test, deploy, and call contracts.
sidebar:
  label: Introduction
---

`groundhog` is the command-line tool for working with Stellar Thruput projects and networks. Use it to create a project, build and test a contract, run a local node, or interact with a deployed contract.

## Projects and networks

The CLI works with two kinds of configuration:

- A **project** contains your Rust contract, tests, and build settings.
- A **profile** selects the network and identity used for an interaction.

This lets you build a contract once and use profiles to target a local node or Devnet. You can also use network commands without creating a contract project.

## The development loop

| Task | Command |
| --- | --- |
| Create a contract project | `groundhog new` |
| Build a contract artifact | `groundhog build` |
| Run contract artifact tests | `groundhog test` |
| Start a local node | `groundhog node` |
| Deploy a contract | `groundhog deploy` |
| Call a deployed contract | `groundhog call` |

These are command names, not a setup script. Start with [installation](/cli/install/), then follow the [CLI quickstart](/get-started/cli/) for a first Devnet interaction.

The [contract quickstart](/get-started/contract/) adds deployment and calls. Use [Run a local node](/cli/local-node/) when you want a disposable node on your machine.

## Look up an option

Run `groundhog <command> --help` for the installed version's options, or use the [command reference](/cli/reference/). [Profiles and networks](/cli/configuration/) explains profile selection and project overrides.

Use [Skills and local docs](/cli/agent-tools/) to install agent guidance, read bundled references, and serve or export documentation. [Build with an Agent](/start/build-with-an-agent/) combines setup with a first-project prompt.
