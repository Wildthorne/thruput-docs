---
title: Build a Token
description: Build an ERC-20-compatible token with the Groundhog SDK and standard interface crate.
---

This tutorial builds an ERC-20-compatible token with transfers, allowances, minting, burning, and standard events. Balances and allowances use [`NNInt`](/programming-model/storage-types/#nnint), which records deltas such as `+100` and `-100`. Those [deltas can merge](/programming-model/execution/#merged-deltas) across concurrent transfers.

**Prerequisites:** Complete [Build a Counter](/tutorials/build-a-counter/) first.

:::note[Version checked]
This tutorial was compiled and tested against Groundhog CLI `0.5.17` and the SDK `0.17.1` source checkout on July 13, 2026.
:::

## 1. Create the Project

Start from the minimal CLI template:

```bash
groundhog new erc20 --template stub
cd erc20
```

The generated RV32 wrapper and Groundhog profiles can remain unchanged. This tutorial replaces the library implementation and native test. Remove the stub artifact tests because they refer to the generated `StubClient`:

```bash
rm tests/test_rv32.rs tests/test_wasm.rs
```

Add the standard interface dependency and extend the generated `dev` feature in `Cargo.toml`. Replace `/path/to/sdk_rs` with one SDK source checkout so both crates resolve from the same release:

```toml
[features]
entrypoints = []
rv32-entrypoints = ["entrypoints"]
default = ["dev"]
dev = ["sdk/dev", "groundhog-erc20-if/dev"]

[dependencies]
sdk = { path = "/path/to/sdk_rs/crates/sdk" }
groundhog-erc20-if = { path = "/path/to/sdk_rs/standard-interfaces/groundhog-erc20" }

[dev-dependencies]
erc20 = { path = ".", features = ["dev"] }
```

:::caution[Published interface compatibility]
The published `groundhog-erc20-if@0.1.4` still depends on SDK `0.15.5` and cannot share a native test graph with SDK `0.17.1`. Use the two path dependencies above until a standard-interface package aligned with SDK `0.17.1` is published.
:::

The interface crate is the source of truth for:

- `ERC20`, `ERC20Client`, and generated client errors
- `Amount = u128` and `Difference = i128`
- `ERC20Error`
- `TransferEvent`, `ApprovalEvent`, and their logging helpers
- The zero-address constant used for mint and burn events

Its `#[contract]` declaration includes `throws = ERC20Error` and `emits(TransferEvent, ApprovalEvent)`, so implementations and generated clients share the same wire contract.

## 2. Wire the Library

Replace `src/lib.rs`:

```rust
#![cfg_attr(not(feature = "dev"), no_std)]

sdk::declare_mock_contract!();

mod implementation;

pub use groundhog_erc20_if::{ERC20, ERC20Client, ERC20ClientError};
pub use implementation::TokenContract;
```

`declare_mock_contract!()` generates `register_mock_contract` for native tests. The standard interface remains in its own crate rather than being copied into this project.

## 3. Define Storage

Replace `src/implementation.rs` with these imports and storage types:

```rust
use groundhog_erc20_if::*;
use sdk::storage::{Map, NNInt, Value};
use sdk::*;

type Balance = NNInt;
type Allowance = NNInt;

#[contract_type]
#[cfg_attr(feature = "dev", derive(Debug))]
pub struct Config {
    pub administrator: ContractAddress,
}

#[sdk::storage]
#[cfg_attr(feature = "dev", derive(Debug))]
pub struct TokenContract {
    config: Value<Config>,
    balances: Map<ContractAddress, Balance>,
    allowances: Map<ContractAddress, Map<ContractAddress, Allowance>>,
    total_supply: NNInt,
}
```

The fields have distinct jobs:

| Field | Purpose |
|-------|---------|
| `config` | Stores the administrator that can mint and burn. |
| `balances` | Maps each account to an `NNInt` token balance. |
| `allowances` | Maps owner and spender pairs to `NNInt` allowances. |
| `total_supply` | Tracks all outstanding tokens. |

[`Value<Config>` and `Map`](/programming-model/storage-types/) provide typed storage and key-derived paths. `NNInt` stores integer changes in a form that concurrent transactions can combine while preventing ordinary balances and allowances from falling below zero.

## 4. Add Storage Helpers

Continue in `src/implementation.rs`:

```rust
impl TokenContract {
    fn init(&mut self, administrator: &ContractAddress) {
        if self.config.try_get().none_if_missing().is_some() {
            throw(ERC20Error::AlreadyInitialized);
        }

        self.config.set(&Config {
            administrator: *administrator,
        });
    }

    fn administrator(&self) -> ContractAddress {
        self.config.get().administrator
    }

    fn balance_of(&self, owner: &ContractAddress) -> Amount {
        self.balances
            .at(owner)
            .try_get()
            .none_if_missing()
            .unwrap_or(0) as Amount
    }

    fn adjust_balance(&mut self, owner: &ContractAddress, diff: Difference) {
        self.balances
            .at_mut(owner)
            .try_strict_inc(diff)
            .unwrap_or_else(|_| throw(ERC20Error::TooLarge));
    }

    fn allowance_of(
        &self,
        owner: &ContractAddress,
        spender: &ContractAddress,
    ) -> Amount {
        self.allowances
            .at(owner)
            .at(spender)
            .try_get()
            .none_if_missing()
            .unwrap_or(0) as Amount
    }

    fn adjust_allowance_by(
        &mut self,
        owner: &ContractAddress,
        spender: &ContractAddress,
        diff: Difference,
    ) {
        self.allowances
            .at_mut(owner)
            .at_mut(spender)
            .try_strict_inc(diff)
            .unwrap_or_else(|_| throw(ERC20Error::TooLarge));

        log_approval_event(owner, spender, diff);
    }

    fn adjust_total_supply(&mut self, diff: Difference) {
        self.total_supply.strict_inc(diff);
    }

    fn supply(&self) -> Amount {
        self.total_supply
            .try_get()
            .none_if_missing()
            .unwrap_or(0) as Amount
    }
}
```

Three details matter:

1. `try_get()` returns `Result<_, LibraryExn>`, not `Option`. `none_if_missing()` converts only missing storage into `None`; it preserves type, serialization, and host errors.
2. The standard interface requires overdrafts to surface as `ERC20Error::TooLarge`. `try_strict_inc(...).unwrap_or_else(...)` translates the SDK library failure into that domain error.
3. `amount_to_diff` from the interface crate rejects `u128` values that do not fit in the signed `i128` type used for balance changes.

## 5. Implement the Interface

Add the implementation below the helpers:

```rust
#[contract(version = "0.1.2")]
impl ERC20 for TokenContract {
    fn initialize(&mut self, administrator: &ContractAddress) {
        self.init(administrator);
    }

    fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
        let owner = get_caller();
        let diff = amount_to_diff(amount);

        self.adjust_balance(&owner, -diff);
        self.adjust_balance(receiver, diff);
        log_transfer_event(&owner, receiver, amount);
    }

    fn transfer_from(
        &mut self,
        owner: &ContractAddress,
        receiver: &ContractAddress,
        amount: Amount,
    ) {
        let spender = get_caller();
        let diff = amount_to_diff(amount);

        self.adjust_allowance_by(owner, &spender, -diff);
        self.adjust_balance(owner, -diff);
        self.adjust_balance(receiver, diff);
        log_transfer_event(owner, receiver, amount);
    }

    fn adjust_allowance(
        &mut self,
        spender: &ContractAddress,
        diff: Difference,
    ) {
        let owner = get_caller();
        self.adjust_allowance_by(&owner, spender, diff);
    }

    fn allowance(
        &self,
        owner: &ContractAddress,
        spender: &ContractAddress,
    ) -> Amount {
        self.allowance_of(owner, spender)
    }

    fn get_balance_of(&self, owner: &ContractAddress) -> Amount {
        self.balance_of(owner)
    }

    fn get_balance(&self) -> Amount {
        self.balance_of(&get_caller())
    }

    fn mint(&mut self, receiver: &ContractAddress, amount: Amount) {
        ensure(
            get_caller() == self.administrator(),
            ERC20Error::MustBeContractOwner,
        );

        let diff = amount_to_diff(amount);
        self.adjust_balance(receiver, diff);
        self.adjust_total_supply(diff);
        log_transfer_event(CONTRACT_ADDR_ZERO, receiver, amount);
    }

    fn burn(&mut self, owner: &ContractAddress, amount: Amount) {
        ensure(
            get_caller() == self.administrator(),
            ERC20Error::MustBeContractOwner,
        );

        let diff = amount_to_diff(amount);
        self.adjust_balance(owner, -diff);
        self.adjust_total_supply(-diff);
        log_transfer_event(owner, CONTRACT_ADDR_ZERO, amount);
    }

    fn total_supply(&self) -> Amount {
        self.supply()
    }
}
```

Deployment does not call `initialize` automatically. Call it once afterward. The stored config enforces one-time initialization.

Mint and burn are restricted to the administrator. Transfers use the immediate caller as the owner. `transfer_from` uses the immediate caller as the spender and decreases both allowance and owner balance.

## 6. Test the Contract

Replace `tests/test.rs`:

```rust
use erc20::{register_mock_contract, ERC20Client};
use sdk::*;

static NONCE: SHA256Hash = sdk::sha256_static!("ERC20_TUTORIAL_NONCE");

#[test]
fn transfer_updates_balances_and_supply() {
    let env = TestEnvironment::no_cost();
    let test_contract = register_mock_contract(&env);
    let contract_hash = test_contract.as_hash().clone();

    let alice = ContractAddress::named("alice");
    let bob = ContractAddress::named("bob");

    env.transact(|tx| {
        tx.call(&alice).run(move || {
            let address = deploy_contract(&NONCE, &contract_hash);
            let token = ERC20Client::new(&address);
            let owner = get_current_address();

            token.initialize(&owner);
            token.mint(&owner, 1_000);
            token.transfer(&bob, 100);

            assert_eq!(token.get_balance_of(&owner), 900);
            assert_eq!(token.get_balance_of(&bob), 100);
            assert_eq!(token.total_supply(), 1_000);
        })
    })
    .assert_success();
}
```

Run the native test and build the deployable artifact:

```bash
cargo test
groundhog build
```

The RV32 build produces `erc20.rv32a`, lowering metadata, and contract-spec sidecars under `target/groundhog/`.

In the native test's root transaction, `get_current_address()` is Alice's root address. `get_caller()` is meaningful inside the nested token invocation.

## Concurrency Semantics

Balance and allowance updates use `strict_inc` to record a change, such as `+100` or `-100`, rather than replacing the stored value with a newly calculated result.

This is the [merged-delta model](/programming-model/execution/#merged-deltas): the runtime combines changes from concurrent transfers when they can all be applied safely. Changes to different balances or allowances do not conflict. Credits to the same balance can combine, and debits from the same balance or allowance can combine as long as their total does not exceed the available value. If the total is too large, the runtime excludes one or more transactions and returns them to the mempool.

## Next Steps

- [Understand a Swap Contract](/tutorials/build-a-swap/) for a source walkthrough of cross-contract token calls
- [Add Events to a Contract](/tutorials/add-events-to-a-contract/) for event testing and queries
- [NNInt In Depth](/programming-model/nnint/) for how NNInt combines concurrent changes
- [Error Handling](/reference/error-handling/) for domain and library exception behavior
