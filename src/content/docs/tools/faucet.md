---
title: Faucet
description: Create a Devnet wallet and request HOG through the hosted faucet.
---

Use the faucet to create a Devnet wallet and fund it before deploying an application. The hosted service supports two CLI workflows:

- `groundhog wallet create` prefunds a future address, deploys its wallet contract, and initializes it for your signing key.
- `groundhog airdrop` funds an existing wallet or address.

Run interactive setup if you have not already:

```bash
groundhog init
groundhog config get devnet --sources
```

Init creates the global `devnet` profile with its RPC and faucet URLs.

The faucet's `GET /v1/network` descriptor uses schema 3. It identifies the network, its RPC endpoint, and the `networkHash` used to bind transaction signatures. The CLI checks this descriptor and the live RPC identity as part of hosted wallet and airdrop operations.

```bash
DEVNET_FAUCET_URL=$(groundhog --json config get devnet | jq -er '.data.faucetUrl')
curl -fsS "$DEVNET_FAUCET_URL/health" | jq .
curl -fsS "$DEVNET_FAUCET_URL/v1/network" | jq .
```

On a fresh setup, accept key generation during init to create and select the key named `default`. The commands below assume that fresh-install path. If you selected another key, substitute its name for `default`.

Create and inspect the wallet:

```bash
groundhog wallet create --profile devnet
groundhog wallet ls --profile devnet
groundhog balance --profile devnet
```

With no `--key` or `--name`, wallet creation uses the selected key and gives the wallet the same name. It also establishes the profile's default wallet when none exists. The network descriptor sets the prefund amount. That prefund pays for wallet creation only, not the first application deployment.

Request an airdrop for more funds. Once the default wallet exists, omit the recipient:

```bash
groundhog airdrop --profile devnet
groundhog balance --profile devnet
```

Remote CLI airdrops call `groundhog_requestAirdrop` through the profile's public RPC endpoint. The faucet selects the amount, so omit `--amount`. Hosted requests are subject to the policy advertised by that deployment. Do not treat current amounts, cooldowns, or quotas as stable Devnet constants.

The CLI stores an idempotency nonce for each remote airdrop attempt. If a request is pending or the outcome is unclear, keep the cache record and rerun the exact same command. This resumes the same logical request instead of creating another transfer. A timeout, cancellation, or network error does not prove that the transfer failed.

A succeeded response means the airdrop transaction committed. Clients must still check `status.result` for execution success.

## TypeScript

Cluster-aware Devnet and Localnet clients expose the high-level `requestAirdrop` action. A full local node serves the same RPC method and funds the request from its `dev-0` faucet. The action creates an idempotency nonce, polls pending attempts, and stops on timeout or cancellation:

```ts
const airdrop = await client.requestAirdrop({
  recipient: account.address,
});

if (airdrop.status.result !== "ok") {
  throw new Error(`Airdrop execution failed: ${airdrop.status.result}`);
}
```

A timeout or cancellation only stops the client from waiting. The request may still commit. Use `requestAirdropAttempt()` when your application must persist and reuse its own `clientNonce`.

The hosted service also exposes direct `/v1/airdrop` and `/v1/create-wallet` APIs for clients that need faucet-specific integration. Prefer `groundhog_requestAirdrop` for public airdrops because it provides the network's RPC contract.

For the complete setup, wallet, deployment, and contract interaction workflow, follow [Develop on Devnet with the CLI](/tutorials/develop-on-devnet/).
