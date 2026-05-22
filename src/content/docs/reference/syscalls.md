---
title: Syscalls
description: Authoritative reference for the host functions exposed to Groundhog contracts, generated from the protocol's syscalls.yaml.
---

These are the host functions available to WASM contracts. Most developers use the SDK rather than calling syscalls directly. See [Programming Model: Storage Types](/programming-model/storage-types/) for the high-level API.

All syscalls share a single imported function. The first argument is the syscall number. The remaining slots carry typed inputs and outputs as `u64` values: primitive integers are passed directly, larger value types are passed as pointers into WASM linear memory, and variable-length buffers are passed as `(offset, length)` pairs (spans). The protocol fixes the total argument count at 10 (one syscall number plus nine input/output slots). Syscalls that need fewer slots pad the unused ones with arbitrary values.

The return value is a `SyscallErrorCode`. Any syscall can return `Fault` (1) if a pointer argument is out of WASM memory bounds, or `NoSyscall` (2) if the syscall number is not supported. Per-syscall error codes are listed with each entry below, and the full enum is at the bottom of this page.

## Hashing

### SHA256

| | |
|---|---|
| **Number** | 0 |

| Direction | Name | Type |
|-----------|------|------|
| in | `buffer` | `[u8]` (span) |
| out | `hash` | `SHA256Hash` |

Errors: none beyond the universal `Fault` / `NoSyscall`.

Returns the SHA-256 hash of the input buffer.

### SHA256Update

| | |
|---|---|
| **Number** | 26 |

| Direction | Name | Type |
|-----------|------|------|
| in | `index` | `u32` |
| in | `buffer` | `[u8]` (span) |
| in | `reset` | `bool` |

Errors:
- `InvalidSyscallInput` if the indexed hash buffer does not exist and `reset` is false, the buffer becomes too large, or there are too many active hash buffers.

Updates the SHA-256 hash computation at the specified index with the supplied bytes. If `reset` is true, the hash state is cleared before the update.

### SHA256Finalize

| | |
|---|---|
| **Number** | 27 |

| Direction | Name | Type |
|-----------|------|------|
| in | `index` | `u32` |
| out | `output` | `SHA256Hash` |

Errors:
- `InvalidSyscallInput` if the queried hash buffer does not exist (for example, calling finalize twice on the same buffer without an intervening reset).

Finalizes the SHA-256 hash computation at the specified index, returns the digest, and removes the buffer.

## Calldata

### GetCalldataLen

| | |
|---|---|
| **Number** | 2 |

| Direction | Name | Type |
|-----------|------|------|
| out | `len` | `RuntimeMemoryLength` |
| out | `auth_token_count` | `u32` |

Errors: none beyond the universal `Fault` / `NoSyscall`.

Returns the length of the calldata supplied to the invocation associated with the current call frame, plus the number of auth tokens supplied to that invocation.

### GetCalldata

| | |
|---|---|
| **Number** | 3 |

| Direction | Name | Type |
|-----------|------|------|
| out | `buffer` | `[u8]` (span) |
| out | `written_len` | `RuntimeMemoryLength` |
| out | `auth_token_list` | `[u8]` (span, interpreted as `[u32]`) |
| out | `auth_token_written_len` | `RuntimeMemoryLength` |

Errors:
- `InvalidSyscallInput` if the `auth_token_list` output span byte length is not a multiple of the size of a `u32`.

Returns the calldata and the auth-token id list supplied to the invocation associated with the current call frame.

## Logging

### ConsoleLog

| | |
|---|---|
| **Number** | 4 |

| Direction | Name | Type |
|-----------|------|------|
| in | `buffer` | `[u8]` (span) |

Errors: none beyond the universal `Fault` / `NoSyscall`.

Logs the input buffer to the console. No-op on release builds and on-chain; calling it from a production contract is harmless but pointless.

### LogEvent

| | |
|---|---|
| **Number** | 24 |

| Direction | Name | Type |
|-----------|------|------|
| in | `topic0` | `Option<Topic>` (`[u8; 32]`) |
| in | `topic1` | `Option<Topic>` (`[u8; 32]`) |
| in | `topic2` | `Option<Topic>` (`[u8; 32]`) |
| in | `data` | `[u8]` (span) |

