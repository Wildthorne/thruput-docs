---
title: Consume the Firehose
description: Connect to the hosted Futurenet firehose from a browser or Node, acknowledge blocks, and resume from durable progress.
---

The hosted Futurenet firehose is `wss://firehose.thruput.network`. It carries public chain data without authentication. It is experimental and has no SLA.

Use it for whole-block push delivery and bounded replay. Each block contains exact stored `EventIndexerPulledBlock` XDR bytes, transported as hex. Saving these bytes does not verify their commitments. Decode and verify with compatible protocol bindings if your application requires that assurance.

## Connect from a browser

Open a browser console and run:

```js
const ws = new WebSocket('wss://firehose.thruput.network');
ws.addEventListener('open', () => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'firehose_subscribe',
    params: [{ from: 'tip' }],
  }));
});
ws.addEventListener('message', ({ data }) => console.log(JSON.parse(data)));
```

Browsers can connect directly; WebSocket connections do not use a CORS preflight. A page's own Content Security Policy must permit the endpoint.

This first snippet only inspects messages. Close it with `ws.close()` before running a consumer. There is one subscription per connection, at most 8 concurrent connections per client IP, and 12 active subscribers globally.

## Process and acknowledge

A subscribe response returns the transport subscription ID. Notifications use `firehose_block` and carry `params.subscription` for routing. A block payload looks like this (hex abbreviated):

```json
{
  "type": "block",
  "subscriberId": 1,
  "block": {
    "schemaVersion": 2,
    "height": 42,
    "consensusHash": "<base58>",
    "byteLength": 27600,
    "record": "0x...",
    "ingestedAtUnixMicros": 1789720800000000
  }
}
```

`schemaVersion` is `2`. `consensusHash` is unprefixed base58. `byteLength` counts raw XDR bytes, not hex characters. `ingestedAtUnixMicros` is absent on archive reads.

The server waits for an application ACK before sending the next block. After durable processing, send:

```js
ws.send(JSON.stringify({
  jsonrpc: '2.0', id: 2, method: 'firehose_ack', params: [1, 42],
}));
```

Use the notification's `subscriberId`, not the transport subscription ID. The ACK result is `null`. Use `firehose_unsubscribe` with `[subscriptionId]` to remove a subscription.

For a browser application, store output and an inclusive replay height together in an IndexedDB transaction before ACKing. After the ACK response succeeds, advance that checkpoint to the following height. If the ACK response is lost, keep the earlier replay height and process it idempotently. A received message or console log is not durable progress.

## Run the Node consumer

Use [consume-firehose.ts](https://github.com/thruputchain/thruput-examples/blob/main/examples/typescript/consume-firehose.ts) from the examples repository. Use Node 22.18 or newer. Clone the repository if you do not already have it, then install its dependencies and run from the repository root:

```bash
git clone https://github.com/thruputchain/thruput-examples.git
cd thruput-examples
npm install
npm run example:consume-firehose
# Optional configuration:
FIREHOSE_URL=wss://firehose.thruput.network OUTPUT_DIR=./my-output \
  npm run example:consume-firehose
```

Run one consumer per output directory on a filesystem supporting file and directory sync and atomic rename. A new directory subscribes at tip, meaning the next publication after registration. It does not request genesis or replay the current tip.

For each block the example validates the height and byte length, saves the inclusive replay height in `cursor.json`, writes and syncs `HEIGHT.xdr`, then ACKs. After a successful ACK response it saves the following height. Replaying a height overwrites the same output file. This is an idempotent byte sink, not a decoded indexer or a commitment verifier. Replace the file write with your application's durable transaction as needed.

The checkpoint includes the endpoint so an accidental URL change cannot silently reuse another service's cursor. Keep the output and checkpoint together. After a crash, a leftover `.tmp` file is not committed progress; the consumer resumes from `cursor.json`.

## Reconnect and resume

The Node example reconnects after transport loss with a 2-second delay. Stop it with Ctrl-C and restart with the same output directory to resume. It sends the saved inclusive replay height:

```json
{"jsonrpc":"2.0","id":1,"method":"firehose_subscribe","params":[{"from":"height","height":43}]}
```

Persist progress from the last acknowledged cursor, allowing conservative replay if ACK delivery or saving the checkpoint was uncertain. Do not resume from the last height merely received. A lost ACK response can cause a processed block to repeat across connections, so application effects must be idempotent.

A terminal notification has this payload:

```json
{"type":"closed","reason":"catchup_timeout","nextHeight":43}
```

Stop consuming that subscription. This is an application message, not a WebSocket close frame. It can be lost on a broken connection; your durable checkpoint remains the recovery source. The example stops on terminal notifications, JSON-RPC errors, and processing failures so you can inspect the cause.

## Handle an expired cursor

At attach, a height below `max(0, tip - 42428)` is rejected with JSON-RPC error `-32009`, message `below_window`. No records are delivered for that rejected request.

The serve window is 42,428 blocks, about 24 hours at about 2 seconds per block. Store retention is about 7 days, but clients can only request within the serve window. History starts when the archive started; neither genesis replay nor any depth beyond the window is promised. Even within the window, unavailable historical records terminate with `archive_error`.

On `below_window`, restore application state from another source or explicitly accept the missing interval and start a new tip subscription. For the example, using a new output directory makes that reset explicit and preserves the old checkpoint. Do not automatically replace an expired cursor with tip.

## Keep up with delivery

On the hosted Futurenet the live send plus ACK deadline is 60 seconds. A full live queue or expired live deadline demotes the subscriber to archive catch-up. An outstanding operation gets one additional 60-second catch-up deadline before `catchup_timeout`. Growing lag over the 120-second progress window terminates with `catchup_falling_behind`.

Blocks can be up to about 16 MB (about 32 MB of hex). A client must sustain roughly the chain's record rate to keep up during a large-block burst; one that cannot falls behind and is closed with `catchup_falling_behind`, and can resume from its saved cursor.

Keep processing bounded and inspect [API errors, limits, and close reasons](/reference/firehose/) before retrying. `firehose_stats` reports active subscribers and process counters; sent counts measure transport enqueue, not completed application work.

Operators can also run `hog-firehose-store` and `hog-firehose-serve` themselves.
