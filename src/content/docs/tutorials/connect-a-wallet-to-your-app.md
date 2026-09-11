---
title: Connect a Wallet to Your App
description: Build a small TypeScript dapp that connects an installed wallet and sends a localnet HOG transfer with receipt recovery.
---

Build a browser dapp that discovers installed wallets, connects an account, and asks the user to approve a **0.1 HOG** transfer. The wallet holds the keys. Your app builds the call, saves its transaction hash before submission, and checks the receipt.

## Before You Start

- Use Node.js `22.12.0` or newer and a browser with an installed Groundhog provider, such as Thruput Wallet.
- Start an isolated local ledger with `groundhog node`. See [Develop Locally](/tutorials/develop-locally/#4-start-the-local-node) for CLI and runtime setup. Keep that process running.
- In Thruput Wallet, select **Localnet** (`http://127.0.0.1:9545`), unlock a test account, and choose **Request test HOG**. Wait for success. Have a second localnet test account's address ready and fund it too, so the transfer does not need to create an unfunded receiver's balance storage.

Use this app in one tab on that ledger. Restarting the node discards its state. Localnet's fixed network hash does not distinguish separate ledger runs, so a saved hash from an earlier run cannot recover a transaction on the new one.

## 1. Create the App

Create a vanilla TypeScript project:

```bash
npm create vite@latest wallet-demo -- --template vanilla-ts
cd wallet-demo
npm install
```

Configure registry access using [TypeScript SDK installation](/tools/typescript-sdk/#install), then install the SDK packages:

```bash
npm install @groundhogchain/client @groundhogchain/protocol
```

Replace `index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Localnet wallet demo</title>
  </head>
  <body>
    <h1>Send 0.1 HOG on Localnet</h1>
    <fieldset id="controls">
      <legend>Wallet actions</legend>
      <div id="wallets">Waiting for an installed wallet.</div>
      <pre id="session">Disconnected</pre>
      <label>Recipient address <input id="recipient" placeholder="0x…" /></label>
      <button id="send" disabled>Send 0.1 HOG</button>
      <button id="check" disabled>Check saved transaction</button>
      <button id="disconnect" disabled>Disconnect</button>
    </fieldset>
    <pre id="status" role="status"></pre>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

## 2. Discover and Connect

Replace `src/main.ts` with the following code, then append the next two blocks to the same file. The app uses the first account authorized in the wallet's connection prompt and displays it before enabling Send.

```ts
import { addressFromHex, createGroundhogClient, localnet, toHex0x } from "@groundhogchain/client";
import { ERC20 } from "@groundhogchain/client/contracts";
import { discoverWalletProviders, parseWalletSession, type WalletProvider,
  type WalletSession } from "@groundhogchain/client/provider";
import { createProviderWalletClient, type ProviderWalletClient } from "@groundhogchain/client/wallet";
import { ExecResult, HOG_ADDRESS, fromHex, gasAmount, sha256Hash } from "@groundhogchain/protocol";

const controls = document.querySelector<HTMLFieldSetElement>("#controls")!;
const choices = document.querySelector<HTMLDivElement>("#wallets")!;
const details = document.querySelector<HTMLPreElement>("#session")!;
const status = document.querySelector<HTMLPreElement>("#status")!;
const recipient = document.querySelector<HTMLInputElement>("#recipient")!;
const send = document.querySelector<HTMLButtonElement>("#send")!;
const check = document.querySelector<HTMLButtonElement>("#check")!;
const disconnect = document.querySelector<HTMLButtonElement>("#disconnect")!;
const message = (text: string) => { status.textContent = text; };

async function start() {
  const client = await createGroundhogClient({ cluster: localnet() });
  const networkHash = toHex0x(client.network.networkHash).slice(2);
  let provider: WalletProvider | undefined;
  let session: WalletSession | undefined;
  let active: ProviderWalletClient | undefined;
  let stopChanges: (() => void) | undefined;
  let busy = false;
  let closed = false;

  function update(value: unknown) {
    active?.dispose(); // Every change invalidates pending wallet work.
    session = undefined;
    try { if (value !== undefined) session = parseWalletSession(value); }
    catch { message("Invalid wallet session. Reconnect."); }
    const account = session?.accounts[0];
    const matches = session?.networkHash === networkHash;
    details.textContent = session
      ? `Account: ${account?.address ?? "Disconnected"}\nNetwork: ${session.networkHash}`
      : "Disconnected";
    send.disabled = check.disabled = !account || !matches;
    disconnect.disabled = !provider;
    if (session && !matches) message("Select Localnet in the wallet, then reconnect.");
  }

  async function run(action: () => Promise<void>) {
    if (busy || closed) return;
    busy = controls.disabled = true;
    try { await action(); }
    catch (error) { message(error instanceof Error ? error.message : "Wallet request failed."); }
    finally { busy = controls.disabled = false; }
  }

  const stopDiscovery = discoverWalletProviders((choice) => {
    if (!choices.querySelector("button")) choices.textContent = "";
    const button = document.createElement("button");
    button.textContent = `Connect ${choice.info.name}`;
    button.onclick = () => { void run(async () => {
      stopChanges?.();
      provider = choice;
      update(undefined);
      // Subscribe before connect, including changes emitted during its prompt.
      stopChanges = choice.on("change", update);
      const connected = await choice.request({ method: "connect" });
      if (closed) return;
      update(connected);
      if (!session?.accounts[0]) throw new Error("No authorized account. Reconnect.");
      if (session.networkHash === networkHash) message("Connected. Check the account and recipient before sending.");
    }); };
    choices.append(button);
  });
```

`localnet()` pins the RPC network identity. The app compares the wallet session with that verified identity; it does not adopt a network selected by the wallet. Provider names are rendered as text.

## 3. Prepare, Sign, Save, and Submit

Append this code inside `start()`. `ERC20` is a generated binding shipped with the SDK. HOG has seven decimals, so `1_000_000n` base units is 0.1 HOG. `prepareExecution()` wraps this transfer through DefaultWallet; `signTransaction()` requests approval without broadcasting.

```ts
  function selection() {
    const account = session?.accounts[0];
    if (!provider || !account || session?.networkHash !== networkHash) {
      throw new Error("Connect a Localnet account first.");
    }
    return { provider, account, key: `wallet-demo:${networkHash}:${account.address}` };
  }

  async function observe(key: string, hash: string) {
    message(`Checking Localnet transaction ${hash}`);
    try {
      const receipt = await client.waitForTransactionReceipt(
        sha256Hash(fromHex(hash.slice(2))), { timeoutMs: 30_000 },
      );
      const result = receipt.execResult === ExecResult.ExecResultOK
        ? "Transfer succeeded" : `Execution failed: ${ExecResult[receipt.execResult]}`;
      message(`${result}\nLocalnet transaction: ${hash}`);
      try { localStorage.removeItem(key); }
      catch { message(`${result}\n${hash}\nCould not clear the saved record. Check again later.`); }
    } catch {
      message(`Outcome unresolved. Keep this Localnet hash: ${hash}\nUse Check saved transaction. Do not send a replacement.`);
    }
  }

  send.onclick = () => { void run(async () => {
    const { provider, account, key } = selection();
    if (localStorage.getItem(key)) throw new Error("Check the saved transaction before sending again.");
    const receiver = addressFromHex(recipient.value.trim());
    const wallet = createProviderWalletClient({ client, provider, account, networkHash });
    active = wallet;
    let submitting = false;
    let hash = "";
    try {
      const transaction = await wallet.prepareExecution({
        invocation: ERC20.transfer.invocation(HOG_ADDRESS, gasAmount(500_000n), {
          receiver, amount: 1_000_000n,
        }),
        gasLimit: gasAmount(10_000_000n),
      });
      message("Review the 0.1 HOG transfer in your wallet.");
      const signed = await wallet.signTransaction(transaction);
      hash = signed.hash;
      localStorage.setItem(key, hash); // If this throws, submission never starts.
      submitting = true;
      await wallet.submitTransaction(signed);
      await observe(key, hash);
    } catch (error) {
      if (submitting) message(`Broadcast may have occurred. Localnet hash: ${hash}\nUse Check saved transaction.`);
      else throw new Error("No broadcast requested. Check the wallet, recipient, and browser storage.", { cause: error });
    } finally {
      wallet.dispose();
      active = undefined;
    }
  }); };
```

The recovery key includes the original network and account. Only the hash is stored because recovery here only reads receipts. A submission acknowledgment is not execution success. Any error after submission starts leaves the record in place.

## 4. Check Status and Clean Up

Append this final block. It closes `start()` and starts the app:

```ts
  check.onclick = () => { void run(async () => {
    const { key } = selection();
    const hash = localStorage.getItem(key);
    if (!hash) { message("No saved transaction for this Localnet account."); return; }
    if (!/^0x[0-9a-f]{64}$/.test(hash)) throw new Error("Invalid saved transaction hash.");
    await observe(key, hash);
  }); };
  disconnect.onclick = () => { void run(async () => {
    active?.dispose();
    await provider?.request({ method: "disconnect" });
    update({ networkHash, accounts: [] });
    message("Disconnected. Saved transaction hashes are kept.");
  }); };
  function cleanup() {
    closed = true;
    active?.dispose();
    stopChanges?.();
    stopDiscovery();
  }
  window.addEventListener("pagehide", cleanup, { once: true });
  window.addEventListener("pageshow", (event) => { if (event.persisted) location.reload(); });
  import.meta.hot?.dispose(cleanup);
}
void start().catch(() => message("Cannot connect to Localnet. Start the node, then reload."));
```

The app creates a fresh adapter for each Send action and disposes it afterward. Account or network changes invalidate pending approval work. Cleanup removes listeners without revoking access; the user's Disconnect action requests revocation. None of these actions automatically re-signs or retries a transfer.

## 5. Try It

Run `npm run dev` and open the localhost URL printed by Vite. Choose your wallet, approve access, and check the displayed account and network. Paste your funded test recipient's address, click **Send 0.1 HOG**, and review the amount and recipient in the wallet before approving.

Expect a transaction hash followed by **Transfer succeeded** or **Execution failed**. If the outcome is unresolved, use **Check saved transaction**. After a reload, reconnect the same account on the same running ledger to check its saved hash. Switching accounts leaves the original record intact. Status checks only query RPC; they never sign or submit.

If no wallet appears, enable the extension for this browser profile and reload. If you reject approval, start another Send only when you intend a new transfer. A missing receipt or timeout does not prove that a submitted transaction failed.

This small app keeps one unresolved hash per account and network and blocks another send until it gets a receipt. It does not coordinate multiple tabs or provide a manual resolution screen for transactions that never receive a receipt. Keep the hash and investigate on the original ledger using the [recovery guide](/tools/wallet-integration/#recover-an-ambiguous-submission).

## Next Steps

- [Wallet Integration](/tools/wallet-integration/) covers provider errors, lifecycle rules, and recovery policies for a larger app.
- [Work with Groundhog from TypeScript](/tutorials/work-with-groundhog-from-typescript/) shows how to generate your own contract binding. Replace the ERC-20 invocation with your contract's typed call and keep the same wallet flow.
