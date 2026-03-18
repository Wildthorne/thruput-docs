---
title: Syscalls
description: Complete reference for Groundhog contract syscalls.
---

## Overview

Syscalls are the interface between [contract](/how-it-works/contracts/) code running in WASM and the Groundhog runtime. Contracts call syscalls to read and write [storage](/reference/storage-types/), invoke other contracts, and interact with the ledger. Each syscall executes within an [invocation frame](/how-it-works/invocation-frames/). Most developers use the SDK, which wraps these calls. This reference is for those who need the low-level details.

Most developers use `strict_inc`, `inc`, and `set` through the SDK's storage types. See [Programming Model: Storage Types](/programming-model/storage-types/) for the high-level API and [NNInt In Depth](/programming-model/nnint/) for how SDK methods map to the `NonnegativeIntSetAdd` syscall.

`caller_address` refers to the address of the currently running contract. Unless otherwise noted, when a contract accesses a `StorageKey`, that key is converted into an `AddressAndKey` by concatenating `caller_address` with the `StorageKey`.

## Error Codes

Syscalls return an error code to signal recoverable errors. A return value of 0 means success.

| Code | Name | Description |
|------|------|-------------|
| 1 | `kFault` | An argument points to an invalid address in WASM memory. All syscalls can return this. |
| 3 | `kIsRootTransaction` | `GetMsgSender` was called from a root call frame with no parent contract. |
| 5 | `kContractAlreadyDeployed` | A contract is already deployed at the target address. |
| 6 | `kNoReturnBufferAvailable` | No return buffer available from a child call frame. |
| 7 | `kInvalidSyscallInput` | Invalid argument to the syscall (e.g. type mismatch, message too long). |
| 8 | `kStorageKeyNotExist` | The storage key does not exist. |
| 9 | `kNoRetrocausalQueueEntry` | The retrocausal queue is empty or the entry size does not match. |

A syscall that returns an error is generally a no-op (other than gas costs). Any "get" syscall never modifies storage.

## Call Format

From inside WASM, all syscalls share a single entry point:

```
uint64_t syscall(uint64_t syscall_no, uint64_t arg0, uint64_t arg1, ...)
```

Every argument is passed as `uint64`. The return value can be cast to a `SyscallErrorCode`.

Larger data types are passed as pointers into WASM linear memory (offsets). Variable-length data is passed as `(offset, length)` pairs. Input arguments come first, followed by output arguments (preallocated buffers).

For example, `SHA256(input_buffer) -> SHA256Hash` becomes:

```
SyscallErrorCode syscall(SyscallNo::SHA256, input_offset, input_len, output_offset)
```

All syscalls that return a byte buffer of variable size take a contract-allocated buffer as an argument and return the number of bytes written into that buffer. Bytes beyond the written length are untouched.

## Syscall Reference

### General

#### SHA256

**Signature:** `SHA256(input_buffer: [u8]) -> SHA256Hash`

Returns the SHA-256 hash of the input.

**Errors:** None beyond `kFault`.

---

#### SHA256Update

**Signature:** `SHA256Update(state: SHA256State, input_buffer: [u8]) -> SHA256State`

Feeds data into a streaming SHA-256 computation. Use with `SHA256Finalize` when the input is too large for a single `SHA256` call.

**Errors:** None beyond `kFault`.

---

#### SHA256Finalize

**Signature:** `SHA256Finalize(state: SHA256State) -> SHA256Hash`

Finalizes a streaming SHA-256 computation and returns the hash. Call after one or more `SHA256Update` calls.

**Errors:** None beyond `kFault`.

---

#### GetMsgSender

**Signature:** `GetMsgSender() -> ContractAddress`

Returns the address of the contract that invoked the current call frame.

**Errors:** `kIsRootTransaction` if called from a root call frame (no parent contract).

---

#### GetCurrentAddress

**Signature:** `GetCurrentAddress() -> ContractAddress`

Returns the address of the currently executing contract.

**Errors:** None beyond `kFault`.

---

#### ConsoleLog

**Signature:** `ConsoleLog(message: [u8]) -> ()`

Creates a debug log entry. The log is tagged with the address of the currently running contract.

**Errors:** `kInvalidSyscallInput` if the message is too long.

---

#### LogEvent

**Signature:** `LogEvent(event_data: [u8]) -> ()`

Emits a structured event associated with the current transaction. Events are included in the transaction output and can be observed by off-chain systems.

**Errors:** `kInvalidSyscallInput` if the event data is too long.

---

#### GetSourceTransactionHash

**Signature:** `GetSourceTransactionHash() -> SHA256Hash`

Returns the SHA-256 hash of the originating transaction.

**Errors:** None beyond `kFault`.

---

#### GetBlockHeight

**Signature:** `GetBlockHeight() -> uint64`

Returns the current block height.

**Errors:** None beyond `kFault`.

---

#### VerifySignature

**Signature:** `VerifySignature(signature: Signature, publickey: PublicKey, message: [u8]) -> ()`

Verifies a cryptographic signature. Check the returned error code to determine verification status.

**Errors:** Returns an error code indicating whether verification succeeded or failed.

---

### Storage Access

#### DeleteObject

**Signature:** `DeleteObject(key: StorageKey) -> ()`

Deletes the storage object at `key`.

**Errors:** `kStorageKeyNotExist` if the key does not exist.

---

### Byte Buffers

#### BytestringGetLen

**Signature:** `BytestringGetLen(key: StorageKey) -> uint64`

Returns the length of the byte buffer stored at `key`.

**Errors:** `kInvalidSyscallInput` if the key exists but is not a byte buffer. `kStorageKeyNotExist` if the key does not exist.

---

#### BytestringGet

