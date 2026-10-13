---
title: Build a token
description: Build and test an ERC-20 contract with balances, allowances, administrator-controlled supply, and standard events.
---

Build the `erc20` contract in the [examples repository](https://github.com/thruputchain/thruput-examples/tree/main/contracts/erc20). You will trace a transfer, exercise minting and allowances, and test both native and RV32 execution.

This is a contract guide. The [counter series](/tutorials/build-a-counter/) covers the full contract-to-application journey; [TypeScript](/typescript/) covers application interactions.

## Prepare the project

Complete [CLI and Cargo setup](/cli/install/), then clone the examples repository if you do not already have it:

```bash
git clone https://github.com/thruputchain/thruput-examples.git
cd thruput-examples
```

Use the workspace's manifests, toolchain, and lockfile together. The token implements the shared interface crates rather than copying their definitions.

## Model the token state

Open `contracts/erc20/src/implementation.rs`:

```rust
pub struct TokenContract {
    config: Value<Config>,
    balances: Map<ContractAddress, Balance>,
    allowances: Map<ContractAddress, Map<ContractAddress, Allowance>>,
    total_supply: Balance,
}
```

The storage attribute derives paths for these handles:

| Field | Job |
| --- | --- |
| `config` | Administrator and optional token metadata |
| `balances` | Each account's nonnegative token amount |
| `allowances` | An owner/spender pair's remaining authorization |
| `total_supply` | Outstanding tokens |

Different map keys are independent. Balance changes use deltas instead of replacing a shared absolute value. See [Storage Types](/programming-model/storage-types/) for the merge rules.

## Follow a transfer

The implementation takes the payer from the direct caller:

```rust
fn transfer(&mut self, receiver: &ContractAddress, amount: Amount) {
    let owner = get_caller();
    self._decrease_balance(&owner, amount);
    self._lazy_increase_balance(receiver, amount);
    TransferEvent::new(&owner, receiver, amount_to_diff(amount)).log();
}
```

The checked debit reports insufficient balance during execution. The credit records a relative increase. The event records the movement for applications; it is not the source of the contract's balance state.

`transfer_from` first spends the caller's allowance, then performs the same debit and credit. An allowance belongs to a specific owner/spender pair, not to every caller.

## Apply supply and allowance policy

Read the `mint`, `burn`, and `adjust_allowance` implementations:

- Minting and burning require the configured administrator.
- Initialization records that administrator and rejects a later initialization.
- Allowances change by a signed `difference`. A positive value adds authority; a negative value removes it.
- An exclusive allowance update requests sole write access to that entry for the block. It does not make a prior offchain read current.
- `clear_allowance` deletes an allowance; `clear_balance` requires an empty balance before deleting its row.

The metadata feature adds name, symbol, and decimals. The permit feature adds signed-operation authorization. Keep the basic transfer policy clear before extending either surface.

## Exercise the contract

```bash
cargo test -p erc20 --locked
```

`tests/test_native.rs` deploys the contract in the SDK environment and runs the shared scenarios under `tests/common`. Inspect those scenarios for administrator checks, minting, transfers, allowance spending, cleanup, and expected exceptions.

`tests/same_block.rs` tests behavior that a serial-only token test would miss:

| Scenario | Expected result |
| --- | --- |
| Compatible credits to one balance | Deltas merge |
| Debits covered by the balance | Both can commit |
| Combined debits exceed the balance | Reservation excludes an overdrawing transaction |
| Read during the same block | Reads the block snapshot |
| Approval and a separate spending transaction in one block | The new approval is not already spendable from the snapshot |

Run a specific case while inspecting the corresponding code:

```bash
cargo test -p erc20 --test same_block same_block_credits_merge --locked
```

**Checkpoint:** the native tests pass, including expected failure paths. A test that deliberately catches a contract exception can still be a passing test.

## Build and test the guest artifact

```bash
thruput build -p erc20
thruput test -p erc20
```

The build writes `target/thruput/erc20.rv32a` and spec sidecars. The artifact test exercises the compiled guest implementation. Keep it as well as the native tests.

You now have a deployable token artifact. Use [Deploy and call](/cli/deploy-and-call/) for network deployment and [Use contract bindings](/tools/typescript-bindings/) for typed application calls. The repository's standard-token and factory examples add a fixed launch configuration for the separate launchpad application.

## Work with an agent

```text
Follow Build a token:
https://thruput.network/docs/tutorials/build-a-token/
Use contracts/erc20 in groundhog-examples with its workspace lockfile.
Trace administrator checks, transfers, allowances, and events in source.
Run the native, same-block, and RV32 tests. Report actual results and
artifact paths. Do not replace the standard interface with invented APIs.
```
