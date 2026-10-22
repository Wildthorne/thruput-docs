---
title: Authorization
description: How transaction signatures, address auth data, caller identity, and auth tokens work in Stellar Thruput.
---

Stellar Thruput treats addresses uniformly. An address can hold code, store auth data, receive calls, and originate transactions through either supported admission model.

Authorization has two layers:

1. **Transaction admission**: hogd checks the transaction's auth claim and signatures before execution.
2. **Runtime authorization**: contracts use caller identity, explicit signature checks, and typed auth tokens while executing.

These layers are related but separate. Transaction admission decides whether the root transaction may enter the block. Runtime authorization decides what authority a contract gives to a caller or token it receives.

## Authorize an application operation

For an owner-controlled method, store the owner in `Value<ContractAddress>` and check it before changing state:

```rust
ensure(get_caller() == self.owner.get(), AccessError::NotOwner);
```

Define `AccessError` with [a contract exception](/contracts/errors/#defining-errors). Initialize the owner through a guarded method and [deploy and initialize atomically](/cli/deploy-and-call/#include-initialization) if the first caller becomes the owner.

`get_caller()` identifies the immediate caller. A forwarded call identifies the forwarding contract, not the original user. For authority passed through several frames, use the [typed auth-token model](#auth-tokens-and-signedt) below and validate its minter and payload.

## Transaction Admission

A `SignedTransaction` contains an inner transaction, decorated signatures, and, for pubkey accounts, the signing public key:

```text
struct DecoratedSignature {
  unsigned int public_key_id;
  Signature signature;
};

struct SignedTransaction {
  Transaction tx;
  DecoratedSignature signatures<>;
  PublicKey *pubkey_claim_key;
};
```

The source address is the root invocation's `invoked_address`. Every transaction signature covers this preimage:

```text
cxs(DomainSeparator("Transaction")) || networkHash || txs(transaction)
```

`txs(value)` denotes its standard XDR encoding. The domain separator prevents a transaction signature from being interpreted as a signature over another object. The network hash binds the signature to one Stellar Thruput network and prevents cross-network replay.

The canonical transaction hash is `sha256(txs(transaction))`. It identifies the inner transaction and excludes signatures. It is distinct from both the signature preimage and the encoded `SignedTransaction` wrapper.

### Signature Schemes

| Scheme | Public key | Signature | Notes |
|---|---|---|---|
| Ed25519 | 32 bytes | 64 bytes | Default scheme in the CLI |
| ML-DSA-65 (FIPS 204) | 1,952 bytes | 3,309 bytes | Pure ML-DSA with an empty context string, not HashML-DSA |

Both schemes sign the preimage above directly, with no extra pre-hash. ML-DSA-65 signing is randomized by default, so two valid signatures over one transaction can differ. The transaction hash stays the same because it excludes signatures.

## Admission Models

The transaction's `AuthClaim` selects one of two admission models:

```text
enum AuthClaim switch (AuthClaimType claim_type) {
case kSourceAddressAuthData:
  struct {
    BitMap allowed_keys;
    Weight required_weight;
  } source_address_claim;

case kPubkeySignature:
  PubkeyAccountPreimage pubkey_preimage;
};
```

### Pubkey Accounts

`kPubkeySignature` authorizes an account whose address is derived from `PubkeyAccountPreimage { pubkey_hash, nonce }`. The preimage holds a hash of the public key, not the key itself:

```text
pubkey_hash = sha256(cxs(DomainSeparator("PublicKey")) || cxs(PublicKey))
```

The `PublicKey` encoding includes its scheme, so the same key bytes under Ed25519 and ML-DSA-65 give different addresses. The full key travels in `SignedTransaction.pubkey_claim_key`.

This derivation also changed Ed25519 addresses. A pubkey-account address saved before the Futurenet reset that introduced ML-DSA-65 does not match the same key now. Derive the address again from the key and update saved addresses.

hogd accepts the claim only when:

- the derived address equals the root invocation's `invoked_address`;
- the source address has no registered `AddressAuthData`;
- the transaction has exactly one signature, with `public_key_id` 0;
- `pubkey_claim_key` is present and its hash equals `pubkey_hash`;
- the signature uses the same scheme as `pubkey_claim_key` (Ed25519 or ML-DSA-65) and verifies against it.

During root execution at an undeployed pubkey-account address, the runtime falls back to the network's configured DefaultWallet contract. This gives a new pubkey account wallet behavior without first deploying code at its derived address. The fallback applies only to the root invocation.

### Source-Address Accounts

`kSourceAddressAuthData` authorizes the root invocation from auth data stored at its source address. The source address must have `AddressAuthData`; a source-address claim without it is rejected. A source-address claim must not carry `pubkey_claim_key`.

hogd checks:

- `allowed_keys` does not set bits beyond `kMaxSigners = 21`.
- Every signature's `public_key_id` appears in `allowed_keys`.
- Signature `public_key_id` values are strictly increasing, so duplicates and out-of-order signatures are rejected.
- Each referenced key exists in the source address's `AddressAuthData`.
- Each signature uses its registered key's scheme and verifies against that key.
- The sum of matched key weights is at least `max(address.required_weight, claim.required_weight)`.

The threshold is `max(address.required_weight, claim.required_weight)`. This lets the address set a standing minimum while each transaction can require an equal or higher threshold.

Contracts can inspect the root transaction's auth claim with [`get_auth_claim()`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/auth_claim/fn.get_auth_claim.html), but admission has already happened by the time contract code runs. For a pubkey account, the claim exposes `pubkey_hash` and `nonce`, not the public key.

## Address Auth Data

`AddressAuthData` is stored under `StorageKeyType::AuthData` for an address:

```text
struct PublicKeyConfig {
  PublicKey key;
  Weight max_weight;
};

struct AddressAuthData {
  PublicKeyConfigOpt public_keys[21];
  Weight required_weight;
  BlockHeight last_written_height;
};
```

Each key slot is optional. Empty slots do not contribute weight.

An address can mutate only its own auth data. The SDK exposes the current syscalls as:

```rust
use thruput_sdk::{
    add_address_public_key,
    remove_address_public_key,
    set_address_required_weight,
};

add_address_public_key(0, public_key, 1)?;
set_address_required_weight(1)?;
remove_address_public_key(0)?;
```

Registered keys are Ed25519 only. `add_address_public_key` rejects ML-DSA-65 keys, so a source-address account cannot register one yet. Use a pubkey account for ML-DSA-65.

Use these for source-address accounts, wallet contracts, and contracts that are meant to originate later transactions. Replay protection is transaction-level, through the transaction `Uniquifier`. `AddressAuthData` does not contain nonce policy or gas-sponsorship policy fields.

## Caller Identity

Inside a contract, [`get_caller()`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/contract_op/fn.get_caller.html) returns the direct caller of the current invocation frame:

```rust
use thruput_sdk::get_caller;

let caller = get_caller();
```

This is Stellar Thruput's equivalent of `msg.sender`: immediate caller identity. It is not a signer set and it does not tell you which key signed the root transaction. A root frame has no caller, so the underlying syscall errors there.

Use [`get_current_address()`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/contract_op/fn.get_current_address.html) when a contract needs its own address.

## Contract Signature Checks

Contracts can verify arbitrary messages with [`verify_signature_ed25519()`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/crypto/fn.verify_signature_ed25519.html):

```rust
use thruput_sdk::crypto::verify_signature_ed25519;

let ok = verify_signature_ed25519(&public_key, &signature, message);
```

Contract signature checks support Ed25519 only. The SDK has no ML-DSA-65 verify function, and the `VerifySignature` syscall rejects other schemes.

This is runtime logic, separate from transaction admission. A wallet contract can use it to accept an off-chain signature, apply its own policy, and then mint an auth token in the wallet contract's name.

## Auth Tokens and `Signed<T>`

The SDK's [`Signed<T>`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/signer/struct.Signed.html) is a typed runtime auth-token handle. It is not a cryptographic signature and it is not a durable bearer token.

An auth token carries:

- **Minter**: set by the host to the current contract address at mint time.
- **Consumer**: the contract address allowed to consume the token.
- **Payload**: CXS-encoded typed data from the SDK.
- **Expiry height**: the token is valid through this block height.
- **Child nodes**: nested auth tokens that materialize when the parent is consumed.

`Signed<T>` is a handle to this runtime token. The handle travels out-of-band alongside calldata; it does not serialize the payload into the method argument bytes. Contract specifications represent it as a `SignedToken` node containing the payload type.

To make a payload type usable in a token, mark it as a contract type:

```rust
use thruput_sdk::*;

#[contract_type]
pub struct TransferAuth {
    pub to: ContractAddress,
    pub amount: i128,
}
```

Mint with [`mint_auth_token()`](https://crates.thruput.network/docs/sdk/0.34.3/doc/sdk/signer/fn.mint_auth_token.html):

```rust
use thruput_sdk::*;

let token: Signed<TransferAuth> = mint_auth_token(
    expiry,
    AuthTokenPreimage {
        consumer: token_contract,
        data: TransferAuth { to, amount },
    },
);
```

Consume with `Signed<T>::consume()`:

```rust
use thruput_sdk::*;

pub fn transfer_from(
    amount: i128,
    to: &ContractAddress,
    auth: Signed<TransferAuth>,
) {
    let (claim, minter) = auth.consume();

    assert!(minter == expected_wallet(), "unauthorized minter");
    assert!(claim.to == *to, "unauthorized recipient");
    assert!(amount <= claim.amount, "exceeds authorized amount");

    // Move funds from `minter` to `to`.
}
```

Consuming proves only two things: the token was minted by the returned `minter`, and the token was destined for the current contract. Any contract can mint a token whose payload decodes as `TransferAuth`. Always check the returned minter against an address your contract trusts before acting on the payload.

## Passing Auth Tokens

Auth tokens never flow implicitly across contract calls. Generated clients collect `Signed<T>` handles from arguments and pass those token ids to `Invoke` beside calldata. A callee receives only the tokens that appeared in its arguments.

Frame ownership works like this:

- When a parent forwards a token to a child call, the child owns that token while it runs.
- If the child returns the token in its return value, the parent receives it back.
- If the child aborts or the parent handles a reverted child frame, forwarded tokens are restored to the parent.
- If the child succeeds without returning a forwarded token, the parent does not automatically regain it.
- Consuming a token removes it. Any child tokens become fresh handles owned by the consuming frame.

This makes method signatures part of the authorization surface: a function that does not take a `Signed<T>` argument cannot consume that token.

Generated clients assign returned token handles to `Signed<T>` fields in the return value. Lower-level callers that receive a `Vec<Signed<Opaque>>` can use `AssumeTokens::try_assume_tokens` to convert an exact number of opaque handles into a typed tuple. A count mismatch returns `CallingError::DecodingSuccess`; `AssumeTokens::assume_tokens` is the throwing convenience form.

## Nested Auth Tokens

A token payload can contain `Signed<U>` fields. When the outer token is consumed, the runtime creates child-token handles for those fields. Child tokens keep the same minter and expiry as the parent, but each child has its own consumer address and payload.

```rust
use thruput_sdk::*;

#[contract_type]
pub struct DexIntent {
    pub pool: ContractAddress,
    pub deadline: BlockHeight,
    pub min_received: i128,
    pub transfer: Signed<TransferAuth>,
}

pub fn execute_swap(intent: Signed<DexIntent>) {
    let (intent, trader) = intent.consume();

    assert!(trader == expected_wallet(), "unauthorized trader");
    assert!(get_block_height() <= intent.deadline, "intent expired");

    // The nested transfer token is now a fresh handle that can be passed to
    // the token contract selected as its consumer.
    token_client.transfer_from(amount_in, &intent.pool, intent.transfer);
}
```

The outer token might be consumed only by the DEX. The nested transfer token might be consumed only by the token contract. Attribution stays with the original minter through the chain.

## Limits

The protocol currently caps an auth-token payload at 256 bytes, tree depth at 4, and child nodes per token at 4. `MintAuthToken` rejects malformed token nodes, expired-at-mint tokens, and tokens that would exceed runtime caps. `ConsumeAuthToken` rejects tokens not owned by the current frame, expired tokens, and already-consumed handles.

## Not Landed

Do not rely on these patterns yet:

- Detached admission-time signatures that directly become `Signed<T>` values.
- Nonce or gas-sponsorship policy fields in `AddressAuthData`.
- Durable, storable, or off-chain portable `Signed<T>` handles. A `Signed<T>` is a runtime handle owned by invocation frames inside a transaction.

## See Also

- [Invocation Frames](/how-it-works/invocation-frames/)
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/)
- [Syscalls](/reference/syscalls/)
- [SDK Macros](/reference/sdk-macros/)
- [Rust API Docs](/tools/rust-api-docs/)
