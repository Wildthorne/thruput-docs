---
title: React API reference
description: Provider props, wallet hooks, query hooks, transaction hooks, and reusable query factories.
---

| Entry point | Purpose |
| --- | --- |
| `@thruputchain/react` | All public React exports below |
| [Setup](/react/setup/) | Installation and context wiring |
| [TypeScript client reference](/tools/typescript-sdk/) | Shared SDK concepts and operations; use the client supported by the React package's peer dependencies |
| [React source](https://github.com/thruputchain/thruput-react) | Public declarations and implementation |

## WalletProvider

| Prop | Type / behavior |
| --- | --- |
| `client` | Initialized `ConnectedThruputClient` with validated cluster identity; keep stable |
| `children` | `ReactNode` |
| `discoveryTarget?` | `EventTarget`; browser default is `window` after mounting |

| Context behavior | Rule |
| --- | --- |
| Scope | One application network and selected wallet connection |
| Discovery | Automatic after mounting; first provider selected without prompting |
| Connection | Explicit; no automatic reconnect or persisted connection |
| Client replacement | Dispose binding and start disconnected, including same-network replacements |
| Server rendering | Disconnected initial state; browser discovery after mount |
| Usage | [Providers and clients](/react/providers/) |

## Wallet hooks

| Hook | Result |
| --- | --- |
| `useClient()` | The configured public client, including while disconnected |
| `useWallet()` | `WalletConnection`: reactive state and stable connection actions |
| `useWalletClient()` | Current provider-backed signing client or `null` |
| Context requirement | `WalletProvider`; no QueryClient required for these three hooks |

### WalletConnection

| Field / action | Meaning |
| --- | --- |
| `providers` / `provider` | Discovered providers and selected provider |
| `session` | Validated network and authorized accounts, or `null` |
| `account` / `address` | Selected wire account and canonical base58 address, or `null` |
| `networkHash` | Expected application network in unprefixed base58 |
| `status` | `disconnected`, `connecting`, `connected`, `disconnecting`, `wrongNetwork` |
| `error` | Latest connection/selection error, or `null` |
| `connect()` / `disconnect()` | `Promise<void>`; request failures appear in `error` |
| `selectProvider(id)` | Select a discovered provider without prompting |
| `selectAccount(address)` | Select an authorized account and recreate the binding |
| Usage | [Connect a wallet](/react/wallets/) |

## Contract reads

| API | Inputs / result |
| --- | --- |
| `useContractView(input)` | Generated `method`, contract `address`, typed `args`, optional `caller`, `enabled`, `staleTime` |
| `contractViewQueryOptions(input)` | Same inputs plus explicit initialized `client`; reusable TanStack options |
| Result | Query state and `queryKey`; data is `ContractView<R>` with `value`, `stateBlockHeight`, `gasUsed`, and `events` |
| Defaults | `enabled: true`, `staleTime: 0`; other query behavior follows the QueryClient |
| Key | Client/network, decoder identity, contract address, entrypoint, encoded arguments, caller |
| Cancellation | Abort the view request and discard late results |
| Validation | Arguments are encoded while constructing the query, even when disabled |
| Usage | [Read contract data](/react/reads/) |

## Balances

| API | Inputs / result |
| --- | --- |
| `useBalance({ address?, query? }?)` | Native-token balance |
| `useTokenBalance({ token?, address?, query? })` | Standard ERC-20 balance |
| `BalanceAddress` | Base58 string or SDK-branded address bytes |
| `BalanceData` | `{ rawBalance: bigint; stateBlockHeight: bigint }` |
| Hook result | TanStack Query state plus `queryKey`; `query.select` can change observer data type |
| Omitted `address` | Connected account on the application's network |
| Explicit address | Read without wallet permission |
| Null address / missing token | Skip fetching |
| Invalid address | Query error state |
| Cancellation | Discard abandoned results; underlying balance RPC may finish |
| Usage | [Read balances](/react/balances/) |

### Balance query options

| Option | Behavior |
| --- | --- |
| `enabled` | Control automatic observer fetching |
| `staleTime`, `gcTime` | Freshness and cache retention |
| `refetchInterval`, `refetchIntervalInBackground` | Explicit polling |
| `refetchOnMount`, `refetchOnReconnect`, `refetchOnWindowFocus` | Refresh triggers |
| `retry`, `retryDelay` | Read retry policy |
| `select` | Transform observer data; cache remains raw `BalanceData` |
| Key / fetch function | Owned by the library; not configurable through these options |

## Transaction execution

| API / field | Behavior |
| --- | --- |
| `useExecute()` | TanStack mutation through the current wallet |
| `ExecuteVariables.request` | SDK `PrepareExecutionRequest`: inner invocation, root budget, transaction options |
| `ExecuteVariables.options` | Required `onSigned`; optional `wait` observation controls |
| `mutate(variables)` | Start from an event handler; expose mutation state |
| `mutateAsync(variables)` | Await execution; rejects on failure |
| Successful data | `{ transactionHash, receipt }` after successful committed execution |
| Retry | Always disabled by the hook |
| Invalidation | Application-owned; no automatic balance refresh |
| Typed child results | Use the signing client's `executeCallsAndWait` |
| Usage | [Send transactions](/react/transactions/) |

## Receipt observation

| API / option | Behavior |
| --- | --- |
| `useWaitForTransactionReceipt({ hash?, wait? }?)` | Public observation; wallet connection not required |
| `hash` | Base58 string; `null` or `undefined` skips fetching |
| `wait.timeoutMs` / `pollingIntervalMs` | SDK observation settings; configure consistently for the same hash |
| Data | `TransactionReceipt`, including failed committed execution |
| Query error | Observation failure, not proof of failed execution |
| `queryKey` | Client/network-scoped canonical hash |
| Defaults | Infinite stale time; no query retry, focus/reconnect refetch, or retry on mount |
| Cancellation | Cancels observation, never the transaction |
| Usage | [Track transaction results](/react/transaction-status/) |

## Query factories and keys

| Export | Inputs / purpose |
| --- | --- |
| `balanceQueryOptions` | Explicit client, address, optional balance-query settings |
| `tokenBalanceQueryOptions` | Explicit client, address, token, optional balance-query settings |
| `contractViewQueryOptions` | Explicit client and typed view inputs |
| `transactionReceiptQueryOptions` | Explicit client, hash, and wait settings |
| `getClientQueryKey(client)` | Stable-value network/client prefix for custom query keys |
| Factory context | No hook or provider required; use the same client instance to share cache entries |
| Missing balance inputs | Skipped query; do not use imperative fetch with missing inputs |
| Cache lifetime | In-memory client identity; not portable for persisted caches or server/browser hydration |
| Usage | [Cache and refresh data](/react/queries/) |
