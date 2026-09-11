---
title: Wallet Provider
description: The Groundhog Wallet Provider 1.0.0 contract for wallet, extension, and bridge implementers.
---

Groundhog Wallet Provider `1.0.0` defines origin-scoped account access, transaction approval, and explicit submission. This page is the normative contract for wallet and bridge implementers. **MUST**, **MUST NOT**, and **SHOULD** describe conformance requirements. Dapp authors should start with [Wallet Integration](/tools/wallet-integration/).

## Interface and Methods

Wire types, validators, and discovery belong to `@groundhogchain/client/provider`. The SDK adapter and wallet builders belong to `@groundhogchain/client/wallet`. No framework, extension runtime, or global singleton is required.

```ts
interface WalletAccount {
  address: string;
  publicKey: string;
  nonce: string;
}
interface WalletSession {
  networkHash: string;
  accounts: readonly WalletAccount[];
}
interface WalletProvider {
  info: { id: string; name: string; version: "1.0.0" };
  request(request: ProviderRequest): Promise<unknown>;
  on(event: "change", listener: (session: WalletSession) => void): () => void;
}
type ProviderRequest =
  | { method: "connect" }
  | { method: "getSession" }
  | { method: "disconnect" }
  | {
      method: "signTransaction";
      params: { account: string; networkHash: string; transaction: string };
    }
  | {
      method: "submitTransaction";
      params: {
        account: string;
        networkHash: string;
        signedTransaction: string;
      };
    };
```

Requests MUST contain exactly the fields shown, including within `params`. Account and network selection are explicit. There is no arbitrary-byte/message signing, network-addition method, or implicit network switch.

| Method | Result | Required behavior |
| --- | --- | --- |
| `connect` | `WalletSession` | Request origin-scoped permission through wallet UI; reject refusal. Success includes at least one authorized account. |
| `getSession` | `WalletSession` | Return a non-interactive snapshot. MUST NOT prompt or grant access. |
| `disconnect` | `null` | Idempotently revoke this origin's permission and pending approvals. |
| `signTransaction` | `{ signedTransaction: string; hash: string }` (`SignTransactionResult`) | Approve and sign the exact unsigned transaction. MUST NOT broadcast. |
| `submitTransaction` | `{ hash: string }` (`SubmitTransactionResult`) | Broadcast only exact previously approved signed bytes. Return their canonical transaction hash, not an execution receipt. |

## Canonical Data and Limits

Parsers MUST reject malformed values rather than normalize them. Data parsers return snapshots. `parseWalletProvider()` instead returns the original live object, preserving identity and method receivers; it validates metadata without snapshotting it.

| Value | Required format or bound |
| --- | --- |
| Address, public key, transaction/receipt hash | Exactly 32 bytes of lowercase, even-length, `0x`-prefixed hex |
| `networkHash` | Exactly 64 lowercase hex characters **without `0x`**, matching application environment configuration |
| Account `nonce` | Canonical decimal u64: `0` or a nonzero digit followed by digits, at most `18446744073709551615`. Account derivation data, not a transaction nonce |
| Session accounts | At most 32, with unique addresses |
| Provider `id` | 1–64 ASCII letters, digits, dots, underscores, or hyphens |
| Provider `name` | 1–80 characters, no control characters or surrounding whitespace. Render as text, never HTML |
| Provider `version` | Exactly `"1.0.0"` |
| Error `message` | Human-readable string of at most 1,024 characters |
| Unsigned `transaction` | Canonical classic XDR `Transaction`, at most **1,048,500 decoded bytes** (1 MiB minus 76) |
| `signedTransaction` | Canonical classic XDR `SignedTransaction`, at most **1,048,576 decoded bytes** (1 MiB) |

Only protocol pubkey accounts with valid, non-small-order, prime-order Ed25519 public keys are supported. Each address MUST equal the protocol derivation of its public key and account nonce.

Transaction hex MUST be lowercase, even-length, and `0x`-prefixed. XDR decoding MUST consume the entire input, and re-encoding MUST reproduce the supplied bytes. Providers MUST enforce the unsigned limit **before requesting approval**. The 76-byte reserve covers the single Ed25519 signature: 4-byte vector count, 4-byte public-key ID, 4-byte scheme, and 64-byte signature.

Bridges MUST bound raw messages before JSON parsing and bound pending UI requests. Transaction hex is at most 2,097,002 unsigned or 2,097,154 signed characters, including `0x`; account for the surrounding request envelope when setting transport limits.

## Permissions and Session Events

