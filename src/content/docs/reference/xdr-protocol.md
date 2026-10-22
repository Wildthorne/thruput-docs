---
title: XDR Protocol
description: Encoding boundaries and source definitions for the Stellar Thruput protocol.
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
| Rust protocol package | `groundhog-xdr` `0.43.0` |
| Embedded protocol revision | `hogp/dc6e80b6472d0ed` |

| Definition | Types |
| --- | --- |
| [transaction.x](https://github.com/groundhogchain/protocol/blob/dc6e80b6472d0eda0440eab190c24b20233c839c/transaction.x) | `Invocation`, `Transaction`, `SignedTransaction`, invocation outputs |
| [types.x](https://github.com/groundhogchain/protocol/blob/dc6e80b6472d0eda0440eab190c24b20233c839c/types.x) | Addresses, hashes, signatures, protocol scalar types |
| [storage_item.x](https://github.com/groundhogchain/protocol/blob/dc6e80b6472d0eda0440eab190c24b20233c839c/storage_item.x) | Storage items and deltas |
| [header.x](https://github.com/groundhogchain/protocol/blob/dc6e80b6472d0eda0440eab190c24b20233c839c/header.x) | Proposal header |
| [consensus.x](https://github.com/groundhogchain/protocol/blob/dc6e80b6472d0eda0440eab190c24b20233c839c/consensus.x) | Consensus values |
| [groundhog_contract_spec.x](https://github.com/groundhogchain/protocol/blob/dc6e80b6472d0eda0440eab190c24b20233c839c/groundhog_contract_spec.x) | Contract types, methods, events, and interface metadata |
