---
title: Syscalls
description: Complete reference for Groundhog contract syscalls.
---

These are the host functions available to WASM contracts. Most developers use the SDK rather than calling syscalls directly. See [Programming Model: Storage Types](/programming-model/storage-types/) for the high-level API.

All syscalls share a single imported function. The first argument is the syscall number. The remaining 7 slots carry input and output arguments as `u64` values (pointers into WASM linear memory for non-primitive types, `(offset, length)` pairs for variable-length buffers). The return value is a `SyscallErrorCode`.

Any syscall can return `Fault` (1) if a pointer argument is out of WASM memory bounds, or `NoSyscall` (2) if the syscall number is not supported.

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 0 | `None` | Success. |
| 1 | `Fault` | A pointer argument is out of WASM memory bounds. Any syscall can return this. |
| 2 | `NoSyscall` | The syscall number is not supported. Any syscall can return this. |
| 3 | `IsRootTransaction` | Called from a root call frame with no parent contract. |
| 4 | `Reentrance` | The invoked address is already on the call stack. |
| 5 | `ContractAlreadyDeployed` | A contract with the same nonce and hash is already deployed at the target address. |
| 6 | `NoReturnBufferAvailable` | No return buffer from a child call frame. Either the most recent subcall failed or there have been no subcalls. |
| 7 | `InvalidSyscallInput` | Invalid argument (type mismatch, value out of range, data too long, etc.). |
| 8 | `StorageKeyNotExist` | The storage key does not exist in the current view. |
| 9 | `NoRetrocausalQueueEntry` | The retrocausal queue is empty. |
| -1 | `DeterministicWasm` | The called WASM frame hit a trap (e.g. divide by zero, out of gas). |
| -2 | `FrameReverted` | The child call frame manually reverted itself. |

## Hashing

### SHA256

| | |
|---|---|
| **Number** | 0 |
| **Description** | Returns the SHA-256 hash of the input buffer. |

| Direction | Name | Type |
|-----------|------|------|
| in | `buffer` | `[u8]` (span) |
| out | `hash` | `SHA256Hash` |

No syscall-specific errors.

### SHA256Update

| | |
|---|---|
| **Number** | 27 |
| **Description** | Feeds data into a streaming SHA-256 computation at the specified index. If `reset` is true, the hash state is cleared before updating. Use with `SHA256Finalize` when the input is too large for a single `SHA256` call. |

| Direction | Name | Type |
|-----------|------|------|
| in | `index` | `u32` |
| in | `buffer` | `[u8]` (span) |
| in | `reset` | `bool` |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | The hash buffer at `index` does not exist and `reset` is false, the buffer becomes too large, or there are too many active hash buffers. |

### SHA256Finalize

| | |
|---|---|
| **Number** | 28 |
| **Description** | Finalizes the streaming SHA-256 computation at the specified index and returns the hash. Removes the hash buffer after finalization. |

| Direction | Name | Type |
|-----------|------|------|
| in | `index` | `u32` |
| out | `output` | `SHA256Hash` |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | The hash buffer at `index` does not exist (e.g. finalize called twice without an intervening reset). |

## Identity

### GetMsgSender

| | |
|---|---|
| **Number** | 1 |
| **Description** | Returns the contract address of the contract that invoked the current call frame. |

| Direction | Name | Type |
|-----------|------|------|
| out | `sender` | `ContractAddress` |

| Error | Condition |
|-------|-----------|
| `IsRootTransaction` | Called from a root transaction. There is no caller address. |

### GetCurrentAddress

| | |
|---|---|
| **Number** | 19 |
| **Description** | Returns the contract address of the current call frame. |

| Direction | Name | Type |
|-----------|------|------|
| out | `address` | `ContractAddress` |

No syscall-specific errors.

### GetSourceTransactionHash

| | |
|---|---|
| **Number** | 11 |
| **Description** | Returns the hash of the transaction that initiated the current execution. |

| Direction | Name | Type |
|-----------|------|------|
| out | `source_tx_hash` | `SHA256Hash` |

No syscall-specific errors.

## Contract Lifecycle

### Invoke

| | |
|---|---|
| **Number** | 5 |
| **Description** | Invokes the specified method of the contract at the given address. Creates a new invocation frame that terminates when the invoked contract returns or exits. The frame is limited to the minimum of `gas_limit` and the remaining gas in the current frame. Unused gas is returned to the caller. The `entrypoint_id` is passed as a `u64` (the little-endian interpretation of a `ContractEntrypointID`). |

