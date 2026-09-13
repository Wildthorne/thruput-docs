# Groundhog Programming Model

Compact reference notes for reasoning about Groundhog contract behavior, conflict semantics, and the economic model. These files are not the final authority. For release documentation, the SDK, protocol definitions, and engine source pinned by that release are authoritative. If source code and these notes disagree, trust source code and update these notes.

## Reading Order

**Start with balances and NNInt.** `Balance` is the ordinary contract API for nonnegative amounts. Its implementation uses NNInt's two-component (set, add) model, whose commutativity rules enable parallel execution.

1. **[storage-types.md](./storage-types.md)** -- SDK storage types (`Balance`, `NNInt`, `CapacityConstraint`, `Map`, `Vector`, `Value`, `Bytestring`, `RCQ`, `Node`) and their conflict semantics.
2. **[nnint.md](./nnint.md)** -- The lower-level set_add primitive, commutativity rules, and public API mapping.
3. **[execution.md](./execution.md)** -- Snapshot isolation, deltas, exclusion model, gas as metering, and Balance-Proportional Scheduling.

## Developer Mental Model

Every transaction reads from the same frozen snapshot (previous block's committed state). Each transaction produces deltas, not final state. After its root contract call returns, the transaction's delta batch is reserved against the in-progress proposal using each storage type's merge rules. Compatible deltas accumulate concurrently. Incompatible transactions are excluded and returned to the mempool.

## The Core Design Principle

Groundhog gets parallelism from simplicity: typed deltas with known merge semantics replace arbitrary state mutations. The developer picks the right storage type, writes ordinary sequential Rust, and concurrency is a consequence of the storage model.

## Source Verification

When writing or editing content, verify claims against sibling source repos before trusting these notes. In particular:

- SDK storage API: `../sdk_rs/crates/sdk/src/storage/`
- NNInt syscall wrappers: `../sdk_rs/crates/sdk/src/sys_exn/nnint.rs` and `../sdk_rs/crates/sdk/src/sys_exn/nnint_internal.rs`
- RCQ raw syscall wrappers: `../sdk_rs/crates/sdk/src/sys_exn/rcq.rs`
- Gas/invoke config: `../sdk_rs/crates/sdk/src/invoke_config.rs`, `../sdk_rs/crates/sdk/src/call/`
- Error types: `../sdk_rs/crates/sdk/src/exn/`, macros in `../sdk_rs/crates/macros/src/`
- Protocol storage rules: `../protocol/storage_item.x`, `../protocol/syscalls.yaml`
- Engine merge/reservation rules: `../hogd/hogd/storage_item/`, `../hogd/hogd/hog_exec/runtime/`
- JSON-RPC and TypeScript client behavior: `../groundhog-rpc/`, `../protocol-ts/`, `../client-ts/`
- Current examples: `../groundhog-examples/`
