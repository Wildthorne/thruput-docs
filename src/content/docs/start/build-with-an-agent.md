---
title: Build with an Agent
description: Give your coding agent one prompt to install the Thruput CLI, fund a wallet, and deploy and call a counter contract on Project Thruput Futurenet.
---

Paste this prompt into your coding agent. It will install the CLI and skill, read an exported copy of the docs, and build and verify a counter contract on Futurenet.

## Copy the prompt

```text
Help me deploy and use my first Project Thruput counter contract on Futurenet.

1. Install the latest Thruput CLI and run thruput init. Use
   thruput --help to see all available commands. Follow the installation
   instructions at https://www.thruput.network/docs/cli/install/.
2. Install the thruput skill user-wide for this coding agent with
   thruput skill install --global, then read the installed skill.
3. Export the documentation into a new folder with thruput docs export.
   Read its index and the relevant setup and contract instructions.
4. Outside a project, run thruput config use futurenet to select the global
   default. Create a wallet with thruput wallet create, then request test funds
   with thruput airdrop. Verify the balance before deployment.
5. Run thruput new counter --template counter, enter the project directory,
   and check thruput config get still selects futurenet. New projects inherit
   the global default. Build the contract and run its tests.
6. Deploy and initialize the counter to 10. Call increment with 5,
   then verify that its read-only view returns 15.

Finish with the project location, contract address, transaction hashes,
verified counter value, and the CLI commands I can use next.
```

The agent follows the [CLI](/get-started/cli/) and [contract](/get-started/contract/) quickstarts. Provide repository access through your local environment when requested.

See [Skills and local docs](/cli/agent-tools/) for installation requirements, agent selection, and Markdown export. For a smaller task, use the prompt in an individual [quickstart](/get-started/).
