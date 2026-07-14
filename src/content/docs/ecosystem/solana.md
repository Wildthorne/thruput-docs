---
title: Solana & Anchor
description: Groundhog concepts for Solana and Anchor developers.
---

This guide is for developers who know Solana and Anchor. It uses familiar Solana concepts to explain how Groundhog works, what changes, and what you stop worrying about.

For the foundational concepts (delta operations, commutativity, storage types), see [For Blockchain Developers](/start/for-blockchain-developers/). This page builds on that with Solana-specific patterns.

## Accounts vs. Storage

This is the biggest mental model shift. On Solana, state lives in accounts. Each account is a separate object with its own address, lamport balance, owner program, and serialized data. Your program receives an array of accounts, validates them, deserializes them, operates on them, and serializes them back. Anchor's `#[derive(Accounts)]` automates the validation, but the account array is always there.

Groundhog has no account model. State lives inside the contract as typed storage fields. A token contract doesn't receive "the sender's balance account" and "the receiver's balance account" as separate objects. It has a `Map<Address, NNInt>` field called `balances`, and it reads and writes entries in that map.

**Solana (Anchor):**

```rust
#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
}
```

**Groundhog:**

```rust
#[sdk::storage]
pub struct Token {
    balances: Map<ContractAddress, NNInt>,
}

fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    let caller = get_caller();
    let diff = amount_to_diff(amount);
    self.balances.at_mut(&caller).strict_inc(-diff);
    self.balances.at_mut(receiver).strict_inc(diff);
}
```

No account array. No account validation. No deserialization step. The `Map` is the state, and the method operates on it directly.

## Access Lists vs. Type-Based Parallelism

On Solana, you declare every account a transaction will touch before the transaction runs. The runtime uses this manifest to schedule parallel execution: transactions that don't share writable accounts can run concurrently. This is why you build the account array. It's not just for validation. It's how Solana knows what can parallelize.

On Groundhog, you declare nothing. The storage types themselves determine what parallelizes. `NNInt` operations (increments, decrements) commute by construction. `Map` operations on different keys never interact. The runtime doesn't need a manifest because the types carry the parallelism rules.

This is a fundamental difference. On Solana, parallelism comes from the developer correctly declaring access patterns. Get it wrong and your transaction fails or, worse, corrupts state. On Groundhog, parallelism comes from the types. You pick `NNInt` for a balance, and concurrent transfers automatically parallelize. You don't think about it.

## The Contract Lifecycle

Both Solana and Groundhog use a two-step deployment (upload code, then create instance), and both compile to a binary format: BPF on Solana, RV32 on Groundhog. RV32 is Groundhog's 32-bit RISC-V contract target. The details differ but the flow is analogous.

### Writing

Solana programs are written in Rust with Anchor (or native). Groundhog contracts are also Rust, with a different SDK. The macro system has a similar role but different surface area:

| Anchor | Groundhog SDK | Purpose |
|--------|---------------|---------|
| `#[program]` | `#[contract]` | Marks the implementation block |
| `#[derive(Accounts)]` | *(not needed)* | Account validation. Groundhog has no account arrays. |
| `#[account]` | `#[sdk::storage]` | Marks state structure |
| `#[instruction]` | Method parameters | Instruction data. Groundhog methods take typed parameters directly. |
| `init` constraint | `fn initialize()` | Conventional method called during the deployment transaction. |

### Compiling

Solana compiles to BPF bytecode (`cargo build-sbf`). Groundhog compiles to RV32, a 32-bit RISC-V target, by default:

```bash
groundhog build
```

### Deploying

On Solana, you upload the program binary, then initialize accounts for it. On Groundhog, you deploy the RV32 artifact and create a contract instance via `DeployContract` with a nonce. The contract address is deterministically derived from the deployer's address, the contract hash, and the nonce. Similar to Solana PDAs in predictability, but simpler: no seeds, no bump bytes.

### Calling

On Solana, a transaction contains instructions, each specifying a program ID, account array, and serialized instruction data. On Groundhog, a transaction specifies a contract address, an entrypoint ID, and XDR-encoded arguments. No account array needed.

The SDK generates typed clients:

```rust
let client = TokenClient::new(&token_addr);
client.transfer(&recipient, 100);
```

## Mental Model Shifts

| Solana / Anchor | Groundhog | Why |
|-----------------|-----------|-----|
| Accounts with serialized data | Typed storage fields (`Map`, `NNInt`) | State lives inside the contract. No external accounts. |
| `#[derive(Accounts)]` validation | Nothing. Types handle it. | No access list to declare or validate. |
| PDAs (seeds + bump) | Deterministic address (deployer + nonce + hash) | Simpler derivation. No seed discovery. |
| Rent exemption (2 years of lamports) | HOG deposit (refundable) | Hold tokens for storage capacity. No rent clock. |
| 200k compute units per TX | Gas limits exist but cost zero | Metering bounds computation. No tokens burned. Hold HOG for throughput capacity. |
| CPI (cross-program invocation) | Cross-contract calls | Same concept, simpler API, snapshot isolation. |
| `Signer<'info>` propagation | `get_caller()` | Caller identity. No signer array to thread through CPIs. |
| `balance -= amount; balance += amount` | `strict_inc(-diff); strict_inc(diff)` | Deltas merge in parallel. Assignments conflict. |
| Account-level write locks | Type-level guarantees | The type (NNInt, Map, Bytestring) enforces correctness; concurrency follows from that. |

## What Disappears

### Account Arrays and Validation

Every Solana transaction starts by building the right account array. Wrong order, missing account, wrong mutability flag: transaction fails. Anchor automates some of this, but you still think in terms of "which accounts does this instruction need?"

Groundhog has no account concept. Your contract method takes typed parameters (an address, an amount) and operates on its own storage. No account discovery, no validation boilerplate, no "account not found" errors.

### Rent and Account Lifecycle

Solana accounts must hold a minimum lamport balance (the rent-exempt minimum, originally calculated against a rent schedule and now required at creation since rent collection was deprecated). This creates friction: every new piece of state costs lamports upfront, and you need to calculate the minimum balance for your account size.

Groundhog uses a capital deposit model for storage. You hold HOG tokens as a deposit while storage is allocated, and the deposit is refundable when storage is freed. No rent clock, no garbage collection, no minimum balance calculations.

### Compute Unit Budgets

Solana transactions have a compute budget that can be raised per transaction via `SetComputeUnitLimit` (with a hard ceiling well below modern Ethereum gas limits). Complex operations require careful optimization. CPI calls are expensive. Developers routinely hit compute limits and restructure logic to stay under budget.

Groundhog has gas limits that meter computation, but gas costs zero tokens. Specify a gas limit to bound execution, but don't optimize for gas cost. There are no priority fees and no fee-related failures.

### PDA Seed Management

PDAs on Solana require choosing seeds, deriving addresses, finding bumps, and storing the bump for future lookups. Seed collisions, missing bumps, and PDA discovery are common sources of bugs.

Groundhog contract addresses are derived from deployer + nonce + contract hash. One derivation, deterministic, no bumps. If your Solana program uses PDAs as state accounts (one per user, one per pool), the Groundhog equivalent is a `Map<Key, Value>` field in your contract storage. The map entries replace the PDAs.

### Signer Propagation in CPIs

On Solana, cross-program invocations require passing signer seeds so the runtime can verify PDA authority. This is fiddly: wrong seeds, wrong program ID, missing signer. Debugging CPI signer failures is a common pain point.

Groundhog cross-contract calls don't propagate signers. The called contract sees `get_caller()` returning the calling contract's address. Authorization is the called contract's responsibility, checked against its own storage. No signer arrays, no PDA signing.

## Pattern Adaptations

### PDA State Accounts → Map Fields

**Solana pattern:** create a PDA account per user to store their state.

```rust
#[derive(Accounts)]
pub struct CreateUserAccount<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + UserState::INIT_SPACE,
        seeds = [b"user", user.key().as_ref()],
        bump,
    )]
    pub user_state: Account<'info, UserState>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

**Groundhog:** a Map field inside the contract. No separate account creation.

```rust
#[sdk::storage]
pub struct MyContract {
    user_states: Map<ContractAddress, UserState>,
}

