---
title: Firehose API
description: Hosted Futurenet WebSocket subscriptions for committed block records, acknowledgements, and resumable replay.
---

| Surface | Contract |
| --- | --- |
| Hosted Futurenet endpoint | `wss://firehose.thruput.network` |
| Transport | JSON-RPC 2.0 over WebSocket with TLS. Browsers connect directly without a CORS preflight |
| Access | No authentication. Public chain data. Experimental, no SLA |
| Usage | [Consume the Firehose](/guides/consume-the-firehose/) |
| Scope | Separate from the JSON-RPC gateway |

## Methods

| Request convention | Value |
| --- | --- |
| Protocol | JSON-RPC 2.0 on the same WebSocket connection |
| Parameters | Positional arrays |

| Method | `params` | Result |
| --- | --- | --- |
| `firehose_subscribe` | `[{"from":"height","height":N}]` or `[{"from":"tip"}]` | Transport subscription ID, used for unsubscribe and notification routing |
| `firehose_unsubscribe` | `[subscriptionId]` | Removes the transport subscription |
| `firehose_ack` | `[subscriberId,height]` | `null`. Must acknowledge this connection's outstanding block; wrong heights, duplicate ACKs, and unknown or foreign subscriber IDs are rejected |
| `firehose_stats` | `[]` | Process totals and active subscriber details below |

| Cursor | Behavior |
| --- | --- |
| `{"from":"height","height":N}` | Inclusive replay from `N`, then follow publications. `0 <= N < 9223372036854775807`. Future heights wait; missing historical records close with `archive_error` |
| `{"from":"tip"}` | Publications after registration only. Does not replay the current tip |
| JavaScript numbers | Heights and subscriber IDs are JSON integers. Reject values outside the safe integer range in a client using `JSON.parse` |

## Notifications

| Envelope field | Value |
| --- | --- |
| `jsonrpc` | `"2.0"` |
| `method` | `"firehose_block"` for both block and terminal notifications |
| `params.subscription` | Transport subscription ID, distinct from `subscriberId` |
| `params.result` | One of the following tagged payloads |

| Block payload field | Type | Meaning |
| --- | --- | --- |
| `type` | string | `"block"` |
| `subscriberId` | integer | Numeric application ID for ACKs on this connection |
| `block.schemaVersion` | integer | Record format version. Currently `2` |
| `block.height` | integer | Committed height |
| `block.consensusHash` | base58 string | Consensus hash contained in the record, not an independent trust anchor |
| `block.byteLength` | integer | Original XDR byte count, before hex or JSON framing |
| `block.record` | hex string | Exact complete stored XDR record, including consensus value, event logs, and transaction bodies. Canonical `0x`-prefixed hex |
| `block.ingestedAtUnixMicros` | optional integer | Publication timestamp after durable append. Absent on archive reads; outside the commitment |

| Terminal payload field | Type | Meaning |
| --- | --- | --- |
| `type` | string | `"closed"`. Stop consuming this subscription |
| `reason` | string | Termination reason below |
| `nextHeight` | integer | Inclusive first unacknowledged height. May already have been processed locally if its ACK was lost |

| Close behavior | Contract |
| --- | --- |
| Scope | Application notification, not a WebSocket close frame; other subscriptions can continue |
| Delivery | Bounded 250 ms enqueue opportunity. A broken or blocked connection can lose this notification; retain a local durable cursor |
| Ordering | One outstanding block per subscription. ACK before the next block; heights are ordered without duplicates within a subscription |
| Reconnection | No exactly-once guarantee across connections. Replay uncertain work idempotently |

## Request errors

| Code / layer | Message or reason | Meaning |
| --- | --- | --- |
| HTTP 429 (nginx) | Connection limit | More than 8 concurrent connections from a client IP |
| `-32006` | `Too many subscriptions on the connection` | One subscription already exists on this connection. Data: `"Exceeded max limit of 1"`. Existing subscription stays open |
| `-32009` | `subscriber limit reached` | Global subscriber cap reached |
| `-32009` | `invalid height` | Height outside the accepted range |
| `-32009` | `below_window` | Requested height below `max(0, tip - 42428)` at attach. No subscription accepted or records sent |
| `-32009` | `subscriber IDs exhausted` | Server cannot allocate another application subscriber ID |
| `-32009` | `unknown subscriber` | ACK names no active application subscriber |
| `-32009` | `acknowledgement must match this connection's outstanding height` | Wrong height, duplicate ACK, or ACK from another connection |