Errors:
- `InvalidSyscallInput` if the event data exceeds the maximum event length, or if topics are not supplied as a continuous prefix (e.g., supplying `topic0` and `topic2` but not `topic1`).

Emits an event with up to three 32-byte topics and a data payload. The serialized event is `topic0 || topic1 || topic2 || data`, with a separate `num_topics` field that lets downstream indexers filter on the leading topic chunks. Events are accumulated into a per-block merkle-patricia trie.

## Invocation

### Invoke

| | |
|---|---|
| **Number** | 5 |

| Direction | Name | Type |
|-----------|------|------|
| in | `address` | `ContractAddress` |
| in | `entrypoint_id` | `u64` (little-endian `ContractEntrypointID`, `[u8; 8]`) |
| in | `gas_limit` | `GasAmount` |
| in | `calldata` | `[u8]` (span) |
| in | `flags` | `InvokeFlagSet` |
| in | `owned_auth_token_ids_list` | `[u8]` (span, interpreted as `[u32]`) |
| out | `return_buffer_len` | `RuntimeMemoryLength` |
| out | `returned_auth_token_len` | `RuntimeMemoryLength` |

Errors:
- `InvalidSyscallInput` if the target contract is not found, or if any auth-token id in `owned_auth_token_ids_list` is duplicated or not owned by the current frame.
- `DeterministicWasm` if the callee terminates with an unspecified internal error (including running out of gas).
- `FrameReverted` if the callee reverts itself.
- `Reentrance` if the invoked address is already on the call stack.

Invokes the specified entrypoint of the contract at `address` with the supplied calldata and auth tokens, creating a new call frame. The new frame is capped at `min(gas_limit, remaining gas in current frame)`; unused gas is returned to the caller. The SDK defaults `gas_limit` to `u64::MAX` so the child inherits everything the parent has left.

`entrypoint_id` is the little-endian interpretation of an 8-byte `ContractEntrypointID`, passed as a `u64` so a clever compiler can keep it on the WASM stack rather than spilling it to linear memory.

### GetMsgSender

| | |
|---|---|
| **Number** | 1 |

| Direction | Name | Type |
|-----------|------|------|
| out | `sender` | `ContractAddress` |

Errors:
- `IsRootTransaction` if there is no caller (the syscall was made from a root transaction frame).

Returns the contract address of the contract that invoked the current call frame.

### GetCurrentAddress

| | |
|---|---|
| **Number** | 19 |

| Direction | Name | Type |
|-----------|------|------|
| out | `address` | `ContractAddress` |

Errors: none beyond the universal `Fault` / `NoSyscall`.

Returns the contract address of the current call frame.

## Return

### Return

| | |
|---|---|
| **Number** | 6 |

| Direction | Name | Type |
|-----------|------|------|
| in | `buffer` | `[u8]` (span) |
| in | `revert_frame` | `bool` |
| in | `returned_auth_token_ids` | `[u8]` (span, interpreted as `[u32]`) |

Errors: none beyond the universal `Fault` / `NoSyscall`. Does not return to the caller (terminates execution of the current WASM invocation).

Returns data and a set of auth-token ids from the current call frame and optionally marks the frame for revert. The return buffer is made available to the caller via `GetReturnedBuffer`. If the supplied buffer is too large, the entire invocation is reverted with a deterministic error (equivalent to a WASM `unreachable`).

### GetReturnedBuffer

| | |
|---|---|
| **Number** | 7 |

| Direction | Name | Type |
|-----------|------|------|
| out | `buffer` | `[u8]` (span) |
| out | `written_len` | `RuntimeMemoryLength` |
| out | `restored_auth_token_ids` | `[u8]` (span, interpreted as `[u32]`) |
| out | `restored_auth_token_ids_written_len` | `RuntimeMemoryLength` |

Errors:
- `NoReturnBufferAvailable` if no return buffer is available (either the most recent subcall failed, or no subcall has been made in this frame).
- `InvalidSyscallInput` if the `restored_auth_token_ids` output span byte length is not a multiple of the size of a `u32`.

