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
curl -fsS "<DEVNET_FAUCET_URL>/v1/network" \
  | jq -e --arg rpc "<DEVNET_RPC_URL>" '.endpoints.rpcUrl == $rpc'
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

Wallet creation and airdrops keep idempotency records in the Groundhog cache. If either command reports a pending attempt, rerun the exact same command and keep the corresponding cache record until it completes.

For the complete setup, wallet, deployment, and contract interaction workflow, follow [Develop on Devnet with the CLI](/tutorials/develop-on-devnet/).
