---
title: Deploy a contract
description: Deploy a supplied RV32 artifact from TypeScript with explicit funding and optional atomic initialization.
---

Use this task when an application or service deploys a supplied contract artifact. You do not need to write Rust, but you do need the `.rv32a` artifact and the bindings from its build. For ordinary developer deployment, use [the CLI](/cli/deploy-and-call/).

## Prepare the deployment identity

For the generated counter, place its artifact and binding in your project. This Node.js example uses the funded account from [Use a signer in scripts](/typescript/accounts/):

```ts
import { readFile } from "node:fs/promises";
import { gasAmount, parseUnits, prepareContractDeployment, toHex0x } from "@groundhogchain/client";
import { Counter } from "./contracts/my-counter.js";
import { account, wallet } from "./wallet.js";

const artifact = await readFile("artifacts/my_counter.rv32a");
const deployment = prepareContractDeployment({
  deployer: account.address,
  contract: artifact,
});
console.log("Predicted address:", toHex0x(deployment.address));
```

Preparation hashes the artifact and predicts its address without signing or submitting. Retain the deployment nonce if you need to reproduce that identity. It differs from the transaction nonce used for replay protection.

## Fund, deploy, and initialize

```ts
const result = await wallet.deployContractAndWait(deployment, {
  gasLimit: gasAmount(10_000_000n),
  amount: parseUnits("10", 7),
  initializer: Counter.v0_1.initialize.invocation(
    deployment.address,
    gasAmount(500_000n),
    { initialValue: 10n },
  ),
});
console.log("Deployed:", toHex0x(result.address));
```

`amount` is explicit native-token funding in base units for the target contract. The example allocation and gas budgets are not universal costs. `0n` skips the funding transfer. The sender still needs scheduling capacity for the root transaction.

Funding, deployment, and the optional initializer form one atomic operation. The initializer targets the predicted address and sees the wallet as its caller. If it fails, the operation rolls back. The helper waits for success and verifies the returned deployment address.

## Deploy through a provider wallet

The provider adapter supports the same deployment plan and options, with an additional `{ onSigned }` lifecycle argument. Use the authorized provider account's address as `deployer`. See [Send transactions](/typescript/transactions/#send-through-a-browser-wallet) for persistence before submission.

Inspect the original transaction hash if observation fails rather than generating a new deployment attempt. See [Track transaction results](/typescript/transaction-status/).
