---
title: Authorization
description: How authorization works in Groundhog. Signature verification, caller identity, address policy, and signed instructions.
---

:::note[Active design]
The model below is the v2 authorization design, under active development and feasibility testing. The current SDK exposes a provisional v1 positional API; v2 is expected to land before the SDK is publicly stable. This page is the working specification and will evolve as it settles.
:::

Groundhog treats every address uniformly. There is no distinction between externally-owned accounts and contracts. Authorization decomposes into four orthogonal concerns, with a clean split between contract and protocol:

| # | Concern | Who does it |
|---|---|---|
| 1 | Signature & claim verification | Protocol, at transaction admission |
| 2 | Caller identity (`msg.sender`) | Runtime query from contract |
| 3 | Signed instructions (attestations) | Contract, via typed method arguments |
| 4 | Address auth policy | Contract declares, protocol enforces |

#1 and #4 are paired: an address uses #4 to configure what the protocol enforces in #1. #2 and #3 are runtime queries that never touch the protocol's admission-time checks.

## Design goals

The v2 model targets four properties that differentiate it from existing authorization frameworks:

1. **Statically computable signatures.** A wallet can determine what the user is signing from the target method's signature alone, without transaction simulation. This is, hopefully, significantly more ergonomic than Ethereum's EIP-4337 or Soroban's "simulate to build an auth tree" pattern.

2. **Authorization expressed in method signatures.** A reader of a function's Rust signature can see exactly what attestations it requires. No deep reading of the function body is needed to locate `require_auth` calls or their equivalent.

3. **Clear to both contract developers and end users.** What is and is not authorized is explicit at the type level for contracts, and derivable from typed payloads for wallet display.

4. **Native support for asynchronous continuations.** Attestations survive across RCQ suspensions. The same attestation can authorize an operation whose execution spans a deferred continuation, replacing the need for token-specific permit patterns.

## Signature verification (concern #1)

At transaction admission, the protocol verifies every signature: the envelope signature that authorizes the transaction, and any detached signatures attached as auth claims. Signatures are checked against keys stored in the sending address's `AddressAuthData`.

Contracts do not run signature-verification code. By the time a contract is executing, the protocol has already validated every cryptographic proof on the transaction.

## Address auth policy (concern #4)

An address's `AddressAuthData` records what the protocol should enforce for transactions from it:

- Public keys registered for signature verification
- Nonce policy (monotonic, windowed, etc.)
- Gas permission policy (who may sponsor gas from this address)

Contracts declare policy via syscalls (`change_public_key_registration`, `set_nonce_config`, `set_gas_permission_config`). The protocol reads; the contract writes.

A fresh address has no `AddressAuthData`; transactions from it fail with `kAuthFailed` until policy is installed.

## Caller identity (concern #2)

A contract can query the address of its direct caller:

```rust
use sdk::contract_op::get_caller;

let caller = get_caller();
```

This always returns the immediate caller of the current frame. For anything beyond "the address immediately above me initiated this call," authorization must be expressed explicitly as a signed instruction.

## Signed instructions (concern #3)

A `Signed<T>` is an **attestation**: a typed statement made by an address and vouched for by the runtime. The runtime guarantees the named minter actually made the statement but does not interpret it. The consuming contract reads both the minter's identity and the payload, and decides what authority to grant based on both.

This is not a capability in the object-capability sense. Possessing a `Signed<T>` does not by itself confer authority; it is an attribution, and the consumer is the interpreter.

In the SDK, attestations appear as `Signed<T>`:

```rust
pub fn transfer_from(
    amount: i128,
    to: Address,
    signed: Signed<Erc20Transfer>,
);
```

The method signature declares, at the type level, what attestation the function expects. A function that does not accept a `Signed<T>` argument cannot read one.

### Properties of an attestation

Every `Signed<T>` carries:

- **Minter**: the address that made the attestation. Set by the runtime from the calling frame at mint time and **unforgeable**. The consuming contract treats the minter as the source of authority.
- **Payload**: the typed statement (e.g. an `Erc20Transfer` struct), supplied by the minter.
- **Consumer**: the contract address permitted to read the attestation. A scope constraint; the runtime refuses to deliver the payload to any other contract.
- **Expiry**: the block height after which the attestation can no longer be read.

Attestations are **single-use**: reading consumes them.

