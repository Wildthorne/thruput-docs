---
title: Build a Swap
description: "Tutorial: build a constant-product AMM pair on Groundhog."
---

We're building a UniswapV2-style pair contract: two reserves, an LP token, and a constant-product swap. After Counter (storage primitives) and Token (delta-based ERC-20), this is the first tutorial where one contract drives another. The pair deploys a second contract for its LP token and calls into it through a generated client.

**Prerequisites:** Complete [Build a Token](/tutorials/build-a-token/) first. The LP token reuses that ERC-20 contract verbatim.

## What You'll Build

A `SwapV2Pair` contract that:

- Holds reserves of two external tokens
- Deploys its own LP token contract at initialize time
- Mints LP tokens in exchange for deposits (`mint_lp`)
- Redeems LP tokens for reserves (`burn_lp`)
- Executes swaps against `x * y = k` with a 0.3% fee

The full source lives in `example-contracts/swap` in the SDK repo. This tutorial mirrors that crate.

## Architecture

The pair is one contract. The LP token is a *separate, freshly deployed* contract that the pair owns and drives through `ERC20Client`. There is no embedded token, no `AsRef`/`AsMut` delegation, no multi-interface struct. One trait, one impl, one storage struct.

```
  ┌──────────────┐    ERC20Client    ┌──────────────┐
  │  SwapV2Pair  │ ────────────────▶ │  LP Token    │  (deployed by initialize)
  │              │                   │  (ERC-20)    │
  └──────┬───────┘                   └──────────────┘
         │ ERC20Client
         ▼
  ┌──────────────┐   ┌──────────────┐
  │  Token A     │   │  Token B     │   (external, addresses passed in)
  └──────────────┘   └──────────────┘
```

:::note[Reentrancy]
The runtime forbids reentrancy: any `invoke` whose target is already on the call stack errors with `Reentrance` (enforced in `hogexec/runtime/syscall_handler.cc`). You don't need defensive guards. The pair calls into three other contracts during `swap` (two reserve tokens and the LP) and the engine guarantees none of those can call back into the pair within the same call tree.
:::

## Step 1: Define the Interface

Errors first. `#[contract_exception]` defines a wire-stable error enum with explicit discriminants.

```rust
use core::fmt;
pub use groundhog_erc20_if::ERC20Error;
use sdk::*;

pub use crate::bignum::{U112, U256};

#[contract_exception]
#[non_exhaustive]
pub enum ISwapV2PairError {
    InitializeFailed = 1,
    AlreadyInitialized = 2,
    NoLiquidityToBurn = 3,
    InsufficientOutputAmount = 4,
    InsufficientInputAmount = 5,
    InsufficientLiquidity = 6,
    InsufficientLiquidityMinted = 7,
    InsufficientLiquidityBurned = 8,
    InvalidDestination = 9,
    InvalidSwapProduct = 10,
    Overflow = 11,
    TransferFailed = 12,
    LPTokenFailure(ERC20Error) = 13,
}
```

`LPTokenFailure(ERC20Error)` wraps the LP contract's error type so callers see one error domain. `throws(ISwapV2PairError, ERC20Error)` on the trait below lets the macro generate the right client-side surface.

The trait itself:

```rust
pub type Amount = u128;
pub type Amounts = [Amount; 2];
pub type Address = sdk::ContractAddress;

#[contract(client = ISwapV2PairClient, throws(ISwapV2PairError, ERC20Error))]
pub trait ISwapV2Pair {
    /// Must be called exactly once before any other methods.
    fn initialize(
        &mut self,
        factory: &Address,
        token0: &Address,
        token1: &Address,
        // Hash of an ERC-20 contract. initialize deploys it.
        lp_token_hash: &SHA256Hash,
    );

    fn liquidity_token(&self) -> ContractAddress;

    fn get_reserves(&self) -> (u128, u128, u32);
    fn get_liquidity(&self) -> Amount;

    fn mint_lp(&mut self, to: &Address) -> Amount;
    fn burn_lp(&mut self, to: &Address) -> Amounts;

    fn skim(&mut self, to: &Address);
    fn sync(&mut self);

    fn swap(&mut self, amount0_out: Amount, amount1_out: Amount, to: &Address);

    // Driver helpers (used by routers / handlers)
    fn handle_purchase(&mut self, purchaser: &ContractAddress);
    fn handle_redeem(&mut self, redeemer: &ContractAddress);
    fn handle_swap(&mut self, trader: &ContractAddress, amounts_out: Amounts);
}
```

