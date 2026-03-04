---
title: SDK Macros
description: "Reference for #[contract], #[storage], and #[init] macros."
---

## `#[contract]`

Generates C ABI exports (for WASM guest execution) and client stubs (for cross-contract calls).

**Applies to:** trait implementations, inherent implementations, or free functions.

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `throws = ErrorType` | No | Your error type. Enables `abort(&error)` and `ensure()` with that type. |
| `client = ClientName` | No | Generates a client struct for cross-contract calls. |
| `storage = "false"` | No | Disables automatic storage serialization. Use for low-level bytestring storage. Default is `"true"`. |
| `exports = "mod_name"` | No | Rename the generated exports module. Default is `exports`. |

### Example: Trait Implementation

```rust
#[contract(throws = ERC20Error)]
impl ERC20 for TokenContract {
    #[init]
    fn initialize(&mut self, contract_owner: &ContractAddress) {
        self._init(contract_owner);
    }

    fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
        let owner = get_caller();
        let diff = amount_to_diff(amount);
        self._adjust_balance(&owner, -diff);
        self._adjust_balance(receiver, diff);
    }

    fn get_balance(&self) -> Amount {
        let owner = get_caller();
        self._balance_amount_of(&owner)
    }
}
```

### Example: Trait Definition with Client

```rust
#[contract(client = ERC20Client, throws = ERC20Error)]
pub trait ERC20 {
    fn transfer(&mut self, receiver: &ContractAddress, amount: Amount);
    fn get_balance(&self) -> Amount;
    // ...
}
```

### Method Behavior

- `&mut self` methods persist state changes after the method completes.
- `&self` methods are read-only. State is not written back.
- Public methods are exported as WASM entry points. Private methods are not.

## `#[storage]` / `#[sdk::storage]`

Marks a struct as contract state. Derives `WriteXDR` and `Storage`, which in turn generates implementations of `ReadXDRPath`, `LoadKeypath`, and `DefaultFromKeypath`. Fields are automatically persisted to and loaded from the key-value store.

### Example

```rust
#[derive(Debug)]
#[sdk::storage]
pub struct TokenContract {
    contract_owner: ContractAddress,
    balances: Map<ContractAddress, NNInt>,
    allowances: Map<ContractAddress, Map<ContractAddress, NNInt>>,
    total_supply: NNInt,
}
```

Each field maps to a storage key path. `Map` fields create nested key-value namespaces. Operations on different keys within a `Map` commute.

## `#[init]`

Marks the initialization method. Called once at deploy time. When called, the SDK asserts that no contract state has been stored yet, and provides a default value for the state object.

Must be placed on a method inside a `#[contract]` block.

### Example

```rust
#[contract(throws = ERC20Error)]
impl ERC20 for TokenContract {
    #[init]
    fn initialize(&mut self, contract_owner: &ContractAddress) {
        self._init(contract_owner);
    }

    // other methods...
}
```

If the `#[init]` method takes `&mut self`, the initialized state is stored after the method completes. This is the standard pattern: initialize state in the `#[init]` method, then interact with it through other methods.

For a working example of all three macros together, see the counter contract in [Getting Started](/start/getting-started/) or the full ERC-20 walkthrough in [Build a Token](/tutorials/build-a-token/).
