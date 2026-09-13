---
title: XDR Protocol
description: Encoding boundaries and protocol definitions selected by Groundhog 0.1.27.
---

## Encodings

| Surface | Encoding | Reference |
| --- | --- | --- |
| `Transaction`, `SignedTransaction`, contract spec sidecars | Classic XDR | Protocol definitions below |
| Contract arguments, return values, exceptions, typed storage, event payloads | CXS, the compact encoding used by the SDK | [Contract Spec](/reference/contract-spec/), [TypeScript Bindings](/tools/typescript-bindings/) |
| Transaction signing preimage | CXS domain separator, raw network hash, then classic XDR transaction | [Authorization](/how-it-works/authorization/) |
| Public JSON-RPC requests and responses | JSON, with hex byte fields and decimal strings for large integers | [JSON-RPC API](/reference/json-rpc-api/) |

The Rust traits retain the names `ReadXDR` and `WriteXDR` for both encodings. Use generated SDK clients and TypeScript bindings for contract payloads; a classic XDR encoder produces different bytes.

## Source Definitions

These links use the protocol commit selected by bundle `0.1.27`.

| Definition | Types |
| --- | --- |
| [transaction.x](https://github.com/groundhogchain/protocol/blob/63c9284d8d5727e8355b0b3d01e5e40f15478a89/transaction.x) | `Invocation`, `Transaction`, `SignedTransaction`, invocation outputs |
| [types.x](https://github.com/groundhogchain/protocol/blob/63c9284d8d5727e8355b0b3d01e5e40f15478a89/types.x) | Addresses, hashes, signatures, protocol scalar types |
| [storage_item.x](https://github.com/groundhogchain/protocol/blob/63c9284d8d5727e8355b0b3d01e5e40f15478a89/storage_item.x) | Storage items and deltas |
| [header.x](https://github.com/groundhogchain/protocol/blob/63c9284d8d5727e8355b0b3d01e5e40f15478a89/header.x) | Proposal header |
| [consensus.x](https://github.com/groundhogchain/protocol/blob/63c9284d8d5727e8355b0b3d01e5e40f15478a89/consensus.x) | Consensus values |
| [groundhog_contract_spec.x](https://github.com/groundhogchain/protocol/blob/63c9284d8d5727e8355b0b3d01e5e40f15478a89/groundhog_contract_spec.x) | Contract types, methods, events, and interface metadata |