(Source: `example-contracts/swap/src/interfaces/iswapv2_pair.rs:1-78`.)

`initialize` takes a `SHA256Hash` of an ERC-20 contract. The pair deploys that hash at init time. Callers don't pass an LP address: the pair owns its LP.

## Step 2: Storage

Three values. That's it.

```rust
use sdk::storage::*;
use sdk::*;

#[storage]
pub struct SwapV2Pair {
    // Token (A, B) addresses
    tokens: Value<[Address; 2]>,

    // The LP token contract, deployed by initialize
    lp_addr: Value<Address>,

    // Reserve balances, cumulative prices, last update timestamp
    reserves: Value<Reserves>,
}
```

(Source: `example-contracts/swap/src/swapv2_pair.rs:14-25`.)

`Reserves` is a user struct carried inside `Value`. It pairs the two balances with their cumulative price accumulators (for an on-chain TWAP oracle) and the last block timestamp:

```rust
#[contract_type]
#[derive(Copy, Clone, Debug)]
pub struct Reserves {
    pub balances: [U112; 2],
    pub cumulative_prices: [U256; 2],
    pub block_timestamp: u32,
}
```

(Source: `example-contracts/swap/src/reserves.rs:10-22`.)

`#[contract_type]` makes the struct safe to cross the contract boundary: it generates the serialization spec the engine needs.

## Step 3: Implement `initialize`

```rust
#[contract(exports = "swap_exports")]
impl ISwapV2Pair for SwapV2Pair {
    fn initialize(
        &mut self,
        _factory: &Address,
        token0: &Address,
        token1: &Address,
        lp_token_hash: &SHA256Hash,
    ) {
        if self.lp_addr.try_get().is_some() {
            throw(ISwapV2PairError::AlreadyInitialized);
        }

        hash_ident! { static LP_NONCE: SHA256Hash; }

        self.lp_addr.set(&deploy_contract(&LP_NONCE, lp_token_hash));
        self.tokens.set(&[*token0, *token1]);
        self.reserves.set(&Reserves::new());

        // Initialize the LP contract, owned by the pair
        self.lp().initialize(&get_current_address());
    }
```

(Source: `swapv2_pair.rs:29-48`.)

