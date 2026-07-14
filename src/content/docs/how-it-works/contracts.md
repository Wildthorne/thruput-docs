---
title: Contracts
description: Contract artifacts, deployment, and address derivation in Groundhog.
---

An address in Groundhog can be invoked if there is a contract *deployed* at that address.
The root invocation of a transaction is specified by a contract address, an 8-byte entrypoint ID, and method arguments. Each invocation creates an [invocation frame](/how-it-works/invocation-frames/) that tracks execution state and storage modifications.

The normal user-deployed contract path is RV32, Groundhog's 32-bit RISC-V contract target. The protocol also supports legacy WASM contracts, native precompiled contracts, and local test mocks.

## Contract Types

### RV32 Contracts

RV32 contracts are the default user contract type. `groundhog build` compiles the contract's RV32 entrypoint wrapper for `riscv32im-unknown-none-elf`, lowers that ELF into a deployable `.rv32a` artifact, and finalizes its contract-spec sidecars.

For a crate named `counter`, the default build writes:

```txt
target/groundhog/counter.rv32a
target/groundhog/counter.rv32.json
target/groundhog/counter.spec.xdr
target/groundhog/counter.spec.json
```

The `.rv32a` file is the executable contract artifact. `groundhog deploy` wraps those bytes in the protocol's `Contract::kRv32` variant before signing and submitting the deploy transaction.

#### Entrypoints

Every callable method is identified by an 8-byte `ContractEntrypointID`. RV32 contracts do not expose methods through exported WASM function names. Instead, the SDK's `#[contract]` macro emits one dispatch record per method into a link-time `GROUNDHOG_RV32_ENTRYPOINTS` registry.

When hogd invokes an RV32 contract, it enters the guest at `_start` with the method ID in registers. The RV32 runtime dispatches by scanning the registry, then calls the generated wrapper for the matching method. That wrapper decodes calldata, calls the Rust method, and returns through the Return syscall.

Entrypoint IDs can be arbitrary 8-byte values at the protocol layer. The SDK provides the normal convention: derive a 6-byte interface prefix from the interface name and version, then use a method-specific 2-byte suffix. See [SDK Macros](/reference/sdk-macros/) and the [contract spec reference](/reference/contract-spec/) for the developer-facing shape.

#### Artifact Shape

Most developers should let the [Groundhog CLI](/tools/groundhog-cli/) produce RV32 artifacts. Under the hood, the RV32 lowerer:

- Parses the `riscv32im-unknown-none-elf` contract binary.
- Validates the layout expected by the Groundhog RV32 runtime.
- Packs code, initial memory, metadata, and section digests into the `.rv32a` artifact.
- Self-verifies the artifact before writing it.

The node executes the lowered artifact through the RV32 runtime. Contract state does not live in guest memory. Durable state must be written through Groundhog storage APIs.

### Legacy WASM Contracts

The protocol still has a `Contract::kWasmi` variant for the WASM compatibility path. Use it only when you intentionally build with `groundhog build --target wasm`, run `groundhog test --target wasm`, or compare RV32 against WASM with differential tests.

Legacy WASM contracts identify methods by exporting a function whose name is the uppercase hex encoding of the 8-byte entrypoint ID, such as:

```wasm
(export "01CC155247140001" (func $transfer))
```

That export-name convention is not how the default RV32 path dispatches methods.

### Native Precompiled Contracts

Native precompiled contracts are implemented directly inside the Groundhog runtime. They are used for trusted system behavior, such as the native token contract, and can have permissions that user-deployed guest contracts do not have.

Users cannot deploy native contracts. They are predeployed at hardcoded addresses and identified by a value from the `HogexecPrecompiledNativeContracts` enum.

### Test Mocks

Local test environments can deploy mock contracts that execute host-side test code. Mock contracts are useful for native unit tests and simulation, but they cannot be deployed on chain.

## Contract Deployment

Contracts are deployed by the DeployContract [system call](/reference/syscalls/). In normal CLI usage, `groundhog deploy` invokes the active wallet contract, and the wallet contract calls DeployContract with the artifact hash and deployment nonce.

### Contract Identification

Contracts are identified by the SHA256 hash of the XDR-encoded `Contract` union:

```rust
pub enum Contract {
    kWasmi { wasmi_contract: ContractBlob },
    kNative { native_contract_id: HogexecPrecompiledNativeContracts },
    kMockTest { mock_contract_id: i32 },
    kRv32 { rv32_contract: ContractBlob },
}
```

For RV32 contracts, the deploy hash is:

```txt
SHA256(XDR(Contract::kRv32 {
    rv32_contract: ContractBlob {
        data: <.rv32a artifact bytes>
    }
}))
```

This is not just the SHA256 hash of the raw `.rv32a` bytes. The XDR wrapper and `kRv32` type tag are part of the hash preimage.

