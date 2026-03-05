---
title: EVM Migration
description: Guide for Solidity/EVM developers building on Groundhog.
---

This guide is for developers who know Solidity and the EVM. It uses EVM concepts as a familiar reference point to explain how Groundhog works, what changes, and what disappears entirely.

For the foundational concepts (delta operations, commutativity, storage types), see [For Blockchain Developers](/start/for-blockchain-developers/). This page builds on that with concrete patterns and a worked example.

## The Contract Lifecycle

If you've deployed and called contracts on Ethereum, the Groundhog lifecycle will feel familiar. The mechanics differ, but the shape is the same: write a contract, compile it, deploy it, call functions on it.

### Writing

Groundhog contracts are written in Rust and compiled to WebAssembly (not EVM bytecode). The SDK provides optional convenience macros, but you can also work directly with raw syscalls. A minimal contract looks like this:

```rust
#[derive(Error, Debug, Clone, PartialEq, ReadXDR, WriteXDR)]
#[repr(i32)]
pub enum Error {
    #[error("Not authorized")]
    NotAuthorized = 1,
}

#[derive(Debug)]
#[sdk::storage]
pub struct MyContract {
    value: NNInt,
}

#[contract(throws = Error)]
impl MyContract {
    #[init]
    pub fn initialize(&mut self, starting_value: u64) {
        self.value.strict_inc(starting_value as i128);
    }

    pub fn increment(&mut self, amount: u64) {
        self.value.strict_inc(amount as i128);
    }

    pub fn get(&self) -> u64 {
        self.value.try_get().unwrap_or(0) as u64
    }
}
```

Where Solidity uses `constructor()`, Groundhog uses a method marked `#[init]` that runs once at deployment. Where Solidity uses `uint256` state variables, Groundhog uses typed storage fields (`NNInt`, `Map<K, V>`, `Bytestring`). The type you choose determines how concurrent writes merge. This is the core difference: storage types enforce parallelism rules, not the developer.

### Compiling

Solidity compiles to EVM bytecode. Groundhog contracts compile to WASM:

```bash
cargo --config .cargo/contract.toml build --release
```

The output is a `.wasm` binary, analogous to Solidity's ABI + bytecode.

### Deploying

On Ethereum, you send a transaction containing bytecode, the EVM executes the constructor, and you get an address back. On Groundhog, deployment is a two-step process:

1. **Upload the WASM binary** to the ledger (analogous to deploying a "factory").
2. **Create a contract instance** by calling `DeployContract` with a nonce. The nonce, combined with the deployer's address and the contract hash, deterministically produces the contract address.

This is closer to Ethereum's `CREATE2` than `CREATE`. The address is predictable before deployment.

The `#[init]` method runs during instance creation, not during WASM upload. This means the same WASM binary can be instantiated multiple times with different initialization parameters, each at a different address.

### Calling

On Ethereum, you send a transaction specifying a contract address, a function selector (4-byte hash), and ABI-encoded arguments. On Groundhog, a transaction specifies a contract address, an entrypoint ID (8-byte identifier), and XDR-encoded arguments.

The SDK generates entrypoint IDs from method names and the `#[contract]` macro handles encoding. From a developer's perspective, calling a contract looks like this:

```rust
let mut client = MyContractClient::new(&contract_addr);
client.increment(42);
let value = client.get();
```

The generated client handles serialization. You don't construct raw calldata.

### Reading State

On Ethereum, you call `view` functions or read storage slots directly via `eth_getStorageAt`. On Groundhog, you call `&self` methods (read-only methods that take an immutable reference). There is no equivalent of reading arbitrary storage slots from outside the contract.

The key difference: every read within a block sees the same snapshot. Two transactions in the same block that call `get()` will see the same value, regardless of what other transactions are doing. This is snapshot isolation, and it's what makes parallel execution safe.

## Mental Model Shifts

| Solidity / EVM | Groundhog | Why |
|----------------|-----------|-----|
| `balance = newValue` | `balance.strict_inc(delta)` | Deltas merge in parallel. Absolute writes conflict. |
| `mapping(address => uint256)` | `Map<Address, NNInt>` | Same concept. The value type enforces guarantees (e.g. non-negativity) and enables parallel execution. |
| Gas per operation | No gas. HOG deposit for storage capacity. | You hold tokens for throughput, not pay per call. |
| Sequential execution | Parallel by default | Every transaction in a block runs simultaneously against the same snapshot. |
| `require(condition, "message")` | `ensure(condition, Error::Variant)` | Typed errors instead of string messages. |
| `revert()` / `require()` | `abort(&error)` | Aborts the transaction. Cannot be caught within the same contract. |
| Solidity + EVM bytecode | Rust + WebAssembly | WASM gives full-featured computation. No 24KB contract size limit. |
| `constructor()` | `#[init] fn initialize()` | Runs at instance creation, not bytecode upload. |
| `msg.sender` | `get_caller()` | Same concept. |
| `view` / `pure` | `&self` / no self | Read-only methods don't produce state changes. |
| `public` / `external` / `internal` / `private` | `pub` / not pub | Rust visibility. Public methods are WASM exports. |
| OpenZeppelin inheritance | Trait implementations | Rust uses traits and composition, not inheritance. |

