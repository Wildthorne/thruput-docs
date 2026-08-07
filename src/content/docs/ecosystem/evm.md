---
title: EVM & Solidity
description: Groundhog concepts for Solidity and EVM developers.
---

This guide is for developers who know Solidity and the EVM. It uses familiar EVM concepts to explain how Groundhog works, what changes, and what disappears entirely.

For the foundational concepts (delta operations, commutativity, storage types), see [For Blockchain Developers](/start/for-blockchain-developers/). This page builds on that with concrete patterns and a worked example.

## The Contract Lifecycle

If you've deployed and called contracts on Ethereum, the Groundhog lifecycle will feel familiar. The mechanics differ, but the shape is the same: write a contract, compile it, deploy it, call functions on it.

### Writing

Groundhog contracts are written in Rust and compiled to RV32 artifacts by default, not EVM bytecode. RV32 is Groundhog's 32-bit RISC-V contract target. The SDK provides optional convenience macros, but you can also work directly with raw syscalls. A minimal contract looks like this:

```rust
#[contract_exception]
pub enum Error {
    NotAuthorized = 1,
}

#[derive(Debug)]
#[sdk::storage]
pub struct MyContract {
    value: NNInt,
}

#[contract(throws = Error)]
impl MyContract {
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

Where Solidity uses `constructor()`, Groundhog contracts commonly expose an ordinary `initialize` method. Deployment does not call it automatically or enforce that it runs once, so the contract must guard one-time initialization when that matters. Where Solidity uses `uint256` state variables, Groundhog uses typed storage fields (`Balance`, `NNInt`, `Map<K, V>`, `Bytestring`). The type you choose determines how concurrent writes merge. This is the core difference: storage types enforce parallelism rules, not the developer.

### Compiling

Solidity compiles to EVM bytecode. Groundhog contracts compile to RV32, a 32-bit RISC-V target, by default:

```bash
groundhog build
```

The output is a `.rv32a` artifact plus [contract spec](/reference/contract-spec/) sidecars, analogous to Solidity's bytecode + ABI.

### Deploying

On Ethereum, you send a transaction containing bytecode, the EVM executes the constructor, and you get an address back. On Groundhog, deployment submits the contract artifact and creates a contract instance with a nonce:

1. **Include the RV32 artifact** in the deploy transaction.
2. **Create a contract instance** with a nonce. The nonce, combined with the deployer's address and the contract hash, deterministically produces the contract address.

This is closer to Ethereum's `CREATE2` than `CREATE`. The address is predictable before deployment.

The same contract artifact can be instantiated multiple times at different addresses. Initialization is a separate contract call unless an application-specific deployer combines deployment and initialization in one parent invocation.

### Calling

On Ethereum, you send a transaction specifying a contract address, a function selector (4-byte hash), and ABI-encoded arguments. On Groundhog, a transaction specifies a contract address, an entrypoint ID (8-byte identifier), and XDR-encoded arguments.

The SDK generates entrypoint IDs from method names and the `#[contract]` macro handles encoding. From a developer's perspective, calling a contract looks like this:

```rust
let client = MyContractClient::new(&contract_addr);
client.increment(42);
let value = client.get();
```

The generated client handles serialization. You don't construct raw calldata.

### Reading State

On Ethereum, you call `view` functions or read storage slots directly via `eth_getStorageAt`. On Groundhog, typed reads normally use `&self` methods through `groundhog_view`. The gateway also exposes `groundhog_getStorageAt` for low-level reads of a specific 32-byte contract-data key.

The key difference: every read within a block sees the same snapshot. Two transactions in the same block that call `get()` will see the same value, regardless of what other transactions are doing. This is snapshot isolation, and it's what makes parallel execution safe.

## Mental Model Shifts