[`deploy_contract(&nonce, &code_hash)`](https://groundhog.dev/docs/sdk/latest/sdk/deploy/fn.deploy_contract.html) is a syscall wrapper. It takes a nonce (so the same pair can deploy multiple sub-contracts deterministically) and the SHA-256 of an already-uploaded contract binary. The returned address is stored in `lp_addr`. Then `self.lp().initialize(...)` runs the LP's own initializer with the pair as owner. From here on, only the pair can mint or burn LP tokens.

[`hash_ident!`](https://groundhog.dev/docs/sdk/latest/sdk/macro.hash_ident.html) generates a unique compile-time nonce. Use it once per `deploy_contract` site.

The `lp()` helper wraps the address in a generated client:

```rust
impl SwapV2Pair {
    fn lp(&self) -> ERC20Client {
        ERC20Client::new(&self.lp_addr.get())
    }

    fn token_addrs(&self) -> [Address; 2] {
        self.tokens.get()
    }

    fn tokens(&self) -> [ERC20Client; 2] {
        self.token_addrs().map(|ref addr| ERC20Client::new(addr))
    }

    fn _get_token_balances(&self) -> Amounts {
        self.tokens().map(|t| t.get_balance())
    }
}
```

(Source: `swapv2_pair.rs:284-309`.)

`ERC20Client::new(addr)` is the generated stub from the `#[contract]` macro on the `ERC20` trait. Every call on it is a cross-contract `invoke`.

## Step 4: `mint_lp`

The mint flow: the caller transfers reserve tokens to the pair first. Then it calls `mint_lp`, which compares the current balances against the previous reserves and mints LP proportional to the deposit.

```rust
fn mint_lp(&mut self, to: &Address) -> Amount {
    let mut reserves = self.reserves.get();
    let prev_balances = reserves.balances();

    // Current balances, after the caller's transfers
    let balances = self._get_token_balances();

    reserves.update(balances);
    self.reserves.set(&reserves);

    let amounts = [
        balances[0].strict_sub(prev_balances[0].into()),
        balances[1].strict_sub(prev_balances[1].into()),
    ];

    ensure(
        amounts[0] > 0 && amounts[1] > 0,
        ISwapV2PairError::InsufficientLiquidityMinted,
    );

    let lp = self.lp();
    let lp_total_supply = lp.total_supply();

    let lp_to_create = if lp_total_supply == 0 {
        // Permanently lock the first MINIMUM_LIQUIDITY tokens
        lp.mint(&Self::BLACK_HOLE, Self::MINIMUM_LIQUIDITY);

        amounts[0]
            .strict_mul(amounts[1])
            .isqrt()
            .strict_sub(Self::MINIMUM_LIQUIDITY)
    } else {
        core::cmp::min(
            amounts[0].strict_mul(lp_total_supply).strict_div(prev_balances[0].into()),
            amounts[1].strict_mul(lp_total_supply).strict_div(prev_balances[1].into()),
        )
    };

    ensure(lp_to_create > 0, ISwapV2PairError::InsufficientLiquidityMinted);

    lp.mint(to, lp_to_create);
    log_event(&MintEvent::new(&get_caller(), lp_to_create));
    lp_to_create
}
```

(Source: `swapv2_pair.rs:65-126`.)

Two `strict_sub` calls on `u128`: deposit amounts. First-ever mint locks 1000 LP units at the zero address (the classic UniswapV2 trick to prevent share-price manipulation). Subsequent mints take the minimum of the two proportional contributions.

## Step 5: `burn_lp`

```rust
fn burn_lp(&mut self, to: &Address) -> Amounts {
    let balances = self._get_token_balances();
    let lp = self.lp();
    let lp_returned = lp.get_balance();
    let total_liquidity = lp.total_supply();

    ensure(total_liquidity > 0, ISwapV2PairError::NoLiquidityToBurn);

    let amounts = [
        lp_returned.strict_mul(balances[0]) / total_liquidity,
        lp_returned.strict_mul(balances[1]) / total_liquidity,
    ];
    ensure(
        amounts[0] > 0 && amounts[1] > 0,
        ISwapV2PairError::InsufficientLiquidityBurned,
    );

    // Burn the LP tokens the caller sent us
    lp.burn(&get_current_address(), lp_returned);

    // Send the proportional reserves back
    self._transfer_to(to, amounts);

    self.sync();
    log_event(&BurnEvent::new(&get_caller(), amounts, to));
    amounts
}
```

(Source: `swapv2_pair.rs:130-165`.)

The caller transfers LP back to the pair, then invokes `burn_lp`. `lp.get_balance()` reads the pair's own LP holdings, which is exactly what the caller just sent. Burn them, return the proportional reserves, re-sync.

## Step 6: `swap`

The constant-product trade.

```rust
fn swap(&mut self, amount0_out: Amount, amount1_out: Amount, to: &Address) {
    let amounts_out = [amount0_out, amount1_out];

    ensure(
        amounts_out[0] > 0 || amounts_out[1] > 0,
        ISwapV2PairError::InsufficientOutputAmount,
    );

    let mut reserves = self.reserves.get();
    let r = reserves.balances();

    ensure(
        amounts_out[0] < r[0].into() && amounts_out[1] < r[1].into(),
        ISwapV2PairError::InsufficientLiquidity,
    );

    let addrs = self.token_addrs();
    ensure(
        to != &addrs[0] && to != &addrs[1],
        ISwapV2PairError::InvalidDestination,
    );

    // Send the requested outputs first (optimistic transfer)
    self._transfer_to(to, amounts_out);

    // Re-read balances after the transfer
    let balances = self._get_token_balances();
    reserves.update(balances);
    self.reserves.set(&reserves);

    // Inputs are whatever ended up in the pool above the post-transfer baseline
    let amounts_in = [
        balances[0].saturating_sub(Amount::from(r[0]) - amounts_out[0]),
        balances[1].saturating_sub(Amount::from(r[1]) - amounts_out[1]),
    ];

    ensure(
        amounts_in[0] > 0 || amounts_in[1] > 0,
        ISwapV2PairError::InsufficientInputAmount,
    );

    // K-invariant check with 0.3% fee, in 1000ths
    let balance_adj = [
        balances[0].strict_mul(1000).strict_sub(amounts_in[0] * 3),
        balances[1].strict_mul(1000).strict_sub(amounts_in[1] * 3),
    ];

    // Widen to U256 so the product can't overflow u128
    let balance_prod =
        U256::from(balance_adj[0]).mul(U256::from(balance_adj[1]));

    let reserve_adj = [u128::from(r[0]) * 1000, u128::from(r[1]) * 1000];
    let reserve_prod =
        U256::from(reserve_adj[0]).mul(U256::from(reserve_adj[1]));

    ensure(balance_prod >= reserve_prod, ISwapV2PairError::InvalidSwapProduct);

    log_event(&SwapEvent::new(&get_caller(), amounts_in, amounts_out, to));
}
```

(Source: `swapv2_pair.rs:167-236`.)

A few things worth flagging.

**Optimistic transfer.** The pair sends `amounts_out` before checking the invariant. If the K-check fails at the end, the whole transaction reverts, including the transfer. Atomicity gives you this for free.

**Input inference.** `amounts_in[i] = balances[i] - (r[i] - amounts_out[i])`. The pair never sees an `amount_in` argument: it deduces inputs from the difference between current balance and what the post-transfer balance would have been if no input arrived. `saturating_sub` is a defensive zero-floor.

**U256 widening.** `balance_adj[i]` can reach roughly `u112::MAX * 1000`, so the product fits in u128 most of the time, but not always. Multiplying through `U256::from(...).mul(U256::from(...))` removes the cliff.

**Fees encoded in the invariant.** The 0.3% fee shows up as `* 1000 - amount_in * 3` on each side. Compared against `reserve * 1000` on each side, both sides are scaled identically and the fee falls out as an asymmetric haircut on the inputs.

## Step 7: Test It

The crate ships a serial swap test. Trimmed:

```rust
mod common;
use common::*;

fn calculate_swap(amounts_in: Amounts) -> Amounts {
    [(amounts_in[1] / 10) * 9, (amounts_in[0] / 10) * 9]
}

#[test]
fn serial_swap_one() {
    transact_assert_success(|| {
        let etx = setup_etx_primed()?;
        let user = CAROL;

        // Carol sends 2 units of token0 to the pair
        let amounts_in = [2 * UNIT_AMT, 0];
        etx.exec_user_tx(user, |_| {
            etx.ctx.token0().transfer(&etx.ctx.pair_addr, amounts_in[0])
        })?;

        etx.advance_block();

        // Then asks for ~90% out, in token1
        let amounts_out = calculate_swap(amounts_in);
        etx.exec_user_tx(user, |user| {
            etx.ctx.pair().swap(amounts_out[0], amounts_out[1], &user.addr)
        })?;

        etx.advance_block();
        etx.user_print_balances(user)
    });
}
```

(Source: `example-contracts/swap/tests/swap.rs:18-32`.)

The test transfers token0 to the pair, advances a block, then calls `swap` asking for token1 out. `transact_assert_success` runs the closure inside a transaction harness and asserts no error escapes.

## Concurrency Notes

- Different pairs are fully independent. Two pairs (ETH/USDC, BTC/USDC) execute swaps in the same block with zero interaction.
- Swaps on the same pair conflict. `reserves` is a `Value`, and two swaps produce different post-images, so one gets returned to the mempool.
- LP transfers between users on the same pair parallelize. They live on the LP contract, which uses `NNInt` balances internally, so balance deltas commute.

## Closing Notes

What you just built mirrors the real `example-contracts/swap` crate. The full source includes:

- `Reserves::update`, which advances the cumulative-price oracle using a `UQ112x112` fixed-point representation
- `skim` and `sync`, the UniswapV2 reconciliation helpers
- `handle_purchase` / `handle_redeem` / `handle_swap`, driver entrypoints that pull in allowances and call the user-facing methods in one transaction
- Custom `U112` / `U256` types in `src/bignum/`
- A full integration test harness in `tests/common/`

Read `example-contracts/swap/src/swapv2_pair.rs` end to end for the parts trimmed here. Everything in this tutorial is a faithful subset.

## Next Steps

- [Storage Types](/programming-model/storage-types/) for `Value`, `Map`, and conflict semantics
- [Cross-Contract Calls](/reference/cross-contract-calls/) for client generation and error propagation
- [Execution Model](/how-it-works/execution-model/) for how the runtime enforces non-reentrancy and excludes conflicting transactions
