---
title: Introduction
description: Learn what Project Thruput is and how compatible updates let contracts share state.
sidebar:
  label: Introduction
---

Project Thruput is a moonshot project exploring how parallel execution can make compute abundant. Transactions record compatible changes to shared state, allowing the network to combine them without requiring sequential execution.

The project's future is open. No decisions have been made about mainnet or its relationship to Stellar. These docs describe the development network and tools available today.

You write contract logic in Rust and connect applications through the TypeScript client or React library. The runtime combines changes using rules defined by the storage type.

## Record the change

Consider a counter with a value of `100`. Two transactions want to increase it, one by `5` and the other by `3`.

If each transaction replaces the value it read, they propose different results: `105` and `103`. With mergeable integer storage, they record the increases instead:

```text
Starting value:    100
Transaction A:     +5
Transaction B:     +3
Combined value:    108
```

These increases can combine if the rest of the transactions are compatible and network limits permit them. Neither transaction needs to calculate a replacement value that includes the other's update.

This is useful for shared counters and balances. It does not make every operation independent: replacing a value, enforcing uniqueness, or choosing a winning order can require different rules. Your storage choices determine which changes can combine.

[Parallel Execution](/how-it-works/execution-model/) explains how Project Thruput applies these rules. [Storage types](/programming-model/storage-types/) shows how to use them in a contract.

## Build in two layers

**Contracts** define application rules and store onchain state. Use the Rust SDK to write and test them, and the CLI to build, deploy, and inspect them.

**Applications** read contract data and request transactions. The TypeScript client provides network and contract operations. The React library adds wallet connection and balance hooks for interfaces.

You can start with either layer. An application can use an existing contract without implementing one first.

## Where to start

Choose a path in [Get Started](/get-started/) to write code. To explore the platform first, use the [System Overview](/how-it-works/architecture/) as a map, then follow the [Transaction Lifecycle](/how-it-works/transaction-lifecycle/) or read about [Compute, Capacity & Storage](/how-it-works/storage-economics/).
