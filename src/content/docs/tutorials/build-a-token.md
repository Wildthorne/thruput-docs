---
title: Build a Token
description: "Tutorial: build an ERC-20 token on Groundhog, step by step."
---

We're building an ERC-20 token with transfer, approve, mint, and burn. The contract uses delta-based operations (`strict_inc`) instead of absolute writes. You express intent ("subtract 50 from this balance") and the system enforces the guarantee (balance never goes negative). No explicit balance checks, no race conditions. The bonus: because these operations are simple deltas, the system can execute them in parallel.

**Prerequisites:** Complete [Build a Counter](/tutorials/build-a-counter/) first (covers SDK setup, project structure, and basic patterns).

## Step 1: Define the Interface

The ERC-20 interface lives in its own crate (`groundhog-erc20-if`). Your contract will implement this trait, and the `#[contract]` macro generates an entrypoint for each method.

```rust
use sdk::ContractAddress;

pub type Amount = u128;
pub type Difference = i128;

#[contract(client = ERC20Client, throws = ERC20Error)]
pub trait ERC20 {
    fn initialize(&mut self, contract_owner: &ContractAddress);

    /// Transfer from caller to `receiver` address
    fn transfer(&mut self, receiver: &ContractAddress, amount: Amount);

    /// Transfer from `owner` to `receiver` address, using allowance
    fn transfer_from(
        &mut self,
        owner: &ContractAddress,
        receiver: &ContractAddress,
        amount: Amount,
    );

    /// Adjust allowance for `spender` by `amount` (positive or negative)
    fn adjust_allowance(
        &mut self,
        spender: &ContractAddress,
        diff: Difference,
    );

    /// Get `spender`'s allowance of `owner`'s tokens
    fn allowance(
        &self,
        owner: &ContractAddress,
        spender: &ContractAddress,
    ) -> Amount;

    /// Get balance for given address
    fn get_balance_of(&self, addr: &ContractAddress) -> Amount;

    /// Get balance for caller
    fn get_balance(&self) -> Amount;

    /// Create tokens into `receiver` address
    fn mint(&mut self, receiver: &ContractAddress, amount: Amount);

    /// Destroy tokens from `owner` address
    fn burn(&mut self, owner: &ContractAddress, amount: Amount);

    /// Get total supply of outstanding tokens
    fn total_supply(&self) -> Amount;
}
```

The `client = ERC20Client` parameter tells the macro to generate a client stub for cross-contract calls. The `throws = ERC20Error` parameter defines the error type returned on failure.

Notice `adjust_allowance` takes a signed `Difference`, not an absolute `Amount`. This is a deliberate design choice: delta-based approvals commute, absolute approvals don't. Two concurrent `adjust_allowance` calls with `+50` and `+100` produce the same result regardless of execution order. Two absolute `approve` calls to set `50` and `100` do not.

The interface crate also defines the error type and conversion helpers:

```rust
#[sdk::contract_exception]
#[non_exhaustive]
pub enum ERC20Error {
    AlreadyInitialized = 1,
    MustBeContractOwner = 2,
    TooLarge = 3,
    Internal = 100,
}

/// Convert unsigned Amount to signed Difference.
/// Throws if the value would overflow i128.
pub fn amount_to_diff(amount: Amount) -> Difference {
    amount.try_into().unwrap_or_else(|_| throw(ERC20Error::TooLarge))
}
```

The `#[contract_exception]` macro generates serialization derives and XDR encoding. `amount_to_diff` converts the unsigned `Amount` (u128) to a signed `Difference` (i128), throwing if the value overflows. This is called before every balance or allowance adjustment.

## Step 2: Define Storage

```rust
use crate::interface::*;
use sdk::storage::{Map, NNInt, Value};
use sdk::*;

type Balance = NNInt;
type Allowance = NNInt;

#[derive(Debug)]
#[sdk::storage]
pub struct TokenContract {
    contract_owner: Value<ContractAddress>,
    balances: Map<ContractAddress, Balance>,
    allowances: Map<ContractAddress, Map<ContractAddress, Allowance>>,
    total_supply: NNInt,
}
```

Four fields:

- **`contract_owner`**: The address authorized to mint and burn, stored as a `Value<ContractAddress>`.
- **`balances`**: Maps each address to its token balance. The value type is `NNInt` (aliased as `Balance`), so increments and decrements commute. See [Storage Types](/programming-model/storage-types/) for the full `NNInt` API.
- **`allowances`**: Nested map. `allowances[owner][spender]` tracks how many tokens `spender` can transfer on behalf of `owner`.
- **`total_supply`**: Total tokens in circulation. Also `NNInt`, so mints and burns commute with each other and with transfers.

The `#[sdk::storage]` macro generates the serialization and storage-access code. See [SDK Macros](/reference/sdk-macros/) for details.

