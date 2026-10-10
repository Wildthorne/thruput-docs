---
title: Inspect transactions and events
description: Inspect receipts, address history, contract events, and token transfers from the CLI.
---

Use the same profile and network that received the transaction. The commands below are read-only.

## Look up one transaction

```bash
thruput tx show TX_HASH --profile devnet
```

Replace `TX_HASH` with the submitted hash. This performs one status lookup and fetches the receipt when committed; it does not wait for a pending transaction.

Check the receipt's execution result. A committed failure is different from a transaction that is still pending or excluded from a proposal. See [Transaction Lifecycle](/how-it-works/transaction-lifecycle/#outcomes-to-distinguish).

## List history

```bash
thruput tx list my-counter --profile devnet --limit 25
```

History is indexed by root invocation target. A wallet-wrapped call can appear under the wallet rather than the inner target contract. Use the receipt and contract events to inspect inner activity; absence from an address-history page does not prove an operation did not occur.

## Read contract events

```bash
thruput events list my-counter --profile devnet --limit 25
```

For decoded events, supply the trusted spec from the same contract build:

```bash
thruput events list my-counter --profile devnet \
  --spec target/thruput/my_counter.spec.xdr --event PingEvent
```

Use `--topic0`, `--topic1`, or `--topic2` for raw topic filters. Repeated values at one position mean OR; filters across positions mean AND. Use the signature from the generated spec rather than copying one from another contract.

## Inspect token transfers

```bash
thruput token transfers HOG --profile devnet
```

Use `--account ADDRESS` to restrict the query to an account. Amounts are returned as base-unit values; formatting is separate from the stored amount.

## Continue a page

These list commands return one newest-first page at a time. Pass the returned cursor to the same command with the same target and filters:

```bash
thruput tx list my-counter --profile devnet --limit 25 --cursor CURSOR
```

Replace `CURSOR` with the exact returned value. An empty page with a non-empty cursor is not the end. The returned cursor `0x` ends that historical walk.

To check for new activity, omit `--cursor` and start at the head again. A saved cursor continues the old walk; it is not a subscription. For forward ingestion and durable checkpoints, use the [event indexing guidance](/typescript/events/#resume-without-missing-events).

The [Explorer](/tools/block-explorer/) provides a browser-based inspection path.
