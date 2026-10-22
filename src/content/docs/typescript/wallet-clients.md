---
title: Accounts and wallet clients
description: Choose an account authorization model and bind it to a signer-backed or provider-backed wallet client.
---

A public client connects to the network. An account describes the identity and authorization used for a transaction. A wallet client combines that account with the operations needed to prepare, sign, and submit transactions.

Account authorization and wallet call behavior are separate. Authorization determines which signatures can originate a transaction. An invocation adapter determines how a wallet contract wraps calls to other contracts.

## Choose an account model

| | Pubkey account | Source-address account |
| --- | --- | --- |
| Constructor | `createPubkeyAccount` | `createSourceAddressAccount` |
| Address | Derived from a hash of an Ed25519 or ML-DSA-65 public key and an account nonce | Existing address supplied by the application |
| Authorization | One Ed25519 or ML-DSA-65 signer whose key matches the account preimage | Signer entries and a claim checked against stored authorization data |
| Wallet behavior | DefaultWallet adapter selected automatically | Application-call wrapping requires an appropriate adapter |
| Typical use | A script account without a separate wallet deployment | An existing account contract with configured signer policy |

Both constructors create local JavaScript objects. They do not fund an address, deploy code, or change authorization data on chain.

## Create a pubkey account

Given an existing `Signer` named `signer`:

```ts
import { createPubkeyAccount } from "@thruputchain/client";

const account = createPubkeyAccount({ signer, nonce: 0n });
```

The same public key and account nonce produce the same address. The key hash includes the scheme, so one seed gives different addresses under Ed25519 and ML-DSA-65. The nonce defaults to zero and is separate from each transaction's replay-protection nonce.

An undeployed pubkey account uses the network's DefaultWallet behavior for its root invocation. No separate wallet deployment is needed. See [Use a signer in scripts](/typescript/accounts/) for key loading and funding.

## Describe a source-address account

For an existing account whose stored policy authorizes your signer at key slot zero with sufficient weight:

```ts
import { createSourceAddressAccount } from "@thruputchain/client";
import { bitMap, weight } from "@thruputchain/protocol";

const account = createSourceAddressAccount({
  address: walletAddress,
  signers: [{ signer, publicKeyId: 0n }],
  allowedKeys: bitMap(0x01n),
  requiredWeight: weight(1n),
});
```

Here, `walletAddress` is the existing account address, not an application contract you want to call. `publicKeyId` identifies a stored signer slot; `allowedKeys` selects slots for the authorization claim. The signatures must satisfy both the stored policy and the claim's required weight.

The constructor does not register signers or set their weights. Those must already be configured on chain. See [Authorization](/how-it-works/authorization/#source-address-accounts) for the protocol rules.

## Bind an account to a client

With a pubkey `account` and the cluster-aware public client from [Connect to a network](/typescript/connect/):

```ts
import { createWalletClient } from "@thruputchain/client";
import { client } from "./client.js";

const wallet = createWalletClient({ client, account });
```

The wallet is a separate object. It retains public-client operations and adds signing and account operations. Pubkey accounts also receive DefaultWallet execution helpers such as `executeAndWait` and `executeCallsAndWait`. Multiple accounts can share the original public client.

For a source-address account, `createWalletClient` provides transaction preparation and signing, but does not infer how its account contract wraps application calls. Supply an `invocationAdapter` that matches that contract to obtain the execution helpers. Do not select an adapter from the authorization model alone. Custom implementations use `defineWalletInvocationAdapter`; see [Client API reference](/tools/typescript-sdk/#choose-an-account-model).

A cluster-aware client supplies its validated signing network hash. A transport-only client requires an explicit `networkHash` when creating the wallet client, and it must match the endpoint's network.

## Bind a browser wallet provider

In a browser app, the wallet provider manages signing. Use an authorized account returned by its session:

```ts
import { createProviderWalletClient } from "@thruputchain/client/wallet";

const wallet = createProviderWalletClient({
  client,
  provider,
  account: selectedAccount,
  networkHash: expectedNetworkHash,
});
```

`selectedAccount` is the provider's wire `WalletAccount`, containing its address, public key, and derivation nonce. It is not the signer-backed account object returned by the constructors above. The provider integration supports pubkey accounts and DefaultWallet behavior; it does not expose a raw signer.

`expectedNetworkHash` is the application's trusted network identity in provider format: unprefixed base58. It must match the client's network. The factory does not request connection permission. Follow [Connect a wallet](/tools/wallet-integration/) for discovery, account selection, and session cleanup.