| Direction | Name | Type |
|-----------|------|------|
| in | `address` | `ContractAddress` |
| in | `entrypoint_id` | `u64` |
| in | `gas_limit` | `GasAmount` |
| in | `calldata` | `[u8]` (span) |
| in | `flags` | `InvokeFlagSet` |
| out | `return_buffer_len` | `RuntimeMemoryLength` |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | The target contract was not found. |
| `DeterministicWasm` | The invoked contract hit a trap or ran out of gas. |
| `FrameReverted` | The invoked contract manually reverted. |
| `Reentrance` | The invoked address is already on the call stack. |

### Return

| | |
|---|---|
| **Number** | 6 |
| **Description** | Returns data from the current call frame and optionally marks the frame for revert. The return buffer is available to the caller via `GetReturnedBuffer`. Immediately terminates execution. If the buffer is too large, the entire invocation reverts with a deterministic error. Does not return to the caller. |

| Direction | Name | Type |
|-----------|------|------|
| in | `buffer` | `[u8]` (span) |
| in | `revert_frame` | `bool` |

No syscall-specific errors (does not return).

### Exit

| | |
|---|---|
| **Number** | 8 |
| **Description** | Terminates execution of the current call frame immediately. The frame reverts, returning a deterministic error to the caller with no return buffer available. Equivalent to the WASM `unreachable` instruction. Does not return. |

No inputs or outputs. No syscall-specific errors (does not return).

### DeployContract

| | |
|---|---|
| **Number** | 10 |
| **Description** | Deploys a contract with the specified nonce and contract hash. The contract must be provided in the transaction's `contracts_to_deploy` field or already exist on chain. |

| Direction | Name | Type |
|-----------|------|------|
| in | `nonce` | `SHA256Hash` |
| in | `contract_hash` | `SHA256Hash` |
| out | `deployed_address` | `ContractAddress` |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | The contract was not available for deployment, or the contract is a native precompiled contract that cannot be deployed. |
| `ContractAlreadyDeployed` | A contract with the same nonce and hash has already been deployed at the computed address (in a previous block or earlier in this transaction). |

### GetDeployAddress

| | |
|---|---|
| **Number** | 9 |
| **Description** | Computes the address that would result from deploying a contract with the given deployer address, nonce, and contract hash. Pure computation, does not deploy. If `caller_address` is not provided, the current contract's address is used. |

| Direction | Name | Type |
|-----------|------|------|
| in | `caller_address` | `ContractAddress` (optional) |
| in | `nonce` | `SHA256Hash` |
| in | `contract_hash` | `SHA256Hash` |
| out | `to_be_deployed` | `ContractAddress` |

No syscall-specific errors.

## Data Passing

### GetCalldataLen

| | |
|---|---|
| **Number** | 2 |
| **Description** | Returns the length of the calldata supplied to the current call frame. |

| Direction | Name | Type |
|-----------|------|------|
| out | `len` | `RuntimeMemoryLength` |

No syscall-specific errors.

### GetCalldata

| | |
|---|---|
| **Number** | 3 |
| **Description** | Returns the calldata supplied to the current call frame. Written into a contract-allocated buffer. |

| Direction | Name | Type |
|-----------|------|------|
| out | `buffer` | `[u8]` (span) |
| out | `written_len` | `RuntimeMemoryLength` |

No syscall-specific errors.

### GetReturnedBuffer

| | |
|---|---|
| **Number** | 7 |
| **Description** | Returns the return buffer from the most recent successful subcall invocation. |

| Direction | Name | Type |
|-----------|------|------|
| out | `buffer` | `[u8]` (span) |
| out | `written_len` | `RuntimeMemoryLength` |

| Error | Condition |
|-------|-----------|
| `NoReturnBufferAvailable` | The most recent subcall failed, or there have been no subcalls within this call frame. |

## Storage: Bytestring

### BytestringGetLen

| | |
|---|---|
| **Number** | 13 |
| **Description** | Returns the length of the bytestring stored at the specified key. |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| out | `length` | `RuntimeMemoryLength` |

| Error | Condition |
|-------|-----------|
| `StorageKeyNotExist` | The storage key does not exist in the current view. |
| `InvalidSyscallInput` | The key exists but contains a different type. |

