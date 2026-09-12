---
title: Build a Token
description: Build an ERC-20-compatible token with the Groundhog SDK and standard interface crate.
---

This tutorial builds an ERC-20-compatible token with transfers, allowances, minting, burning, and standard events. Balances, allowances, and total supply use `Balance`, the SDK's nonnegative, zero-defaulting interface over Groundhog's mergeable integer storage. Its [deltas can merge](/programming-model/execution/#merged-deltas) across concurrent transfers.

**Prerequisites:** Complete [Build a Counter](/tutorials/build-a-counter/) first.

:::note[Version checked]
This tutorial starts from CLI `0.14.0`, whose generated project uses SDK `0.29.0`. The matching standard interface crate is `groundhog-erc20-if` `0.1.21`.
:::

## 1. Create the Project

Start from the minimal CLI template:

```bash
groundhog new erc20 --template stub
cd erc20
```

The generated RV32 wrapper and Groundhog profiles can remain unchanged. This tutorial replaces the library implementation and native test. The generated RV32 test only deploys the artifact, so it keeps passing; remove it if you would rather not carry it:

```bash
rm tests/test_rv32.rs
```

Now make two edits to the generated `Cargo.toml`. Extend the `dev` feature so it forwards to the interface crate:

```toml
[features]
dev = ["sdk/dev", "groundhog-erc20-if/dev"]
```

and add the interface crate. The generated manifest declares `sdk` twice, once
per target, because it needs `std` on the host and forbids it on the guest.
`groundhog-erc20-if` needs no such split, so add it as a plain dependency
rather than editing either `[target.'cfg(...)']` block:

```toml
[dependencies]
groundhog-erc20-if = { version = "=0.1.21", registry = "groundhog" }
```

Leave the rest of the generated manifest alone. In particular keep the
`groundhog-integration-test` feature and the `[target.'cfg(not(target_arch = "riscv32"))'.dependencies]`
block: `tests/integration.rs` is gated on them, and removing them makes
`groundhog test --integration` fail with cargo's "package does not have the feature".

The interface crate is the source of truth for:

- `ERC20` and `ERC20Client`
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

pub use groundhog_erc20_if::{ERC20, ERC20Client};
pub use implementation::TokenContract;
```

`declare_mock_contract!()` generates `register_mock_contract` for native tests. The standard interface remains in its own crate rather than being copied into this project.

## 3. Define Storage

Replace `src/implementation.rs` with these imports and storage types:

```rust
use groundhog_erc20_if::*;
use sdk::storage::{Balance, Map, Value};
use sdk::*;

type Allowance = Balance;

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
    total_supply: Balance,
}
```

The fields have distinct jobs:

| Field | Purpose |
|-------|---------|
| `config` | Stores the administrator that can mint and burn. |
| `balances` | Maps each account to a zero-defaulting `Balance`. |
| `allowances` | Maps owner and spender pairs to `Balance` values. |
| `total_supply` | Tracks all outstanding tokens in a `Balance`. |

[`Value<Config>` and `Map`](/programming-model/storage-types/) provide typed storage and key-derived paths. `Balance` accepts nonnegative `u128` amounts and exposes increase and decrease operations instead of signed arithmetic or an absolute `set`.

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
        self.balances.at(owner).get()
    }

    fn lazy_increase_balance(
        &mut self,
        owner: &ContractAddress,
        amount: Amount,
    ) {
        self.balances
            .at_mut(owner)
            .try_lazy_increase(amount)
            .unwrap_or_else(|_| throw(ERC20Error::TooLarge));
    }

    fn decrease_balance(&mut self, owner: &ContractAddress, amount: Amount) {
        self.balances
            .at_mut(owner)
            .try_decrease(amount)
            .unwrap_or_else(|_| throw(ERC20Error::TooLarge));
    }

    fn allowance_of(
        &self,
        owner: &ContractAddress,
        spender: &ContractAddress,
    ) -> Amount {
        self.allowances.at(owner).at(spender).get()
    }

    fn adjust_allowance_by(
        &mut self,
        owner: &ContractAddress,
        spender: &ContractAddress,
        diff: Difference,
    ) {
        let mut owner_allowances = self.allowances.at_mut(owner);
        let mut allowance = owner_allowances.at_mut(spender);
        let result = if diff >= 0 {
            allowance.try_increase(diff as u128)
        } else {
            allowance.try_decrease(diff.unsigned_abs())
        };
        result.unwrap_or_else(|_| throw(ERC20Error::TooLarge));

        log_approval_event(owner, spender, diff);
    }

    fn increase_total_supply(&mut self, amount: Amount) {
        self.total_supply
            .try_increase(amount)
            .unwrap_or_else(|_| throw(ERC20Error::TooLarge));
    }

    fn decrease_total_supply(&mut self, amount: Amount) {
        self.total_supply
            .try_decrease(amount)
            .unwrap_or_else(|_| throw(ERC20Error::TooLarge));
    }

    fn supply(&self) -> Amount {
        self.total_supply.get()
    }
}
```

