---
title: Wallet Extension
description: Download and install the Thruput fork of Freighter in Chrome for Futurenet testing.
---

Use [Thruput Freighter](https://github.com/thruputchain/freighter), a fork of Stellar's Freighter wallet with added Thruput support. Developer builds are available for Futurenet testing.

## Download and extract

1. Sign in to GitHub.
2. Open the [successful Run Tests builds](https://github.com/thruputchain/freighter/actions/workflows/runTests.yml?query=is%3Asuccess).
3. Open the newest run with a **thruput-freighter-dev-…** download in its **Artifacts** section.
4. Download the artifact ZIP and extract it.

Artifacts expire after 14 days. If no download is available, follow the source-build instructions in the [Freighter repository](https://github.com/thruputchain/freighter).

Keep the extracted folder in a stable location. Chrome loads the extension from the folder that directly contains `manifest.json`.

## Load it in Chrome

1. Open `chrome://extensions` in the address bar.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the extracted folder that directly contains `manifest.json`, not the ZIP or its parent folder.
5. Open the puzzle-piece menu beside Chrome's address bar. Find **Thruput Freighter Dev** and click its pin button to keep it in the toolbar.

![Chrome's Extensions page with Developer mode enabled and the Load unpacked button](/images/wallet/wallet-install.png)

Open the extension from the toolbar and follow its setup prompts. Use a test wallet for development. To request native test tokens, copy your public address and use the [Futurenet faucet](/tools/faucet/).

## Update the extension

Download and extract a newer build into the same folder. Click **Reload** on the extension's card in `chrome://extensions`, then refresh any connected app tabs.

## If something does not work

| Symptom | Check |
| --- | --- |
| No artifact download | Sign in to GitHub and choose a successful run with an unexpired **thruput-freighter-dev-…** artifact. |
| Chrome cannot find the manifest | Select the extracted folder that directly contains `manifest.json`. |
| The app does not detect a wallet | Enable the extension, allow it on the site, and refresh the app tab. |

For application integration, see the [TypeScript integration](/tools/wallet-integration/) or [React wallet hooks](/react/wallets/).
