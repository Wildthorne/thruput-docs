---
title: Block Explorer Status
description: Current explorer availability and the public RPC data available to explorer clients.
---

No public Groundhog block-explorer UI is documented or deployed yet. The `hogd` repository contains an internal command-line transaction diagnostic named `block_explorer`, but it is not a user-facing web application.

## Data Available Today

The public JSON-RPC gateway exposes the core data an explorer can use:

| Data | Public API |
|------|------------|
| Chain height and hash | `groundhog_chainTip` |
| Transaction status | `groundhog_getTransactionStatus` |
| Committed receipt and events | `groundhog_getTransactionReceipt` |
| Transactions whose root invocation targets an address | `groundhog_getTransactionsByAddress` |
| Filtered, paginated events | `groundhog_getEvents` |
| Native HOG balance | `groundhog_getBalance` |
| Raw committed storage | `groundhog_getStorageAt` |
| Read-only contract execution | `groundhog_view` |

Address history is rooted-address history. It does not include every transaction that touched an address through a nested invocation.

## Current Gaps

The current gateway returns JSON-RPC error `-32052` for:

- `groundhog_getBlockByNumber`
- `groundhog_pendingTransactionCount`

There is no public whole-chain `groundhog_getTransactions` method. Those gaps prevent a complete block-by-block explorer experience through the public gateway today.

## Inspect State Without an Explorer

Use the CLI for common development checks:

```bash
groundhog balance <wallet-or-address> --profile devnet
groundhog view <contract-or-alias> <method> --profile devnet
groundhog storage <contract-or-alias> 0x<32-byte-key> --profile devnet
```

Use the [JSON-RPC API](/reference/json-rpc-api/) directly for receipts, status, address-rooted history, and event pagination. This page will link to the public explorer once a supported UI and deployment URL exist.