Handles are **ephemeral by default**. They exist for the duration of the transaction frame in which they're minted, and are discarded if not read. Persistence across an asynchronous continuation is supported by embedding the handle in an RCQ entry; this is the planned path for attestations whose use needs to outlive the minting transaction.

### Reading and validation

The consuming contract extracts both the minter and the payload, then validates the call's actual arguments against what the minter said:

```rust
pub fn transfer_from(
    amount: i128,
    to: Address,
    signed: Signed<Erc20Transfer>,
) {
    let sender = signed.minter;          // VM-attested authorizer
    let instruction = signed.consume();  // typed payload

    // The minter said: transfer up to `instruction.amount` to `instruction.recipient`.
    // The contract enforces actual args fit within those bounds.
    assert!(amount <= instruction.amount, "exceeds authorized amount");
    assert!(to == instruction.recipient, "unauthorized recipient");

    // Move funds from the attesting party.
    self.transfer(sender, to, amount);
}
```

The minter is who; the payload is what; the contract enforces the relationship between what was attested and what's being asked. **Identity comes from the runtime, never from a payload field.** A field like `from` in the payload would be ambient data the minter could lie about; `signed.minter` cannot be forged.

The contract's check is not constrained to exact-argument matching. Contracts can encode `≤`, subset relations, deadline checks, or any domain-specific equivalence appropriate to the call. The payload sets the bound; the contract sets the relation.

### Passing and forwarding

Attestations never flow implicitly. A cross-contract call does not inherit attestations from the caller's frame. To delegate an attestation to a sub-call, pass it explicitly as an argument.

This is what makes "the method signature is the auth story" enforceable: a function that does not declare a `Signed<T>` parameter has no way to read one.

### Nested attestations

A payload type can contain `Signed<U>` fields. When the outer attestation is consumed, the inner attestations remain valid handles: fresh entries in the runtime, with the outer's minter propagated to them.

```rust
#[contracttype]
pub struct DexIntent {
    pub pool: Address,
    pub deadline: BlockHeight,
    pub min_received: i128,
    pub transfer: Signed<Erc20Transfer>,
}

pub fn execute_swap(signed: Signed<DexIntent>) {
    let trader = signed.minter;
    let intent = signed.consume();
    // intent.transfer is a fresh Signed<Erc20Transfer>, still attributed to `trader`.

    // ...swap logic, slippage checks, pool interactions...

    // Forward the inner attestation to the token to settle the input transfer.
    let erc20 = Erc20Client::new(&token);
    erc20.transfer_from(amount_in, intent.pool, intent.transfer);
}
```

The outer attestation has `consumer = DexContract`; only the DEX can read it. The inner has `consumer = the ERC-20 token`; only the token can read it. Attribution stays intact through the chain: when the token reads `intent.transfer`, it sees `minter = trader`.

The effect is a **scope chain**: the outer attestation is meaningful only to the DEX, the inner only to the token. The protection this gives is at two levels:

**Signing scope.** Two flows are possible, and both close the same abuse channel.

*All-on-chain.* Alice's wallet builds the transaction and signs the envelope. The wallet contract executes inside that transaction and mints `Signed<DexIntent>` directly from the call arguments. No per-intent signature exists in calldata — there is only the envelope sig, which is bound 1:1 to that specific transaction by its nonce. Replay is impossible at the signature level.

*Portable / sponsored.* Alice signs an off-chain message describing the intent, and a sponsor or solver packages that signature as a detached auth claim inside *their* transaction. A signature now exists in calldata, and someone could extract it. But it covers the whole `DexIntent`, so a replayer can only resubmit Alice's full intent at the named consumer before expiry; nonce policy in `AddressAuthData` makes it single-use, and the signature cannot be decomposed into a bare `Erc20Transfer` authorization, because Alice never signed one.

**In-execution routing.** Inside a transaction, a contract that receives `Signed<DexIntent>` cannot lift the inner `Signed<Erc20Transfer>` and call the token directly, because only `consumer = DexContract` can unwrap the outer. The inner only materializes after the DEX has accepted the call. This is a meaningful guarantee when the path from wallet to DEX passes through any contract you don't fully trust.

