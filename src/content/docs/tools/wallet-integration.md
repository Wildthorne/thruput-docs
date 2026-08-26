---
title: Wallet Integration Status
description: Integrate Groundhog account signers and wallet transaction construction in TypeScript.
---

The TypeScript SDK supports signers, Groundhog account models, and wallet transaction construction. It does not provide an official browser connection or permission provider.

:::note[Version checked]
This page was source-checked against published `@groundhogchain/client` `0.4.0` and protocol packages `0.8.0` on August 26, 2026.
:::

| Layer                                | Current support                                                          |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Signers and account models           | `Signer`, pubkey accounts, and source-address accounts                   |
| Wallet transaction construction      | Wallet clients, DefaultWallet, DevWallet, and custom invocation adapters |
| Browser connection and permission UX | No official provider or adapter                                          |

## Signer Boundary

`Signer` is the extension point for a browser wallet, hardware signer, remote signer, or custom key manager:

```ts
import type { PublicKey, Signature } from "@groundhogchain/protocol";

interface Signer {
  publicKey: PublicKey;
  sign(message: Uint8Array): Promise<Signature>;
}
```

The `message` passed to `sign()` is the transaction signature preimage:

```text
cxs(DomainSeparator("Transaction")) || networkHash || txs(transaction)
```

It binds the signature to the protocol domain and one network. It is not bare transaction bytes, the transaction hash, or a serialized signed transaction. A signer integration must show which network it is signing for and must not substitute its own serialization.

## Account Models

Groundhog supports two account models:

- A **pubkey account** derives its address from one public key and a nonce. It can sign transactions immediately and uses the network's DefaultWallet behavior without deploying a wallet contract.
- A **source-address account** uses a smart-wallet contract already deployed at its source address. That contract defines authorization and the root invocation shape. DevWallet is one smart wallet used by local development accounts.

The SDK represents both models as account objects that contain the address, authorization claim, and ordered signer entries:

```ts
const pubkeyAccount = createPubkeyAccount({ signer, nonce: 0n });

const sourceAccount = createSourceAddressAccount({
  address: walletAddress,
  signers: [{ signer, publicKeyId: 0n }],
  allowedKeys: bitMap(0x01n),
  requiredWeight: weight(1n),
});
```

## Wallet Clients

`createWalletClient()` binds four pieces of state and behavior to an existing client instance:

- The account address and authorization claim
- The account's signers
- The network identity used in each transaction signature preimage
- The invocation adapter that wraps application calls through the wallet

A cluster-aware client supplies the network identity learned during its endpoint handshake. When the cluster has a network hash pin, client creation compares the two before returning. Pubkey accounts receive `defaultWalletAdapter` automatically:

```ts
const client = await createGroundhogClient({ cluster: devnet() });
const account = createPubkeyAccount({ signer });
const wallet = createWalletClient({ client, account });

const txHash = await wallet.execute({
  invocation: applicationInvocation,
  gasLimit: walletGasLimit,
});
```

`devnet()` performs an endpoint identity handshake, but its default descriptor does not pin an expected hash. Pass `networkHash` to `devnet()` when the application must reject a different network at that endpoint.

An unqualified `{ transport }` client skips cluster identity validation. Its wallet binding must receive the trusted network hash explicitly:

```ts
const wallet = createWalletClient({
  client: unqualifiedClient,
  account,
  networkHash,
});
```

Wallet decoration adds account-specific closures to the supplied client. One client instance can bind only one account. Create separate client instances for multiple accounts, even when they share an endpoint.

## Source-Address Wallets

Source-address accounts require an explicit adapter to expose `prepareExecution()` and `execute()`:

```ts
const wallet = createWalletClient({
  client,
  account: sourceAccount,
  invocationAdapter: devWalletAdapter,
});
```

`devWalletAdapter` wraps an application invocation through DevWallet's `doAction` method. `defaultWalletAdapter` wraps it through DefaultWallet's `execute` method. A custom smart wallet can provide its generated binding and define a structural adapter:

```ts
const customWalletAdapter = defineWalletInvocationAdapter({
  createRootInvocation(accountAddress, request: CustomWalletRequest) {
    return CustomWallet.execute.invocation(accountAddress, request.gasLimit, {
      call: request.invocation,
      policy: request.policy,
    });
  },
});
```

`prepareExecution()` returns the wrapped transaction for inspection. `execute()` prepares, wraps, signs, and submits it. The explicit `prepareTransaction()`, `signTransaction()`, `sendInvocation()`, and `sendTransaction()` methods remain available for wallet-specific root operations such as deployment.

See the [TypeScript SDK workflow](/tools/typescript-sdk/#bind-a-wallet-client) for funding, execution, deployment, and receipt examples.

## Browser Wallet Boundary

The SDK constructs network-bound wallet transactions, but it does not yet define browser-facing behavior for:

- Discovering and connecting a wallet
- Selecting accounts
- Requesting permissions
- Presenting transaction approval prompts
- Creating, recovering, or persisting wallets
- Communicating between an application and a wallet extension

An application can implement those concerns and expose the selected key through `Signer`. The wallet client then handles Groundhog account authorization, invocation wrapping, transaction preparation, signing input, submission, and receipt polling.

## Related Documentation

- [TypeScript SDK](/tools/typescript-sdk/) for the complete client and wallet workflow
- [TypeScript Bindings](/tools/typescript-bindings/) for generated application and wallet descriptors
- [Authorization](/how-it-works/authorization/) for protocol admission rules
- [Develop on Devnet](/tutorials/develop-on-devnet/) for the supported CLI workflow
