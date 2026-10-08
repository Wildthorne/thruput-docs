---
title: Explorer
description: Use the Devnet explorer to look up transactions, inspect receipts and events, and check address activity.
---

Use the [Devnet explorer](https://explorer.thruput.network/) to look up transactions, inspect receipts and events, and check address balances and recent activity. Sign in if prompted.

## Look Up a Transaction or Address

1. Open the [Devnet explorer](https://explorer.thruput.network/).
2. Paste a transaction hash or address into the search field. Use the full `0x`-prefixed, 32-byte value (64 hexadecimal characters after `0x`).
3. Select **Search**.

The home page also lists recent native-token transfers. Select a transaction to inspect it, or follow an address link to view that address.

### Transactions

The transaction page shows:

- Transaction status and, once committed, block height and execution result.
- Receipt events, including decoded token transfers, mints, and burns where supported.
- Raw receipt data for debugging.

Events without a supported decoder appear as raw topics and data.

### Addresses and Tokens

The address page shows the native-token balance. For non-token addresses, it also shows recent transactions and sent or received native-token transfers. Recognized token contracts show token metadata and token transfer history. Other contracts can show their emitted events.

Address transaction history combines transactions whose root invocation targets the address with native-token transfer activity. It does not cover every nested invocation or every token transfer involving the address.

### Share a Result

Copy the page URL to share a transaction or address:

```text
https://explorer.thruput.network/tx/<transaction-hash>
https://explorer.thruput.network/address/<address>
```

## Inspect State Without an Explorer

Use the CLI for terminal workflows, local nodes, or when the explorer is unavailable:

```bash
groundhog balance <wallet-or-address> --profile devnet
groundhog tx show <transaction-hash> --profile devnet
groundhog view <contract-or-alias> <method> --profile devnet
groundhog storage <contract-or-alias> 0x<32-byte-key> --profile devnet
```

These commands use Devnet. For a local node, use `--profile local` instead. The hosted explorer does not show your local node's transactions.

Use the [JSON-RPC API](/reference/json-rpc-api/) directly for receipts, status, address-rooted history, and event pagination.

## If a result is missing

Check the full hash or address and the network that produced it. Indexer-backed history can lag, so use `groundhog tx show` for the original transaction before submitting another one. A pending or missing result does not prove failure.