## Cursors and resume

| Rule | Contract |
| --- | --- |
| Serve window | New height requests must be within 42,428 blocks below tip (about 24 hours at about 2 seconds per block). Boundary and future heights are accepted |
| Available history | Starts when the archive started. No catch-up from genesis or guaranteed historical depth. Store retention is about 7 days, but requests remain limited by the serve window |
| Moving window | Accepted subscriptions retain their cursors as the window advances, subject to delivery deadlines |
| Durable progress | Persist application output and the inclusive replay height together before ACK. After a successful ACK response, persist the next height as the last acknowledged cursor's successor |
| Uncertain ACK | Keep the prior replay height if ACK delivery or checkpoint persistence is uncertain. Reapply idempotently; never resume from the last received height alone |
| Resume | Subscribe with `{"from":"height","height":savedReplayHeight}`. A terminal `nextHeight` is the server's first unacknowledged height, not proof of durable client processing |
| Expired cursor | `below_window` requires an explicit recovery decision: restore application state from another source or deliberately start a new tip subscription and accept the gap |

## Close Reasons

| Reason | Meaning |
| --- | --- |
| `catchup_timeout` | Archive-mode send/ACK deadline expired, including the extra deadline after live demotion |
| `catchup_falling_behind` | Archive lag increased across a progress window |
| `archive_timeout` | Archive read deadline expired |
| `archive_error` | Archive record could not be read, including missing history |
| `archive_corrupt` | Record decoding or commitment verification failed |
| `archive_gap` | Decoded height differs from the requested height |
| `record_too_large` | Raw record exceeds the configured delivery limit |
| `encoding_error` | Notification could not be encoded |
| `height_exhausted` | Height cannot advance safely |
| `client_closed` | Client subscription or transport closed; also recorded in diagnostics |

## Delivery Limits

| Hosted admission limit | Value |
| --- | --- |
| Connections per client IP | 8 |
| Subscriptions per connection | 1 |
| Global active subscribers | 12 |
| Largest deliverable block record | 20 MiB |
| Serve request window | 42,428 blocks |

| Service flag | Release default | Hosted Futurenet | Effect |
| --- | ---: | ---: | --- |
| `--max-subscribers` | `64` | `12` | Global subscription cap; also connection cap |
| `--subscriber-queue` | `8` | `8` | Maximum queued live blocks per subscriber |
| `--subscriber-queue-bytes` | `2097152` | `2097152` | Maximum raw bytes in a live queue |
| `--max-record-bytes` | `4194304` | `20971520` | Maximum deliverable raw record; ingestion can accept larger records |
| `--live-timeout-ms` | `5000` | `60000` | Live send plus ACK deadline before demotion |
| `--catchup-timeout-ms` | `10000` | `60000` | Archive read deadline and, separately, archive send plus ACK deadline |
| `--catchup-progress-ms` | `30000` | `120000` | Window for checking whether archive lag grows |

## Statistics

| Result field | Meaning |
| --- | --- |
| `currentSubscribers` | Active subscription count |
| `tip` | Durable archive height, or `-1` before an origin is known |
| `totals` | Process-lifetime counters, retained after subscribers leave |
| `subscribers` | Active subscriber array, bounded by the configured cap |
| `subscribers[].id` | Application subscriber ID |
| `subscribers[].nextHeight` | Inclusive next unacknowledged height |
| `subscribers[].lagBlocks` | Lag relative to the durable archive, not the node's current tip |
| `subscribers[].mode` | `"live"` or `"catchup"` |
| `subscribers[].queuedBlocks`, `subscribers[].queuedBytes` | Live queue occupancy; bytes count raw records |
| `subscribers[].counters` | Counters for this active subscriber |

| Counter field (in `totals` and `counters`) | Meaning |
| --- | --- |
| `demotions` | Transitions from live delivery to archive catch-up |
| `blocksSent`, `bytesSent` | Successful transport enqueues, not confirmed application processing; bytes count raw records |
| `catchupSeconds` | Time in catch-up, including disk, send, and ACK waits |
| `disconnects` | Counts keyed by termination reason |
