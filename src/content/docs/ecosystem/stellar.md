---
title: Stellar & Soroban
description: Groundhog patterns for developers building in the Stellar ecosystem.
---

## Who This Guide Is For

This guide is for Stellar and Soroban developers evaluating where Groundhog fits alongside the Stellar economy. It focuses on **pattern translation**: how familiar workflows look when they are expressed with Groundhog's parallel storage primitives.

---

## Mental Model Shifts

Before diving into specific patterns, here are the main differences in emphasis:

| Aspect | Stellar | Groundhog |
|--------|---------|-----------|
| **Execution** | Sequential within ledger | Parallel via snapshot isolation + delta merge |
| **State model** | Account-centric (balances, trustlines, offers built in) | Contract-centric (you define storage with typed primitives) |
| **Error handling** | Transaction result codes | Typed abort with structured errors |
| **DEX execution** | Built-in offers and synchronous path payments | Synchronous contracts or queued intent settlement, chosen by the application |
| **Multi-operation** | Bundle multiple operations in one transaction | Single root invocation with cross-contract calls |

Payments and token operations map directly to Groundhog's balance deltas. DEX applications can use a synchronous AMM, or use a request queue when they want concurrent submission and later settlement, as shown in [Design a Swap](/tutorials/design-a-swap/).

---

## Pattern Translations

### 1. Simple Payments

**Stellar Pattern:**
```javascript
// Stellar SDK
const payment = Operation.payment({
  destination: "GDEST...",
  asset: Asset.native(),
  amount: "100"
});

transaction.addOperation(payment);
```

**Groundhog Pattern:**
```rust
// Token contract transfer (see Build a Token for the full implementation)
fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    let sender = get_caller();
    self.balances.at_mut(&sender).decrease(amount);
    self.balances.at_mut(receiver).lazy_increase(amount);
    log_transfer_event(&sender, receiver, amount);
}
```

**What This Highlights:**
- You write a token contract with explicit balance primitives instead of using built-in account-level balances
- Both balance updates are delta operations, so transfers to and from the same account can execute in parallel
- Underflow is automatically rejected by `Balance::decrease` (the balance can never go negative)

The token contract in [Build a Token](/tutorials/build-a-token/) shows the full version of this pattern.

---

### 2. Multi-Operation Transactions

**Stellar Pattern:**
```javascript
// Stellar: All operations execute atomically, sequentially
const transaction = new TransactionBuilder(account)
  .addOperation(Operation.payment({ dest: A, amount: "100" }))
  .addOperation(Operation.payment({ dest: B, amount: "50" }))
  .addOperation(Operation.changeTrust({ asset: USD }))
  .build();
```

**Groundhog Pattern:**
```rust
// A contract method that performs multiple operations
fn batch_payment_and_trust(
    &mut self,
    dest_a: &ContractAddress,
    dest_b: &ContractAddress,
    token: &ContractAddress,
) {
    let sender = get_caller();

    // These are delta operations on independent keys, so they commute
    self.balances.at_mut(&sender).decrease(150);
    self.balances.at_mut(dest_a).lazy_increase(100);
    self.balances.at_mut(dest_b).lazy_increase(50);

    // Trust is just contract storage
    self.trustlines.at_mut(&sender).at_mut(token).set(&true);
}
```

**What This Highlights:**
- No operation bundling. You write a contract method that does everything you need
- For cross-contract operations, use [cross-contract calls](/reference/cross-contract-calls/): your method invokes other contracts
- Groundhog does not require you to declare which state you'll touch upfront. Conflicts are detected at merge time, not submission time
- Each contract invocation is atomic: if your method aborts, all state changes are discarded

The main shift is organizational: logic that would be represented as a list of Stellar operations becomes a contract method.

---

### 3. Market Making / Resting Orders

Groundhog does not provide a built-in order book. A contract can store orders by ID in a `Map`, or accept order intents through a `RetrocausalQueue` when many producers need to submit concurrently.

**Stellar Pattern:**
```javascript
// Place a new offer
Operation.manageSellOffer({
  selling: XLM,
  buying: USD,
  amount: "1000",
  price: "0.10",
  offerId: 0  // 0 = new offer
});

// Cancel an existing offer
Operation.manageSellOffer({
  selling: XLM,
  buying: USD,
  amount: "0",   // 0 = cancel
  price: "0.10",
  offerId: 12345
});
```

With a map-based book, different order IDs are independent. Changes to the same order follow the stored value type's conflict rules. With a queue-based design, inserts commute, one consumer sequences matching, and results are reported later through stored state or events. The queue is an application architecture, not a protocol requirement.

---

### 4. DEX Trading / Swaps

There are two useful Groundhog designs, and they make different tradeoffs.

**Stellar Pattern:**
```javascript
// Synchronous path payment: result is immediate
Operation.pathPaymentStrictReceive({
  sendAsset: XLM,
  sendMax: "1000",
  destination: dest,
  destAsset: USD,
  destAmount: "100",
  path: [EUR]  // Optional intermediate assets
});

// After submission, you know immediately:
// - Did it execute?
// - What was the actual rate?
// - How much was sent?
```

**Synchronous contract.** A swap method can call token contracts and return in one transaction. The SDK example uses this Uniswap-style shape. Swaps against different pair contracts are independent. Swaps against the same pair usually conflict because each calculates and writes a new reserve value, so only a compatible subset lands in a block.

**Queued intents.** A venue can instead accept intents through `RetrocausalQueue`. Inserts commute, then a consumer matches and settles them later. This shape needs event polling or another application-level result channel, but separates highly concurrent submission from sequential matching.