fn get_user_state(&self, user: &ContractAddress) -> UserState {
    self.user_states.at(user).try_get().unwrap_or_default()
}
```

No `init` instruction, no `space` calculation, no `payer`, no `system_program`. The map entry is created on first write.

### Token Transfer

**Solana (SPL Token):**

```rust
let cpi_accounts = Transfer {
    from: ctx.accounts.from_token_account.to_account_info(),
    to: ctx.accounts.to_token_account.to_account_info(),
    authority: ctx.accounts.authority.to_account_info(),
};
let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
token::transfer(cpi_ctx, amount)?;
```

**Groundhog:**

```rust
fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    let caller = get_caller();
    let diff = amount_to_diff(amount);
    self.balances.at_mut(&caller).strict_inc(-diff);
    self.balances.at_mut(receiver).strict_inc(diff);
}
```

No CPI context, no account info conversion, no external token program. The balance is a map field in your contract, and `strict_inc` handles the delta.

### Cross-Program Invocation → Cross-Contract Call

**Solana:**

```rust
let cpi_accounts = MintTo {
    mint: ctx.accounts.mint.to_account_info(),
    to: ctx.accounts.token_account.to_account_info(),
    authority: ctx.accounts.authority.to_account_info(),
};
let seeds = &[b"mint_authority", &[bump]];
let signer_seeds = &[&seeds[..]];
let cpi_ctx = CpiContext::new_with_signer(
    ctx.accounts.token_program.to_account_info(),
    cpi_accounts,
    signer_seeds,
);
token::mint_to(cpi_ctx, amount)?;
```

**Groundhog:**

```rust
let token = ERC20Client::new(&token_addr);
token.mint(&recipient, amount);
```

The `#[contract]` macro generates the client. No account arrays, no signer seeds, no CPI context construction. The call executes within the same snapshot. If the called contract aborts, your contract aborts too (or use `try_mint` to handle the error).

### Error Handling

**Solana (Anchor):**

```rust
#[error_code]
pub enum MyError {
    #[msg("Not authorized")]
    NotAuthorized,
    #[msg("Insufficient balance")]
    InsufficientBalance,
}

// In handler:
require!(ctx.accounts.authority.key() == expected, MyError::NotAuthorized);
```

**Groundhog:**

```rust
#[contract_exception]
pub enum Error {
    NotAuthorized = 1,
}

// In method:
ensure(get_caller() == self.contract_owner.get(), Error::NotAuthorized);
```

Similar pattern: define error variants, check conditions. Anchor uses `require!` macro, Groundhog uses `ensure()`. Both abort the transaction on failure. The difference: Groundhog errors are XDR-serialized (for cross-contract error inspection), and `NNInt` underflow aborts automatically without needing an explicit check.

## What Doesn't Exist

| Solana Feature | Status on Groundhog | Alternative |
|----------------|---------------------|-------------|
| Account model | Does not exist | State lives in contract storage fields |
| `#[derive(Accounts)]` | Does not exist | No account validation needed |
| PDAs and bump seeds | Does not exist | Deterministic address from deployer + nonce |
| Rent / rent exemption | Does not exist | Refundable HOG deposit for storage |
| Compute unit budget | Gas limits (cost zero) | Metering exists for bounding computation. No per-operation fees. |
| Priority fees | Does not exist | Throughput via HOG token holding |
| `Signer<'info>` propagation | Does not exist | `get_caller()` for identity |
| Associated Token Accounts | Does not exist | `Map<Address, NNInt>` in contract storage |
| Account `space` / `realloc` | Does not exist | Storage grows as needed |
| `system_program`, `token_program`, `rent` as accounts | Does not exist | No system accounts passed to instructions |
| Versioned transactions | Does not exist | One transaction format |
| Address lookup tables | Does not exist | No account arrays to compress |

## Next Steps

- [Getting Started](/start/getting-started/) for SDK setup and project structure
- [Build a Counter](/tutorials/build-a-counter/) for a step-by-step first contract
- [Build a Token](/tutorials/build-a-token/) for a full ERC-20 implementation
- [Merged Deltas](/programming-model/execution/#merged-deltas) for the contract-level merge model
- [Storage Types](/reference/storage-types/) for the full NNInt, Map, and Bytestring API
