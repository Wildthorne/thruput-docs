---
title: Stellar & Soroban
description: Map Stellar and Soroban operations to Thruput storage, authorization, and development workflow.
---

Stellar provides native payments, assets, trustlines, and a decentralized exchange alongside Soroban smart contracts. Your Rust and contract-design experience applies to Project Thruput. The network, executable format, contract interfaces, and authorization model are different. This page shows what changes when you port a Soroban contract. It does not cover moving assets between chains or running Soroban Wasm on Thruput.

Project Thruput is a development network. Its relationship to the Stellar network is not decided. See [Architecture](/architecture/).

## Before you start

Install the [Thruput CLI](/cli/install/). `thruput new` [creates a project](/cli/create-project/) with native and RV32 guest tests.

The examples follow one payment. Alice starts with 100 units. She pays Bob 10 directly, then 7 through a router. Alice ends with 83 and Bob with 17. Mallory tries to spend Alice's balance and is refused. The Soroban side is a small fixed-supply teaching ledger, not a full token implementation. It follows the official [Soroban auth](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/auth) and [cross-contract](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/cross-contract-call) examples: enum storage keys, a generated client, typed errors, and scoped authorization tests. The Thruput side uses the ERC20 token from [Build a token](/guides/build-a-token/).

## Keys and addresses

Thruput supports the `G` public-key and `S` seed encodings for Ed25519 keys. A G public key identifies a signer, not its Thruput wallet. Thruput derives an account address from a hash of the key and a nonce, so one key can control more than one account.

Thruput address inputs accept base58 or a checksummed Thruput `Z` StrKey. Stellar `C` contract addresses are rejected. Reports and JSON-RPC identifiers use base58. A Z address does not identify a network. Select the intended profile and use the address reported by the tools. See [keys and wallets](/cli/wallets/).

## Map the development workflow