### BytestringGet

| | |
|---|---|
| **Number** | 14 |
| **Description** | Retrieves the bytestring stored at the specified key. Written into a contract-allocated buffer. |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| out | `bytestring` | `[u8]` (span) |
| out | `written_len` | `RuntimeMemoryLength` |

| Error | Condition |
|-------|-----------|
| `StorageKeyNotExist` | The storage key does not exist or has been deleted. |
| `InvalidSyscallInput` | The key exists but contains a different type. |

### BytestringSet

| | |
|---|---|
| **Number** | 15 |
| **Description** | Sets the bytestring value at the specified storage key. Overwrites any existing value at that key, even if the existing value has a different type. |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| in | `bytestring` | `[u8]` (span) |
| in | `flags` | `StorageDeltaFlagSet` |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | The bytestring is too long, or the storage flags are invalid. |

## Storage: NonnegativeInt

### NonnegativeIntGet

| | |
|---|---|
| **Number** | 16 |
| **Description** | Retrieves the nonnegative integer value at the specified storage key. Behavior depends on `force_load_from_snapshot`. When true, `current_set` is always populated from the snapshot (returns errors on type mismatch or missing key). When false, returns the parameters of the prior NNInt write if one exists, or `(nullopt, 0)` if no prior NNInt write. |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| in | `force_load_from_snapshot` | `bool` |
| out | `current_set` | `i128` |
| out | `current_set_opt` | `bool` |
| out | `current_add` | `i128` |

| Error | Condition |
|-------|-----------|
| `StorageKeyNotExist` | The key does not exist or has been deleted. Only returned when `force_load_from_snapshot` is true. |
| `InvalidSyscallInput` | The key contains a different type. Only returned when `force_load_from_snapshot` is true. |

### NonnegativeIntSetAdd

| | |
|---|---|
| **Number** | 17 |
| **Description** | Sets or modifies a nonnegative integer at the specified storage key. `set_value` (if provided) sets the base value. `add_value` is applied as a delta. The final value must remain nonnegative. Overwrites any existing value at that key, even if the existing value has a different type. |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| in | `set_value` | `i128` (optional) |
| in | `add_value` | `i128` |
| in | `flags` | `StorageDeltaFlagSet` |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | The operation would always produce a negative value (e.g. `set_add(1, -2)`), or the storage flags are invalid. |

## Storage: Delete

### DeleteObject

| | |
|---|---|
| **Number** | 18 |
| **Description** | Deletes the object at the specified storage key. |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| in | `flags` | `StorageDeltaFlagSet` |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | The storage flags are invalid or incompatible with the current storage state. |

## Storage: RetrocausalQueue

### RetrocausalQueueInsert

| | |
|---|---|
| **Number** | 20 |
| **Description** | Inserts an entry into the retrocausal queue at the specified storage key. |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| in | `queue_entry` | `[u8]` (span) |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | The key contains a different type, the entry is too large, or too many entries were inserted in the current transaction. |

### RetrocausalQueueConsume

| | |
|---|---|
| **Number** | 21 |
| **Description** | Consumes (or peeks at) the next entry from the retrocausal queue at the specified storage key. If `peek` is true, the entry is not removed. |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| in | `peek` | `bool` |
| out | `queue_entry` | `[u8]` (span) |
| out | `written_len` | `RuntimeMemoryLength` |

| Error | Condition |
|-------|-----------|
| `NoRetrocausalQueueEntry` | The queue is empty. |
| `InvalidSyscallInput` | The key contains a different type. |

### RetrocausalQueuePeekLen

| | |
|---|---|
| **Number** | 32 |
| **Description** | Returns the length of the next entry in the retrocausal queue at the specified storage key. |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| out | `len` | `RuntimeMemoryLength` |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | The key contains a different type. |
| `NoRetrocausalQueueEntry` | The queue is empty. |

## Events

### LogEvent

| | |
|---|---|
| **Number** | 24 |
| **Description** | Logs an event with up to 3 topics and additional data. Topics are 32-byte values prepended to the data in the serialized event. The `num_topics` field tells indexers how many leading 32-byte chunks are topics. Events are stored in the transaction's event log and accumulated into a per-block Merkle-Patricia trie. |