| Solidity / EVM | Groundhog | Why |
|----------------|-----------|-----|
| `balance = newValue` | `balance.increase(amount)` or `decrease(amount)` | Deltas merge in parallel. Absolute writes conflict. |
| `mapping(address => uint256)` | `Map<Address, Balance>` | Same concept. The value type enforces non-negativity and enables parallel execution. |
| Gas per operation | Gas exists for metering but costs zero. HOG deposit for storage capacity. | Gas limits bound computation, but no tokens are burned. |
| Sequential execution | Parallel by default | Every transaction in a block runs simultaneously against the same snapshot. |
| `require(condition, "message")` | `ensure(condition, Error::Variant)` | Typed errors instead of string messages. |
| `revert()` / `require()` | `throw(error)` | Aborts the transaction. Cannot be caught within the same contract. |
| Solidity + EVM bytecode | Rust + RV32 artifact | Different VM and artifact format. Attached Groundhog contract blobs are capped at 256 KiB. |
| `constructor()` | Ordinary initialization method | Deployment does not invoke it automatically; guard one-time initialization in storage. |
| `msg.sender` | `get_caller()` | Same concept. |
| `view` / `pure` | `&self` / no self | Read-only methods don't produce state changes. |
| `public` / `external` / `internal` / `private` | `pub` / not pub | Rust visibility. Public methods become contract entrypoints. |
| OpenZeppelin inheritance | Trait implementations | Rust uses traits and composition, not inheritance. |

## What Disappears

These are real problems EVM developers deal with daily. They don't exist on Groundhog.

### Reentrancy

On the EVM, calling an external contract hands over execution control. That contract can call back into yours before your state updates are complete. Entire categories of exploits (DAO hack, read-only reentrancy) exist because of this.

Groundhog bans reentrancy at the runtime level. A contract cannot be called while it is already on the call stack. The runtime enforces this: if contract A calls contract B, and B tries to call back into A, the call fails. This is not a convention or a guard you add. It is a protocol-level guarantee.

Beyond the ban, the snapshot/delta model means there is no partial state to observe even if reentrancy were allowed. Every contract reads from the same frozen snapshot and writes deltas. Deltas merge after all execution completes.

You don't need reentrancy guards, checks-effects-interactions ordering, or `nonReentrant` modifiers.

### Ordering and MEV

On Ethereum, pending transactions are visible in the mempool. Searchers can insert transactions before yours (front-running), after yours (back-running), or around yours (sandwich attacks). This is because transaction order within a block affects outcomes.

On Groundhog, commutative operations produce the same merged result regardless of execution order. Two compatible credits to the same account therefore produce the same final balance whichever executes first. Operations that conflict do not both land: one is excluded and returned to the mempool. The proposer still controls transaction selection and which contender wins a conflict, so Groundhog does not make a blanket claim that every application is MEV-free.

### Gas Estimation and Out-of-Gas Failures

EVM developers spend significant effort estimating gas, setting gas limits, and handling out-of-gas reverts. Groundhog has gas limits for metering (bounding computation, preventing infinite loops), but gas costs zero tokens. You hold HOG tokens for capacity (compute throughput and storage). There are no gas fees to estimate and no fee-related reverts to handle.

### Nonce Management

Every Ethereum transaction requires a sequential nonce per account. Sending transactions in parallel requires careful nonce tracking, and a stuck transaction blocks all subsequent ones. Groundhog has no sequential nonces. Replay protection uses a `Uniquifier` (a per-address value made of a block expiry height and an arbitrary nonce); it just has to be unique, not monotonic, so transactions from the same address can execute concurrently and out of order.

### Integer Overflow/Underflow

Solidity 0.8+ added checked arithmetic by default, but earlier versions required SafeMath. Groundhog's `Balance` type enforces non-negativity at the storage layer. Checked `increase` and `decrease` abort automatically if the result would overflow or underflow. You don't write separate arithmetic checks because the type handles them.

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
    balances: Map<ContractAddress, Balance>,
}

fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    let caller = get_caller();
    self.balances.at_mut(&caller).decrease(amount);
    self.balances.at_mut(receiver).lazy_increase(amount);
}
```

**What changes:** No explicit balance check. `decrease` loads the sender and aborts during contract execution if its snapshot balance is insufficient. `lazy_increase` skips the receiver load and defers its bound check until delta reservation. Both operations produce mergeable deltas. Two transfers from the same account in the same block execute against the snapshot and produce deltas. If the account has enough balance for both, both succeed. If not, one is excluded.

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
    contract_owner: Value<ContractAddress>,
    // ...
}

fn mint(&mut self, receiver: &ContractAddress, amount: Amount) {
    ensure(get_caller() == self.contract_owner.get(), Error::NotOwner);
    self.total_supply.increase(amount);
    self.balances.at_mut(receiver).lazy_increase(amount);
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
    pub fn initialize(&mut self, initial_supply: Amount) {
        let caller = get_caller();
        self.contract_owner.set(&caller);
        self.total_supply.increase(initial_supply);
        self.balances.at_mut(&caller).lazy_increase(initial_supply);
        log_transfer_event(CONTRACT_ADDR_ZERO, &caller, initial_supply);
    }
}
```

