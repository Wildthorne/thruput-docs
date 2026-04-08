---
title: Stellar Migration
description: Guide for Stellar developers adapting applications to Groundhog.
---

## Who This Guide Is For

This guide is for Stellar developers evaluating how their applications would adapt to run on Groundhog. It focuses on **pattern adaptation**: how the workflows and mental models you've developed for Stellar would change, rather than low-level API mappings.

---

## Mental Model Shifts

Before diving into specific patterns, understand these fundamental differences:

| Aspect | Stellar | Groundhog |
|--------|---------|-----------|
| **Execution** | Sequential within ledger | Parallel via snapshot isolation + delta merge |
| **State model** | Account-centric (balances, trustlines, offers built in) | Contract-centric (you define storage with typed primitives) |
| **Error handling** | Transaction result codes | Typed abort with structured errors |
| **DEX execution** | Synchronous (immediate result) | Async (intent submission, later execution) |
| **Multi-operation** | Bundle up to 100 ops in one transaction | Single contract invocation with cross-contract calls |

**The good news:** The majority of Stellar traffic is payments and token operations, which map directly to parallel Groundhog primitives with minimal adaptation. The pattern that requires the most rethinking is DEX trading, which moves from synchronous execution to an intent-queue model.

---

## Pattern Adaptations

### 1. Simple Payments (Low Friction)

**Current Stellar Pattern:**
```javascript
// Stellar SDK
const payment = Operation.payment({
  destination: "GDEST...",
  asset: Asset.native(),
  amount: "100"
});

transaction.addOperation(payment);
```

**Groundhog Equivalent:**
```rust
// Token contract transfer (see Build a Token for the full implementation)
fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    let sender = get_caller();
    let diff = amount_to_diff(amount);
    self.balances.at_mut(&sender).strict_inc(-diff);
    self.balances.at_mut(receiver).strict_inc(diff);
    log_transfer_event(&sender, receiver, amount);
}
```

**What Changes:**
- You write a token contract with explicit balance primitives instead of using built-in account-level balances
- Both balance updates are delta operations (`strict_inc`), so transfers to and from the same account can execute in parallel
- Underflow is automatically rejected by `NNInt` (the balance can never go negative)

**Adaptation Difficulty:** Low. The ERC-20 token contract in [Build a Token](/tutorials/build-a-token/) is a complete working example.

---

### 2. Multi-Operation Transactions (Medium Friction)

**Current Stellar Pattern:**
```javascript
// Stellar: All operations execute atomically, sequentially
const transaction = new TransactionBuilder(account)
  .addOperation(Operation.payment({ dest: A, amount: "100" }))
  .addOperation(Operation.payment({ dest: B, amount: "50" }))
  .addOperation(Operation.changeTrust({ asset: USD }))
  .build();
```

**Groundhog Equivalent:**
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
    self.balances.at_mut(&sender).strict_inc(-150);
    self.balances.at_mut(dest_a).strict_inc(100);
    self.balances.at_mut(dest_b).strict_inc(50);

    // Trust is just contract storage
    self.trustlines.at_mut(&sender).at_mut(token).set(&true);
}
```

**What Changes:**
- No operation bundling. You write a contract method that does everything you need
- For cross-contract operations, use [cross-contract calls](/reference/cross-contract-calls/): your method invokes other contracts
- Groundhog does not require you to declare which state you'll touch upfront. Conflicts are detected at merge time, not submission time
- Each contract invocation is atomic: if your method aborts, all state changes are discarded

**Adaptation Difficulty:** Medium. The contract model is more flexible than Stellar's operation model, but requires thinking about your logic as contract code rather than a list of operations.

---

### 3. Market Making / Resting Orders (Low Friction)

This is the biggest win for Stellar users on Groundhog. Most Stellar DEX activity is resting order management, which maps directly to parallel primitives.

**Current Stellar Pattern:**
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

**Groundhog Equivalent:**
```rust
// Place offer: insert into a retrocausal queue (always commutes)
fn place_order(&mut self, venue: &StorageKey, amount: Amount, price: u64) {
    let sender = get_caller();
    let diff = amount_to_diff(amount);

    // Lock funds
    self.balances.at_mut(&sender).strict_inc(-diff);
    self.locked.at_mut(&sender).strict_inc(diff);

    // Submit order intent (multi-producer queue, inserts always commute)
    let order = serialize_order(&sender, amount, price);
    retrocausal_queue_insert(venue, &order);
}

// Cancel offer: just unlock funds (balance ops commute)
fn cancel_order(&mut self, amount: Amount) {
    let sender = get_caller();
    let diff = amount_to_diff(amount);

    self.locked.at_mut(&sender).strict_inc(-diff);
    self.balances.at_mut(&sender).strict_inc(diff);
}
```

**What Changes:**
- Offers are intents submitted to a `RetrocausalQueue`, not direct orderbook manipulation
- Multiple market makers can submit offers in parallel (queue inserts commute)
- Cancellation is balance rebalancing, fully parallel
- Offer matching happens in a subsequent block (see DEX Trading below)

**Adaptation Difficulty:** Low. Order placement and cancellation are the high-volume operations, and they parallelize completely.

---

### 4. DEX Trading / Swaps (High Friction)

This is where the mental model changes most significantly.

**Current Stellar Pattern:**
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

**Groundhog Equivalent:**
```rust
// Phase 1: Submit swap intent (commutes with other intents)
fn submit_swap(
    &mut self,
    venue: &StorageKey,
    input_max: Amount,
    output_min: Amount,
) {
    let sender = get_caller();
    let diff = amount_to_diff(input_max);

    // Lock input tokens
    self.balances.at_mut(&sender).strict_inc(-diff);
    self.locked.at_mut(&sender).strict_inc(diff);

    // Submit to queue
    let intent = serialize_swap(&sender, input_max, output_min);
    retrocausal_queue_insert(venue, &intent);
}

