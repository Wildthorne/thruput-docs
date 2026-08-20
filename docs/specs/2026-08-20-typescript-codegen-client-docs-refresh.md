# TypeScript Codegen and Client Documentation Refresh
## Goal
Update the published documentation for Groundhog CLI and TypeScript tooling so it accurately describes:

- Groundhog CLI and codegen `0.9.6`
  
- `@groundhogchain/client` `0.2.0`
  
- TypeScript protocol packages `0.7.1`
  
- The RV32-only CLI workflow
  
- Generated contract method and event descriptors
  
- Typed views, exceptions, and root-receipt decoding
  

The update should replace obsolete APIs rather than document compatibility wrappers. CLI `0.9.6` and client `0.2.0` intentionally do not preserve the old generated binding API.
## Source of Truth
Verify examples and claims against these sibling repositories before publishing:

- CLI and TypeScript codegen: `groundhog-rpc`
- TypeScript client runtime: `client-ts`
- TypeScript protocol packages: `protocol-ts`
- Rust SDK and scaffold APIs: `sdk_rs`

Use these coordinated versions throughout the TypeScript documentation:

| Component | Version |
|---|---|
| Groundhog CLI | `0.9.6` |
| `@groundhogchain/client` | `0.2.0` |
| TypeScript protocol packages | `0.7.1` |
| Client Node.js floor | `22.12.0` |
| CLI scaffold SDK | `0.19.0` |
| CLI scaffold JSON-RPC client | `0.7.0` |

The client still pins an OpenRPC document whose wire version is `2.3.1`, while the current Rust gateway advertises wire `3.0.0`. Keep this distinction explicit rather than presenting the versions as synchronized.
## Non-Goals
- Do not create new sidebar pages unless an existing page becomes too large to navigate.
  
- Do not add compatibility guidance for generated bindings older than CLI `0.9.6`.
  
- Do not mechanically remove protocol-level `kWasmi` or deterministic-WASM schema references. The off-chain CLI is RV32-only, but retained protocol schema requires a separate runtime audit.
  
- Do not document a high-level browser-wallet builder. The TypeScript client does not provide one.
  
- Do not change generated code or source repositories as part of this documentation work.
  
## Phase 1: Rewrite the TypeScript SDK Guide
### File
`src/content/docs/tools/typescript-sdk.md`
### Required changes
1. Update the source-check note and installation versions:
  
  - `@groundhogchain/client@0.2.0`
    
  - `@groundhogchain/protocol@0.7.1`
    
  - `@groundhogchain/contract-spec@0.7.1`
    
2. Remove `@groundhogchain/xdr` from the packages required solely by generated bindings. Current generated files import runtime helpers from `@groundhogchain/client/contract` plus protocol and contract-spec types. Applications should declare `xdr` only when their own code imports it directly.
  
3. Update the version matrix while preserving the client OpenRPC versus gateway wire-version distinction.
  
4. Keep the Node.js `22.12.0` runtime floor.
  
5. Replace the manual generated-invocation to `client.view()` conversion with the method descriptor API:
  
  ```ts
  const result = await Counter.get.view({
    client,
    contract,
    caller,
  });
  
  console.log(result.value, result.height, result.events);
  ```
  
6. Document `viewOutcome()` for callers that want typed abort and fault outcomes without exceptions.
  
7. Document invocation construction separately:
  
  ```ts
  const invocation = Counter.increment.invocation(contract, gasLimit, {
    amount: 1n,
  });
  ```
  
8. Remove claims that generated bindings leave method return values as raw CXS bytes. Generated methods expose:
  
  - `decodeReturn()`
    
  - `decodeException()`
    
  - `view()`
    
  - `viewOutcome()`
    
  - `decodeReceipt()`
    
  - `decodeReceiptOutcome()`
    
9. Add a root-receipt example:
  
  ```ts
  const receipt = await client.waitForTransactionReceipt(txHash);
  const result = Counter.get.decodeReceipt(receipt);
  ```
  
10. Explain receipt semantics:
  
  - `decodeReceipt()` returns typed value and receipt metadata.
    
  - It throws `ContractReceiptError` for aborts, execution failures, or missing return data.
    
  - `decodeReceiptOutcome()` returns a discriminated `return`, `abort`, or `failure` result.
    
  - Both APIs decode only a receipt whose root invocation called that method. They do not inspect nested application invocations inside a wallet call.
    
