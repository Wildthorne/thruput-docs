---
title: Stellar & Soroban
description: Translate Stellar operations and Soroban contract patterns into Stellar Thruput applications.
---

## Who This Guide Is For

For Stellar developers, distinguish classic operations from Soroban contracts before comparing either with Stellar Thruput. Stellar Thruput exposes contract calls and typed storage; payment, trust, and exchange policy belongs in contracts.

## Mental Model Shifts

| Starting point | Stellar Thruput approach |
| --- | --- |
| Classic payments and token operations | Call a token contract |
| Account trustlines and asset policy | Implement or select a contract's authorization policy |
| Multiple classic operations | Compose calls in one transaction |
| Built-in offers and path payments | Use an application-defined exchange |
| Soroban storage get/set | Choose typed storage operations and their merge rules |

These are design translations, not compatibility claims. Stellar Thruput does not automatically provide Stellar's asset or trustline semantics.

## Pattern Translations

### 1. Simple Payments

Classic Stellar provides a payment operation. A Stellar Thruput token implementation updates typed balances:

```rust
fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    let sender = get_caller();
    self.balances.at_mut(&sender).decrease(amount);
    self.balances.at_mut(receiver).lazy_increase(amount);
}
```

Here, `balances` is `Map<ContractAddress, Balance>`. The checked debit detects insufficient funds during execution; the lazy credit records a relative change. Compatible transactions can merge if aggregate bounds and their other changes permit it. See [Build a token](/guides/build-a-token/) for the complete implementation and events.

### 2. Multi-Operation Transactions

[Classic Stellar transactions](https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-transactions) can bundle operations atomically. Soroban transactions contain a single smart-contract operation, which can invoke other contracts.

A Stellar Thruput transaction has one root invocation. That invocation can call several contracts. The native DefaultWallet and its SDK helpers also support [atomic typed call batches](/typescript/transactions/#execute-multiple-calls).

If the root aborts, its contract changes and successful child changes are discarded. A parent using recoverable calls can instead handle a child's failure and continue. See [Invocation Frames](/how-it-works/invocation-frames/).

### 3. Market Making / Resting Orders

Stellar Thruput has no built-in order book. A contract can store orders by ID in a `Map`, or accept requests through a `RetrocausalQueue`.

Separate order IDs have independent storage locations. Changes to the same order follow its value type's merge rules. A queue allows concurrent insertion and later ordered processing. Choose according to the venue's matching and settlement rules.

### 4. DEX Trading / Swaps

Two designs are possible:

- **Synchronous calls:** execute a swap and return its result in one transaction. Reserve-dependent writes to the same pair can conflict.
- **Queued requests:** accept a request first, then process it in a later transaction. The client tracks a request ID through outcome events or stored state.

The maintained [AMM example](/guides/build-an-amm/) uses the queued design. Request acceptance is not proof that the swap completed. A synchronous result refers to execution within a transaction, not immediate network confirmation.

### 5. Account & Trust Management

A Stellar Thruput contract can store per-account policy in a map, but a stored trust flag has no effect unless the token or application checks it.

Use [caller checks and auth tokens](/how-it-works/authorization/) to enforce the policy. Use [account authorization](/typescript/wallet-clients/) for signatures that can originate transactions. These are separate responsibilities.

### 6. Soroban Smart Contracts

Both environments support Rust contracts, with different storage and authorization APIs:

| Soroban | Stellar Thruput |
| --- | --- |
| `persistent().get/set` | Typed handles such as `Value<T>`, `Map<K, V>`, and `Balance` |
| Instance, Persistent, and Temporary storage | One persistent storage model with type-specific operations |
| Storage TTL and archival/restoration | No storage TTL; funded data remains until deleted |
| `require_auth()` | Immediate-caller checks or explicit runtime auth tokens, according to the contract policy |
| `#[contractimpl]` | `#[contract]` on a Rust interface or implementation |
| Inclusion and resource fees | No conventional gas fees; native-token-backed scheduling and storage |

Soroban TTL expiry is not the same for every storage type: Temporary data is deleted, while Persistent and Instance entries are archived and can be restored. See [Stellar state archival](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival).

Stellar Thruput's storage types determine which concurrent changes can combine. Use [Contract Execution](/programming-model/execution/) for snapshots and [Storage Types](/programming-model/storage-types/) for API choices.

## Pattern Summary

| Pattern | Design decision |
| --- | --- |
| Payments | Select the token contract and its transfer policy |
| Resting orders | Choose keyed storage, a queue, or both |
| Trust and authorization | Store policy and enforce it on every relevant action |
| Swaps | Choose synchronous execution or accepted requests with later settlement |
| Client recovery | Track transaction hashes and, for queued work, request outcomes |

## What Doesn't Change

Applications still need to validate amounts, choose the intended network, authorize writes, and inspect outcomes. A successful submission is not successful execution on either platform.

## Common Questions

### Q: Do I lose atomicity for multi-op transactions?

No. Calls can execute atomically inside one root transaction. A workflow split across several transactions, such as queue acceptance and later settlement, needs application-level outcome tracking.

### Q: When should I use a queued DEX model?

Use it when concurrent request submission and later processing fit the venue. Use a synchronous call when the caller needs the swap result during the same transaction.

### Q: Will my market making bot need major changes?

The venue determines that. A queued venue requires the bot to connect accepted request IDs with later outcomes. It must not treat a successful processing transaction as proof that every queued request succeeded.

## References

- [Stellar operations and transactions](https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-transactions)
- [Stellar state archival](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival)
- [Contract quickstart](/get-started/contract/)
- [Build a token](/guides/build-a-token/)
- [Build an AMM](/guides/build-an-amm/)