**What changes:** Groundhog has no special constructor syntax. Call `initialize` after deployment, or have an application-specific deployer invoke it in the same parent transaction. The runtime does not provide once-only constructor semantics, so store and check an initialized flag when repeated calls must fail. State initialization uses the same storage operations as everything else.

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

**What changes:** No `indexed` keyword. Events use typed structs (`TransferEvent`, `ApprovalEvent`) with topic-based indexing built into the type. Fields marked `#[topic]` are indexed. The SDK provides helpers like `log_transfer_event` that handle serialization. Indexing and filtering happen at the node/explorer layer, not in the contract. See [Add Events to a Contract](/tutorials/add-events-to-a-contract/) for the full workflow and [Contract Spec](/reference/contract-spec/#events) for how events are described to off-chain tools.

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
    contract_owner: Value<ContractAddress>,
    balances: Map<ContractAddress, Balance>,
    allowances: Map<ContractAddress, Map<ContractAddress, Balance>>,
    total_supply: Balance,
}

#[contract(version = "0.1.5")]
impl ERC20 for TokenContract {
    fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
        let owner = get_caller();
        self.balances.at_mut(&owner).decrease(amount);
        self.balances.at_mut(receiver).lazy_increase(amount);
        log_transfer_event(&owner, receiver, amount);
    }

    fn adjust_allowance(&mut self, spender: &ContractAddress, diff: Difference) {
        let owner = get_caller();
        let mut allowances = self.allowances.at_mut(&owner);
        let mut allowance = allowances.at_mut(spender);
        if diff >= 0 {
            allowance.increase(diff as u128);
        } else {
            allowance.decrease(diff.unsigned_abs());
        }
        log_approval_event(&owner, spender, diff);
    }

    fn transfer_from(&mut self, owner: &ContractAddress, receiver: &ContractAddress, amount: Amount) {
        let spender = get_caller();
        self.allowances.at_mut(owner).at_mut(&spender).decrease(amount);
        self.balances.at_mut(owner).decrease(amount);
        self.balances.at_mut(receiver).lazy_increase(amount);
        log_transfer_event(owner, receiver, amount);
    }
}
```

**Key differences:**

- **No explicit balance checks.** `Balance::decrease` aborts if the result would be negative. The check is built into the type.
- **`adjust_allowance` instead of `approve`.** Deltas instead of absolute writes. No race condition. Concurrent approvals merge correctly.
- **No success boolean.** These ERC-20 methods return unit on success and abort on failure, instead of returning `bool`. Other Groundhog methods can return typed values.
- **No `require` guards.** `Balance` enforces non-negativity. You only need `ensure()` for business logic checks (authorization, etc.), not arithmetic safety.
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
| `block.timestamp` / `block.number` | Block height is exposed; block timestamp is not currently an SDK contract API | Use `get_block_height()` when height-based logic is appropriate |
| `gasleft()` | `stats::gas_remaining()` | Available for execution control, but gas costs zero tokens |
| Contract inheritance | Does not exist | Use Rust traits and composition |
| 24KB EVM runtime-code limit | Different limit | Attached Groundhog contract blobs are capped at 256 KiB |
| Storage slot packing | Does not exist | Each storage field is independent |

## Next Steps

- [Getting Started](/start/getting-started/) for SDK setup and project structure
- [Build a Counter](/tutorials/build-a-counter/) for a step-by-step first contract
- [Build a Token](/tutorials/build-a-token/) for the full ERC-20 implementation
- [Merged Deltas](/programming-model/execution/#merged-deltas) for the contract-level merge model
- [Storage Types](/reference/storage-types/) for the full `Balance`, `NNInt`, `Map`, and `Bytestring` API