The production `groundhog-erc20` standard interface in the SDK uses a single `config: Value<Config>` field that bundles the administrator address with optional metadata (name, symbol, decimals) behind feature flags. This tutorial keeps the four flat fields for clarity; the trade-offs are the same.

## Step 3: Helper Methods

These private methods abstract over raw storage access. The pattern: `try_get().unwrap_or(0)` returns zero for addresses that have never been written to, so you don't need explicit initialization of every balance or allowance.

```rust
impl TokenContract {
    fn _init(&mut self, contract_owner: &ContractAddress) {
        // One-time initialization. Calling `initialize` twice is a bug.
        ensure(self.contract_owner.try_get().is_none(), ERC20Error::AlreadyInitialized);
        self.contract_owner.set_exclusive(contract_owner);
    }

    fn _contract_owner(&self) -> ContractAddress {
        self.contract_owner.get()
    }

    // Balance stored at given owner address, or zero if empty
    fn _balance_amount_of(&self, owner: &ContractAddress) -> Amount {
        self.balances.at(owner).try_get().unwrap_or(0) as Amount
    }

    // Adjust balance at given owner address, from zero if empty
    fn _adjust_balance(&mut self, owner: &ContractAddress, diff: Difference) {
        // For never-stored-to addresses, this acts as
        // if the value was zero.  If the resulting balance
        // would be negative, this aborts.
        self.balances.at_mut(owner).strict_inc(diff);
    }

    fn _allowance(
        &self,
        owner: &ContractAddress,
        spender: &ContractAddress,
    ) -> Amount {
        self.allowances.at(owner).at(spender).try_get().unwrap_or(0) as Amount
    }

    // Adjust allowance for owner and spender, from zero if empty.
    fn _adjust_allowance(
        &mut self,
        owner: &ContractAddress,
        spender: &ContractAddress,
        diff: Difference,
    ) {
        // This fails if the result would be negative
        self.allowances
            .at_mut(owner)
            .at_mut(spender)
            .strict_inc(diff);

        log_approval_event(owner, spender, diff);
    }

    fn _adjust_total_supply(&mut self, diff: Difference) {
        self.total_supply.strict_inc(diff);
    }

    fn _total_supply(&self) -> Amount {
        self.total_supply.try_get().unwrap_or(0) as Amount
    }
}
```

Every balance and allowance mutation goes through `strict_inc`. No method reads a value, computes a new absolute value, and writes it back. That read-modify-write pattern would create conflicts between concurrent transactions. `strict_inc` expresses intent ("add 50" or "subtract 30") as a delta; it may read the snapshot for early underflow detection, but it does not write an absolute final value.

Map access uses `.at(key)` for reads and `.at_mut(key)` for writes. These return borrow guards that deref to the inner storage type. Nested maps chain naturally: `self.allowances.at_mut(owner).at_mut(spender)` walks through `Map<owner, Map<spender, NNInt>>` and returns a mutable reference to the inner `NNInt`.

## Step 4: Implement the Interface

The implementation uses a few utility functions not shown here:

- **`get_caller()`** returns the `ContractAddress` of the caller (the account or contract that invoked this method).
- **`log_transfer_event(from, to, amount)`** and **`log_approval_event(owner, spender, diff)`** emit events. Events are recorded in the transaction and visible to off-chain indexers.
- **`CONTRACT_ADDR_ZERO`** is the zero address, used by convention to represent minting (transfer from zero) and burning (transfer to zero).

The `#[contract]` macro on the `impl` block generates the exported entrypoints. Each trait method becomes a callable contract function.

### Initialize

```rust
#[contract(version = "0.1.0")]
impl ERC20 for TokenContract {
    fn initialize(&mut self, contract_owner: &ContractAddress) {
        self._init(contract_owner);
    }
```

The `version` parameter tags this implementation for compatibility tracking. `initialize` runs once at deploy time and sets the contract owner.

### Transfer

```rust
    fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
        let owner = get_caller();

        let diff = amount_to_diff(amount);
        self._adjust_balance(&owner, -diff);
        self._adjust_balance(receiver, diff);

        log_transfer_event(&owner, receiver, amount);
    }
```

Two `strict_inc` calls: one negative (sender), one positive (receiver). Both are delta operations. Two transfers involving different sender/receiver pairs run in parallel with zero conflicts. Two transfers from the same sender run in parallel as long as neither causes underflow. That is the point.

### Transfer From

```rust
    fn transfer_from(
        &mut self,
        owner: &ContractAddress,
        receiver: &ContractAddress,
        amount: Amount,
    ) {
        let spender = get_caller();

        let diff = amount_to_diff(amount);
        self._adjust_allowance(owner, &spender, -diff);
        self._adjust_balance(owner, -diff);
        self._adjust_balance(receiver, diff);

        log_transfer_event(owner, receiver, amount);
    }
```

Three delta operations: reduce the allowance, reduce the owner's balance, increase the receiver's balance. All three are commutative.

