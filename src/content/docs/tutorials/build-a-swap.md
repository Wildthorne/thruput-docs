---
title: Build a Swap
description: "Tutorial: build an AMM on Groundhog."
---

:::caution[Under Active Development]
The swap contract SDK patterns (cross-contract error wrapping, multi-interface exports, embedded contracts) are evolving. The code below shows the current shape of a working UniswapV2-style AMM. APIs and macros may change.
:::

**Prerequisites:** Complete [Build a Token](/tutorials/build-a-token/) first (covers storage types, delta operations, and the ERC-20 pattern).

## What You'll Build

A constant-product AMM pair contract (UniswapV2-style) that:

- Holds reserves of two tokens
- Mints LP tokens to liquidity providers
- Burns LP tokens to withdraw liquidity
- Executes swaps against the reserve curve

The contract demonstrates three patterns not covered in previous tutorials: **embedded contracts** (LP token as an ERC-20 inside the pair), **cross-contract calls** (transferring external tokens), and **multi-interface exports** (one struct implementing two protocols).

## Storage Layout

```rust
use sdk::storage::{Map, NNInt, Value};
use sdk::*;

#[derive(Debug)]
#[sdk::storage]
pub struct SwapV2Pair {
    factory: Value<ContractAddress>,
    token0: Value<ContractAddress>,
    token1: Value<ContractAddress>,
    reserve0: Value<U112>,
    reserve1: Value<U112>,
    price0_cumulative_last: Value<U256>,
    price1_cumulative_last: Value<U256>,
    block_timestamp_last: Value<u32>,
    lp: TokenContract,   // Embedded ERC-20 for LP tokens
}
```

The pair stores the addresses of both tokens, their current reserves, cumulative price accumulators (for a TWAP oracle), and an embedded `TokenContract` that manages LP token balances.

The embedded `TokenContract` is the same ERC-20 from [Build a Token](/tutorials/build-a-token/). It lives inside the pair's storage and manages LP token minting, burning, and transfers. Delegation uses Rust's `AsRef`/`AsMut`:

```rust
impl AsRef<TokenContract> for SwapV2Pair {
    fn as_ref(&self) -> &TokenContract { &self.lp }
}
impl AsMut<TokenContract> for SwapV2Pair {
    fn as_mut(&mut self) -> &mut TokenContract { &mut self.lp }
}
```

## Dual Interface

The pair implements two interfaces on one struct: the swap protocol and ERC-20 (for the LP token). Each gets its own export set:

```rust
#[contract(version = "0.1.0", exports = "swap_exports")]
impl ISwapV2Pair for SwapV2Pair {
    fn swap(&mut self, amount0_out: Amount, amount1_out: Amount, to: &Address) {
        // ...
    }
    // mint_lp, burn_lp, get_reserves, sync, skim, initialize
}

#[contract(exports = "erc20_exports")]
impl ERC20 for SwapV2Pair {
    // All ERC-20 methods delegate to self.lp via AsRef/AsMut
}
```

This means external callers can interact with the pair as either a swap venue or a token contract, depending on which entrypoint they call.

## Cross-Contract Token Transfers

The pair holds reserves of external tokens. Moving tokens in and out requires cross-contract calls:

```rust
fn _transfer(&mut self, which: u8, to: &Address, amount: Amount) {
    let token_addr = if which == 0 {
        self.token0.get()
    } else {
        self.token1.get()
    };
    let token = ERC20Client::new(&token_addr);
    token.transfer(to, amount);
}
```

Errors from the external token contract propagate to the caller. The swap contract wraps them into its own error domain:

```rust
fn wrap_erc20<T>(f: impl FnOnce() -> T) -> T {
    catch(|e: &ERC20Error| throw(ISwapV2PairError::from(*e)), f)
}
```

## The Swap

The core AMM operation. A caller sends tokens to the pair and receives the other token, priced by the constant product formula (`x * y = k`).

```rust
fn swap(&mut self, amount0_out: Amount, amount1_out: Amount, to: &Address) {
    let (reserve0, reserve1, _) = self._get_reserves();

    // At least one output must be positive
    ensure(
        amount0_out > 0 || amount1_out > 0,
        ISwapV2PairError::InsufficientOutputAmount,
    );

    // Transfer outputs
    if amount0_out > 0 { self._transfer(0, to, amount0_out); }
    if amount1_out > 0 { self._transfer(1, to, amount1_out); }

    // Read new balances (after transfer)
    let balance0 = self._balance_of_token(0);
    let balance1 = self._balance_of_token(1);

    // Verify the constant product invariant (with 0.3% fee)
    let adjusted0 = balance0.strict_mul(1000).strict_sub(amount0_in.strict_mul(3));
    let adjusted1 = balance1.strict_mul(1000).strict_sub(amount1_in.strict_mul(3));
    ensure(
        adjusted0.strict_mul(adjusted1) >= reserve0.strict_mul(reserve1).strict_mul(1_000_000),
        ISwapV2PairError::InvariantK,
    );

    self._update(balance0, balance1, reserve0, reserve1);
}
```

The pattern is: transfer out first, then check the invariant. This is safe because the entire transaction is atomic. If the invariant check fails, the transaction aborts and all state changes (including the transfers) are discarded.

## Concurrency Properties

How does this interact with Groundhog's parallel execution?

- **Different pairs are fully independent.** Swaps on the ETH/USDC pair and the BTC/USDC pair execute in parallel with zero interaction.
- **Swaps on the same pair conflict.** Reserve updates are `Value<U112>` writes. Two swaps on the same pair in the same block produce different reserve values, so one is excluded. This is the correct behavior: AMM pricing depends on current reserves.
- **LP deposits on the same pair conflict** for the same reason (reserve writes).
- **LP token transfers are independent.** The embedded ERC-20 uses `NNInt` balances, so concurrent LP transfers between different accounts parallelize.

This matches the real-world contention profile. High-volume pairs see sequential swaps (one per block), but the rest of the network runs in parallel. On a traditional chain, a hot pair degrades performance for everyone. On Groundhog, it only affects that pair.

## What's Coming

The swap contract is functional but several features are still in development:

- **Event emission.** Currently uses placeholder `log()` calls. Will use `#[derive(Event)]` with proper topic indexing.
- **Flash swaps.** Not supported. Groundhog bans reentrancy at the runtime level (a contract cannot be called while it is already on the call stack), so the callback pattern used by flash loans on other chains does not apply. Alternative designs for flash-loan-like functionality are under exploration.
- **Protocol fees.** Fee collection and distribution to a fee recipient.
- **Router contract.** A higher-level contract that handles multi-hop swaps, slippage protection, and deadline enforcement.

## Next Steps

- [Storage Types](/programming-model/storage-types/) for `Value`, `NNInt`, `Map`, and their conflict semantics
- [Cross-Contract Calls](/reference/cross-contract-calls/) for client generation and error handling
- [Execution Model](/how-it-works/execution-model/) for how parallel execution and conflict exclusion work
- [SDK Macros](/reference/sdk-macros/) for `#[contract]`, `exports`, and multi-interface patterns