A disconnected or unauthorized origin MUST see `accounts: []`, retaining the wallet's current network hash. Providers MUST emit `change` with a full session snapshot whenever accounts, authorization, account metadata, or network changes, including disconnect. `on()` returns an idempotent unsubscribe function and does not emit an initial snapshot.

Any change caused by `connect` or `disconnect` MUST reach registered page-facing listeners **before the corresponding request promise resolves**. Bridges MUST preserve this ordering even with separate response and event delivery paths. Sending the event first in a background process is insufficient if the page resolves the request before delivering that event.

Pending operations MUST recheck authorization before signing or broadcasting. A session change clears prior approvals; approval cannot survive a disconnect, account change, or network change.

## Signing and Transaction Identity

A signing request MUST match the origin's currently authorized account and network. The transaction root address and complete pubkey authorization claim, including key and derivation nonce, MUST match the selected account.

The signing result MUST preserve the entire unsigned transaction byte-for-byte and include exactly one Ed25519 signature with public-key ID zero. Verify strictly, with ZIP-215 disabled, over the SDK's `transactionSignaturePreimage(networkHash, tx)`:

```text
cxs(DomainSeparator("Transaction")) || networkHash || txs(transaction)
```

The prefix uses CXS, the network hash is the raw 32 bytes, and the unsigned transaction uses classic XDR. Sign this preimage directly, without an extra pre-hash. Both the public key and signature point R MUST be non-small-order, prime-order points; a cofactored verification equation alone is insufficient.

The result's `hash` MUST be `0x` plus lowercase SHA-256 of the **unsigned transaction XDR**, matching the RPC transaction/receipt identifier. Neither signatures nor network are included in that hash. The hash is not the signing preimage.

## Approval and Submission

The provider MUST retain approved signed bytes bound to the **trusted caller origin, account, and network**. Submission MUST reject bytes outside that approval set, including an alternative signature with the same transaction hash. The submission result MUST return the approved transaction's hash.

Providers MUST NOT derive caller origin from page-supplied parameters. An extension MUST enforce permission and approval rules in its trusted background process using authenticated browser sender metadata. Discovery and page-side validation are not security boundaries.

Clear approvals on disconnect and session changes. Bound retained approvals; one approval replacing the previous one is recommended. Fail closed on eviction, restart, or lost state. Approval of one transaction does not authorize signing or sending another.

Applications MUST finish saving the signed result, canonical hash, account, and original network before asking to broadcast. A submit response is only a broadcast acknowledgement. Once submit starts, every failure must be treated as potentially submitted, including timeouts, disconnects, network changes, and invalid response hashes. Preserve the saved hash and query status/receipt on the original network. Never automatically prepare/sign a new transaction, change its nonce, or retry execution. Re-sending identical bytes requires an explicit recovery policy and still-valid provider approval.

## Errors

`WalletProviderError(code, message)` extends `Error`. Bridges MUST preserve its numeric `code` and human-readable `message`. `instanceof` is not reliable across realms; use `parseWalletProviderError()` to validate and reconstruct serialized errors.

| Code | Meaning |
| --- | --- |
| `4001` | User rejected the request |
| `4100` | Origin/account unauthorized, stale session, or no matching approval |
| `4200` | Unsupported method |
| `4900` | Provider disconnected or transport unavailable |
| `4901` | Requested network does not match |
| `-32602` | Invalid parameters, noncanonical encoding, or exceeded input limits |
| `-32603` | Internal error or invalid provider result |
| `-32002` | Another operation is pending |

Unknown methods MUST return `4200`; malformed known requests MUST return `-32602`.

## Multiple-Provider Discovery

`registerWalletProvider(provider, target = window)` validates a provider, listens for `groundhog:requestProvider`, and immediately dispatches `CustomEvent("groundhog:announceProvider", { detail: provider })`. It repeats that announcement on each request. The event detail is the provider itself, not an envelope.

`discoverWalletProviders(listener, target = window)` installs its announcement listener **before** dispatching `groundhog:requestProvider`. It validates announcements, ignores malformed ones, and reports each ID once, accepting at most 32 IDs per subscription. The first valid announcement for an ID wins. Multiple providers and either load order work without polling or assigning `window.groundhog`.

Both cleanup functions are idempotent. Registration cleanup removes the request listener but does not retract an already discovered provider. Discovery cleanup removes its listener and releases retained IDs. IDs remain reserved until cleanup; discovery does not track removals and has no unregister event. Neither cleanup disconnects sessions or revokes permissions.

Importing `/provider` or `/wallet` is safe without browser globals. Pass an `EventTarget` when calling discovery helpers outside a browser. Discovery validates shape, **not identity or trust**: page scripts can spoof IDs and names.

