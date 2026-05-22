---
title: Invocation Frames
description: Execution context, call stack management, and frame lifecycle.
---

An **Invocation Frame** represents the execution context for a single [contract](/how-it-works/contracts/) method call. A new frame is created:
- When a transaction first starts (the root frame)
- Whenever a contract invokes another contract via the Invoke [syscall](/reference/syscalls/) (a child frame), also known as a [cross-contract call](/reference/cross-contract-calls/)

Each frame tracks the execution state, resource usage, and state modifications for one contract method invocation.

## Frame Structure

An invocation frame contains the following data (pseudocode):

```rust
// Pseudocode - not actual implementation
struct InvocationFrame {
    // Immutable context (set at frame creation)
    contract_address: ContractAddress,
    entrypoint: ContractEntrypointID,     // 8-byte method identifier
    calldata: Vec<u8>,                      // Encoded arguments
    invocation_flags: InvocationFlagSet,  // Behavioral modifiers (e.g., try_invoke, read_only)
                                          // Root frame has no flags set
    max_gas: GasAmount,                   // Capped at parent's remaining gas

    // Mutable state (modified during execution)
    most_recent_child_result: Option<ChildResultState>,  // Result from last child invocation
    deployed_contracts: Vec<(ContractAddress, DeployedContractHash)>,  // Deployments in this frame + committed children
    state_changes: HashMap<AddressAndKey, StorageDelta>,  // Ledger modifications from this frame + committed children
    events: Vec<Event>,  // Events emitted in this frame + committed children
    gas_used: GasAmount,  // Gas consumed so far
}

struct ChildResultState {
    buffer: Vec<u8>,           // Return data from child (empty if **Fault**)
    status: FrameTerminationStatus,      // **Return**, **Abort**, or **Fault**
}

enum FrameTerminationStatus {
    Return = 0,   // Child returned successfully (preserves state)
    Fault  = 1,   // Child hit a **Fault** (discards state)
    Abort  = 2,   // Child **Aborted** (discards state, but returns data)
}

// State changes can be writes, deletes, or other operations
enum StateChange {
    Write_Bytestring(Bytes),
    // Other state operations...
}

type AddressAndKey = (ContractAddress, StorageKey);
```

**Notes:**
- The root frame has no invocation flags set
- Contracts manipulate mutable state via [system calls](/reference/syscalls/)

## Call Stack

Invocation frames are organized as a stack. When a contract invokes another contract, a new frame is pushed onto the stack. When the subinvocation completes, its frame is popped and control returns to the caller.

**Example stack:**
```
[Root Frame]
  contract: contract_a_address
  entrypoint: 0x1111111111111111

  [Child Frame]
    contract: contract_b_address
    entrypoint: 0x2222222222222222

    [Nested Child Frame]
      contract: contract_c_address
      entrypoint: 0x3333333333333333
```

## Frame Lifecycle

Each invocation frame progresses through five stages:

### 1. Creation

A new frame is created when:
- A transaction begins (root frame)
- A contract calls the Invoke [syscall](/reference/syscalls/) (child frame)

The frame is initialized with:
- Immutable context: contract address, entrypoint ID, calldata, invocation flags, max gas
- Empty mutable state: no child returns, no deployments, no state changes, no events, zero gas used

**Note:** Gas allocated to a child frame is capped at the parent's remaining gas. The root frame has no invocation flags set.

### 2. Execution

The contract executes its WebAssembly code, making syscalls to e.g. read and write ledger state.
All modifications are recorded in the frame's mutable state.

### 3. Completion

A frame terminates in one of three ways:[^termination-syscall]

**a) Fault**

The frame terminates abnormally due to:
- WebAssembly trap (divide by zero, out of bounds access, etc.)
- Explicit contract panic (e.g., Rust `panic!()`). Due to installed panic handlers in WebAssembly, a `panic!()` macro in the Rust SDK may call Abort instead of Fault.
- Out of gas

When a frame **Faults**: No return buffer, all state changes discarded, gas still consumed

**b) Commit**

The contract completes successfully, preserving its state changes.

When a frame **Returns**: Return buffer (may be empty) passed to caller, state changes preserved, gas consumed

**c) Abort**

The contract explicitly aborts its execution, discarding state changes but returning data to the caller.

When a frame **Aborts**: Return buffer passed to caller, state changes discarded, gas consumed

[^termination-syscall]: Contracts control termination through the Return syscall, which takes an output buffer and a `revert_frame` flag (`false` for Return, `true` for Abort). WebAssembly functions that exit normally without calling this syscall implicitly Return. The status codes used on this page (`Return = 0`, `Fault = 1`, `Abort = 2`) match `FrameTerminationStatus` in `protocol/transaction.x`.

### 4. Merge into Parent (or Finalize for Root)

**For child frames:**

The parent frame is updated:
- Gas: Parent's `gas_used` increases by child's `gas_used`
- Result state: Parent's `most_recent_child_result` is set to child's result
  - If child hit a **Fault**: status = Fault, buffer = empty
  - If child **Returned**: status = Commit, buffer = child's return buffer
  - If child **Aborted**: status = Abort, buffer = child's return buffer

State changes:
- If child **Returned**: Parent merges child's `state_changes`, `deployed_contracts`, and `events` into its own
  - Child writes overwrite parent writes on the same `(ContractAddress, StorageKey)` pair
  - This ensures each frame has at most one delta per storage key
  - Child events are appended to parent's event list
- If child **Aborted or hit a Fault**: Child's state changes, deployments, and events are discarded

**For root frame:**