Returns the return buffer and any restored auth-token ids from the most recent successful subcall invocation.

### Exit

| | |
|---|---|
| **Number** | 8 |

No inputs. No outputs. Does not return.

Errors: none beyond the universal `Fault` / `NoSyscall`.

Terminates the current call frame immediately. The frame reverts and the caller sees a deterministic error with no return buffer available. Equivalent to a WASM `unreachable` instruction.

## Storage

### BytestringGetLen

| | |
|---|---|
| **Number** | 13 |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| out | `length` | `RuntimeMemoryLength` |

Errors:
- `StorageKeyNotExist` if the storage key does not exist in the current transaction view.
- `InvalidSyscallInput` if the key exists but holds a different storage type (e.g. NNInt rather than bytestring).

Returns the length of the bytestring stored at `key`.

### BytestringGet

| | |
|---|---|
| **Number** | 14 |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| out | `bytestring` | `[u8]` (span) |
| out | `written_len` | `RuntimeMemoryLength` |

Errors:
- `StorageKeyNotExist` if the storage key does not exist or has been deleted.
- `InvalidSyscallInput` if the key exists but holds a different storage type.

Retrieves the bytestring stored at `key`.

### BytestringSet

| | |
|---|---|
| **Number** | 15 |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| in | `bytestring` | `[u8]` (span) |
| in | `flags` | `StorageDeltaFlagSet` |

Errors:
- `InvalidSyscallInput` if the bytestring is too long or the storage flags are invalid.

Writes the bytestring value at `key`. Overwrites any existing value, even if that value has a different storage type.

### NonnegativeIntGet

| | |
|---|---|
| **Number** | 16 |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| in | `force_load_from_snapshot` | `bool` |
| out | `current_set` | `i128` |
| out | `current_set_opt` | `bool` |
| out | `current_add` | `i128` |

Errors:
- `StorageKeyNotExist` if the storage key does not exist or has been deleted (only returned when `force_load_from_snapshot` is true).
- `InvalidSyscallInput` if the key exists but holds a different storage type (only returned when `force_load_from_snapshot` is true).

Retrieves the NNInt value at `key`.

If `force_load_from_snapshot` is true, `current_set` will never be null: the syscall reads the snapshot value. A snapshot that is not an NNInt, or a prior write on this key that is not an NNInt, returns `InvalidSyscallInput`. A snapshot that does not exist, or was deleted by a prior write, returns `StorageKeyNotExist`.

If `force_load_from_snapshot` is false, the prior snapshot state is ignored unless the prior write on `key` is itself an NNInt write (in which case the parameters of that write are returned). If the prior write is not an NNInt or was a deletion, the syscall returns `(None, 0)` without error.

### NonnegativeIntSetAdd

| | |
|---|---|
| **Number** | 17 |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| in | `set_value` | `Option<i128>` |
| in | `add_value` | `i128` |
| in | `flags` | `StorageDeltaFlagSet` |

Errors:
- `InvalidSyscallInput` if the operation would always result in a negative value (for example `set_add(1, -2)`) or the storage flags are invalid.

Sets or modifies the NNInt at `key`. `set_value` (if `Some`) supplies the base, and `add_value` is added as a delta. The resolved value must remain nonnegative. Overwrites any existing value, even if that value has a different storage type. See [Programming Model: NNInt](/programming-model/nnint/) for commutativity rules.

### DeleteObject

| | |
|---|---|
| **Number** | 18 |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| in | `flags` | `StorageDeltaFlagSet` |

Errors:
- `InvalidSyscallInput` if the storage flags are invalid or incompatible with the current storage state.

Deletes the object at `key`.

## Retrocausal Queue

### RetrocausalQueueInsert

| | |
|---|---|
| **Number** | 20 |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| in | `queue_entry` | `[u8]` (span) |

Errors:
- `InvalidSyscallInput` if the key exists but holds a different storage type that cannot be converted to a retrocausal queue, if the entry is too large, or if too many entries are inserted in the current transaction.