// Phase 2: Execution happens in a subsequent block.
// A venue sequencer contract consumes the queue and matches trades.
// Results are delivered via events or callback.
```

**What Changes:**
- No immediate execution result. You submit an intent, execution happens in a subsequent block
- Submission is parallel (many users can submit swaps simultaneously)
- Execution is sequential per venue (only swaps on the same pair compete)
- Must handle async results via events or callback

**Adaptation Difficulty:** High. This is the one area where the programming model is fundamentally different. But it is also more fair than Stellar's model, where transaction ordering within a ledger can favor certain participants.

---

### 5. Account & Trust Management (Low Friction)

**Current Stellar Pattern:**
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

**Groundhog Equivalent:**
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

**What Changes:**
- Explicit key-value storage instead of built-in account abstraction
- Per-account operations on different accounts are fully parallel (different `Map` keys)
- Configuration writes to the same account use `Bytestring`, so concurrent config changes conflict (one per block)

**Adaptation Difficulty:** Low

---

### 6. Soroban Smart Contracts

If you're already writing Soroban contracts, the adaptation is mostly about storage types and error handling.

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
        let diff = amount_to_diff(amount);
        self.balances.at_mut(&sender).strict_inc(-diff);  // delta, not read-modify-write
        self.balances.at_mut(receiver).strict_inc(diff);
    }
}
```

**Key Differences from Soroban:**

| Soroban | Groundhog |
|---------|-----------|
| `env.storage().persistent().get/set` (read-modify-write) | `strict_inc(delta)` (delta operation, no read needed) |
| Three storage tiers (Instance, Persistent, Temporary) | One storage model, no tiers |
| TTLs on all storage; must call `extend_ttl()` or data expires | Permanent storage, no TTLs, no expiration |
| `require_auth()` for caller authorization | `ensure(caller == self.owner.get(), err)` pattern |
| `#[contractimpl]` | `#[contract]` with `#[sdk::storage]` |
| `Env` passed to every function | `&self` / `&mut self` with `get_caller()` |
| Resource limits constrain transaction complexity | Gas metering exists but costs zero tokens |
| Sequence numbers enforce serial execution per account | No sequence numbers; transactions parallelize by default |
| Fees per transaction (inclusion + resource fees) | No per-operation fees; available (unlocked) HOG balance determines throughput share |

**What you can stop doing:** TTL management, storage tier selection, building cron jobs to extend data lifetimes, managing channel accounts for parallelism.

**What you need to learn:** Commutativity. Which of your storage operations commute determines your parallelism. See [Execution Model](/how-it-works/execution-model/).

---

## Adaptation Summary

| Pattern | Adaptation | Notes |
|---------|------------|-------|
| Payments | Low | Direct mapping to token contract transfers |
| Resting orders | Low | Queue inserts commute; market makers benefit most |
| Trust/Auth | Low | Explicit key-value model |
| DEX trades | High | Intent queue pattern; async results |
| Soroban tokens | Low | Delta operations instead of read-modify-write |
| Soroban DEX | High | Same intent queue pattern as DEX trades |

Most Stellar traffic is payments and token operations, which parallelize on Groundhog with minimal changes. DEX trading is the one area that requires a fundamentally different approach.

---

## What Doesn't Change

Despite the differences, many concepts translate directly:

| Stellar Concept | Groundhog Equivalent |
|-----------------|---------------------|
| Accounts | Contract addresses |
| Assets (XLM, issued tokens) | Token contracts |
| Trustlines | Contract-level authorization |
| Order book DEX | Per-venue order books via RetrocausalQueue |
| Sequence numbers | Not needed; transactions parallelize by default |

---

## Common Questions

### Q: Do I lose atomicity for multi-op transactions?

No. Each Groundhog contract invocation is atomic. If your method aborts, all state changes are discarded. For multi-step workflows that span multiple contracts, use [cross-contract calls](/reference/cross-contract-calls/): a parent contract calls child contracts, and if the parent aborts, all child changes are reverted too.

### Q: How do I handle the async DEX model?

Options:
1. **Events**: Poll for execution events matching your intent
2. **Callbacks**: Register a callback contract to receive execution results
3. **Optimistic UI**: Show "pending" state, update when confirmed

This is similar to how many DeFi applications already work on other chains.

### Q: Will my market making bot need major changes?

Order placement and cancellation are faster on Groundhog (parallel queue inserts). The main change is handling async fills, but most sophisticated market makers already poll for trade events rather than relying on synchronous execution.

---

## References

- [Getting Started](/start/getting-started/): Set up the Rust SDK and write your first Groundhog contract
- [Build a Token](/tutorials/build-a-token/): Full ERC-20 token walkthrough
- [Execution Model](/how-it-works/execution-model/): How snapshot isolation and delta merge work
- [Storage Types](/reference/storage-types/): NNInt, Map, Vector, Value, Bytestring, RetrocausalQueue API reference