The transaction terminates. The root frame's `state_changes` map is passed to the conflict checking and commit protocol (see [Transaction Lifecycle](/how-it-works/transaction-lifecycle/)).

### 5. Pop and Return

The frame is removed from the call stack:
- Control returns to the caller (or transaction ends if root frame)
- **All WebAssembly execution state is discarded** (linear memory, locals, stack, program counter)

**WARNING:** WebAssembly modules do not persist state across invocation frames. Any data not written to ledger storage is lost when the frame terminates.

## Example: Nested Contract Calls

This example shows a transaction invoking contract A, which calls contracts B, C, and D. The three different frame termination states (**Fault**, **Return**, **Abort**) are demonstrated.

**1. Root frame - ContractA.method() created**

Immutable context:
```
contract: contract_a_address
entrypoint: 0x1111111111111111
calldata: <empty>
flags: (none - root frame has no flags)
max_gas: 1_000_000
```

Initial mutable state:
```
most_recent_child_result: (none)
deployed_contracts: []
state_changes: {}
gas_used: 0
```

**2. ContractA writes to storage**

ContractA executes a storage write:
```
state_changes: {
  (contract_a_address, key_0x01): Write_Bytestring('AAA')
}
gas_used: 10_000
```

**3. ContractA calls ContractB - Push new frame**

ContractB frame immutable context:
```
contract: contract_b_address
entrypoint: 0x2222222222222222
calldata: <empty>
flags: (none)
max_gas: 500_000  // allocated from ContractA's remaining gas
```

ContractB executes and writes to storage:
```
state_changes: {
  (contract_b_address, key_0x02): Write_Bytestring('BBB')
}
gas_used: 15_000
```

**4. ContractB Commits (preserves state changes)**

ContractB completes successfully, committing its state:
```
return_buffer: "success_b"
status: Commit
```

ContractA frame updated after ContractB Commits:
```
most_recent_child_result: { buffer: "success_b", status: Commit }
deployed_contracts: []
state_changes: {
  (contract_a_address, key_0x01): Write_Bytestring('AAA'),
  (contract_b_address, key_0x02): Write_Bytestring('BBB')
}  // ContractB's changes merged into parent
gas_used: 25_000  // 10_000 from A + 15_000 from B
```

**5. ContractA calls ContractC - Push new frame**

ContractC frame immutable context:
```
contract: contract_c_address
entrypoint: 0x3333333333333333
calldata: <empty>
flags: (none)
max_gas: 475_000  // remaining gas from ContractA
```

ContractC executes and writes to storage:
```
state_changes: {
  (contract_c_address, key_0x03): Write_Bytestring('CCC')
}
gas_used: 20_000
```

**6. ContractC Aborts (discards state)**

ContractC explicitly aborts, discarding its state changes:
```
return_buffer: "error_c"
status: Abort
```

ContractA frame updated after ContractC Aborts:
```
most_recent_child_result: { buffer: "error_c", status: Abort }
deployed_contracts: []
state_changes: {
  (contract_a_address, key_0x01): Write_Bytestring('AAA'),
  (contract_b_address, key_0x02): Write_Bytestring('BBB')
}  // ContractC's changes DISCARDED (aborted)
gas_used: 45_000  // gas still consumed
```

**7. ContractA calls ContractD - Push new frame**

ContractD frame immutable context:
```
contract: contract_d_address
entrypoint: 0x4444444444444444
calldata: <empty>
flags: (none)
max_gas: 455_000
```

ContractD writes to storage:
```
state_changes: {
  (contract_d_address, key_0x04): Write_Bytestring('DDD')
}
gas_used: 10_000
```

**8. ContractD hits a Fault (unhandled error)**

ContractD hits a WebAssembly trap (divide by zero, out of bounds, etc.):
```
status: Fault
No return buffer
All state changes discarded
```

ContractA frame updated after ContractD hits a Fault:
```
most_recent_child_result: { buffer: <empty>, status: Fault }
deployed_contracts: []
state_changes: {
  (contract_a_address, key_0x01): Write_Bytestring('AAA'),
  (contract_b_address, key_0x02): Write_Bytestring('BBB')
}  // ContractD's changes DISCARDED (hit a Fault)
gas_used: 55_000  // gas still consumed
```

**9. ContractA makes final storage write**

ContractA writes one more value:
```
state_changes: {
  (contract_a_address, key_0x01): Write_Bytestring('AAA'),
  (contract_b_address, key_0x02): Write_Bytestring('BBB'),
  (contract_a_address, key_0x05): Write_Bytestring('FINAL')
}
gas_used: 60_000
```

**10. Root frame Commits (commits transaction)**

ContractA completes successfully, committing the transaction:
```
return_buffer: "done"
status: Commit
deployed_contracts: []
state_changes: {
  (contract_a_address, key_0x01): Write_Bytestring('AAA'),
  (contract_b_address, key_0x02): Write_Bytestring('BBB'),
  (contract_a_address, key_0x05): Write_Bytestring('FINAL')
}
```

**11. Reservation and commit**
- The root frame's `state_changes` map is used for reservation and commit
- Each delta is reserved against the block's accumulated state
- If all reservations succeed, all writes commit atomically to the ledger
- Final ledger state includes AAA, BBB, and FINAL
- CCC and DDD were never committed (ContractC Aborted, ContractD hit a Fault)

## Related Documentation

- [Contracts](/how-it-works/contracts/): Contract types and entrypoint IDs
- [Transaction Lifecycle](/how-it-works/transaction-lifecycle/): How transactions progress from submission to commit
- [Syscalls](/reference/syscalls/): How contracts interact with frames
- [Cross-Contract Calls](/reference/cross-contract-calls/): SDK-level call patterns