### Adjust Allowance

```rust
    fn adjust_allowance(
        &mut self,
        spender: &ContractAddress,
        diff: Difference,
    ) {
        let owner = get_caller();

        self._adjust_allowance(&owner, spender, diff);
    }
```

This takes a signed `diff`, not an absolute value. To grant 100 tokens of spending approval, call `adjust_allowance(spender, 100)`. To revoke 50, call `adjust_allowance(spender, -50)`. The delta approach means concurrent approvals commute.

### Mint and Burn

```rust
    fn mint(&mut self, receiver: &ContractAddress, amount: Amount) {
        let caller = get_caller();
        ensure(
            caller == self._contract_owner(),
            ERC20Error::MustBeContractOwner,
        );

        let diff = amount_to_diff(amount);
        self._adjust_balance(receiver, diff);
        self._adjust_total_supply(diff);

        log_transfer_event(CONTRACT_ADDR_ZERO, receiver, amount);
    }

    fn burn(&mut self, owner: &ContractAddress, amount: Amount) {
        let caller = get_caller();
        ensure(
            caller == self._contract_owner(),
            ERC20Error::MustBeContractOwner,
        );

        let diff = amount_to_diff(amount);
        self._adjust_balance(owner, -diff);
        self._adjust_total_supply(-diff);

        log_transfer_event(owner, CONTRACT_ADDR_ZERO, amount);
    }
```

Only the contract owner can mint or burn. The `ensure()` macro aborts with `ERC20Error::MustBeContractOwner` if the caller doesn't match. See [Error Handling](/reference/error-handling/) for more on the `ensure()` pattern.

Mint logs a transfer event from the zero address. Burn logs a transfer to the zero address. This follows the ERC-20 convention.

### Read Methods

```rust
    fn get_balance_of(&self, owner: &ContractAddress) -> Amount {
        self._balance_amount_of(owner)
    }

    fn get_balance(&self) -> Amount {
        let owner = get_caller();
        self._balance_amount_of(&owner)
    }

    fn allowance(
        &self,
        owner: &ContractAddress,
        spender: &ContractAddress,
    ) -> Amount {
        self._allowance(owner, spender)
    }

    fn total_supply(&self) -> Amount {
        self._total_supply()
    }
}
```

Read methods take `&self` (not `&mut self`) and read from the current snapshot. They don't conflict with writes.

## Step 5: Test It

The ERC-20 example uses a shared test suite so that the same tests run against both native and WASM execution. A basic test:

```rust
use erc20::{register_mock_contract, ERC20Client};
use sdk::*;

static NONCE: SHA256Hash = sdk::sha256_static!("ERC20_NONCE");

#[test]
fn test_transfer() {
    let env = TestEnvironment::no_cost();
    let test_contract = register_mock_contract(&env);
    let contract_hash = test_contract.as_hash().clone();

    contract_exec(env, move || {
        let addr = deploy_contract(&NONCE, &contract_hash);
        let client = ERC20Client::new(&addr);
        let owner = get_caller();
        let receiver = ContractAddress::named("bob");

        client.initialize(&owner);
        client.mint(&owner, 1000);
        client.transfer(&receiver, 100);

        assert_eq!(client.get_balance_of(&owner), 900);
        assert_eq!(client.get_balance_of(&receiver), 100);
    })
    .unwrap_or_else(|e| panic!("Test failed: {e:?}"));
}
```

`TestEnvironment::no_cost()` creates a test environment with no storage cost enforcement. `register_mock_contract` registers the contract with the test environment (generated by `declare_mock_contract!()` in your `lib.rs`). The `dev` feature flag (enabled via `[dev-dependencies]`) exposes mocking utilities.

Run tests with:

```bash
cargo test
```

Your `Cargo.toml` needs the `dev` feature for testing:

```toml
[features]
dev = ["sdk/dev", "groundhog-erc20-if/dev"]

[dev-dependencies]
erc20 = { path = ".", features = ["dev"] }
```

## Why This Matters

Every balance mutation in this contract uses `strict_inc`, which records a delta rather than an absolute value. Deltas commute: two transfers that debit the same account produce the same result regardless of execution order, as long as neither causes underflow. This means the runtime can execute thousands of token transfers in parallel within a single block. This is how Groundhog achieves high throughput for real token workloads.

## Next Steps

- [Build a Swap](/tutorials/build-a-swap/) to see cross-contract calls in action
- [Execution Model](/programming-model/execution/) for the full snapshot/delta/merge pipeline
- [Storage Types](/programming-model/storage-types/) for `NNInt`, `Map`, `Vector`, `Value`, `Bytestring`, and `RetrocausalQueue`
- [NNInt In Depth](/programming-model/nnint/) for the `set_add` primitive and commutativity rules
- [Error Handling](/reference/error-handling/) for the `ensure()` pattern