11. Refine the transaction guidance:
  
  - The client can construct, sign, submit, and poll low-level transactions.
    
  - Generated descriptors build application invocations.
    
  - The package does not discover network wallet interfaces or construct the wallet-root invocation automatically.
    
  - Applications must not submit an inner application invocation as the root unless that contract is intentionally the authorization root.
    
12. Update the SDK-versus-bindings table so generated descriptors own contract-specific return, exception, view, receipt, and event decoding.
  
13. Add the public package subpaths:
  
  - `@groundhogchain/client/transaction`
    
  - `@groundhogchain/client/transport`
    
  - `@groundhogchain/client/contract`
    
  - `@groundhogchain/client/contracts`
    
  - `@groundhogchain/client/signers`
    
  - `@groundhogchain/client/actions`
    
14. Link the maintained client examples for chain tip, balance views, HOG transfer, and Counter deployment.
  
## Phase 2: Rewrite the TypeScript Bindings Guide
### File
`src/content/docs/tools/typescript-bindings.md`
### Generation workflow
1. State that `groundhog codegen ts` accepts canonical `.spec.xdr` input.
  
2. Remove legacy `.wasm` input and `--target wasm` instructions.
  
3. Explain that `.rv32a` does not embed a contract spec. Passing one reports an error that names the adjacent `.spec.xdr` sidecar.
  
4. Document both supported generation workflows:
  
  ```bash
  groundhog build --bindings ts
  ```
  
  This writes `target/groundhog/<name>.ts` next to the RV32 artifact.
  
  ```bash
  groundhog codegen ts \
    target/groundhog/my_contract.spec.xdr \
    -o web/src/contracts/my-contract.ts
  ```
  
  Use the standalone command when the output belongs elsewhere.
  
5. Explain the generated imports accurately. Current output uses `@groundhogchain/client/contract`, `@groundhogchain/protocol`, `@groundhogchain/protocol/utils`, and `@groundhogchain/contract-spec` as required by the spec.
  
### Generated method descriptors
Replace the old `buildNamedCodecs`, `createInvocation`, `encodeCalldata`, and callable method example with a shortened `defineContractMethod` example. Explain that interface objects expose method descriptors rather than functions.

Document these operations:

```ts
Counter.increment.invocation(contract, gasLimit, { amount: 1n });
Counter.get.decodeReturn(returnData);
Counter.increment.decodeException(abortData);

const result = await Counter.get.view({ client, contract, caller });
const outcome = await Counter.get.viewOutcome({ client, contract, caller });

const receiptResult = Counter.get.decodeReceipt(receipt);
const receiptOutcome = Counter.get.decodeReceiptOutcome(receipt);
```

Explain that return and exception decoders consume the complete buffer and reject trailing bytes.
### Generated exceptions
Add a section covering:

- Generated declared-exception unions
  
- Declared exceptions with name, selector, and typed value
  
- Unknown exceptions preserving the selector and raw abort data
  
- `ContractViewError` from `view()`
  
- `ContractReceiptError` from `decodeReceipt()`
  
- Transport and JSON-RPC errors passing through unchanged
  
### Generated event descriptors
Add a complete event example:

```ts
const decoded = ChangedEvent.decode(event);

const filter = ChangedEvent.filter({
  contractAddresses: [contract],
  topics: { actor },
});

const matches = ChangedEvent.allFromReceipt(receipt, {
  contractAddress: contract,
});

const match = ChangedEvent.singleFromReceipt(receipt, {
  contractAddress: contract,
});
```

Document these behaviors:

- A different event signature returns `null` from `decode()`.
  
- A malformed event with the matching signature throws `ContractDecodeError`.
  
- Named topic filters are generated only for directly represented topics, such as addresses and fixed 32-byte values.
  
- Hashed topic preimages are not directly filterable through generated named fields.
  
- `allFromReceipt()` returns every matching event from the selected emitter.
  
- `singleFromReceipt()` requires exactly one match.
  
- Module-level `decodeEvent()` decodes any declared event in that binding.
  
### Type mapping
Replace the current type table with the CLI `0.9.6` mapping. Include:

