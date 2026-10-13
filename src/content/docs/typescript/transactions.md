---
title: Send transactions
description: Build typed calls, execute them through a wallet, and distinguish submission from successful execution.
---

A binding builds an application call. A wallet wraps that call into an authorized transaction. Use the wallet's execution helper instead of submitting a contract method directly as the transaction root.

## Send from a script

Set up and fund the account from [Use a signer in scripts](/typescript/accounts/). For this small-transfer example, choose a recipient that already has native tokens. Create `src/send.ts`:

```ts
import { addressFromHex, gasAmount, parseUnits, toHex0x } from "@thruputchain/client";
import { ERC20 } from "@thruputchain/client/contracts";
import { HOG_ADDRESS } from "@thruputchain/protocol";
import { wallet } from "./wallet.js";

const recipient = process.env.THRUPUT_RECIPIENT;
if (!recipient) throw new Error("Set THRUPUT_RECIPIENT to a funded address");

const transfer = ERC20.v0_1.transfer.call({
  contract: HOG_ADDRESS,
  gasLimit: gasAmount(500_000n),
  args: {
    receiver: addressFromHex(recipient),
    amount: parseUnits("0.0001", 7),
  },
});
const { txHash, receipt, values } = await wallet.executeCallsAndWait({
  calls: [transfer],
  gasLimit: gasAmount(1_000_000n),
});
console.log("Committed:", toHex0x(txHash), receipt.height.toString());
console.log("Return value:", values[0]); // transfer returns void
```

```bash
npx tsx src/send.ts
```

The helper waits for successful committed execution and decodes child returns in call order. A returned receipt and a decoded result are separate guarantees; see [Track transaction results](/typescript/transaction-status/) for failures at either boundary.

## Send through a browser wallet

Use the adapter returned by [Connect a wallet](/tools/wallet-integration/). The same typed call works, but the provider helper also requires an `onSigned` callback:

```ts
import type { ContractAddress } from "@thruputchain/client";
import { gasAmount, parseUnits } from "@thruputchain/client";
import { ERC20 } from "@thruputchain/client/contracts";
import { HOG_ADDRESS } from "@thruputchain/protocol";
import type { ProviderWalletClient, ProviderExecutionOptions } from "@thruputchain/client/wallet";

export function sendHog(
  wallet: ProviderWalletClient,
  receiver: ContractAddress,
  onSigned: ProviderExecutionOptions["onSigned"],
) {
  const transfer = ERC20.v0_1.transfer.call({
    contract: HOG_ADDRESS,
    gasLimit: gasAmount(500_000n),
    args: { receiver, amount: parseUnits("0.0001", 7) },
  });
  return wallet.executeCallsAndWait({
    calls: [transfer],
    gasLimit: gasAmount(1_000_000n),
  }, { onSigned });
}
```

Call this from the user's send action. Your `onSigned` implementation must finish saving the signed bytes, hash, account, and network before it resolves. A failed save prevents submission. The SDK does not provide that storage layer.

## Choose an execution helper

| Need | Helper |
| --- | --- |
| Submit and require successful execution | `executeAndWait({ invocation, gasLimit })` |
| Also decode typed child returns | `executeCallsAndWait({ calls, gasLimit })` |
| Get a submitted hash and observe separately in a signer-based script | `execute({ invocation, gasLimit })` |
| Inspect the transaction before signing | `prepareExecution(...)` |

Provider-backed helpers require the additional lifecycle options shown above. Their explicit prepare/sign/submit path is covered in [Wallet integration](/tools/wallet-integration/#prepare-sign-save-submit-observe).

## Execute multiple calls

Pass an ordered list to `executeCallsAndWait` to execute calls atomically. If a call fails, the transaction does not commit earlier calls' state changes. The returned `values` follow the same order.

For a provider wallet, await `getCapabilities()` and inspect the returned `atomicBatch` before offering a multi-call action. `null` means unsupported; `maxCalls` gives the advertised limit. The adapter checks support during preparation as well. One atomic wallet transaction is different from [HTTP request batching](/typescript/transport/#http-batching).

The SDK requests capabilities only when the provider advertises `getCapabilities`. No advertisement or a `4200` response means unsupported batching. Permission errors, transport failures, malformed responses, and account/network mismatches must remain errors. Refresh capability state after a session change; see [batch capability requirements](/tools/wallet-provider/#optional-atomic-batch-capabilities).

Keep a batch within the wallet's advertised limit, up to 16 calls. For explicit preparation, `prepareBatchExecution({ invocations, gasLimit })` builds one unsigned transaction; use the same [sign, save, submit, and observe flow](/tools/wallet-integration/#prepare-sign-save-submit-observe) as a single call.

If batching is unsupported, offer a single-call action only when it meets the user's intended operation. Do not split an operation that requires atomicity. After a batch is rejected or its submission is uncertain, never fall back to individual transactions. Retain its signed evidence and [inspect the original hash](/typescript/transaction-status/).

A batch that enqueues requests commits their acceptance, not their later execution. Track the resulting request IDs and outcomes as described in [Build an AMM](/tutorials/build-an-amm/#understand-acceptance-and-execution).

## Set gas and funding

Each child call has a budget; the root needs enough gas for the wallet wrapper and its child calls. The numbers above are example transfer budgets, not universal defaults. `walletGasLimit(invocations, overhead)` sums invocation budgets and an overhead that you have measured for your workload. For typed calls, pass each call's `invocation` field.

There are no conventional gas fees, but the declared root limit uses scheduling capacity backed by the sender's unlocked native tokens. Storage deposits are separate. A new recipient's first credit must cover its balance storage, so a small first transfer can fail. See [Compute, Capacity & Storage](/how-it-works/storage-economics/).