## Validation Helpers

These exports belong to `/provider`. Structural validation does not establish origin permission or retained approval.

| Helper | Validates or returns |
| --- | --- |
| `parseWalletAccount`, `parseWalletSession`, `parseWalletProviderInfo` | Strict data boundaries and frozen snapshots; the session parser allows empty accounts, so callers must separately check successful `connect` is nonempty |
| `parseWalletProvider` | Versioned metadata and callable methods; returns the live provider, without verifying its behavior or trustworthiness |
| `parseWalletHex32`, `parseWalletNetworkHash` | The two distinct hex formats |
| `parseProviderRequest` | Exact request union and bounded canonical XDR; returns a new request object |
| `parseTransactionHex`, `parseSignedTransactionHex` | Protocol objects decoded from bounded canonical XDR; no signature verification |
| `parseSignTransactionResult`, `parseSubmitTransactionResult` | Result structure and encoding; no check of signature, hash correctness, prior approval, broadcast, or execution |
| `assertWalletTransaction(tx, account)` | Matching root address and complete pubkey authorization claim |
| `verifySignTransactionResult(value, transaction, account, networkHash)` | `Promise<SignTransactionResult>` with a frozen result after exact unsigned-byte, account-claim, strict signature, and canonical hash checks. Requires Web Crypto (HTTPS or localhost in browsers); does not establish origin authorization |
| `parseWalletProviderError` | Recognized error code and bounded message; reconstructs the error |

Malformed parser inputs fail with `-32602`, except unknown request methods (`4200`). `assertWalletTransaction` reports claim mismatch as `4100`. Invalid signing results fail verification with `-32603`; malformed expected verification inputs fail their boundary validation first.

| Exported constant | Value |
| --- | --- |
| `MAX_TRANSACTION_BYTES` | `1_048_576` |
| `MAX_UNSIGNED_TRANSACTION_BYTES` | `MAX_TRANSACTION_BYTES - 76` (`1_048_500`) |
| `MAX_WALLET_ACCOUNTS` | `32` |
| `MAX_DISCOVERED_PROVIDERS` | `32` |
| `REQUEST_PROVIDER_EVENT` | `"groundhog:requestProvider"` |
| `ANNOUNCE_PROVIDER_EVENT` | `"groundhog:announceProvider"` |

## SDK Adapter Behavior

`createProviderWalletClient({ client, provider, account, networkHash })` in `/wallet` synchronously creates a separate binding without connecting or decorating `client`. `account` is the wire type from `/provider`, not the local-signer `WalletAccount` from `/wallet`.

| Method | Result and behavior |
| --- | --- |
| `prepareExecution(PrepareExecutionRequest)` | `Promise<Transaction>` using the default-wallet wrapper, random transaction nonce when omitted, expiry handling, and unsigned size bound |
| `signTransaction(Transaction)` | `Promise<SignTransactionResult>` after exact-byte, account-claim, strict signature, and hash verification; never broadcasts |
| `submitTransaction(SignTransactionResult)` | `Promise<SubmitTransactionResult>`; only the latest successfully verified approval is accepted, and the response hash is checked |
| `dispose()` | `void`; idempotently unsubscribe and permanently invalidate the adapter, clearing its approval without revoking provider permission |

The adapter snapshots account/network configuration and inputs before asynchronous work, validates account derivation and any validated client network identity, and checks `getSession` before preparation, signing, and submission. It checks changes while operations are pending. Every `change`, failed session read, or mismatched session invalidates it. Recreate it after reconnect or a change. A delayed connection event violates the event-ordering contract and invalidates a newly created adapter even when its snapshot matches.

The adapter permits one in-flight operation and retains one signed approval, with no automatic retries. Starting a new valid signing request clears the previous approval after unsigned transaction and account-claim validation, before awaiting the session check. A failed or rejected signing request does not restore that approval. It consumes approval when submission starts, including on error, and fails closed on invalid provider results. There is no raw signer, `execute()`, or implicit submit. It does not impose a UI timeout or cancel provider requests on disposal; providers and bridges own deadlines. A late result cannot reactivate it or cause submission. Persistence failure before submit means the adapter has not requested broadcast. See the [dapp lifecycle example](/tools/wallet-integration/#prepare-sign-save-submit-observe).

## Design References

The request/error shape and event-based discovery are inspired by [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193), [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963), and [Wallet Standard](https://github.com/wallet-standard/wallet-standard). This is a Groundhog-specific contract, not a compatible implementation of those interfaces.

Version `1.0.0` does not define full simulation, arbitrary networks, message signing, WalletConnect, hardware wallets, or source-address/legacy accounts.
