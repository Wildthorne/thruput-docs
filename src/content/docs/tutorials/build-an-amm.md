---
title: Build an AMM
description: Build and exercise a queued constant-product AMM, including liquidity, swaps, request outcomes, and RV32 tests.
---

Build the AMM contract suite in [groundhog-examples](https://github.com/groundhogchain/groundhog-examples). This guide creates pools, adds and removes liquidity, and executes swaps through its native and RV32 test environments. You will also verify that a failed queued request does not become a false success.

Read [Build a token](/tutorials/build-a-token/) first. Complete [CLI and Cargo setup](/cli/install/). Commands run from the examples repository root with its checked-in manifests and lockfile.

## Assemble the components

| Source | Responsibility |
| --- | --- |
| `interfaces/swap-if` | Shared methods, request types, errors, and clients |
| `engines/swap-pair` | Constant-product math and reserve operations |
| `contracts/swap-handler` | Apply a request, move tokens, and update pair state |
| `contracts/swap-driver` | Queue and process requests |
| `contracts/swap-factory` | Create and connect a pool's contracts |
| `contracts/swap-router` | User-facing liquidity and swap requests |
| `helpers/batch-driver` | Shared queue capacity and processing logic |

The pair is an internal engine used by the handler, not another public contract entry point. The suite adapts [Uniswap V2 pair operations](https://github.com/Uniswap/v2-core/blob/master/contracts/UniswapV2Pair.sol) to Stellar Thruput's execution model.

## Create a pool

Run the factory's deployment scenario:

```bash
cargo test -p swap-factory --test factory create_pair_brings_up_pool --locked
```

Open `contracts/swap-factory/src/factory.rs` and `tests/factory.rs`. Creation derives and funds three addresses, deploys the LP token, handler, and driver, initializes their relationships, and records the pair. The tests verify the resulting pool and funding rules.

The factory takes funding from the caller through an allowance. It does not let arbitrary pool creators spend the factory's own native tokens. Pool addresses are deterministic for the token pair and configured code hashes.

**Checkpoint:** a pool is created in the test environment with its contracts connected correctly.

## Add liquidity

```bash
cargo test -p swap-router --test add_liquidity --locked -- --nocapture
```

In `contracts/swap-router/tests/add_liquidity.rs`, the fixture establishes token balances, authorizes the handler, submits a liquidity request, and processes it. The test helper named `etx` is example test code, not an SDK API:

```rust
etx.user_allow_for_pair(user, amounts_desired)?;
etx.advance_block();
etx.user_add_liquidity(ALICE, amounts_desired)?;
etx.process_outstanding_requests(1)?;
```

The tests also separate the purchaser from the recipient: Alice can supply tokens while Bob receives LP tokens. Assertions check both the mint event and the actual LP balance.

## Execute a swap

```bash
cargo test -p swap-router --test swap carol_swap_exact_tokens_for_tokens --locked -- --nocapture
```

Open `contracts/swap-router/tests/swap.rs`. The exact-input scenario:

1. Establishes pool reserves.
2. Calculates expected output independently of the router.
3. Grants the handler an allowance for the input amount.
4. Submits a request with a minimum output.
5. Processes the queue.
6. Checks both token balances, the consumed allowance, and unchanged LP ownership.

The corresponding exact-output test checks that the requested output is received without exceeding the input cap.

**Checkpoint:** the swap tests pass with real state and event assertions, not just a successful method return.

## Understand acceptance and execution

<span id="the-problem"></span>
<span id="split-acceptance-from-execution"></span>

Every swap changes reserves. Concurrent transactions using the same snapshot cannot all replace those reserves with different values. The implementation separates accepting requests from executing reserve-dependent work:

```text
users → router → driver queue
                    ↓
             process_requests
                    ↓
                 handler → pair engine
```

Queue inserts can merge. Processing consumes requests serially inside one transaction, so each operation sees earlier updates in that transaction. The handler accepts work from its driver, and the driver accepts requests from the configured router.

An accepted request is not a completed swap. Submission returns a request ID and emits `RequestAccepted`. A later operation event or `RequestFailed` identifies its outcome.

## Verify failures and request IDs

<span id="getting-the-answer-back"></span>

```bash
cargo test -p swap-router --test request_id --locked
cargo test -p swap-router --test swap swap_limits_respected --locked
cargo test -p swap-driver --test authorization --locked
```

These checks verify that request IDs reach terminal events, slippage failures leave the user's funds unchanged, and unauthorized calls cannot bypass the router/driver/handler chain.

Each request is handled with a gas cap and commit locking. A handled failure can roll back that request without taking down other requests in the processing transaction.

## Bound the queue and processing work

<span id="batch-the-serial-work"></span>
<span id="the-gas-limit-is-the-batch-size"></span>
<span id="minimum-batch-size"></span>
<span id="a-queue-costs-storage-so-it-needs-a-ceiling"></span>

Queue capacity bounds pending storage. Consumption is checked during reservation across concurrent requests. An excluded submission returns to the mempool; it is not guaranteed a place in the next block.

Processing is permissionless and bounded by gas. The driver requires enough budget for the waiting work up to its configured minimum batch. It does not consume a request and then discard it merely because no processing budget remains.

```bash
cargo test -p swap-driver --test admission --locked
cargo test -p swap-driver --test min_batch --locked
cargo test -p swap-driver --test same_block --locked
```

These cases check queue limits, the minimum processing budget, and interactions with withdrawals and allowance changes. The source's `process_requests_gas` helper supplies the budget calculation; do not copy a gas number from an unrelated operation.

## Remove liquidity

```bash
cargo test -p swap-router --test remove_liquidity --locked
```

The tests verify redemption and the distinction between the LP-token owner and the recipient of the withdrawn tokens. Run the complete native suite before changing the design:

```bash
cargo test -p swap-factory -p swap-router -p swap-driver -p swap-pair --locked
```

## Verify compiled contracts

Build the guest contracts used by the suite:

```bash
thruput build -p erc20
thruput build -p swap-factory
thruput build -p swap-handler
thruput build -p swap-driver
thruput build -p swap-router
cargo test -p swap-driver -p swap-router -p swap-factory --features guest_test --locked
```

`guest_test` runs the scenarios against the compiled RV32 implementations in the SDK test environment. It does not start a browser application or submit to Devnet.

**Checkpoint:** you have built the AMM and verified pool creation, liquidity, swaps, and failure behavior through native and guest execution. The repository also contains an application under `apps/swap`; this guide focuses on the contract suite.

## Work with an agent

```text
Follow Build an AMM:
https://thruput.network/docs/tutorials/build-an-amm/
Use the existing swap contract suite in groundhog-examples. Run pool,
liquidity, swap, slippage, request-ID, authorization, and queue tests.
Build the guest artifacts and rerun with guest_test. Explain how the
assertions establish each outcome. Do not equate request acceptance or
a successful processing transaction with completion of a specific swap.
```