## What Disappears

These are real problems EVM developers deal with daily. They don't exist on Groundhog.

### Reentrancy

On the EVM, calling an external contract hands over execution control. That contract can call back into yours before your state updates are complete. Entire categories of exploits (DAO hack, read-only reentrancy) exist because of this.

Groundhog's execution model eliminates reentrancy. Every transaction reads from a frozen snapshot and writes deltas. A child contract call reads from the same snapshot as the parent. There is no way for a callback to observe partial state updates, because partial state updates don't exist during execution. Deltas merge after all execution completes.

You don't need reentrancy guards, checks-effects-interactions ordering, or `nonReentrant` modifiers.

### Front-Running and MEV

On Ethereum, pending transactions are visible in the mempool. Searchers can insert transactions before yours (front-running), after yours (back-running), or around yours (sandwich attacks). This is because transaction order within a block affects outcomes.

On Groundhog, commutative operations produce the same result regardless of execution order. Two transfers to the same account produce the same final balance no matter which runs first. There is nothing to extract from reordering, because reordering doesn't change results. For operations that do conflict (bytestring writes), one is excluded and returned to the mempool. There is no profitable ordering to exploit.

### Gas Estimation and Out-of-Gas Failures

EVM developers spend significant effort estimating gas, setting gas limits, and handling out-of-gas reverts. Groundhog has no per-operation gas. You hold HOG tokens for capacity (compute throughput and storage). Your contract executes to completion or aborts. There is no partial execution due to resource exhaustion.

### Nonce Management

Every Ethereum transaction requires a sequential nonce. Sending transactions in parallel requires careful nonce tracking, and a stuck transaction blocks all subsequent ones. Groundhog has no transaction nonces. Send as many concurrent transactions as you want.

### Integer Overflow/Underflow

Solidity 0.8+ added checked arithmetic by default, but earlier versions required SafeMath. Groundhog's `NNInt` type enforces non-negativity at the storage layer. `strict_inc` aborts automatically if the result would underflow. You don't write overflow checks because the type handles it.

### The `approve()` Race Condition

The ERC-20 `approve(spender, amount)` function sets an absolute allowance. If you approve 100, then want to change it to 50, the spender can front-run your second `approve` and spend the original 100 before the new value takes effect.

Groundhog's ERC-20 pattern uses `adjust_allowance(spender, diff)` instead. You send a delta (+50 or -50), not an absolute value. Concurrent allowance adjustments merge correctly because addition commutes.

## Pattern Adaptations

### Balance Transfer

**Solidity:**

```solidity
mapping(address => uint256) private balances;

function transfer(address to, uint256 amount) external {
    require(balances[msg.sender] >= amount, "Insufficient balance");
    balances[msg.sender] -= amount;
    balances[to] += amount;
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
    self.balances.get(&caller).strict_inc(-diff);
    self.balances.get(receiver).strict_inc(diff);
}
```

**What changes:** No explicit balance check. `strict_inc` with a negative delta aborts automatically if the sender's balance would go below zero. The two operations are deltas, not reads followed by writes. Two transfers from the same account in the same block both execute against the snapshot and both produce deltas. If the account has enough balance for both, both succeed. If not, one is excluded.

### Access Control

**Solidity:**

```solidity
address public owner;

modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}

function mint(address to, uint256 amount) external onlyOwner {
    balances[to] += amount;
    totalSupply += amount;
}
```

**Groundhog:**

```rust
#[sdk::storage]
pub struct Token {
    contract_owner: ContractAddress,
    // ...
}

fn mint(&mut self, receiver: &ContractAddress, amount: Amount) {
    ensure(&get_caller() == &self.contract_owner, Error::NotOwner);
    let diff = amount_to_diff(amount);
    self.balances.get(receiver).strict_inc(diff);
}
```

**What changes:** No modifier system. Rust doesn't have decorators. Use `ensure(condition, error)` at the top of the method. The pattern is the same (check authorization, then act), just expressed differently. For contracts with multiple roles, store a `Map<ContractAddress, Role>` and check against it.

### Constructor and Initialization

**Solidity:**

```solidity
contract Token {
    address public owner;
    uint256 public totalSupply;

    constructor(uint256 initialSupply) {
        owner = msg.sender;
        totalSupply = initialSupply;
        balances[msg.sender] = initialSupply;
    }
}
```

**Groundhog:**

```rust
#[contract(throws = Error)]
impl Token {
    #[init]
    pub fn initialize(&mut self, initial_supply: Amount) {
        let caller = get_caller();
        self.contract_owner = caller.clone();
        let diff = amount_to_diff(initial_supply);
        self.balances.get(&caller).strict_inc(diff);
        log_transfer_event(CONTRACT_ADDR_ZERO, &caller, initial_supply);
    }
}
```

