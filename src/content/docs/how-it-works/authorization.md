---
title: Authorization
description: How authorization works in Groundhog — signature verification, caller identity, address policy, and capability tokens.
---

:::note[Active design]
The capability-token model below is the v2 authorization design, under active development and feasibility testing. The current SDK exposes a provisional v1 positional API; v2 is expected to land before the SDK is publicly stable. This page will evolve as the model settles.
:::

Groundhog treats every address uniformly — there is no distinction between externally-owned accounts and contracts. Authorization decomposes into four orthogonal concerns, with a clean split between contract and protocol:

| # | Concern | Who does it |
|---|---|---|
| 1 | Signature & claim verification | Protocol, at transaction admission |
| 2 | Caller identity (`msg.sender`) | Runtime query from contract |
| 3 | Authorized operations (capability tokens) | Contract, via typed method arguments |
| 4 | Address auth policy | Contract declares, protocol enforces |

#1 and #4 are paired: an address uses #4 to configure what the protocol enforces in #1. #2 and #3 are runtime queries that never touch the protocol's admission-time checks.

## Design goals

The v2 model targets four properties that differentiate it from existing authorization frameworks:

1. **Statically computable signatures.** A wallet can determine what the user is signing from the target method's signature alone — no transaction simulation required. This is, hopefully, significantly more ergonomic than Ethereum's EIP-4337 or Soroban's "simulate to build an auth tree" pattern.

2. **Authorization expressed in method signatures.** A reader of a function's Rust signature can see exactly what capabilities it requires. No deep reading of the function body is needed to locate `require_auth` calls or their equivalent.

3. **Clear to both contract developers and end users.** What is and is not authorized is explicit at the type level for contracts, and derivable from typed payloads for wallet display.

4. **Native support for asynchronous continuations.** Capability tokens survive across RCQ suspensions — the same capability can authorize an operation whose execution spans a deferred continuation. This replaces the need for token-specific permit patterns.

## Signature verification (concern #1)

At transaction admission, the protocol verifies every signature — the envelope signature that authorizes the transaction itself, and any detached signatures attached as auth claims. Signatures are checked against keys stored in the sending address's `AddressAuthData`.

Contracts do not run signature-verification code. By the time a contract is executing, the protocol has already validated every cryptographic proof associated with the transaction.

## Address auth policy (concern #4)

An address's `AddressAuthData` records what the protocol should enforce for transactions from it:

- Public keys registered for signature verification
- Nonce policy (monotonic, windowed, etc.)
- Gas permission policy (who may sponsor gas from this address)

Contracts declare policy via syscalls — `change_public_key_registration`, `set_nonce_config`, `set_gas_permission_config`. The protocol reads; the contract writes.

A fresh address has no `AddressAuthData`; transactions from it fail with `kAuthFailed` until policy is installed.

## Caller identity (concern #2)

A contract can query the address of its direct caller:

```rust
use sdk::contract_op::get_caller;

let caller = get_caller();
```

This always returns the immediate caller of the current frame. For anything beyond "the address immediately above me initiated this call," authorization must be expressed explicitly as a capability.

## Capability tokens (concern #3)

A capability token represents an authorization to perform a specific operation. Tokens live as opaque handles in the trusted runtime — contract code never sees the underlying bytes directly. In the SDK, they appear as `Signer<T>`:

```rust
pub fn transfer_from(
    amount: i128,
    to: Address,
    from: Address,
    signer: Signer<Erc20Transfer>,
);
```

The method signature declares, at the type level, what authorization the function requires. A contract that does not accept a `Signer<T>` argument cannot consume one.

### Properties of a capability token

Every token carries four pieces of metadata:

- **Minter** — the address whose authority the token represents
- **Consumer** — the single contract address permitted to unwrap it
- **Expiry** — after which consumption fails
- **Payload** — the signed data describing what is authorized (e.g. an `Erc20Transfer` struct)