| Soroban | Thruput |
| --- | --- |
| `stellar contract build` produces Wasm | `thruput build` produces an RV32 artifact and a contract spec |
| `__constructor` runs at deployment | An ordinary initializer with a contract-defined guard, run atomically with [`deploy --init`](/cli/deploy-and-call/) |
| `stellar contract deploy` | `thruput deploy`; fund the contract's storage with an explicit `--fund` amount when you use `--init` |
| `Address`, `#[contracttype]` | `ContractAddress`, `#[contract_type]` |
| `env.current_contract_address()` | `get_current_address()`; `get_caller()` returns the immediate caller |
| `stellar contract invoke`, sent or simulated | `thruput call` submits a transaction; `thruput view` simulates against committed state |
| `contractimport!` and generated clients | Generated Rust clients from a shared interface; `try_*` methods return a [`CallError`](/contracts/cross-contract-calls/#callerror) |
| `#[contracterror]` and `Result<T, E>` returns | [`#[contract_exception]`](/contracts/errors/); exported methods throw instead of returning `Result` |
| `#[contractevent]` types, or the older `env.events().publish` | Declared [typed events](/contracts/events/) emitted with `log_event`. Topic 0 is the event's signature, not static symbols; up to two fields can be marked as topics. |
| `env.ledger().timestamp()` (Unix seconds) and `env.ledger().sequence()` | `get_block_timepoint()` (Unix nanoseconds, fixed for the block) and `get_block_height()` |
| `update_current_contract_wasm` | Deployed contracts are [immutable](/how-it-works/contracts/); deploy a new contract at a new address |
| `Env` tests with `mock_auths` and `env.auths()` | [`TestEnvironment`](/programming-model/testing/) transactions with explicit callers and `env.advance_block()`, run natively and as RV32 guests |

Generated Thruput projects set `overflow-checks = false` in their release profile, while the Soroban examples set `true`. Plain `+` that panics on overflow in a Soroban build wraps in the RV32 guest, even though native tests still panic. Use checked arithmetic and throw a typed exception where the source relied on that panic. Test the overflow path in the RV32 guest.

## Read and change balances

In the Soroban ledger, an enum key identifies each balance in persistent storage:

```rust
pub fn balance(env: Env, id: Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(id))
        .unwrap_or_default()
}
```

The transfer checks authorization and a nonnegative amount, checks the available balance, then writes the debit and credit.

The Thruput token uses `Map<ContractAddress, Balance>`. A missing balance also reads as zero:

```rust
fn _balance_amount_of(&self, owner: &ContractAddress) -> Amount {
    self.balances.at(owner).get()
}
```

A `Balance` handle supplies nonnegative amount checks and checked or lazy changes. This excerpt shows a direct transfer:

```rust
fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    let sender = get_caller();
    self.balances.at_mut(&sender).decrease(amount);
    self.balances.at_mut(receiver).lazy_increase(amount);
}
```

Here, `Amount` is `i128`. The excerpt simplifies error handling: the example token uses `try_decrease` and throws `ERC20Error::TooLarge` when the balance is insufficient. The checked debit detects insufficient funds during execution. The lazy credit records a relative change. Relative changes from different transactions can merge if the combined result stays within the balance bounds.

[Build a token](/guides/build-a-token/) covers the complete example: initialization, supply policy, error mapping, allowances, and events.

Thruput tokens use native contract interfaces. The SDK's `thruput-sep41` client adapter provides familiar token operations over supported ERC20 interfaces. It uses Thruput caller authorization, native events, and Thruput block heights for approval expiry. See [Rust API Docs](/tools/rust-api-docs/) for exact signatures and the [adapter's API comments](https://github.com/thruputchain/thruput-sdk-rs/blob/main/standard-impls/thruput-sep41/src/lib.rs) for its requirements and differences.

The adapter does not provide Soroban ABI compatibility. Moving assets between Stellar and Thruput through a bridge is a separate integration. Each bridge defines its supported assets and transfer guarantees.

## Port authorization

For each operation, find whose authority it needs and how that authority reaches the contract.

Soroban's [`Address::require_auth()`](https://docs.rs/soroban-sdk/latest/soroban_sdk/struct.Address.html#method.require_auth) checks that an address authorized the invocation and its arguments. User authorization can cover a tree of contract calls. The contract can use an `Address` without implementing signature checks itself. It does not need to treat that address as the immediate caller. In Soroban, a contract that calls another contract directly is authorized for its own address. This invoker rule is the closest match to `get_caller()`.

Thruput separates transaction admission from the authority a contract uses during execution:

| Question | Thruput mechanism |
| --- | --- |
| May this account originate the root transaction? | Transaction signatures and the account's admission policy |
| Which address called this method directly? | `get_caller()` |
| May this intermediary act for another address? | An allowance or explicit auth-token policy enforced by the receiving contract |

Do not replace `from.require_auth()` with `get_caller() == from` before you check the full call path. Signing the root transaction does not grant arbitrary downstream authority. The root frame itself has no caller.

### Direct payment

For a direct Thruput wallet-to-token call, the token sees the wallet as its caller. The transfer excerpt above spends that wallet's balance.

Soroban's ledger transfer instead receives an explicit `from` address and calls `from.require_auth()`. The named address must authorize the operation. A supplied address alone is not authority.

### A user acting on their own state

Soroban's [auth example](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/auth) calls `user.require_auth()` before changing that user's own counter. When the source has no intermediary, checking `get_caller() == user` keeps who may change the record. This removes two behaviors. Another account cannot submit the call for the user, as a Soroban relayer or fee sponsor can. Thruput does not support sponsored transactions yet. They are [planned](/architecture/roadmap/#sponsored-transactions). A call through an intermediary is refused, because the callee sees the intermediary. Document this change, and test that a forwarded call is refused.

### Payment through a router

In the Soroban example, the router roots authorization in the payment and calls the ledger through its generated client:

```rust
pub fn pay(env: Env, ledger: Address, from: Address, to: Address, amount: i128) {
    from.require_auth();
    LedgerClient::new(&env, &ledger).transfer(&from, &to, &amount);
}
```

The ledger also calls `from.require_auth()`. Tests should inspect the complete root-and-child authorization tree with `env.auths()` before reading balances. A missing child authorization or changed recipient is refused.

On Thruput, a token called by a router sees the router. Calling its direct `transfer` method spends the router's balance, even when Alice signed the transaction. A router that forwards to `transfer` is an easy porting mistake.

The working port uses the token's allowance interface. Alice first calls the token's `adjust_allowance` to grant the router a budget. The router then binds the payer to its own immediate caller:

```rust
pub fn pay(token: &ContractAddress, to: &ContractAddress, amount: i128) {
    let payer = get_caller();
    ERC20Client::new(token).transfer_from(&payer, to, amount);
}
```

Mallory cannot name Alice as the payer through this method. Mallory's separate call to the token also lacks Alice's allowance to Mallory. Test balances and the remaining grant after each refused attempt.

This port changes the authorization policy. An allowance is a persistent spending budget. It usually does not bind a recipient. A Soroban authorization tree can bind the operation, recipient, amount, and child calls. Use a narrower grant interface when the application needs authority for one operation only.

For such interfaces, Thruput's `Signed<T>` is a typed runtime auth-token handle, not an off-chain signature or a durable bearer token. Pass it explicitly. The receiving contract must check the consumed minter and payload against its policy. See [caller identity and auth tokens](/how-it-works/authorization/).

### Several parties authorizing one operation

In Soroban's [atomic swap](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/atomic-swap), each of two parties authorizes its side of one invocation. Both signed entries travel in one transaction. Each is consumed only if that transaction succeeds. A Thruput transaction has one source address, and `get_caller()` names one address. Detached signatures cannot yet become `Signed<T>` values; a wallet contract must check a signature and mint the token during execution.

A port can store a grant for each party before the swap. Alternatively, each party's wallet can mint a `Signed<T>` in the swap transaction. Bind each grant to the source's authorized arguments. Consume it once, and give it an expiry and a revocation path. Check when each authorization is consumed. If a call that does not complete the swap can consume it, anyone who can submit that call can cancel that party's side.

## Other porting decisions

| Starting point | Thruput decision |
| --- | --- |
| Classic payments and asset operations | Select a token contract and its transfer policy. Native Stellar asset semantics are not automatic. |
| Trustlines and asset authorization | Store policy and enforce it on every relevant operation. A stored flag alone does not restrict transfers. |
| Several classic operations | Compose calls in one root transaction or a DefaultWallet typed call batch. |
| Soroban storage get/set | Select typed handles such as `Value`, `Map`, and `Balance`; review their merge rules. |
| Instance, Persistent, and Temporary storage | Review lifetime requirements. Thruput has one persistent model and no storage TTL; funded data remains until deleted. |
| Built-in offers, liquidity pools, and path payments | Select an application-defined venue. Thruput has no built-in order book or liquidity pool. |
| Inclusion fees | Gas costs zero tokens. Scheduling uses the sender's native-token balance. Sponsored transactions are [planned](/architecture/roadmap/#sponsored-transactions). |
| Resource fees and rent for storage | [Storage deposits](/how-it-works/storage-economics/) come from the contract that owns the data, not the submitter. A write the contract cannot fund is excluded, not aborted. |
| Methods that let any caller create entries | Each new balance, allowance, or per-user record spends the contract's funds. Decide who may create entries, and consider refusing writes that only allocate, such as zero approvals for a new pair. |

Soroban's Temporary data is deleted at TTL expiry. Persistent and Instance entries can be archived and restored. See [Stellar state archival](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival). Anyone can extend an entry's TTL. For this reason, Stellar's storage guidance stores an explicit deadline and checks it on read. Port that check as it is. Some sources also extend a Temporary entry to its deadline. Soroban then refuses deadlines past the network's maximum TTL. Thruput block heights have no such limit. Keep an explicit bound if the source relied on it.

### Transaction snapshots

On Stellar, the result of a ledger matches applying its transactions one at a time in order. Thruput transactions in the same block execute against the same committed snapshot. A transaction does not read another transaction's writes in that block. Later calls within one transaction see its own changes, including successful child calls. See [Contract Execution](/programming-model/execution/). In SDK tests, call `env.advance_block()` after a write before a dependent transaction reads it. A test transaction reporting success does not advance the block.

Authorization checks read the snapshot too. After an admin change or a revoked grant, the previous holder still passes a stored-role check in other transactions of the same block. Their writes land unless they conflict with the change. Test the previous holder acting in that block.

Two absolute `Value::set` writes can coexist when they store the same value. A read/increment/set port could therefore lose an increment even if both writes land. Use Balance deltas when their bounds and return semantics fit, or an [exclusive write](/programming-model/storage-types/#exclusive-writes) for an absolute update that needs one included writer. Preserve source numeric limits. Exclusion does not guarantee an automatic retry.

### Atomic calls and queued work

[Classic Stellar transactions](https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-transactions) can bundle operations atomically. Soroban transactions contain one smart-contract operation, which can invoke other contracts.

A Thruput transaction has one root invocation, which can call several contracts. The native DefaultWallet also supports [atomic typed call batches](/typescript/transactions/#execute-multiple-calls). If the root aborts, its contract changes and successful child changes are discarded. A parent using recoverable calls can handle a child's failure and continue. See [Invocation Frames](/how-it-works/invocation-frames/).

If the source completes an operation in one call, keep it that way. Use a queue only if a delayed result is acceptable. The [AMM example](/guides/build-an-amm/) shows queued requests processed in later transactions; there, acceptance is not a completed swap.

## Work with an agent

Install the Thruput agent skill with `thruput skill install`. See [agent tools](/cli/agent-tools/). Then give your agent one workflow:

```text
Help me port one small Soroban contract to Thruput.
Read the source contract, its tests, and its dependency pins.
Use the Stellar & Soroban docs page as a checklist.
Identify the authorized principal, amount bounds, call path, and state changes.
Preserve synchronous behavior unless the application requires later processing.
Explain any change from invocation-specific authority to an allowance or grant.
Check direct, unauthorized, and forwarded calls, including the actual payer.
Port the tests and run them natively and as RV32 guests. Match expected errors
and inspect state after success and refusal. Report unrun checks as unverified.
Do not infer bridge, token-standard, or Soroban ABI compatibility.
```

For the Thruput execution and storage model, continue with [Contract Execution](/programming-model/execution/), [Storage Types](/programming-model/storage-types/), and [Testing](/programming-model/testing/).
