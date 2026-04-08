---
title: TypeScript SDK
description: TypeScript packages for interacting with Groundhog.
---

:::caution[Early Access]
These packages are functional but the developer-facing SDK (transaction building, wallet integration, high-level contract interaction) is not yet available. What exists today is the protocol and transport layer.
:::

## Available Packages

| Package | What it provides |
|---------|-----------------|
| `@groundhog/xdr` | XDR serialization framework. Encode and decode all Groundhog protocol types. |
| `@groundhog/protocol` | Generated TypeScript definitions for all protocol types (transactions, blocks, storage, auth). Auto-generated from the same XDR source as hogd. |
| `@groundhog/rpc` | ONC-RPC client. Connect directly to hogd's internal RPC interface over HTTP or WebSocket. |

These packages are auto-generated from the protocol definitions and stay in sync with the Rust and C++ implementations.

## What's Coming

A higher-level SDK for transaction building, contract interaction, key management, and wallet integration. See the [JSON-RPC API](/reference/json-rpc-api/) for the external API these tools will build on.