Tokens are **single-use**: consumption invalidates them.

### Consumption and argument validation

The consuming contract unwraps the token to read its payload, then compares the payload against the call's actual arguments:

```rust
pub fn transfer_from(
    amount: i128,
    to: Address,
    from: Address,
    signer: Signer<Erc20Transfer>,
) {
    let authorized: Erc20Transfer = signer.consume();
    assert!(amount <= authorized.amount, "exceeds authorized amount");
    assert!(to == authorized.to, "unauthorized recipient");
    assert!(from == authorized.from, "unauthorized sender");

    // perform the transfer
}
```

The payload defines what was signed; the contract defines the comparison relation. This is deliberately more flexible than exact-argument matching — contracts can encode `≤`, subset relations, or any domain-specific equivalence appropriate to the call.

### Passing and forwarding

Capability tokens never flow implicitly. A cross-contract call does not inherit tokens from the caller's frame. To delegate a capability to a sub-call, pass it explicitly as an argument.

This is what makes "the method signature is the auth story" enforceable: a function that does not declare a `Signer<T>` parameter has no way to consume one.

### Nested capabilities and routing gates

A token's payload can itself be a token. The Rust encoding is `Signer<OuterConsumer<T>>`:

```rust
pub fn swap(
    ...,
    signer: Signer<DexContract<Erc20Transfer>>,
);
```

The outer token's consumer is `DexContract`. Unwrapping it yields a fresh `Signer<Erc20Transfer>` that Dex can consume itself or forward to another contract (for example, the ERC-20 token).

The effect is a routing constraint: the `Erc20Transfer` authorization can only reach a token contract via `DexContract`. Other contracts cannot unwrap the outer token.

### Returning capabilities

Contracts can also mint tokens and return them. This generalizes ERC-1271: any contract can serve as a signature-verification authority by accepting inputs, running its own policy, and returning a `Signer<T>` on success. The caller takes that capability onward.

A wallet contract can verify a multisig quorum or a passkey attestation, for example, and return a `Signer<Transfer>` that the rest of the transaction consumes.

## What this enables

**Sponsored transactions.** The authorizer and the fee-payer are independent. A user mints a capability authorizing a specific call; a sponsor wraps it in a transaction paid from their own account.

**Portable authorizations.** A capability is bound to its minter, consumer, and expiry — not to a particular enclosing transaction. A signed capability can be generated off-line and submitted later by any party, subject to reaching the named consumer before expiry.

**Atomic multi-party operations.** Multiple parties each mint independent capabilities. A coordinator submits a transaction feeding all of them into a single call. Either every capability validates and the call succeeds, or it reverts atomically.

**Replacing token permits.** A `transferFrom` taking a `Signer<Erc20Transfer>` argument is strictly more general than EIP-2612-style permits, requires no token-standard specialization, and survives asynchronous continuations — a property RCQ flows depend on.

## Provisional v1 API

The current SDK exposes capability consumption as a positional array: `get_auth_claim(index)` and `get_auth_claim_count()`. This is provisional and will be superseded by the typed `Signer<T>` model before the SDK is publicly stable. Positional access is expected to remain as a debug-only affordance.

## Not yet specified on this page

Several mechanics are being pinned down and will land here as they settle:

- **Minting from user signatures.** How an off-chain signature becomes an on-chain capability. Expected path: an account contract verifies the signature against its own policy and mints, ERC-1271-style.
- **Expiry domain.** Whether expiry is measured in block height, timestamp, or transaction sequence.
- **RCQ lifetime.** How capability lifetime interacts with RCQ suspension, and what happens to outstanding capabilities if a resumer reverts.
- **Failed sub-call semantics.** The expected behavior is that forwarded capabilities are returned unconsumed on revert, consistent with "reverted call is a state no-op" elsewhere in the protocol.

## See also

- [Invocation Frames](/how-it-works/invocation-frames/)
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/)
- [Syscalls](/reference/syscalls/)