Three details matter:

1. A missing `Balance` reads as zero, so balance, allowance, and supply getters do not need missing-storage handling.
2. The standard interface requires overdrafts and overflows to surface as `ERC20Error::TooLarge`. The `try_` methods let the helpers translate SDK library failures into that domain error.
3. Both checked and lazy operations record mergeable deltas. Checked `decrease` loads the sender so insufficient funds fail during contract execution. `lazy_increase` skips the receiver load and leaves its bound check to delta reservation after the contract returns.

:::note[Checked and lazy failures happen at different points]
Suppose a sender's snapshot balance is 10. `try_decrease(11)` returns `Err` while the contract is running, so `decrease_balance` can translate it into `ERC20Error::TooLarge`.

Now suppose a receiver's snapshot balance is `Balance::MAX`, with no offsetting debit in the proposed block. `try_lazy_increase(1)` returns `Ok(())` inside the contract because it does not load that snapshot balance. After the contract returns, the completed delta batch cannot satisfy the balance bound, so the transaction is excluded and returned to the mempool.

The distinction is when the snapshot-bound result becomes known. Both checked and lazy calls still produce deltas that can merge with compatible transactions. A lazy call can still reject an amount that cannot be represented or accumulated within the transaction.
:::

## 5. Implement the Interface

Add the implementation below the helpers:

```rust
#[contract(version = "0.1.5")]
impl ERC20 for TokenContract {
    fn initialize(&mut self, administrator: &ContractAddress) {
        self.init(administrator);
    }

    fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
        let owner = get_caller();

        self.decrease_balance(&owner, amount);
        self.lazy_increase_balance(receiver, amount);
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
        self.decrease_balance(owner, amount);
        self.lazy_increase_balance(receiver, amount);
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

        // Establish the checked supply bound first. Once it holds, the lazy
        // receiver increase cannot overflow an individual balance.
        self.increase_total_supply(amount);
        self.lazy_increase_balance(receiver, amount);
        log_transfer_event(CONTRACT_ADDR_ZERO, receiver, amount);
    }

    fn burn(&mut self, owner: &ContractAddress, amount: Amount) {
        ensure(
            get_caller() == self.administrator(),
            ERC20Error::MustBeContractOwner,
        );

        self.decrease_balance(owner, amount);
        self.decrease_total_supply(amount);
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

`Balance` records increases and decreases as changes rather than replacing the stored value with a newly calculated result. The transfer path checks the sender with `decrease` and credits the receiver with `lazy_increase`. Allowance adjustments use checked operations in both directions so the interface can report failures immediately.

This is the [merged-delta model](/programming-model/execution/#merged-deltas): the runtime combines changes from concurrent transfers when they can all be applied safely. Changes to different balances or allowances do not conflict. Credits to the same balance can combine, and debits from the same balance or allowance can combine as long as their total does not exceed the available value. If the total is too large, the runtime excludes one or more transactions and returns them to the mempool.

## Next Steps

- [Design a Swap](/tutorials/design-a-swap/) for an application built from cross-contract token calls
- [Add Events to a Contract](/tutorials/add-events-to-a-contract/) for event testing and queries
- [Merged Deltas](/programming-model/execution/#merged-deltas) for the snapshot, execution, and exclusion model behind this contract
- [Storage Types](/programming-model/storage-types/) for checked and lazy `Balance` operations and other state choices
- [NNInt In Depth](/programming-model/nnint/) for the lower-level `set_add` representation behind `Balance`
- [How Conflicts Are Resolved](/how-it-works/execution-model/#how-conflicts-are-resolved) for the engine's concurrent reservation machinery
- [Error Handling](/reference/error-handling/) for domain and library exception behavior
