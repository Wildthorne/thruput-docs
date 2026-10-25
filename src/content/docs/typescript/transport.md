---
title: Configure HTTP transport
description: Set RPC timeouts, batch independent reads, and classify transport failures.
---

The client uses HTTP JSON-RPC by default. Supply `HttpTransport` when you need explicit timeout, header, or batching settings.

## Set a request timeout

```ts
import { createThruputClient, futurenet, HttpTransport } from "@thruputchain/client";

const cluster = futurenet();
const client = await createThruputClient({
  cluster,
  transport: new HttpTransport(cluster.rpcUrl!, { timeoutMs: 10_000 }),
});
```

The cluster still controls identity checks; the transport controls requests to the endpoint. A timeout ends observation of that request, not an already-submitted transaction.

## HTTP batching

Batch independent RPC reads into fewer HTTP requests:

```ts
const batched = await createThruputClient({
  cluster,
  transport: new HttpTransport(cluster.rpcUrl!, {
    batch: { maxSize: 100, waitMs: 0 },
    timeoutMs: 10_000,
  }),
});
const [tip, version] = await Promise.all([
  batched.getChainTip(),
  batched.getVersionInfo(),
]);
```

Batching is off by default. `batch: true` uses the defaults shown. Concurrent requests are grouped within the scheduling window and split at `maxSize`.

- Responses match by request ID, not array position.
- Per-call RPC errors remain separate. HTTP or malformed-batch failures reject affected requests.
- Cancellation removes one caller; canceling every caller can cancel the shared request.
- HTTP batching does not provide a shared state snapshot or an atomic transaction. Use [shared-snapshot reads](/typescript/reads/#read-related-values-from-one-snapshot) when related contract values must come from one state; awaiting separate reads does not make their snapshots match.

Server [array and byte limits](/reference/json-rpc-api/#json-rpc-arrays) still apply.

## Handle transport errors

| Error | Boundary |
| --- | --- |
| `HttpRequestError` | Network request failed |
| `HttpResponseError` | Non-success HTTP status |
| `NativeRpcError` | RPC error response; a `JsonRpcError` with `code`, `data`, method context, and a typed `decoded` cause |
| `RpcCompatibilityError` | Unsupported wire format, network mismatch, or unadvertised method |
| `RpcRequestValidationError` | Invalid local request, rejected before dispatch |
| `RpcDecodingError` | Malformed result; retains the raw value |
| `ContractViewError` / `ContractDecodeError` | Contract outcome or decoding, not transport |

`NativeRpcError.decoded` is `known` with a `data.kind` from the [error codes](/reference/json-rpc-api/#error-codes), or `unclassified`. Neither grants retry permission. Use `classifyReadError(error, { signal })` when implementing a bounded read-retry policy. See [read cancellation](/typescript/reads/#cancel-stale-reads). Do not apply automatic read retries to transaction submission.

## Use a custom transport

Implement the exported `Transport` interface when integrating another request layer. A client created with only a transport has no validated cluster identity. For wallet use, provide a trusted signing network hash and verify the endpoint separately, or supply a cluster descriptor as above.