Inserts an entry into the retrocausal queue at `key`.

### RetrocausalQueueConsume

| | |
|---|---|
| **Number** | 21 |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| in | `peek` | `bool` |
| out | `queue_entry` | `[u8]` (span) |
| out | `written_len` | `RuntimeMemoryLength` |

Errors:
- `NoRetrocausalQueueEntry` if the queue is empty.
- `InvalidSyscallInput` if the key exists but holds a different storage type.

Consumes (or with `peek = true`, only inspects) the next entry from the retrocausal queue at `key`.

### RetrocausalQueuePeekLen

| | |
|---|---|
| **Number** | 30 |

| Direction | Name | Type |
|-----------|------|------|
| in | `key` | `StorageKeyContractData` |
| out | `len` | `RuntimeMemoryLength` |

Errors:
- `InvalidSyscallInput` if the key exists but holds a different storage type.
- `NoRetrocausalQueueEntry` if the queue is empty.

Returns the length (in bytes) of the next entry in the retrocausal queue at `key`.

## Auth

### VerifySignature

| | |
|---|---|
| **Number** | 12 |

| Direction | Name | Type |
|-----------|------|------|
| in | `scheme` | `i32` (CryptographicScheme) |
| in | `signature` | `[u8]` (span) |
| in | `public_key` | `[u8]` (span) |
| in | `message` | `[u8]` (span) |

No outputs: the result is the `SyscallErrorCode` itself (`None` on success).

Errors:
- `InvalidSyscallInput` if verification fails or the inputs are malformed (wrong key/signature size for the chosen scheme, unsupported scheme, etc.).

Verifies a cryptographic signature against a public key and message.

### GetAuthClaim

| | |
|---|---|
| **Number** | 25 |

| Direction | Name | Type |
|-----------|------|------|
| out | `auth_claim` | `AuthClaim` |

Errors: none beyond the universal `Fault` / `NoSyscall`.

Returns the authentication claim associated with the current transaction. Takes no input.

### ChangePublicKeyRegistration

| | |
|---|---|
| **Number** | 23 |

| Direction | Name | Type |
|-----------|------|------|
| in | `key_index` | `u32` |
| in | `key_scheme` | `Option<i32>` (CryptographicScheme) |
| in | `key_bytes` | `[u8]` (span) |
| in | `key_weight` | `Option<u32>` |

Errors:
- `InvalidSyscallInput` if the registration is invalid or `key_index` is out of bounds.

Changes the public key registration for the current contract address at `key_index`. If `key_scheme` is `None`, the key is removed. Otherwise the key is set with the supplied scheme, bytes, and weight.

### WriteAddressRequiredWeight

| | |
|---|---|
| **Number** | 28 |

| Direction | Name | Type |
|-----------|------|------|
| in | `required_weight` | `Weight` (`u32`, by value) |

Errors: none beyond the universal `Fault` / `NoSyscall`.

Writes the required-weight threshold for the current contract address. This is the minimum total weight of signing keys needed to authorize a transaction from this address.

### MintAuthToken

| | |
|---|---|
| **Number** | 31 |

| Direction | Name | Type |
|-----------|------|------|
| in | `expiry_height` | `BlockHeight` |
| in | `serialized_auth_token` | `[u8]` (span) |
| out | `token_id` | `u32` |

Errors:
- `InvalidSyscallInput` if the serialized token fails to parse as a valid `AuthToken`, `expiry_height` is in the past, or minting would exceed the per-transaction auth-token cap.

Mints an authentication token for the current contract address.

### ConsumeAuthToken

| | |
|---|---|
| **Number** | 32 |

| Direction | Name | Type |
|-----------|------|------|
| in | `token_id` | `u32` |
| out | `auth_payload` | `[u8]` (span) |
| out | `token_minter` | `ContractAddress` |
| out | `auth_payload_written_len` | `RuntimeMemoryLength` |
| out | `unwrapped_token_id_start` | `u32` |
| out | `unwrapped_token_id_count` | `u32` |

Errors:
- `InvalidSyscallInput` if the token is not owned by the current contract address, or the token has expired.

