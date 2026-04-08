# TODO

## Auto-generate reference section from SDK source

The reference pages (storage-types, syscalls, sdk-macros, error-handling, cross-contract-calls) were manually rewritten on 2026-04-07 to match the current SDK. This is not sustainable. The SDK evolves faster than manual docs updates.

**Goal:** Generate reference pages automatically from SDK cargo docs, XDR definitions, and macro source.

**Candidates for generation:**

| Page | Source |
|------|--------|
| Storage Types | `sdk_rs/src/storage/*.rs` rustdoc + type signatures |
| Syscalls | `hogd/protocol/syscalls.yaml` (canonical) + `hogd/protocol/syscall_error.x` |
| SDK Macros | `groundhog-macros/src/lib.rs` + `groundhog-macros/doc/*.md` |
| Error Handling | `sdk_rs/src/exn/` + generated client error enum shape from `gen/src/client.rs` |
| Cross-Contract Calls | `gen/src/client.rs` generated client shape |
| XDR Protocol | `hogd/protocol/*.x` files (already planned as auto-generated) |

**Approach options:**
1. **Build-time script:** Run during `pnpm build`, parse source, emit markdown. Keeps docs always in sync.
2. **CI job:** Generate on SDK release, open PR against docs repo. Allows human review.
3. **Rustdoc extraction:** Use `cargo doc --json` to get structured API data, transform to markdown tables.

**Priority:** The syscalls page is the easiest win since `syscalls.yaml` is already structured data. Storage types and macros are harder since they require parsing Rust source.
