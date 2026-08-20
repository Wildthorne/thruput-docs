# TypeScript Codegen and Client Documentation Refresh

## Goal

Update the published TypeScript documentation for:

- `@groundhogchain/client` `0.2.0`
- TypeScript protocol packages `0.7.1`
- Groundhog CLI TypeScript codegen `0.9.6`
- Generated contract method and event descriptors
- Typed views, exceptions, root-receipt decoding, and deployment helpers

Document the generated TypeScript APIs exposed by CLI codegen `0.9.6` and client `0.2.0`.

## Source of Truth

Verify examples and claims against:

- TypeScript client runtime: `client-ts`
- TypeScript protocol packages: `protocol-ts`
- CLI TypeScript codegen: `groundhog-rpc` (`crates/tools/cli/src/codegen.rs`)

Use these versions throughout the TypeScript documentation:

| Component | Version |
|---|---|
| `@groundhogchain/client` | `0.2.0` |
| TypeScript protocol packages | `0.7.1` |
| Groundhog CLI TypeScript codegen | `0.9.6` |
| Client Node.js floor | `22.12.0` |

The client pins an OpenRPC document whose wire version is `2.3.1`, while the current Rust gateway advertises wire `3.0.0`. Keep this distinction explicit on the SDK page without expanding this workstream into a JSON-RPC reference refresh.

## Scope

Update only:

- `src/content/docs/tools/typescript-sdk.md`
- `src/content/docs/tools/typescript-bindings.md`
- `src/content/docs/tools/wallet-integration.md`
- The TypeScript bindings section in `src/content/docs/tools/groundhog-cli.md`
- The generated TypeScript event section in `src/content/docs/tutorials/add-events-to-a-contract.md`
- The bare `u8` entry, TypeScript mapping link, and TypeScript codegen guidance in `src/content/docs/reference/contract-spec.md`
- The maintained codegen command in `client-ts/examples/README.md`

## Non-Goals

- Do not change WASM or RV32 guidance outside the TypeScript codegen pages. The bindings guide must still state the actual inputs accepted by CLI codegen `0.9.6`.
- Do not change general CLI build, test, deploy, scaffold, or installation documentation.
- Do not change ecosystem, execution-runtime, or contract-artifact concept pages.
- Do not refresh the JSON-RPC method reference.
- Do not change Rust SDK or tutorial dependency versions.
- Do not create new sidebar pages.
- Do not document a high-level browser-wallet builder. The TypeScript client does not provide one.
- Do not change generated source files or implementation repositories, except the approved client examples README command update.

## TypeScript SDK Guide

### Installation and Versions

- Use `@groundhogchain/client@0.2.0`.
- Use `@groundhogchain/protocol@0.7.1` and `@groundhogchain/contract-spec@0.7.1` for generated bindings.
- Keep the Node.js `22.12.0` runtime floor.
- Preserve the client OpenRPC `2.3.1` versus gateway wire `3.0.0` distinction.

### Transport Options

Keep the `HttpTransport` options and `JsonRpcError` example, including request timeouts, custom headers, and transport-level error handling.

### Typed Views and Receipts

Document descriptor-driven views:

```ts
const result = await Counter.get.view({
  client,
  contract,
  caller,
});
```

- `view()` returns a typed value with height and events.
- `viewOutcome()` returns typed `return`, `abort`, or `fault` outcomes.
- Transport and JSON-RPC errors pass through unchanged.
- Malformed return or abort data throws `ContractDecodeError` from direct decoders and view or receipt wrappers.

Document invocation construction separately:

```ts
const invocation = Counter.increment.invocation(contract, gasLimit, {
  amount: 1n,
});
```

Document root-receipt decoding:

```ts
const receipt = await client.waitForTransactionReceipt(txHash);
const result = Counter.get.decodeReceipt(receipt);
```

- `decodeReceipt()` returns the typed value and receipt metadata.
- It throws `ContractReceiptError` for aborts, execution failures, or missing return data from non-void methods.
- `decodeReceiptOutcome()` returns a discriminated `return`, `abort`, or `failure` result.
- Callers must know that the receipt came from the expected root method. Descriptors cannot verify method identity or inspect nested wallet invocations.

### Client Boundaries

- The package provides standalone transaction construction and signing helpers.
- `GroundhogClient` submits signed transactions and polls receipts.
- Generated descriptors build application invocations.
- The package does not discover network wallet interfaces or construct wallet-root invocations automatically.
- Applications must not submit an inner application invocation as the root unless that contract is intentionally the authorization root.

### Deployment Helpers

Add a concise section covering:

- `hashContract()` hashes the canonical encoded protocol `Contract`, including its type and payload framing.
- Construct the branded deployment nonce with `sha256Hash(randomBytes(32))`.
- `deriveContractAddress()` derives an address from the deploying contract, deployment nonce, and canonical contract hash.
- The deployment nonce is separate from `Transaction.uniquifier.nonce`.
- `DevWallet.deploy.invocation()` constructs the local wallet's root deployment call.
- `contracts_to_deploy` makes contract code available to the transaction, while the DevWallet invocation performs the deployment.
- The example constructs, signs, submits, waits for, and decodes the deployment transaction.
- The maintained DevWallet deployment example is local-node-specific.

### Public Entry Points and Examples

Document:

- `@groundhogchain/client/transaction`
- `@groundhogchain/client/transport`
- `@groundhogchain/client/contract`
- `@groundhogchain/client/contracts`
- `@groundhogchain/client/signers`
- `@groundhogchain/client/actions`

Link the maintained chain-tip, HOG balance, HOG transfer, and Counter deployment examples. State that their documented workflow expects a local node.

## TypeScript Bindings Guide

### Codegen Workflows

Document:

```bash
groundhog build --bindings ts
```

and standalone generation for custom output paths:

```bash
mkdir -p web/src/contracts
groundhog codegen ts \
  target/groundhog/my_contract.spec.xdr \
  -o web/src/contracts/my-contract.ts
```

State that standalone CLI codegen `0.9.6` accepts canonical `.spec.xdr` input. It does not accept legacy `.wasm`, `.rv32a`, or inspection-only `.spec.json` input. Do not alter broader build, test, deploy, or runtime documentation in this workstream.

On mixed-version pages, keep the existing page-wide provenance and add a section-specific note for CLI codegen `0.9.6`.

Add a concise "What Bindings Provide" section covering generated contract types, method descriptors, event descriptors, entrypoint IDs, interface metadata, and contract spec metadata.

State only that generated output may import from:

- `@groundhogchain/client/contract`
- `@groundhogchain/contract-spec`
- `@groundhogchain/protocol`
- `@groundhogchain/protocol/utils`

### Method Descriptors

Document:

- `entrypoint`
- `invocation()`
- `decodeReturn()`
- `decodeException()`
- `view()`
- `viewOutcome()`
- `decodeReceipt()`
- `decodeReceiptOutcome()`

Explain argumentless methods, generated camelCase argument names, optional view callers, complete-buffer return and declared-exception decoding, and unknown-exception preservation.

### Generated Exceptions

Cover:

- Declared-exception unions with nullable names, selectors, and typed values
- Unknown exceptions preserving selector and raw abort data
- `ContractViewError`
- `ContractReceiptError`
- `ContractDecodeError`
- Unwrapped transport and JSON-RPC errors

### Event Descriptors

Document:

- `signature`
- `decode()`
- `filter()`
- `allFromReceipt()`
- `singleFromReceipt()`
- Module-level `decodeEvent()`

Cover strict topic count, 32-byte topic length, 1,024-byte total event size, trailing payload rejection, named direct-topic filters, one-to-five contract addresses, and up to 16 values in `oneOf`.

### Type Mapping

Use the CLI codegen `0.9.6` mapping:

| Contract type | TypeScript representation |
|---|---|
| `Void` | `void` |
| `Bool` | `boolean` |
| Integer types, including bare `u8` | `bigint` |
| `String` | `string` |
| `Address` | `ContractAddress` |
| `Bytes`, `Vec<u8>` | `Uint8Array` |
| Other `Vec<T>` | `T[]` |
| `[u8; N]` | `FixedBytes<N>` |
| Other fixed arrays of length 0 through 3 | Exact readonly tuple |
| Other fixed arrays longer than 3 | `FixedArray<T, N>` |
| Tuple | Readonly tuple |
| `Option<T>` | `T \| null` |
| Named struct | Interface |
| Enum | Bigint const object and value-union type |
| Union | `{ case: "..."; value?: ... }` discriminated union |

Document `fixedBytes()` and `fixedArray()`, including their ownership behavior. Keep `SignedToken` listed as present in the schema but unsupported by TypeScript codegen.

### Standard Bindings

- Document client `0.2.0` exports `ERC20`, `ERC20Metadata`, `ERC20Error`, `ERC20Spec`, `ERC20TransferEvent`, `ERC20ApprovalEvent`, and `decodeERC20Event`.
- State that the shipped bindings were generated from interface `0.1.9`.
- Replace callable examples with descriptor APIs.

## Wallet and Event Cross-Links

- Update wallet documentation to distinguish package helpers, `GroundhogClient`, generated application invocations, and missing wallet-root abstractions. Scope `do_action` to the current CLI-supported DevWallet flow; custom wallets may use another root method or calldata shape.
- Add generated event descriptor usage to the events tutorial without changing its Rust, CLI target, SDK version, or runtime guidance.
- Keep the contract-spec page's existing runtime guidance. Correct only bare `u8` and link its readers to the bindings type mapping.

## Verification

Run:

```bash
npx astro check
pnpm build
```

Also verify:

- TypeScript examples compile against client `0.2.0` and protocol packages `0.7.1`.
- No published page uses callable generated methods such as `Counter.get(...)` or `ERC20.transfer(...)` as current APIs.
- No published page claims generated method returns require handwritten CXS decoding.
- Event examples use `singleFromReceipt()` and current descriptor names.
- Root-receipt examples state the method-identity precondition.
- No changed page alters WASM, RV32, scaffold, general CLI, or gateway guidance outside the TypeScript codegen behavior documented on the bindings and events pages.

## Acceptance Criteria

- SDK installation uses client `0.2.0` and protocol packages `0.7.1`.
- Typed examples use current public package entry points.
- Method documentation covers invocation, views, returns, exceptions, and root receipts.
- Event documentation covers strict decoding, named filters, and receipt extraction.
- Deployment documentation covers canonical hashing, address derivation, transaction responsibility, and polling.
- Wallet documentation separates low-level client capabilities from missing wallet-root abstractions.
- The remaining diff is limited to the Scope section above.
- `npx astro check` and `pnpm build` pass.
