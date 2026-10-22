---
title: Wallet Extension
description: Install the wallet for Stellar Thruput in Chrome, create a test wallet, and connect it to a Devnet app.
---

The Stellar Thruput wallet extension supports Devnet and Localnet. It appears as **Thruput Wallet** in Chrome. The prebuilt download needs no Node.js, Rust, or package-registry access. Use a test wallet for development.

The hosted network is now called Futurenet. The wallet extension and the
screenshots below still use the Devnet label.

## Download and extract

[Download Thruput Wallet](https://groundhog-public-release-artifacts-017820684264.s3.us-west-2.amazonaws.com/wallet/f877c655c6778b195a651c61cc8e6f2da055d2bba33f621a9841a76f81fe0c80/thruput-wallet.zip) · [SHA-256 checksum](https://groundhog-public-release-artifacts-017820684264.s3.us-west-2.amazonaws.com/wallet/f877c655c6778b195a651c61cc8e6f2da055d2bba33f621a9841a76f81fe0c80/SHA256SUMS)

Extract the ZIP. The `thruput-wallet` folder contains `manifest.json`, `index.html`, and the extension scripts. Keep that folder in a stable location; Chrome loads the extension from it.

## Load it in Chrome

1. Open `chrome://extensions` in the address bar.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the extracted **thruput-wallet** folder, not the ZIP or its parent folder.
5. Open the puzzle-piece menu beside Chrome's address bar. Find **Thruput Wallet** and click its pin button to keep it in the toolbar.

![Chrome's Extensions page with Developer mode enabled, Load unpacked, and Thruput Wallet enabled](/images/wallet/wallet-install.png)

If Chrome cannot find the manifest, select the folder that directly contains `manifest.json`.

## Create a test wallet

Open the wallet from the toolbar. Select **New wallet**, enter and confirm a password of at least 12 characters, then click **Create wallet**. The password unlocks the wallet on this device.

![Thruput Wallet's New wallet screen with password and confirmation fields and the Create wallet button](/images/wallet/wallet-create.png)

Follow the prompt to back up your recovery phrase in **Settings**. Keep the phrase private. Use **Restore wallet** if you already have a test recovery phrase you want to use.

<span id="select-devnet-and-get-test-hog"></span>

## Select Devnet and get native test tokens

Check the network dropdown. New wallets start on **Devnet**; existing wallets keep their saved selection.

Open **Assets** and click **Request test HOG**, the wallet's label for native test tokens. Wait for the balance to update. These tokens have no monetary value. They fund storage deposits and provide scheduling capacity under load; there are no conventional gas fees.

![Wallet showing the Devnet selector, Assets tab, and Request test HOG button](/images/wallet/wallet-devnet.png)

| Network | RPC endpoint | Use |
| --- | --- | --- |
| Devnet | `https://rpc.thruput.network` | Hosted apps and shared development |
| Localnet | `http://127.0.0.1:9545` | A node running on your computer |

For local work, [start a local node](/cli/local-node/) before selecting Localnet. Changing networks clears app connections and pending approvals. Reconnect from the app afterward.

You can also copy the wallet's public address and use the [hosted faucet](/tools/faucet/).

## Connect to an app

1. Open the app and choose its wallet connection action. Select **Thruput Wallet** if it offers a wallet picker.
2. In the approval popup, check the site and choose the account to share.
3. Click **Connect**. The app should display the connected account.
4. For an update, review and approve the separate transaction request in the wallet.

Closing the connection popup cancels that connection request. Connecting an account does not approve future transactions. Use the app's disconnect control when finished.

Try this with [counter part 4](/tutorials/connect-a-wallet-to-your-app/). To add wallet support to your own app, use the [TypeScript integration](/tools/wallet-integration/) or [React wallet hooks](/react/wallets/).

## Update or build from source

After replacing the extension files, click **Reload** on its card in `chrome://extensions`, then refresh app tabs so they load the current provider.

For a source build, follow the [wallet README](https://github.com/thruputchain/thruput-examples/tree/main/apps/wallet-extension). That path needs repository and package access; load its generated `dist` folder in Chrome.

## If something does not work

| Symptom | Check |
| --- | --- |
| The app does not detect a wallet | Enable the extension, allow it on the site, and refresh the app tab. |
| Chrome cannot find the manifest | Select the extracted `thruput-wallet` folder, or `dist` for a source build. |
| Wrong network | Select the app's network in the wallet, then reconnect from the app. |
| Connection no longer works after a Devnet reset | Select Devnet again to refresh its network identity, then reconnect. |
| No native test tokens yet | Wait for the request to finish and follow any displayed cooldown or error. |
| A transaction has a hash but no result | Inspect that hash in the [Explorer](/tools/block-explorer/) or with [the CLI](/cli/transactions/#look-up-one-transaction) before submitting another update. |