**Signature:** `BytestringGet(key: StorageKey) -> [u8], uint64`

Returns the byte buffer stored at `key`, written into a contract-allocated buffer. The second return value is the full length of the stored buffer. If the stored buffer is larger than the allocated buffer, the output is truncated.

**Errors:** `kInvalidSyscallInput` if the key exists but is not a byte buffer. `kStorageKeyNotExist` if the key does not exist.

---

#### BytestringSet

**Signature:** `BytestringSet(key: StorageKey, value: [u8]) -> ()`

Sets the value at `key` to the given byte buffer. If the key already exists, it must be of type byte buffer.

If multiple calls to `BytestringSet` target the same key within a transaction, the last write wins.

**Errors:** `kInvalidSyscallInput` if the key exists but is not a byte buffer.

---

### Nonnegative Integers

#### NonnegativeIntSetAdd

**Signature:** `NonnegativeIntSetAdd(key: StorageKey, set_value: int128 (optional), add_value: int128, flags: StorageDeltaFlagSet) -> ()`

Performs a set-add operation on the nonnegative integer at `key`. The `set_value` is the expected base value (optional) and the `add_value` is the delta to apply. The `flags` parameter controls delta behavior (e.g., exclusive access).

Within a single transaction, all calls to `NonnegativeIntSetAdd` on the same key must use the same `set_value`. The runtime cannot reconcile different set values because that would require discarding prior adjustments.

**Errors:** `kInvalidSyscallInput` if the key exists but is not a nonnegative integer. `kStorageKeyNotExist` if the key does not exist.

---

#### NonnegativeIntGet

**Signature:** `NonnegativeIntGet(key: StorageKey) -> int128`

Returns the current value of the nonnegative integer at `key`, including any `add_value` deltas applied in the current transaction.

**Errors:** `kInvalidSyscallInput` if the key exists but is not a nonnegative integer. `kStorageKeyNotExist` if the key does not exist.

---

### Retrocausal Queues

#### RetrocausalQueueInsert

**Signature:** `RetrocausalQueueInsert(key: StorageKey, entry: [u8]) -> ()`

Inserts an entry into the retrocausal queue at `key`. Always commutes with other inserts.

**Errors:** `kInvalidSyscallInput` if the entry data is invalid.

---

#### RetrocausalQueueConsume

**Signature:** `RetrocausalQueueConsume(key: StorageKey) -> [u8]`

Consumes the next entry from the retrocausal queue at `key`.

**Errors:** `kNoRetrocausalQueueEntry` if the queue is empty or the entry size does not match.

---

### Invocations

#### GetCalldataLen

**Signature:** `GetCalldataLen() -> uint64`

Returns the length of the calldata supplied to the current invocation.

**Errors:** None beyond `kFault`.

---

#### GetCalldata

**Signature:** `GetCalldata() -> [u8]`

Returns the calldata supplied to the current invocation. The output is truncated to the size of the contract-allocated buffer.

**Errors:** None beyond `kFault`.

---

#### Invoke

**Signature:** `Invoke(call_address: ContractAddress, method: MethodID, gas_limit: GasAmount, calldata: [u8]) -> uint64`

Calls `method` on the contract at `call_address` with the supplied calldata and gas limit. Creates a new call frame that terminates when the invoked contract returns or exits.

Returns the length of the buffer returned by the called contract. The buffer is not accessible if the child frame exited with an error.

**Errors:** Returns an error if the invocation fails.

---

#### Return

**Signature:** `Return(output: [u8], revert_frame: bool) -> !`

Terminates the current contract immediately. Sets the parent call frame's return buffer to `output`. If `revert_frame` is `false`, the frame commits (state changes preserved). If `revert_frame` is `true`, the frame aborts (state changes discarded).

If the output byte buffer is too long, the contract terminates with a fault, which reverts the call frame.

**Errors:** Does not return.

---

#### GetReturnedBuffer

**Signature:** `GetReturnedBuffer() -> [u8]`

Loads the byte buffer returned by the most recent child call frame.

**Errors:** `kNoReturnBufferAvailable` if no child call frame exists or if the most recent child frame exited with a fault.

---

#### Exit

**Signature:** `Exit(code: i32) -> !`

Terminates the current contract immediately with the given exit code. Does not set the parent call frame's return buffer. A negative exit code reverts all state changes made in the current call frame.

**Errors:** Does not return.

---

#### GetDeployAddress

**Signature:** `GetDeployAddress(source_address: Option<ContractAddress>, nonce: SHA256Hash, contract_hash: SHA256Hash) -> ContractAddress`

Returns `SHA256(source_address || nonce || contract_hash)`. If `source_address` is not provided, the address of the currently running contract is used.

This is the address where `DeployContract` will place a contract when called from `source_address` with the given `nonce` and `contract_hash`.

**Errors:** None beyond `kFault`.

---

#### DeployContract

**Signature:** `DeployContract(nonce: SHA256Hash, contract_hash: SHA256Hash) -> ContractAddress`

Deploys the contract identified by `contract_hash` at the address defined by `GetDeployAddress(nonce, contract_hash)`. Returns the address of the newly deployed contract.

The deployment is visible only within the current transaction's context until the next block. If the call frame reverts, the deployment is reverted along with all other state changes.

**Errors:** `kContractAlreadyDeployed` if a contract is already deployed at the target address. Returns an error if no contract with the given hash exists.

---

## Additional System Syscalls

The following syscalls exist for system-level operations and are not typically used by application contracts: `GetTransactionStatistics`, `ChangePublicKeyRegistration`, `GetAuthClaimCount`, `GetAuthClaim`, `WriteAddressNonceConfig`, `WriteAddressGasPermissionConfigs`.
