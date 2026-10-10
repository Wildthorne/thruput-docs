---
title: EVM & Solidity
description: Translate Solidity contract patterns into Stellar Thruput storage, calls, and authorization.
---

The contract lifecycle remains write, test, deploy, and call. The main differences are typed storage updates, the call runtime, and resource accounting. This page compares those mechanisms, not network performance.

## The Contract Lifecycle

<span id="writing"></span>
<span id="compiling"></span>
<span id="deploying"></span>
<span id="calling"></span>
<span id="reading-state"></span>

| Task | Stellar Thruput path |
| --- | --- |
| Write | Rust with SDK storage handles and contract macros |
| Compile | `thruput build` produces an RV32 artifact and contract-spec sidecars |
| Deploy | Fund the new contract's storage and deploy with the CLI or wallet client |
| Initialize | Call an ordinary method, optionally atomically through `deploy --init` |
| Call | Use generated Rust or TypeScript bindings |
| Read | Use a typed view through the public client or `thruput view` |

Stellar Thruput entrypoints use 8-byte IDs and CXS arguments. Ethereum contract calls commonly use a 4-byte selector and ABI arguments; see [Ethereum transactions](https://ethereum.org/en/developers/docs/transactions/). Use bindings rather than constructing either encoding manually.

Stellar Thruput deployment addresses derive from the deployer, nonce, and code hash. This resembles `CREATE2` in allowing address prediction, but uses a different preimage. See [Contract artifacts and addresses](/how-it-works/contracts/).

## Mental Model Shifts

| Solidity / EVM pattern | Stellar Thruput pattern |
| --- | --- |
| Mapping of token balances | `Map<ContractAddress, Balance>` |
| Read-modify-write balance assignment | Checked or lazy relative balance changes |
| `require` or `revert` | `ensure` or a typed contract exception |
| `msg.sender` | `get_caller()`, the immediate caller |
| Constructor | An ordinary initializer with a contract-defined guard |
| Solidity interface and ABI | Shared Rust interface and generated contract spec |
| `view` / `pure` | Rust receiver choice does not enforce runtime read-only behavior; use the call's read-only restriction |

## Execution Differences

### Reentrancy

An EVM external call can call back into a contract already on the stack; see [Solidity external calls](https://docs.soliditylang.org/en/latest/control-structures.html#external-function-calls).

Stellar Thruput rejects invocation of a contract already on the call stack. For A → B → A, the last call is rejected as reentrant. This runtime check is separate from snapshot isolation. Reads within a transaction can still observe its own earlier changes and successful child calls.

Use [recoverable calls](/contracts/cross-contract-calls/#error-handling) when the parent should inspect a child failure rather than propagate it.

### Ordering and MEV

Compatible arithmetic changes have the same merged value regardless of execution order. Conflicting operations do not all land together, and the proposer still selects transactions and conflict winners. This is not a guarantee that every application is free from ordering-dependent outcomes or MEV.

### Gas Limits and Gas Price Estimation

Ethereum transactions specify gas limits and fee parameters. Stellar Thruput gas meters execution but costs zero tokens, so no gas price estimation is needed. Gas usage still matters: the declared root limit consumes scheduling capacity, and exceeding it faults execution.

Unlocked native-token balances provide capacity; stored data requires separate deposits. See [Compute, Capacity & Storage](/how-it-works/storage-economics/).

### Nonce Management

Ethereum account transactions use a sequential nonce. Stellar Thruput replay protection uses an expiry-height and nonce pair, unique for the originating address. It need not increase sequentially. That permits independent transactions from one address without a sequential account counter.

### Integer Overflow/Underflow

`Balance` accepts nonnegative amounts. Its checked methods reject underflow or overflow during execution; lazy methods defer snapshot-bound checks to reservation. The runtime also enforces aggregate bounds across concurrent transactions.

### The `approve()` Race Condition

An absolute allowance replacement can grant new spending authority after the previous allowance has already been spent. The example Stellar Thruput token instead uses relative allowance adjustments. The caller requests an increase or decrease, not a replacement amount.

This does not remove the need to inspect outcomes or choose an authorization policy. See the [token implementation](/tutorials/build-a-token/#apply-supply-and-allowance-policy) for its exact allowance methods and exclusive-update option.

## Pattern Adaptations

### Balance Transfer

In a token implementation, use balance deltas:

```rust
fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    let sender = get_caller();
    self.balances.at_mut(&sender).decrease(amount);
    self.balances.at_mut(receiver).lazy_increase(amount);
}
```

Here, `balances` is `Map<ContractAddress, Balance>`. The checked debit detects insufficient funds during execution. The lazy credit skips a balance load and defers its bound check. Other changes and resource limits still determine whether complete transactions can land together.

### Access Control

Store an owner or role policy and check it before changing state:

```rust
ensure(get_caller() == self.owner.get(), Error::NotOwner);
```

Define `Error` with `#[contract_exception]`. A forwarding contract becomes the immediate caller; it does not inherit the original user's identity. See [Authorization](/how-it-works/authorization/).

### Constructor and Initialization

Stellar Thruput does not invoke `initialize` automatically or make it once-only. Guard initialization in contract storage when required. The CLI's [atomic initialization](/cli/deploy-and-call/#include-initialization) combines funding, deployment, and the initializer call.

### Events

Define events with `#[derive(Event)]`, mark filterable fields with `#[topic]`, and declare emitted types on the contract interface. See [Events](/contracts/events/) for the complete pattern and [Read events](/typescript/events/) for application queries.

<span id="erc-20-side-by-side"></span>

[Build a token](/tutorials/build-a-token/) walks through the maintained ERC-20 implementation, including allowances, supply policy, events, and tests.

## What Doesn't Exist

| EVM feature | Stellar Thruput approach |
| --- | --- |
| `msg.value` | Transfer tokens explicitly through their contract interface |
| `delegatecall` and proxy code replacement | Deploy a new immutable contract at a new address |
| `selfdestruct` | No equivalent contract-removal operation |
| Solidity `receive` / `fallback` dispatch | Use declared methods in the generated SDK dispatcher |
| Storage-slot packing | Use typed storage paths |

Block context and gas inspection do exist: `get_block_timepoint()`, `get_block_height()`, and `stats::gas_remaining()`. Artifact and transaction bounds are network constraints, not EVM limits; see [Contract artifacts](/how-it-works/contracts/).

## Next Steps

- [Contract quickstart](/get-started/contract/): build and deploy a counter
- [Build a token](/tutorials/build-a-token/): maintained token code and tests
- [Contract Execution](/programming-model/execution/): snapshots and deltas
- [Storage Types](/programming-model/storage-types/): choose a storage API
