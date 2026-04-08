---
title: Contracts
description: Contract types, deployment, and address derivation in Groundhog.
---

An address in Groundhog can be invoked if there is a contract *deployed* at that address.
Recall that the invocation that starts a Transaction is specified by a contract address and method arguments. Each invocation creates an [invocation frame](/how-it-works/invocation-frames/) that tracks execution state and storage modifications.

There are two types of on-chain contracts within Groundhog, plus a mock type for testing.

## Contract Types

### WebAssembly Contracts

The common type of contract, which users can write, deploy, and invoke, are implemented as WebAssembly modules.

WebAssembly module requirements:
- Valid WebAssembly
    - memory64: no
    - mutable globals: yes
    - sign extension: yes
    - bulk-memory: yes
    - no "start" function
    - Currently restricts initial memory to 1 64kb page
    - export memory
    - no multi memory
    - No imported functions, other than those provided by Groundhog (see [Syscalls](/reference/syscalls/))

We impose no restrictions on the kinds of computation performed within the WebAssembly.

#### Exported Methods

WebAssembly contracts expose their callable methods via exported functions. Each method is identified by an 8-byte **entrypoint ID**, which is encoded as a 16-character hexadecimal string in the export name.
These functions must have no input or output arguments in their signatures. WebAssembly contracts can access contract arguments via [system calls](/reference/syscalls/).

**Example:**
```wasm
(export "01CC155247140001" (func $transfer))
```

In this example:
- The entrypoint ID is `0x01CC155247140001` (8 bytes)
- The export name is `"01CC155247140001"` (16 hex characters)
- This function is callable via an `Invocation` with `entrypoint = 0x01CC155247140001`

**Entrypoint ID Encoding:**
- The 8-byte entrypoint ID is encoded as uppercase hexadecimal
- Each byte becomes 2 hex characters (e.g., `0x01` -> `"01"`, `0xCC` -> `"CC"`)
- The resulting 16-character string is used as the WebAssembly export name

**Note:** Entrypoint IDs can be arbitrary 8-byte values. The SDK provides a conventional scheme for deriving entrypoint IDs from interface names and method signatures (see [SDK Macros](/reference/sdk-macros/)), but contracts are free to use any 8-byte identifiers they choose.

**Multiple methods:**

A contract can export multiple methods:
```wasm
(export "01CC155247140001" (func $transfer))
(export "01CC155247140002" (func $approve))
(export "01CC155247140003" (func $balance_of))
```

Each exported method must have a unique entrypoint ID. When a transaction invokes the contract, the runtime looks up the exported function by its hex-encoded entrypoint ID and executes it.

### Native Precompiled Contracts

System contracts implemented directly within the Groundhog system. These contracts
generally can have elevated permissions within the system (they are not constrained
by the WebAssembly sandbox boundary) and are used to implement functionality that requires
trusted logic, like management of the native token.

It is (currently) impossible for a native contract to be deployed; instead, these contracts
are predeployed at hardcoded addresses within the Groundhog chain.
These contracts are identified by a value from the `HogexecPrecompiledNativeContracts` enum (a 32-bit identifier).

Currently, two native contracts are deployed at genesis: the **HOG token contract** (which manages the native token) and the **initial token claim contract** (which handles genesis token distribution).

### Test Mocks

Local test environments can also deploy a mock contract (to, for example, run unit tests),
which directly executes arbitrary user-defined code. These can never be deployed on chain.

## Contract Deployment

Contracts are deployed by the DeployContract [system call](/reference/syscalls/).

### Contract Identification

Contracts are uniquely identified by the SHA256 hash of the `Contract` enum structure (as defined in the XDR schema):

```rust
pub enum Contract {
    kWasmi { wasmi_contract: ContractBlob },
    kNative { native_contract_id: i32 },
    kMockTest { mock_contract_id: i32 },
}
```

For WebAssembly contracts, this is effectively `SHA256(XDR(Contract::kWasmi { wasmi_contract: ContractBlob { wasm: <bytecode> } }))`.

### DeployContract Syscall

To deploy a contract, the caller invokes the DeployContract syscall with two arguments:
- **`nonce`**: A 32-byte value chosen by the caller
- **`contract_hash`**: The SHA256 hash identifying the contract to deploy

The system then:
1. Verifies the contract (identified by `contract_hash`) is available (see Deployment Eligibility below)
2. Computes the deployment address: `ContractAddress = SHA256(XDR(ContractDeploymentHashPreimage))`
3. Writes `AddressMetadata` to the ledger at the computed address
4. The contract code itself is stored separately in a deduplicated contract code store (not associated with any particular address)