This protection lands hardest in batch-auction and solver-driven exchange designs, where the user signs an intent that an off-chain network of solvers competes to fill. The user can audit the auction contract; they cannot audit the solvers. Wrapping the inner transfer in a `Signed<DexIntent>` means a solver who sees the intent cannot pull the transfer authorization out and use it outside the auction's settlement path.

Wrapping does not replace trust in the auction or DEX itself. The user still depends on it to honor slippage and deadline. The wrapping constrains *where* the transfer fires, not how the swap settles.

**Where the binding earns its keep.** The routing protection above lives in the *outer* attestation's consumer-binding, not the inner's. Once `consumer = DexContract` keeps the solver out, the inner `Signed<Erc20Transfer>` never materializes for them. The inner's consumer-binding is hygienic but not what's holding the line: even without it, a random contract reading "Alice authorizes 100 USDC to P" cannot act on it, because moving USDC requires the USDC contract's balance state and only the token has that. Consumer-binding does load-bearing work on **composite** attestations that carry inner attestations; on **leaf** attestations whose payloads are bounded data, it is defense-in-depth. We keep it on leaves anyway because there is no useful pattern in which a non-token contract should be reading a transfer attestation.

A `Signed<T>` is a runtime handle, not a portable bearer token. There is no "extract the handle from the mempool and clone it" attack to defend against, because the handle doesn't exist at mempool time. What exists at mempool time is the transaction and any off-chain signatures it carries; those are subject to the signing-scope reasoning above.

### Issuing attestations from contracts

Contracts can mint attestations and return them to their callers. This generalizes ERC-1271: any contract can act as a signature-verification authority by accepting inputs, running its own policy, and minting a `Signed<T>` on success.

A wallet contract can verify a multisig quorum or a passkey attestation, then mint a `Signed<Transfer>` in its own name. Any downstream consumer reads `minter = wallet_address`, which in Groundhog's uniform-address model *is* the user's identity.

```rust
fn verify_and_attest(msg: Bytes, sig: Bytes) -> Signed<Transfer> {
    require(self.verify_signature(&msg, &sig));
    sdk::mint_auth_token(
        block_height + 100,
        SignerPreimage {
            consumer: some_token_address,
            data: transfer_from_msg(&msg),
        },
    )
}
```

The returned attestation carries `minter = wallet_address`, set unforgeably by the runtime.

## What this enables

**Sponsored transactions.** The authorizer and the fee-payer are independent. A user mints an attestation authorizing a specific call; a sponsor wraps it in a transaction paid from their own account.

**Portable authorizations.** An attestation is bound to its minter, consumer, and expiry, not to a particular enclosing transaction. A signed attestation can be generated off-line and submitted later by any party, subject to reaching the named consumer before expiry.

**Atomic multi-party operations.** Multiple parties each mint independent attestations. A coordinator submits a transaction feeding all of them into a single call. Either every attestation validates and the call succeeds, or it reverts atomically.

**Replacing token permits.** A `transferFrom` taking a `Signed<Erc20Transfer>` argument is strictly more general than EIP-2612-style permits, requires no token-standard specialization, and survives asynchronous continuations, a property RCQ flows depend on.

**Bounded delegation in place of `approve`.** ERC-20-style approve has unbounded staleness as its core footgun: an open allowance lingers until explicitly revoked. An expiring, single-use, typed signed instruction removes that whole class of issue without sacrificing any of approve's functionality.

## Provisional v1 API

The current SDK exposes attestation consumption as a positional array: `get_auth_claim(index)` and `get_auth_claim_count()`. This is provisional and will be superseded by the typed `Signed<T>` model before the SDK is publicly stable. Positional access is expected to remain as a debug-only affordance.

## Not yet specified on this page

Several mechanics are being pinned down and will land here as they settle:

- **Minting from user signatures.** How an off-chain signature becomes an on-chain attestation. Expected path: an account contract verifies the signature against its own policy and mints, ERC-1271-style.
- **Expiry domain.** Whether expiry is measured in block height, timestamp, or transaction sequence.
- **RCQ revert semantics.** What happens to an attestation embedded in an RCQ entry if the resumer reverts and retries.
- **Failed sub-call semantics.** The expected behavior is that forwarded attestations are returned unread on revert, consistent with "reverted call is a state no-op" elsewhere in the protocol.

## See also

- [Invocation Frames](/how-it-works/invocation-frames/)
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/)
- [Syscalls](/reference/syscalls/)
