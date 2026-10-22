---
title: Solana & Anchor
description: Translate Solana account, storage, and CPI patterns into Project Thruput contracts.
---

Both ecosystems support Rust contract development. Project Thruput changes how a contract addresses state and how concurrent writes combine. The comparison below follows Solana's [account model](https://solana.com/docs/core/accounts) and [CPI rules](https://solana.com/docs/core/cpi).

## Accounts vs. Storage

Solana state lives in accounts with an address, owner, lamport balance, and data. Instructions receive declared accounts; Anchor expresses their expected types and constraints.

Project Thruput stores typed fields under contract addresses. For example, a token implementation uses `Map<ContractAddress, Balance>` rather than receiving separate token-account objects for each balance. Contract code still checks caller authority and application rules.

## Access Lists vs. Type-Based Parallelism

Solana transactions declare account access before execution. The runtime uses read/write access to schedule work; transactions that contend for a writable account cannot execute together in that schedule.

Project Thruput discovers storage access during execution. Typed merge rules allow compatible changes to the same location to combine. Different map keys use separate locations, but other shared writes and storage-funding limits can still conflict.

## The Contract Lifecycle

### Writing

| Anchor concept | Project Thruput SDK concept |
| --- | --- |
| `#[program]` | `#[contract]` on an interface or implementation |
| Account-data structure | Typed fields under `#[thruput_sdk::storage]` |
| `#[derive(Accounts)]` constraints | Explicit argument and authorization checks; no caller-supplied account array |
| Initialization instruction | Ordinary initializer, optionally called atomically with deployment |

### Compiling

Solana programs compile to SBF. Project Thruput contracts compile to RV32 through:

```bash
thruput build
```

The build produces a deployable artifact and contract spec. Keep the generated toolchain and dependencies together.

### Deploying

Project Thruput deployment derives an address from the deployer, nonce, and code hash. This shares a PDA's predictability, not its derivation or authorization model. See [Contract artifacts and addresses](/how-it-works/contracts/).

### Calling

Use a generated client for another contract:

```rust
let token = ERC20Client::new(&token_address);
token.transfer(&recipient, amount);
```

The receiver sees the calling contract as its immediate caller. [Cross-Contract Calls](/contracts/cross-contract-calls/) covers gas limits and recoverable errors.

## Mental Model Shifts

| Solana / Anchor pattern | Project Thruput pattern |
| --- | --- |
| Per-user state account | Often a `Map` entry under the contract |
| Serialized account data | Typed storage handles |
| Account-level write conflicts | Storage-type merge rules, including compatible shared-key deltas |
| Rent-exempt storage balance | Storage deposit backed by native tokens |
| Compute-unit budget | Gas limit, with no token fee for gas |
| Signer privileges passed through CPI | Immediate caller identity and explicit runtime auth tokens |

## Account and Call Patterns

### Account Arrays and Validation

Project Thruput has no caller-supplied account array. That removes account-list construction, not authorization. Validate caller identities, contract addresses, amounts, and application conditions before applying changes.

### Rent and Account Lifecycle

Solana accounts hold a refundable minimum lamport balance for their storage. Project Thruput storage also requires funding: it locks native tokens according to the data's type and size, and releases the deposit when data is deleted. The runtime accounts for it, but the owning address must have enough funds.

### Compute Unit Budgets

Project Thruput gas limits bound computation, including child calls. Gas costs zero tokens, but a root transaction's declared limit consumes scheduling capacity. Account funding and execution bounds still matter. See [Compute, Capacity & Storage](/how-it-works/storage-economics/).

### PDA Seed Management

A PDA used only for per-user state often maps to a `Map` entry. A PDA used as an authority needs an authorization design as well; replacing its storage with a map does not reproduce its signing role.

### Signer Propagation in CPIs

Solana CPI passes existing signer and writable privileges to the callee. `invoke_signed` additionally supplies seeds when the calling program must authorize a PDA. Ordinary CPI does not always require signer seeds.

Project Thruput's `get_caller()` returns the immediate calling contract, not the root signer. Use contract policy, allowances, or [typed auth tokens](/how-it-works/authorization/#auth-tokens-and-signedt) when authority must pass through several calls.

## Pattern Adaptations

### PDA State Accounts → Map Fields

```rust
#[thruput_sdk::storage]
pub struct Registry {
    user_states: Map<ContractAddress, Value<UserState>>,
}
```

`UserState` is your serializable application type. Access an entry with `at` or `at_mut`; first writes create storage and require its deposit. See [Storage Types](/programming-model/storage-types/).

### Token Transfer

Inside a token implementation:

```rust
fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    let caller = get_caller();
    self.balances.at_mut(&caller).decrease(amount);
    self.balances.at_mut(receiver).lazy_increase(amount);
}
```

This updates the token's own balance map. To transfer another contract's token, call its generated client rather than writing its storage directly.

### Cross-Program Invocation → Cross-Contract Call

```rust
let token = ERC20Client::new(&token_address);
let result = token.try_mint(&recipient, amount);
```

The callee applies its own authorization policy. `try_mint` returns a `Result`; the direct `mint` method propagates failure. See [Handle errors](/contracts/errors/).

### Error Handling

Define errors with `#[contract_exception]` and check conditions with `ensure`:

```rust
ensure(get_caller() == self.owner.get(), Error::NotOwner);
```

Unlike signer-account validation, this checks the immediate contract caller. A failure aborts the frame and discards its contract effects.

## What Doesn't Exist

Project Thruput does not use Solana account arrays, associated token accounts, PDA bump seeds, or account `space`/`realloc` arguments. It has its own contract-address, storage, and authorization models. These are pattern translations, not wire or tooling compatibility.

## Next Steps

- [Contract quickstart](/get-started/contract/): build and deploy a counter
- [Build a token](/guides/build-a-token/): token state and tests
- [Storage Types](/programming-model/storage-types/): map and balance APIs
- [Authorization](/how-it-works/authorization/): caller and auth-token rules
