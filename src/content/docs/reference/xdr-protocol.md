---
title: XDR Protocol
description: Encoding boundaries and source definitions for the Project Thruput protocol.
---

## Encodings

| Surface | Encoding | Reference |
| --- | --- | --- |
| `Transaction`, `SignedTransaction`, contract spec sidecars | Classic XDR | Protocol definitions below |
| Contract arguments, return values, exceptions, typed storage, event payloads | CXS, the compact encoding used by the SDK | [Contract Spec](/reference/contract-spec/), [TypeScript Bindings](/tools/typescript-bindings/) |
| Transaction signing preimage | CXS domain separator, raw network hash, then classic XDR transaction | [Authorization](/how-it-works/authorization/) |
| Public JSON-RPC requests and responses | JSON, with base58 identifiers, `0x` hex byte fields, and decimal strings for large integers | [JSON-RPC API](/reference/json-rpc-api/) |

The Rust traits retain the names `ReadXDR` and `WriteXDR` for both encodings. Use generated SDK clients and TypeScript bindings for contract payloads; a classic XDR encoder produces different bytes.

## Source Definitions

| Source baseline | Value |
| --- | --- |
| Rust protocol package | `thruput-xdr` `0.61.0` |
| Embedded protocol revision | `hogp/6705996afff00a0` |

| Definition | Types |
| --- | --- |
| [transaction.x](https://github.com/thruputchain/thruput-protocol/blob/6705996afff00a07c2eb699233a7a928fd77f715/transaction.x) | `Invocation`, `Transaction`, `SignedTransaction`, invocation outputs |
| [types.x](https://github.com/thruputchain/thruput-protocol/blob/6705996afff00a07c2eb699233a7a928fd77f715/types.x) | Addresses, hashes, signatures, protocol scalar types |
| [storage_item.x](https://github.com/thruputchain/thruput-protocol/blob/6705996afff00a07c2eb699233a7a928fd77f715/storage_item.x) | Storage items and deltas |
| [header.x](https://github.com/thruputchain/thruput-protocol/blob/6705996afff00a07c2eb699233a7a928fd77f715/header.x) | Proposal header |
| [consensus.x](https://github.com/thruputchain/thruput-protocol/blob/6705996afff00a07c2eb699233a7a928fd77f715/consensus.x) | Consensus values |
| [contract_spec.x](https://github.com/thruputchain/thruput-protocol/blob/6705996afff00a07c2eb699233a7a928fd77f715/contract_spec.x) | Contract types, methods, events, and interface metadata |
