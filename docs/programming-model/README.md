# Groundhog Programming Model

Reference rules for the Groundhog L1 programming model. These files are the source of truth for reasoning about contract behavior, conflict semantics, and economic model.

## Reading Order

**Start with NNInt.** It is the core unlock. The two-component (set, add) model and its commutativity rules are what make Groundhog's parallel execution possible. Everything else builds on this.

1. **[nnint.md](./nnint.md)** -- The set_add primitive, commutativity rules, public API mapping. Read this first.
2. **[storage-types.md](./storage-types.md)** -- All storage types (NNInt, Map, Vector, Value, Bytestring, RetrocausalQueue) and their conflict semantics. How to choose between them.
3. **[execution.md](./execution.md)** -- Snapshot isolation, block lifecycle, exclusion model, gas (metering not billing), Balance-Proportional Scheduling.

## The Model in Five Sentences

Every transaction reads from the same frozen snapshot (previous block's committed state). Each transaction produces deltas, not final state. At block close, deltas are checked for compatibility using each storage type's merge rules. Compatible deltas merge. Incompatible transactions are excluded and returned to the mempool.

## The Core Design Principle

Groundhog gets parallelism from simplicity: typed deltas with known merge semantics replace arbitrary state mutations. The developer picks the right storage type, writes simple sequential code, and concurrency is a consequence of the type system, not explicit parallel programming.

## Source Verification

When writing or editing content, verify claims against the SDK source at `~/code/gh/sdk/sdk_rs`. In particular:

- NNInt API: `src/non_negative_int.rs` (public API), `src/internal/nnint.rs` (internal syscall wrapper). `src/storage/` is an optional convenience library (handle/keypath sugar) that should be its own crate.
- RetrocausalQueue: `src/retrocausal_queue.rs`
- Gas/invoke config: `src/invoke_config.rs`, `src/call/calls.rs`
- Storage convenience layer: `src/storage/` (optional, wraps primitives with keypath-based handles and KV sugar)
