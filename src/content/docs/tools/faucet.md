---
title: Faucet
description: Create a Devnet wallet and request HOG through the hosted faucet.
---

The hosted faucet supports two CLI workflows:

- `groundhog wallet create` prefunds a future address, deploys its wallet contract, and initializes it for your signing key.
- `groundhog airdrop` funds an existing wallet or address.

Your Devnet profile needs both the RPC and faucet URLs supplied during onboarding:

```toml
[profile.devnet]
network = "devnet"
rpc_url = "<DEVNET_RPC_URL>"
faucet_url = "<DEVNET_FAUCET_URL>"
```

Check that the faucet advertises the same RPC before using it:

```bash
curl -fsS "<DEVNET_FAUCET_URL>/health" | jq .
curl -fsS "<DEVNET_FAUCET_URL>/v1/network" | jq .
```

Create and inspect a wallet:

```bash
groundhog keys generate alice
groundhog wallet create --key alice --profile devnet
groundhog wallet ls --profile devnet
groundhog balance alice --profile devnet
```

Request more HOG only when needed:

```bash
groundhog airdrop alice --profile devnet
groundhog balance alice --profile devnet
```

Hosted requests are subject to deployment-specific quotas. Remote airdrops use the amount selected by the faucet, so omit `--amount`.

For the complete setup, wallet, deployment, and contract interaction workflow, follow [Test the CLI on Devnet](/tutorials/test-cli-on-devnet/).