### DeployContract Syscall

To deploy a contract, the caller invokes DeployContract with two arguments:

- `nonce`: a 32-byte value chosen by the caller
- `contract_hash`: the SHA256 hash identifying the contract artifact to deploy

The system then:

1. Verifies that the contract identified by `contract_hash` is available for deployment.
2. Computes the deployment address: `ContractAddress = SHA256(XDR(ContractDeploymentHashPreimage))`.
3. Writes `AddressMetadata` at the computed address.
4. Stores the contract code separately in the deduplicated contract code store.

### Deterministic Address Derivation

The address to which a contract is deployed is computed from the deployer address, nonce, and contract hash. Anyone can predict the address before deployment.

A single contract artifact can be deployed at many addresses. Each deployment has separate metadata and separate storage.

### Deployment Preimage

```rust
pub struct ContractDeploymentHashPreimage {
    /// Address of the contract performing the deployment.
    pub deployer_address: ContractAddress,

    /// Arbitrary 32-byte nonce chosen by the deployer.
    pub nonce: SHA256Hash,

    /// SHA256 hash of the contract artifact.
    pub contract_hash: SHA256Hash,
}
```

Under XDR encoding, this structure serializes as the concatenation of its fields:

```txt
XDR(ContractDeploymentHashPreimage) = deployer_address || nonce || contract_hash
```

### Example

A wallet contract at address `0x1234...` deploys `counter.rv32a`:

```txt
deployer_address = 0x1234...
nonce            = 0x5678...
contract_hash    = SHA256(XDR(Contract::kRv32 {
                       rv32_contract: ContractBlob { data: bytes(counter.rv32a) }
                   }))
                 = 0xabcd...

ContractAddress  = SHA256(0x1234... || 0x5678... || 0xabcd...)
                 = 0x9999...
```

The deployed counter contract's address is now `0x9999...`.

This scheme is analogous to Ethereum's `CREATE2` opcode because the address can be calculated before deployment.

## Deployment Eligibility

To be deployed via DeployContract, a contract identified by `contract_hash` must be available in the context of the current transaction.

A contract is available if either of the following holds:

- The contract code already exists in the on-chain contract code store.
- The contract is included in the `contracts_to_deploy` field of the current transaction.

```rust
pub struct Transaction {
    pub invocation: Invocation,
    pub uniquifier: Uniquifier,

    /// New contract code to make available for deployment.
    pub contracts_to_deploy: VecM<Contract>,

    /// Authorization claim specifying required signatures.
    pub auth_claim: AuthClaim,
}
```

`contracts_to_deploy` makes contract code available, but it does not deploy the code to an address by itself. Deployment to a specific address happens when a contract invokes DeployContract.

Example flow:

1. The transaction includes `contracts_to_deploy: [Contract::kRv32 { rv32_contract: ContractBlob { data: <artifact bytes> } }]`.
2. The contract code becomes available under its `contract_hash`.
3. During execution, a contract calls `DeployContract(nonce, contract_hash)`.
4. The system computes the deployed address and writes its metadata.

## Address Metadata

When a contract is deployed, the system writes `AddressMetadata` to the storage key `(contract_address, StorageKeyType::Metadata)`.

```rust
pub struct AddressMetadata {
    pub deployed_contract: DeployedContractHash,
}

pub struct DeployedContractHash {
    /// SHA256 hash of the contract code.
    pub hash: SHA256Hash,

    /// Size of the contract in bytes.
    pub contract_size: u32,

    /// Type of contract: kRv32, kWasmi, kNative, or kMockTest.
    pub contract_type: ContractType,
}
```

This metadata allows the executor and off-chain tools to:

- Verify what code is running at an address.
- Determine the contract type without loading bytecode.
- Calculate storage costs from the contract size.

The metadata is set during deployment and persists for the lifetime of the contract address.

## Deployment Concurrency

Multiple transactions may deploy the same contract to the same address in the same block. Groundhog does not consider concurrent deployments of the same contract to the same address to be in conflict. Collision resistance of SHA256 implies that different contracts cannot be deployed to the same address.

If a contract requires one-time initialization, implement that guard in contract storage.

## Redeployment and Immutability

Once a contract is deployed to an address, that address's `AddressMetadata` cannot be changed. Deployed contracts are immutable.

## Related Documentation

- [Groundhog CLI](/tools/groundhog-cli/): RV32 builds, local nodes, deployment, and codegen
- [Invocation Frames](/how-it-works/invocation-frames/): execution context and call stack management
- [Syscalls](/reference/syscalls/): system calls available to contracts
- [SDK Macros](/reference/sdk-macros/): SDK entrypoint IDs and generated clients
- [Contract Spec](/reference/contract-spec/): generated method, type, event, and error metadata
- [Architecture](/how-it-works/architecture/): the big-picture design