| Direction | Name | Type |
|-----------|------|------|
| in | `topic0` | `Topic` ([u8; 32], optional) |
| in | `topic1` | `Topic` ([u8; 32], optional) |
| in | `topic2` | `Topic` ([u8; 32], optional) |
| in | `data` | `[u8]` (span) |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | The event data exceeds the maximum allowed length, or topics are not supplied in a continuous sequence (e.g. `topic0` and `topic2` provided without `topic1`). |

## Diagnostics

### ConsoleLog

| | |
|---|---|
| **Number** | 4 |
| **Description** | Logs the input buffer to the console. No-op on release builds and on-chain execution. Safe to leave in production contracts. |

| Direction | Name | Type |
|-----------|------|------|
| in | `buffer` | `[u8]` (span) |

No syscall-specific errors.

### GetTransactionStatistics

| | |
|---|---|
| **Number** | 22 |
| **Description** | Returns a transaction statistic value. Statistics may be disabled in release builds or production execution. May return nondeterministic values in test configurations (those stats will be disabled in production). |

| Direction | Name | Type |
|-----------|------|------|
| in | `statistic` | `TransactionStatistic` |
| out | `result` | `u64` |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | The requested statistic does not exist or is not available in this configuration. |

## Authorization

### GetAuthClaimCount

| | |
|---|---|
| **Number** | 25 |
| **Description** | Returns the number of authentication claims associated with the current transaction. |

| Direction | Name | Type |
|-----------|------|------|
| out | `count` | `u32` |

No syscall-specific errors.

### GetAuthClaim

| | |
|---|---|
| **Number** | 26 |
| **Description** | Returns the authentication claim at the specified index (0-indexed). |

| Direction | Name | Type |
|-----------|------|------|
| in | `index` | `u32` |
| out | `auth_claim` | `AuthClaim` |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | The index is out of bounds (>= the number of authentication claims). |

### ChangePublicKeyRegistration

| | |
|---|---|
| **Number** | 23 |
| **Description** | Changes the public key registration for the current contract address at the specified key index. If `key_scheme` is None, the key is removed. Otherwise, the key is set with the provided scheme, bytes, and weight. |

| Direction | Name | Type |
|-----------|------|------|
| in | `key_index` | `u32` |
| in | `key_scheme` | `i32` (optional) |
| in | `key_bytes` | `[u8]` (span) |
| in | `key_weight` | `u32` (optional) |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | The registration is invalid or the key index is out of bounds. |

### WriteAddressNonceConfig

| | |
|---|---|
| **Number** | 29 |
| **Description** | Writes the nonce configuration for the current contract address. |

| Direction | Name | Type |
|-----------|------|------|
| in | `nonce_config` | `NonceConfig` |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | `nonce_config.accepted_keys` has a bit set beyond the maximum signer count. |

### WriteAddressGasPermissionConfigs

| | |
|---|---|
| **Number** | 30 |
| **Description** | Writes gas permission configurations for the current contract address. Up to 5 configurations can be set. Permissions must be supplied as a contiguous sequence starting from `permission_0`. |

| Direction | Name | Type |
|-----------|------|------|
| in | `permission_0` | `GasPermissionConfig` (optional) |
| in | `permission_1` | `GasPermissionConfig` (optional) |
| in | `permission_2` | `GasPermissionConfig` (optional) |
| in | `permission_3` | `GasPermissionConfig` (optional) |
| in | `permission_4` | `GasPermissionConfig` (optional) |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | The configurations are invalid, or permissions are not supplied as a contiguous sequence (e.g. `permission_1` supplied without `permission_0`). |

## Block Info

### GetBlockHeight

| | |
|---|---|
| **Number** | 31 |
| **Description** | Returns the current block height. |

| Direction | Name | Type |
|-----------|------|------|
| out | `result` | `BlockHeight` |

No syscall-specific errors.

## Cryptography

### VerifySignature

| | |
|---|---|
| **Number** | 12 |
| **Description** | Verifies a cryptographic signature against a public key and message. Returns `None` (0) on success. |

| Direction | Name | Type |
|-----------|------|------|
| in | `scheme` | `i32` (CryptographicScheme) |
| in | `signature` | `[u8]` (span) |
| in | `public_key` | `[u8]` (span) |
| in | `message` | `[u8]` (span) |

| Error | Condition |
|-------|-----------|
| `InvalidSyscallInput` | Verification failed, or the parameters are invalid (wrong key/signature size for the scheme, unsupported scheme). |
