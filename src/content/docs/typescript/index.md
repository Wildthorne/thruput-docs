---
title: TypeScript
description: Connect applications and services to Project Thruput with the TypeScript client and typed contract bindings.
sidebar:
  label: Overview
---

Build browser applications, Node.js services, and scripts with `@thruputchain/client`. You can read an existing contract without a wallet, signing key, Rust installation, or deployment.

## The application model

A **public client** connects to an RPC endpoint and reads network data. A **contract binding** describes methods, arguments, results, errors, and events. Together they provide typed contract reads.

Writes also need an **account** and authorization. A browser app connects to the user's wallet provider. A script or service can manage a signer directly. A wallet client wraps application calls into a transaction, signs it, submits it, and observes its result.

```text
Read:   contract binding + public client → typed result
Write:  contract binding + wallet client → signed transaction → receipt
```

## How the packages fit

| Package or entry point | Role |
| --- | --- |
| `@thruputchain/client` | RPC clients, accounts, wallet helpers, amounts, and contract runtime |
| `@thruputchain/client/contracts` | Standard contract bindings supplied with the client, including ERC-20 and DefaultWallet |
| `@thruputchain/protocol` | Wire types, serialization, and protocol constants such as `HOG_ADDRESS` |
| `@thruputchain/contract-spec` | Contract schema tooling; most applications use the generated binding instead |
| `@thruputchain/react` | React integration over the client and wallet model; see [React](/react/) |

Generated bindings are application files, not a replacement for the client package. They import its contract runtime.

## Start with an existing contract

The [TypeScript quickstart](/get-started/typescript/) reads Futurenet's native-token contract using its supplied binding and address. [Read contract data](/typescript/reads/) uses the same checkpoint, so you can learn the application APIs without first writing a contract.

For a custom contract, obtain its generated bindings, deployment address, and network from its author. [Use contract bindings](/tools/typescript-bindings/) explains how those pieces fit.

[Read events](/typescript/events/) completes the read-only path with filters, decoding, and historical pagination. It also needs no wallet or signer.

## Add writes

Read [Accounts and wallet clients](/typescript/wallet-clients/) to understand account identity, authorization, and call wrapping. Then choose one integration path for your application:

- [Connect a wallet](/tools/wallet-integration/) when the user's browser wallet manages approval and signing.
- [Use a signer in scripts](/typescript/accounts/) when your Node.js process manages the account key.

These are alternatives, not consecutive setup steps. Both lead to [Send transactions](/typescript/transactions/) and [Track transaction results](/typescript/transaction-status/). [Deploy a contract](/typescript/deployment/) builds on that transaction flow when your application needs to create a deployment.

Complete applications live in [Guides](/guides/). This section covers individual tasks; [Client API reference](/tools/typescript-sdk/) and [Wallet provider reference](/tools/wallet-provider/) provide lookup tables.
