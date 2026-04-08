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

- NNInt storage API: `src/storage/nnint.rs`
- NNInt syscall wrappers: `src/sys_exn/nnint.rs`
- Map, Vector, Value, Bytestring, Node, Slot types: `src/storage/`
- RetrocausalQueue: `src/sys_exn/rcq.rs`
- Gas/invoke config: `src/invoke_config.rs`, `src/call/`
- Error types: `src/exn/`, macros at `groundhog-macros/src/lib.rs`
- Example contracts: `example-contracts/` (erc20, counter are the most current)
- Protocol definitions: `~/code/gh/hogd/protocol/` (syscalls.yaml, syscall_error.x)