| Contract type | TypeScript representation |
|---|---|
| Integer types, including bare `u8` | `bigint` |
| `Bytes`, `Vec<u8>` | `Uint8Array` |
| `[u8; N]` | `FixedBytes<N>` |
| Other fixed arrays | Exact readonly tuple or `FixedArray<T, N>` |
| Tuple | Readonly tuple |
| `Option<T>` | `T \| null` |
| Named struct | Interface |
| Enum | Bigint const object and value-union type |
| Union | `{ case: "..."; value?: ... }` discriminated union |

Add construction examples:

```ts
const id = fixedBytes(rawBytes, 32);
const values = fixedArray(rawValues, 4);
```

State that encoding and decoding both enforce fixed lengths. Keep `SignedToken` listed as unsupported if it remains unsupported when the page is updated.
### Standard bindings
1. Remove the client `0.1.6` and ERC-20 interface `0.1.3` warning.
  
2. Document that client `0.2.0` ships ERC-20 and metadata bindings generated from interface `0.1.9`.
  
3. Replace old function calls with descriptor APIs:
  
  ```ts
  const balance = await ERC20.getBalanceOf.view({
    client,
    contract: token,
    args: { addr },
  });
  
  const transfer = ERC20.transfer.invocation(token, gasLimit, {
    receiver,
    amount,
  });
  ```
  
4. Mention standard event exports such as `ERC20TransferEvent`, `ERC20ApprovalEvent`, and `decodeERC20Event` after confirming their current exported names.
  
5. Add a migration note: regenerate old bindings with CLI `0.9.6`; there are no legacy callable builder aliases.
  
## Phase 3: Correct CLI and Contract-Spec Documentation
### `src/content/docs/tools/groundhog-cli.md`
1. Update the source-check note to CLI `0.9.6` and scaffold SDK `0.19.0`.
  
2. Remove:
  
  - `groundhog build --target wasm`
    
  - `groundhog test --target wasm`
    
  - `groundhog test --integration --differential`
    
  - Claims that commands merely default to RV32
    
3. State that CLI `0.9.6` build, artifact test, integration test, and deploy workflows are RV32-only.
  
4. Update the build artifact list and describe `.cargo/contract.toml` as the CLI-only RV32 `build-std` overlay.
  
5. Update the TypeScript section to make `groundhog build --bindings ts` the short path and `groundhog codegen ts <spec.xdr>` the custom-output path.
  
### `src/content/docs/reference/contract-spec.md`
1. Update the source-check note to CLI `0.9.6` and scaffold SDK `0.19.0`.
  
2. Remove `.wasm` as a current codegen input and remove current CLI WASM custom-section build guidance.
  
3. Explain that RV32 build finalization writes canonical `.spec.xdr` and human-readable `.spec.json` sidecars.
  
4. State that `.spec.json` is for inspection and `.spec.xdr` is the codegen input.
  
5. Replace WASM export-name entrypoint explanations with the SDK-generated RV32 entrypoint registry.
  
6. Update the TypeScript type mapping to agree with the rewritten bindings guide.
  
7. Document `groundhog build --bindings ts` and the targeted `.rv32a` sidecar error.
  
## Phase 4: Refresh Scaffold and Tutorial Pages
### `src/content/docs/start/getting-started.md`
- Update the CLI installation pin to `=0.9.6`.
  
- Use scaffold SDK `0.19.0`.
  
- Remove alternate WASM target guidance.
  
- Replace "defaults to RV32" with RV32-only wording.
  
- Update the generated project tree:
  
  - Keep `tests/test.rs`, `tests/test_rv32.rs`, and `tests/integration.rs`.
    
  - Remove `tests/test_wasm.rs`.
    
  - Describe `.cargo/contract.toml` as the RV32 `build-std` overlay.
    
### `src/content/docs/programming-model/testing.md`
- Update CLI and scaffold versions.
  
- Remove WASM guest-test language.
  
- Update the host-only dependency target to `cfg(not(target_arch = "riscv32"))`.
  
- Update scaffolded `groundhog-json-rpc-client` to `0.7.0`.
  
- Remove differential and WASM test modes.
  
### `src/content/docs/tutorials/build-a-counter.md`
- Update the source-check note.
  