Consumes an authentication token owned by the current contract address. Returns the token's auth payload, its minter, and the id range of any nested tokens unwrapped as a side effect.

## Address

### GetDeployAddress

| | |
|---|---|
| **Number** | 9 |

| Direction | Name | Type |
|-----------|------|------|
| in | `caller_address` | `Option<ContractAddress>` |
| in | `nonce` | `SHA256Hash` |
| in | `contract_hash` | `SHA256Hash` |
| out | `to_be_deployed` | `ContractAddress` |

Errors: none beyond the universal `Fault` / `NoSyscall`.

Computes the address that would be deployed for a contract with the given deployer address, nonce, and contract hash. Pure computation; does not deploy anything.

### DeployContract

| | |
|---|---|
| **Number** | 10 |

| Direction | Name | Type |
|-----------|------|------|
| in | `nonce` | `SHA256Hash` |
| in | `contract_hash` | `SHA256Hash` |
| out | `deployed_address` | `ContractAddress` |

Errors:
- `InvalidSyscallInput` if the requested contract is not available for deployment, or the contract is a special precompiled (native) contract that cannot be deployed. A contract must either already exist on chain or be supplied in the transaction's `contracts_to_deploy` field.
- `ContractAlreadyDeployed` if a contract with the same nonce and contract hash has already been deployed at the computed address in a previous block or earlier in this transaction. A contract can be deployed multiple times concurrently in the same block; if a contract must initialize only once, gate the initialization on a semaphore.

Deploys a contract with the specified nonce and contract hash at the computed address.

## Block

### GetBlockHeight

| | |
|---|---|
| **Number** | 29 |

| Direction | Name | Type |
|-----------|------|------|
| out | `result` | `BlockHeight` |

Errors: none beyond the universal `Fault` / `NoSyscall`.

Returns the current block height.

## Transaction

### GetSourceTransactionHash

| | |
|---|---|
| **Number** | 11 |

| Direction | Name | Type |
|-----------|------|------|
| out | `source_tx_hash` | `SHA256Hash` |

Errors: none beyond the universal `Fault` / `NoSyscall`.

Returns the hash of the transaction that initiated the current execution.

### GetTransactionStatistics

| | |
|---|---|
| **Number** | 22 |

| Direction | Name | Type |
|-----------|------|------|
| in | `statistic` | `TransactionStatistic` |
| out | `result` | `u64` |

Errors:
- `InvalidSyscallInput` if the requested statistic does not exist or is not available in this configuration.

Returns a transaction statistic. Statistics may be disabled in release builds or production execution, and may be nondeterministic in test configurations. Nondeterministic stats are disabled in production settings.

## Error Codes

The full `SyscallErrorCode` enum, from `protocol/syscall_error.x`:

| Code | Name | Description |
|------|------|-------------|
| 0 | `None` | Success. |
| 1 | `Fault` | A pointer argument is out of WASM memory bounds. Any syscall can return this. |
| 2 | `NoSyscall` | The supplied syscall number is not supported. Any syscall can return this. |
| 3 | `IsRootTransaction` | Cannot call `GetMsgSender` from a root invocation. |
| 4 | `Reentrance` | Reentrance guard violation: the invoked address is already on the call stack. |
| 5 | `ContractAlreadyDeployed` | Attempt to deploy a contract twice (same nonce, contract hash, and deployer). |
| 6 | `NoReturnBufferAvailable` | No return buffer from a child call frame. Either the most recent subcall failed or no subcall has been made in this frame. |
| 7 | `InvalidSyscallInput` | Invalid input to a syscall (type mismatch, value out of range, data too long, bad flags, etc.). |
| 8 | `StorageKeyNotExist` | The storage key does not exist in the current view. |
| 9 | `NoRetrocausalQueueEntry` | The retrocausal queue is empty. |
| -1 | `DeterministicWasm` | Deterministic error inside called WASM (trap, out of gas, etc.). Signals that the called frame reverted. |
| -2 | `FrameReverted` | The child call frame manually reverted. Signals that the called frame reverted. |