### Deterministic Address Derivation

The address to which a contract is deployed is deterministically computed from deployment parameters. This allows anyone to predict the address before deployment. A contract can be deployed at multiple addresses. Multiple deployments of the same contract are completely separate from each other, with their own separate storage.

### Deployment Preimage

```rust
pub struct ContractDeploymentHashPreimage {
    /// Address of the contract performing the deployment
    pub deployer_address: ContractAddress,

    /// Arbitrary 32-byte nonce chosen by deployer
    pub nonce: SHA256Hash,

    /// SHA256 hash of the contract code
    pub contract_hash: SHA256Hash,
}
```

Under XDR encoding, this structure serializes as the concatenation of its fields:
```
XDR(ContractDeploymentHashPreimage) = deployer_address || nonce || contract_hash
```

### Example

Contract A (address `0x1234...`) deploys Contract B:

```
deployer_address = 0x1234...
nonce           = 0x5678...
contract_hash   = SHA256(wasm_blob) = 0xabcd...

ContractAddress = SHA256(0x1234... || 0x5678... || 0xabcd...)
                = 0x9999...
```

Contract B's address is now `0x9999...`.

This scheme is analogous to Ethereum's `CREATE2` opcode and enables deterministic address computation before deployment.

## Deployment Eligibility

To be deployed via the DeployContract syscall, a contract (identified by its hash) must be available in the context of the current transaction.

A contract is available if either of the following holds:
- The contract code (identified by `contract_hash`) already exists in the on-chain contract code store (i.e., it has been deployed to at least one address previously, anywhere on the chain)
- It is included in the `contracts_to_deploy` field of the current `Transaction`

```rust
pub struct Transaction {
    pub invocation: Invocation,
    pub uniquifier: Uniquifier,

    /// New contract code to make available for deployment
    pub contracts_to_deploy: VecM<Contract>,

    pub auth_claims: AuthClaimData,
    pub gas_claims: VecM<GasClaim>,
}
```

The `contracts_to_deploy` field makes contract code *available* for deployment within the transaction, but does **not** automatically deploy it to any address. Actual deployment to a specific address happens when a contract invokes the DeployContract syscall.

**Example flow:**
1. Transaction includes `contracts_to_deploy: [Contract::kWasmi { wasmi_contract: <bytecode> }]`
2. This makes the contract code available (identified by its hash)
3. During execution, a contract calls `DeployContract(nonce, contract_hash)` to deploy it to a specific address
4. The system computes the address and writes the metadata

## Address Metadata

When a contract is deployed, the system writes `AddressMetadata` to the storage key `(contract_address, kStorageKeyTypeAddressMetadata)`.

```rust
pub struct AddressMetadata {
    pub deployed_contract: DeployedContractHash,
}

pub struct DeployedContractHash {
    /// SHA256 hash of the contract code
    pub hash: SHA256Hash,

    /// Size of the contract in bytes
    pub contract_size: u32,

    /// Type of contract (kWasmi, kNative, or kMockTest)
    pub contract_type: ContractType,
}
```

This metadata allows anyone to:
- Verify what code is running at an address
- Determine the contract type without loading bytecode
- Calculate storage costs based on contract size

The metadata is set during deployment and persists for the lifetime of the contract address.

## Deployment Concurrency

Multiple transactions may deploy a contract to the same address in the same block. Groundhog does not consider two concurrent deployments of the same contract to the same address to be in conflict. Collision-resistance of SHA256 implies that it is impossible to deploy different contracts to the same address.

One-time initialization guards can be implemented within a new contract, if such behavior is required.

## Redeployment and Immutability

Once a contract is deployed to an address, that address's `AddressMetadata` cannot be changed. Deployed contracts are immutable.

## Miscellaneous

- We expect that in nearly all use cases, a transaction that deploys a contract will soon invoke that contract (to initialize state, for example).
Groundhog defers some WebAssembly validation criteria (such as lack of a start function) to the time when a contract is first invoked.
This means that it is technically possible to deploy a contract that can never be invoked. Invoking a contract in the same transaction in which it is deployed will catch this error (as the invocation would fail).

## Related Documentation

- [Invocation Frames](/how-it-works/invocation-frames/): Execution context and call stack management
- [Syscalls](/reference/syscalls/): System calls available to contracts
- [SDK Macros](/reference/sdk-macros/): How the SDK generates entrypoint IDs and client code
- [Architecture](/how-it-works/architecture/): The big-picture design