- Replace the shown generated `Cargo.toml` with CLI `0.9.6` scaffold output.
  
- Use SDK `0.19.0`, JSON-RPC client `0.7.0`, and the current host-only target condition.
  
### `src/content/docs/tutorials/build-a-token.md`
- Update the source-check note.
  
- Remove `tests/test_wasm.rs` from the cleanup command.
  
- Revalidate the independently versioned ERC-20 interface before changing its documented version.
  
### `src/content/docs/tutorials/develop-locally.md`
- Update checked and required CLI versions to `0.9.6`.
  
- Update the installation pin to `=0.9.6`.
  
### `src/content/docs/tutorials/develop-on-devnet.md`
- Update the checked CLI version and installation pin to `0.9.6`.
  
### `src/content/docs/tutorials/add-events-to-a-contract.md`
- Update the source-check note.
  
- Keep standalone `.spec.xdr` codegen, and add `groundhog build --bindings ts` as the short path.
  
- Add a generated event descriptor example using `filter()`, `decode()`, and receipt extraction.
  
## Phase 5: Update Wallet and RPC Boundaries
### `src/content/docs/tools/wallet-integration.md`
1. Update client to `0.2.0` and CLI to `0.9.6`.
  
2. Keep the current `Signer` interface example.
  
3. Clarify that the client provides low-level transaction construction, signing, submission, and polling.
  
4. Clarify that generated `.invocation()` methods build application invocations, not network-aware wallet roots.
  
5. Keep the warning that no official browser-wallet provider, browser adapter, or descriptor-driven wallet-root builder is published.
  
### `src/content/docs/reference/json-rpc-api.md`
- Update the source-check version for the current gateway workspace.
  
- Keep raw RPC actions distinct from generated typed contract descriptors.
  
- Link to the SDK guide for actions and the bindings guide for typed method and event behavior.
  
- Replace WASM-trap examples only where they incorrectly imply a current CLI artifact path. Do not rewrite retained protocol enum names in this pass.
  
## Cross-Links and Navigation
Keep the existing TypeScript SDK and TypeScript Bindings pages and expand them in place. No sidebar changes are required.

After adding sections, update links to point to specific anchors where useful:

- SDK typed views and receipt decoding
  
- Binding method descriptors
  
- Binding event descriptors
  
- Fixed-length values
  
- Wallet-root limitations
  
- CLI codegen workflows
  

Review backlinks from:

- `tools/typescript-sdk.md`
  
- `tools/typescript-bindings.md`
  
- `tools/wallet-integration.md`
  
- `tools/groundhog-cli.md`
  
- `tutorials/add-events-to-a-contract.md`
  
- `reference/contract-spec.md`
  
- `reference/json-rpc-api.md`
  
## Verification
Run after each implementation phase:

```bash
npx astro check
```

Run before review:

```bash
pnpm build
```

Also verify:

- Every internal link is absolute and includes the expected trailing slash.
  
- Every page retains required `title` and `description` frontmatter.
  
- Code examples use APIs exported by client `0.2.0` or generated by CLI `0.9.6`.
  
- No published page recommends `--target wasm`, `--target rv32`, `--differential`, or `tests/test_wasm.rs` as current CLI behavior.
  
- No published page uses callable generated methods such as `Counter.get(...)` or `ERC20.transfer(...)`.
  
- No published page claims generated method returns require handwritten CXS decoding.
  
- Event examples use `singleFromReceipt`, not an invented receipt-helper name.
  
- Root-receipt examples state that nested wallet invocations are not inspected.
  
- The site introduces no new sidebar entries unless new pages are deliberately added.
  
## Acceptance Criteria
- TypeScript SDK installation and version tables use client `0.2.0` and protocol packages `0.7.1`.
  
- TypeScript examples compile conceptually against the current public package entrypoints.
  
- Generated method documentation covers invocation, views, returns, exceptions, and root receipts.
  
- Generated event documentation covers strict decoding, named filters, and receipt extraction.
  
- CLI and codegen documentation is RV32-only and documents `groundhog build --bindings ts`.
  
- Scaffold and tutorial pages contain no removed WASM test files or flags.
  
- Wallet documentation accurately separates low-level client capabilities from missing browser-wallet and wallet-root abstractions.
  
- `npx astro check` and `pnpm build` pass.