**What changes:** `#[init]` replaces `constructor`. It runs once when the contract instance is created (not when the WASM is uploaded). The deployer calls `initialize` as part of the deployment transaction. State initialization uses the same delta operations as everything else.

### Events

**Solidity:**

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);

function transfer(address to, uint256 amount) external {
    // ... transfer logic ...
    emit Transfer(msg.sender, to, amount);
}
```

**Groundhog:**

```rust
fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    let caller = get_caller();
    // ... transfer logic ...
    log_transfer_event(&caller, receiver, amount);
}
```

**What changes:** No `indexed` keyword. Events use typed structs (`TransferEvent`, `ApprovalEvent`) with topic-based indexing built into the type. The SDK provides helpers like `log_transfer_event` that handle serialization. Indexing and filtering happen at the node/explorer layer, not in the contract.

## ERC-20 Side-by-Side

Here's how the core of an ERC-20 token compares. This isn't the full implementation (see [Build a Token](/tutorials/build-a-token/) for that), but it shows the key design differences.

**Solidity (OpenZeppelin-style):**

```solidity
contract ERC20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    function transfer(address to, uint256 amount) public returns (bool) {
        require(_balances[msg.sender] >= amount, "Insufficient");
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _allowances[msg.sender][spender] = amount;  // absolute write
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(_allowances[from][msg.sender] >= amount, "Allowance exceeded");
        require(_balances[from] >= amount, "Insufficient");
        _allowances[from][msg.sender] -= amount;
        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
```

**Groundhog:**

```rust
#[sdk::storage]
pub struct TokenContract {
    contract_owner: ContractAddress,
    balances: Map<ContractAddress, NNInt>,
    allowances: Map<ContractAddress, Map<ContractAddress, NNInt>>,
    total_supply: NNInt,
}

#[contract(throws = ERC20Error)]
impl ERC20 for TokenContract {
    fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
        let owner = get_caller();
        let diff = amount_to_diff(amount);
        self.balances.get(&owner).strict_inc(-diff);
        self.balances.get(receiver).strict_inc(diff);
        log_transfer_event(&owner, receiver, amount);
    }

    fn adjust_allowance(&mut self, spender: &ContractAddress, diff: Difference) {
        let owner = get_caller();
        let owner_allowances = self.allowances.get(&owner);
        owner_allowances.get(spender).strict_inc(diff);
        log_approval_event(&owner, spender, diff);
    }

    fn transfer_from(&mut self, owner: &ContractAddress, receiver: &ContractAddress, amount: Amount) {
        let spender = get_caller();
        let diff = amount_to_diff(amount);
        self.allowances.get(owner).get(&spender).strict_inc(-diff);
        self.balances.get(owner).strict_inc(-diff);
        self.balances.get(receiver).strict_inc(diff);
        log_transfer_event(owner, receiver, amount);
    }
}
```

**Key differences:**

- **No explicit balance checks.** `strict_inc` with a negative delta aborts if the result would be negative. The check is built into the type.
- **`adjust_allowance` instead of `approve`.** Deltas instead of absolute writes. No race condition. Concurrent approvals merge correctly.
- **No return values.** Methods either succeed or abort. There is no `returns (bool)` pattern because there is no partial failure.
- **No `require` guards.** NNInt enforces non-negativity. You only need `ensure()` for business logic checks (authorization, etc.), not arithmetic safety.
- **Parallel execution.** Two transfers debiting the same account both run against the snapshot. If the account has enough balance for both, both succeed and their deltas merge. If not, one is excluded and returned to the mempool.

For the full implementation with initialization, minting, burning, and tests, see [Build a Token](/tutorials/build-a-token/).

## What Doesn't Exist

These EVM features have no Groundhog equivalent. Set your expectations:

| EVM Feature | Status on Groundhog | Alternative |
|-------------|---------------------|-------------|
| `msg.value` (send ETH with call) | Does not exist | Transfer tokens explicitly via a token contract |
| `delegatecall` / proxy patterns | Does not exist | Contracts are immutable. Deploy new versions at new addresses. |
| `selfdestruct` | Does not exist | Contracts are permanent |
| `receive()` / `fallback()` | Does not exist | All methods must be explicitly defined |
| `block.timestamp` / `block.number` | Available via syscalls | Different API, same concept |
| `gasleft()` | Does not exist | No gas model |
| Contract inheritance | Does not exist | Use Rust traits and composition |
| 24KB contract size limit | Does not exist | WASM binaries have no practical size limit |
| Storage slot packing | Does not exist | Each storage field is independent |

## Next Steps

- [Getting Started](/start/getting-started/) for SDK setup and project structure
- [Build a Counter](/tutorials/build-a-counter/) for a step-by-step first contract
- [Build a Token](/tutorials/build-a-token/) for the full ERC-20 implementation
- [Execution Model](/how-it-works/execution-model/) for snapshots, deltas, and merge rules
- [Storage Types](/reference/storage-types/) for the full NNInt, Map, and Bytestring API
