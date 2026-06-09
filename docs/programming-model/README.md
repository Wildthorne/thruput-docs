# Groundhog Programming Model

Reference rules for the Groundhog L1 programming model. These files are compact context for reasoning about contract behavior, conflict semantics, and the economic model. Verify API details against the current Rust SDK before publishing user-facing examples.

## Reading Order

**Start with NNInt.** It is the core unlock. The two-component (set, add) model and its commutativity rules are what make Groundhog's parallel execution possible. Everything else builds on this.

1. **[nnint.md](./nnint.md)** -- The set_add primitive, commutativity rules, public API mapping. Read this first.
2. **[storage-types.md](./storage-types.md)** -- SDK storage types (`NNInt`, `Map`, `Vector`, `Value`, `Bytestring`, `RCQ`, `Node`) and their conflict semantics. How to choose between them.
3. **[execution.md](./execution.md)** -- Snapshot isolation, deltas, exclusion model, gas as metering, and Balance-Proportional Scheduling.

## The Model in Five Sentences

Every transaction reads from the same frozen snapshot (previous block's committed state). Each transaction produces deltas, not final state. At block close, deltas are checked for compatibility using each storage type's merge rules. Compatible deltas merge. Incompatible transactions are excluded and returned to the mempool.

## The Core Design Principle

Groundhog gets parallelism from simplicity: typed deltas with known merge semantics replace arbitrary state mutations. The developer picks the right storage type, writes ordinary sequential Rust, and concurrency is a consequence of the storage model.

## Source Verification

When writing or editing content, verify claims against the checked-out SDK source at `~/code/sdk_rs`. In particular:

- NNInt storage API: `crates/sdk/src/storage/nnint.rs`
- NNInt syscall wrappers: `crates/sdk/src/sys_exn/nnint.rs` and `crates/sdk/src/sys_exn/nnint_internal.rs`
- Map, Vector, Value, Bytestring, Node, Slot types: `crates/sdk/src/storage/`
- RCQ typed wrapper and raw syscall wrappers: `crates/sdk/src/storage/rcq.rs`, `crates/sdk/src/sys_exn/rcq.rs`
- Gas/invoke config: `crates/sdk/src/invoke_config.rs`, `crates/sdk/src/call/`
- Error types: `crates/sdk/src/exn/`, macros in `crates/macros/src/`
- Current examples: `~/code/sdk_rs/example-contracts/` first; `~/code/groundhog-examples/` as a secondary reference