Use the synchronous model when callers need an immediate contract result. Use a queue when submit-then-settle semantics fit the product.

---

### 5. Account & Trust Management

**Stellar Pattern:**
```javascript
// Create trustline
Operation.changeTrust({
  asset: new Asset("USD", "GISSUER..."),
  limit: "10000"
});

// Configure account
Operation.setOptions({
  homeDomain: "example.com",
  inflationDest: "GINFLATION...",
  setFlags: AuthRequiredFlag
});
```

**Groundhog Pattern:**
```rust
// Trust and account config are just contract storage
fn set_trustline(&mut self, asset: &ContractAddress, limit: Amount) {
    let account = get_caller();
    self.trustlines.at_mut(&account).at_mut(asset).set(&limit);
}

fn set_options(&mut self, home_domain: &[u8], flags: u32) {
    let account = get_caller();
    self.config.at_mut(&account).set(&serialize_options(home_domain, flags));
}
```

**What This Highlights:**
- Explicit key-value storage instead of built-in account abstraction
- Per-account operations on different accounts are fully parallel (different `Map` keys)
- Configuration writes to the same account use `Bytestring`, so concurrent config changes conflict (one per block)

---

### 6. Soroban Smart Contracts

If you're already writing Soroban contracts, Groundhog is best read as an adjacent contract environment with a different storage model. Soroban remains a strong fit for applications that want the Soroban runtime and Stellar integration directly; Groundhog is useful when parallel execution, permanent storage, and delta-oriented state are the shape you want.

**Soroban:**
```rust
#[contractimpl]
impl TokenContract {
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        let from_balance: i128 = env.storage().persistent().get(&from).unwrap_or(0);
        let to_balance: i128 = env.storage().persistent().get(&to).unwrap_or(0);
        assert!(from_balance >= amount);
        env.storage().persistent().set(&from, &(from_balance - amount));
        env.storage().persistent().set(&to, &(to_balance + amount));
    }
}
```

**Groundhog:**
```rust
#[contract(throws = TokenError)]
impl TokenContract {
    fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
        let sender = get_caller();
        self.balances.at_mut(&sender).decrease(amount);
        self.balances.at_mut(receiver).lazy_increase(amount);
    }
}
```

**Side-by-Side Patterns:**

| Soroban | Groundhog |
|---------|-----------|
| `env.storage().persistent().get/set` (read-modify-write) | `Balance` increase/decrease (delta operation; no absolute rewrite) |
| Three storage tiers (Instance, Persistent, Temporary) | One storage model, no tiers |
| TTLs on all storage; must call `extend_ttl()` or data expires | Permanent storage, no TTLs, no expiration |
| `require_auth()` for caller authorization | `ensure(caller == self.owner.get(), err)` pattern |
| `#[contractimpl]` | `#[contract]` with `#[sdk::storage]` |
| `Env` passed to every function | `&self` / `&mut self` with `get_caller()` |
| Resource limits constrain transaction complexity | Gas metering exists but costs zero tokens |
| Sequence numbers serialize transactions per Stellar account | No sequential nonce; each Groundhog transaction carries a unique `(expiry height, nonce)` pair |
| Fees per transaction (inclusion + resource fees) | No per-operation fees; available (unlocked) HOG balance determines throughput share |

The important Groundhog concept is commutativity: which storage operations can merge determines how much parallelism your contract gets. See [Execution Model](/how-it-works/execution-model/).

---

## Pattern Summary

| Pattern | Groundhog Shape | Notes |
|---------|------------------|-------|
| Payments | Direct | Token contract transfers with `Balance` storage |
| Resting orders | Direct or queued | Map entries keep orders independent; queue inserts commute |
| Trust/Auth | Direct | Explicit key-value model |
| DEX trades | Synchronous or queued | Direct AMM calls return immediately; queues settle later |
| Soroban tokens | Direct | Delta operations instead of read-modify-write |
| Soroban DEX | Synchronous or queued | Choose based on contention and product semantics |

Payments and token operations fit `Balance` directly. DEX applications should deliberately choose between synchronous execution and a queued intent design.

---

## What Doesn't Change

Despite the differences, many concepts translate directly:

| Stellar Concept | Groundhog Equivalent |
|-----------------|---------------------|
| Accounts | Contract addresses |
| Assets (XLM, issued tokens) | Token contracts |
| Trustlines | Contract-level authorization |
| Order book DEX | Application-defined map or queued-intent venue |
| Sequence numbers | Unique expiry-height and nonce pair, not a monotonic account sequence |

---

## Common Questions

### Q: Do I lose atomicity for multi-op transactions?

No. Each Groundhog contract invocation is atomic. If your method aborts, all state changes are discarded. For multi-step workflows that span multiple contracts, use [cross-contract calls](/reference/cross-contract-calls/): a parent contract calls child contracts, and if the parent aborts, all child changes are reverted too.

### Q: When should I use a queued DEX model?

Use a queue when concurrent intent submission matters more than an immediate result. Poll execution events or read venue state to learn the settlement outcome. If callers need synchronous output, use a direct swap contract instead.

### Q: Will my market making bot need major changes?

That depends on the venue design. A synchronous venue looks like an ordinary contract call. A queued venue requires the bot to correlate submitted intents with later settlement events or state.

---

## References

- [Getting Started](/start/getting-started/): Set up the Rust SDK and write your first Groundhog contract
- [Build a Token](/tutorials/build-a-token/): Full ERC-20 token walkthrough
- [Merged Deltas](/programming-model/execution/#merged-deltas): How concurrent state changes combine
- [Storage Types](/reference/storage-types/): Balance, NNInt, Map, Vector, Value, Bytestring, RetrocausalQueue API reference
