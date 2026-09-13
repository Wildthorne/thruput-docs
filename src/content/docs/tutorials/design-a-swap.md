---
title: Design a Swap
description: How a constant-product AMM is built on Groundhog, and why the execution model shapes it.
---

This page follows the contracts behind a swap application. The implementation
adapts Uniswap V2's [pair operations][UniswapV2Pair] and [supporting math
libraries][UniswapV2PeripheryLibraries] to Groundhog's snapshot execution model.
Requests enter a queue concurrently, then a separate transaction processes them
against the pair's reserves.

**Prerequisites:** [Build a Token](/tutorials/build-a-token/). You should be
able to write a contract, deploy it, and call another contract through a
generated client.

[UniswapV2Pair]: https://github.com/Uniswap/v2-core/blob/master/contracts/UniswapV2Pair.sol
[UniswapV2PeripheryLibraries]: https://github.com/Uniswap/v2-periphery/tree/master/contracts/libraries/

:::note[Naming]
For your reference while following along, the example swap application
currently lives in the `groundhog-examples` repository.
:::

## The problem

For each token-pair that the application manages, it tracks its own reserves of
each of the two tokens. Every pair operation reads these balances, computes
against them, and writes them back:

```rust
let (reserve0, reserve1) = self.reserves.get();
let amount_out = compute_output(amount_in, reserve0, reserve1);
self.reserves.set(&(reserve0 + amount_in, reserve1 - amount_out));
```

On Groundhog, every transaction in a block reads the same committed snapshot.
If two transactions compute different reserve values for the same pair, their
writes cannot merge. One transaction can land while the other is excluded and
returned to the mempool. Identical writes can coexist, so the reserve field
alone does not enforce one operation per pair per block.

A direct port therefore needs to account for both conflicting writes and
operations that compute identical reserves. Processing requests sequentially
inside one transaction makes each operation use the preceding operation's
updated reserves. See [Execution Model](/how-it-works/execution-model/) for the
storage merge rules.

:::caution[The serial part stays serial]
Nothing here makes the pair's operations concurrent. They cannot be: each one
genuinely depends on the result of the last. What changes is *when* the serial
work happens, and how many operations can be performed in one block.
:::

## Split acceptance from execution

Although a pair operation itself has to be performed serially with respect to
other operations on the same pair, accepting a request does not.

So our implementation splits them: instead of performing an operation
immediately, user requests (many per block) are accepted into a queue. The
queue is processed later, in a transaction of its own.

```
  many transactions, one block              one transaction, later
  ┌──────────┐
  │ Alice    │──┐
  ├──────────┤  │   ┌───────────┐          ┌────────────────────┐
  │ Bob      │──┼──▶│   queue   │─────────▶│ drain: op, op, op  │
  ├──────────┤  │   └───────────┘          └────────────────────┘
  │ Carol    │──┘   inserts commute      serial execution, as required
  └──────────┘
```

The queue is an `RCQ`, a "retro-causal queue" provided by the SDK. Inserts
**commute**: two transactions inserting in the same block do not conflict. Many
requests can be accepted together.

Draining is the other half of the RCQ rule: only one transaction per block may
consume from a given queue. That is exactly the serialization the pair needs,
and now it costs one transaction per block instead of one per user.

With this arrangement, a single transaction can process multiple operations
against updated reserves, bounded by its execution budget.

:::tip[The general lesson]
When two transactions conflict, the fix is usually to change *what you write*,
not to add locking. A write that commutes (a queue insert, a balance delta)
doesn't require a transaction to be deferred.
:::

## Batch the serial work

We call processing the request-queue *cranking*, and anyone may do it.
`Queue::crank` in the `batch-driver` helper crate takes requests off the queue
one at a time and hands each to a closure that knows how to perform it. The
swap application provides that closure:

```rust
self.queue.crank(|request, gas_limit| {
    cfg.handler()
        .with_commit_locking()
        .with_gas_limit(gas_limit)
        .try_handle_request(request)
})
```

Some details to explain:

**`with_gas_limit`.** Each request carries its own budget, and the processing
loop performed in `crank` checks that the frame can still afford one before
taking it off the queue. (A request is never consumed and then dropped for want
of gas to handle it.)

**`with_commit_locking`.** A request that fails should not take the batch down
with it. "Commit-locking" settles the sub-call's effects as soon as it returns
(instead of waiting until the end of the transaction to check invariants), so a
failed request can be rolled back alone and the processing continues to the
next one. The closure above catches errors using the `try_*` variant of a
cross-contract call, and the loop continues with more requests.

### The gas limit is the batch size

Although a root transaction (the one signed by a sender) declares a gas limit,
executing it on Groundhog does not *consume* any tokens; rather, tokens are
temporarily reserved while the transaction occupies a portion of the chain's
scheduling capacity. (See [Execution](/programming-model/execution/).)

A crank runs until the queue is empty or the frame's remaining gas is no longer
sufficient to run another request, so **the caller chooses the batch size by
choosing a gas limit**. No batch size is fixed inside the contract for
everyone. A caller can request a small batch, subject to the minimum described below. Someone clearing a backlog asks for a large one. (The
`batch-driver` helper provides `gas_for_batch` for converting a request count
into the necessary gas limit.)

## Nobody has to be on duty

Cranking needs no privilege, so the policy can be simple: after submitting a
request, send a crank as its own transaction with a short expiry, and stop.

Nothing needs to be polled, timed, or estimated, because every way a crank can
turn out is harmless:

| Outcome | What happens |
|---|---|
| Another crank won the block | Yours is excluded and returns to the mempool. It may be included before its expiry. |
| The queue was empty at the snapshot | Yours commits having done nothing, writing no delta and conflicting with nobody. |
| Otherwise | It drains the queue, up to the batch its gas limit allows. |

The short expiry keeps the first case from becoming a nuisance: a crank that
loses several blocks running should give up rather than land much later as a
pointless no-op.

If an operator chooses to provide a queue-keeper mechanism, its operation will
compose with this without any reconfiguration. When the keeper's crank runs,
everyone else's cranks defer harmlessly behind it. If it stops, theirs
immediately take up the slack.

:::tip[The general lesson]
An excluded crank leaves no committed effects. It can be considered again
until its expiry, without coordinating with other crank callers.
:::

### Minimum batch size

Because batch sizes determine application throughput, we want to ensure that
each block's one opportunity to drain the queue is not wasted on too small a
batch. So the application's policy requires that a crank be able to process
what is currently waiting in the queue, up to a configured `min_crank_batch`;
otherwise it is refused before the queue is touched.

## A queue costs storage, so it needs a ceiling

Storage on Groundhog is a refundable deposit paid from the contract's own
balance. See [Storage Economics](/how-it-works/storage-economics/). A queue
anyone can add to is therefore an unbounded claim on whoever funds the
contract.

We represent a ceiling with a `CapacityConstraint`, an SDK type that holds the
room *remaining* rather than the number of entries used:

```rust
self.slots.consume_capacity(1);   // take this request's room
```

The constraint mechanism allows transactions to consume capacity (corresponding
to slots in the finite-sized queue) without conflict, but prevents exhaustion
in any particular block. The ceiling is built into the `Queue` datatype in the
`batch-driver` helper crate.

### Early is not the same as failed

Note that a transaction that submits a request and thus consumes a unit of
queue capacity (as in the line of code above) does not explicitly check whether
any capacity is available. If it did (if the capacity constraint were checked
at call time), a request arriving at a full queue would have to fail
deterministically. The transaction would be committed with the block, have no
effect due to the failure, and not be retried. The user would have to submit a
new transaction.

Instead, capacity consumption is checked against all concurrent transactions in
aggregate when they are being committed as a block; if a resource would be
exhausted, some transaction(s) will be excluded from the block and returned to
the mempool. Thus the request can land later, once a crank frees capacity. (A
caller who cannot wait indefinitely bounds the wait with the transaction's
expiry height.)

## Getting the answer back

As a request is not served in the transaction that submits it, the submitter
cannot be given a result. It is provided an identifier instead.

`UniqueIds` (in the `unique-ids` helper crate) mints that identifier from the
submitting transaction's hash and a stored counter. Both halves are needed: the
counter separates requests made in one transaction, and the transaction hash
separates requests made in different ones, including concurrent transactions in
the same block that observe the same counter because neither can see the
other's delta.

The identifier is returned to the caller and stamped on the queued request, so
it reappears on whatever event that request eventually produces:

```
  submit ──▶ RequestAccepted { request_id }
                    ⋮
  crank  ──▶ SwapEvent { request_id, ... }       // success
         or  RequestFailed { request_id, ... }
```

`RequestAccepted`, `RequestFailed` and `RequestsProcessed` are defined in
`batch-driver` and emitted by the queue itself, so every application built on
this pattern reports on its queue in the same way.

## Components

| Crate | Role |
|---|---|
| `swap-if` | Interfaces only: every trait, client, error, and shared value type |
| `swap-pair` | The fundamental operations. Not a contract; the handler runs it in its own invocation |
| `swap-handler` | Performs one request: prices it against live reserves, moves the assets |
| `swap-driver` | Holds the queue, batches requests, forwards each to the handler |
| `swap-router` | Builds requests from user operations and enqueues them with the appropriate driver |
| `swap-factory` | Creates pairs and keeps a registry |
| `batch-driver` | The reusable part: `Queue`, its crank policy, and the three events |
| `unique-ids` | `UniqueIds` |

## Each link takes work only from its predecessor

A request names the account whose tokens it will spend. Nothing downstream from
the directly called contract can check that claim, because it is the only one
that can see (via [`get_caller`](/how-it-works/invocation-frames/)) who is
submitting the request.

```
  user ──▶ SwapRouter ──▶ SwapDriver ──▶ SwapHandler ──▶ pair operations
           sees the        accepts        accepts
           caller          only from      only from
                           the router     its driver
```

So the router is the only contract that can attribute a request to an account,
and each link afterwards accepts work only from its predecessor. `SwapDriver`
checks that its caller is the router before enqueuing; `SwapHandler` checks
that its caller is its driver before handling. Without those checks, anyone
could enqueue a request naming a victim as the payer and themselves as the
recipient, and be paid out of the victim's standing allowance.

In contrast, `process_requests` takes no privilege at all: cranking is
permissionless, because a crank can only perform requests that were already
accepted, and the more participants willing to do it the better.

## Next steps

- [Execution Model](/how-it-works/execution-model/) for snapshots, conflicts,
  and exclusion
- [Execution](/programming-model/execution/) for gas, scheduling capacity, and
  merged deltas
- [Storage Types](/programming-model/storage-types/) for `RCQ`, `NNInt`, and
  what commutes
- [Storage Economics](/how-it-works/storage-economics/) for deposits and who
  pays for them
