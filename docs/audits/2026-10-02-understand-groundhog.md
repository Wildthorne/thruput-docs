# Understand Groundhog editorial review

Issue: GH-449. Date: 2026-10-02.

## Scope

The user requested a targeted edit of the existing material. Preserve useful examples and technical depth. Clarify page roles, reduce repetition, and check the claims affected by the edits.

No public page URLs changed. The Introduction's counter example, the detailed reservation example, the six-stage transaction lifecycle, the free/locked HOG distinction, and the proposer/validator explanation remain.

## Changes

| Page | Change |
| --- | --- |
| Architecture | Renamed System Overview; replaced repeated storage explanations with a component diagram, role table, and submission/read paths |
| Engine Execution Model | Renamed Parallel Execution; retained reservation detail and clarified operation compatibility. Removed the Storage Primitives, HOG and the Capital Model, and How This Compares sections after review; finish with a short related-reading list |
| Contract-author Execution Model | Renamed Contract Execution; kept the storage examples and practical rules, with shorter lifecycle and cost summaries |
| Transaction Lifecycle | Put outcomes and receipt interpretation first; kept the six stages; distinguished discarded contract changes from committed protocol bookkeeping |
| Storage & Scheduling Economics | Renamed Compute, Capacity & Storage; retained its central examples, removed repeated gas/refund explanations, refreshed configured-cost wording, and moved planned sponsorship to the end |
| Networking | Linked to the component diagram, removed the duplicate transaction walkthrough, and corrected the event-server registration method names |
| Consensus | Kept the substantive explanation and table; clarified coordinator/execution-layer responsibilities and updated links |
| For Blockchain Developers | Kept the transfer comparison and practical differences; shortened repeated model explanations and linked to the existing EVM reentrancy section |
| Backend comparison | Qualified the SQL arithmetic analogy so it does not promise conflict-free execution for every relative update |

The optional sidebar label is now **Coming from...**. System Overview follows Introduction in the reading order.

## Source verification

Observed source revisions:

- `groundhog-hogd`: `c145e5d5a`
- `groundhog-rpc`: `770a456d`
- `groundhog-chuckd`: `b24a9a8`
- `groundhog-sdk_rs`: `ec845ba1`
- `groundhog-protocol`: `aee8ec1`

| Claim or correction | Source checked |
| --- | --- |
| Gateway submission and read backends | `groundhog-rpc/crates/x23/hogd-backend/src/lib.rs`, `submit.rs`, `status.rs`, and the shared server's `backend.rs` |
| Coordinator drives proposal and commit through its execution layer | `groundhog-chuckd/sub/baton/baton/drive.go` |
| Execution components register with the scheduler | `groundhog-hogd/hogd/hog_mempool/registration.h` and `rpc_from_exec.h`, `rpc_from_db.h`, `rpc_from_auth.h`, `rpc_from_coord.h` |
| Event registration uses prepare/activate, not the old intro name | `groundhog-hogd/hogd/hog_mempool/rpc_from_event.h`: `schedevent_prepare_event`, `schedevent_activate_event` |
| Root delta reservation follows successful root execution | `groundhog-hogd/hogd/hog_exec/runtime/syscall_handler.cc`: `try_commit_transaction()` |
| Deterministic failures can commit protocol records despite discarding contract-body effects | The same function's deterministic-fault and manual-revert paths, plus `groundhog-protocol/exec_result.x` |
| Integer reservations enforce matching bases and bounds | `groundhog-hogd/hogd/hog_db/item_lock/nnint128_lock.cc` |
| Native balances enforce funding and account for storage deposits | `groundhog-hogd/hogd/hog_db/item_lock/balance_lock.cc` |
| Declared gas limit, rather than gas consumed, drives scheduling accounting | `groundhog-hogd/hogd/hog_mempool/scheduler.cc`: `schedule()` and `apply_committed_tx_hog_age()` |
| Storage costs depend on item type and configured rates | `groundhog-hogd/hogd/storage_cost/storage_cost_model.h` and `.cc` |
| Checked and lazy balance adjustments use the integer delta model | `groundhog-sdk_rs/crates/sdk/src/storage/balance.rs` |
| Transaction fields, replay protection, and unsupported sponsorship context | `groundhog-protocol/transaction.x` and the reserved legacy sponsorship result in `exec_result.x` |

The compact author notes in `docs/programming-model/execution.md` were reconciled for contract-body failure effects, type-dependent storage costs, gas wording, and identical bytestring writes.

The dedicated EVM, Solana, and Stellar comparison guides were not re-audited in full. They remain accessible under Coming from... rather than appearing as comparison subsections in Parallel Execution.

## Compatibility and checks

- Kept existing page URLs and the execution/reservation/gas anchors used by other pages.
- Retained the old Architecture fragment IDs as aliases near the corresponding new sections.
- Updated related-link labels and homepage navigation expectations for the renamed pages.
- Extended existing link checks to cover the edited concept pages and their internal anchors.
- Astro diagnostics passed with zero errors, warnings, or hints.
- All 11 unit checks and all 43 browser checks passed.
- The production build passed through the browser test runner.
- Inspected System Overview at desktop and mobile widths and checked the retained legacy fragment targets. The component diagram uses a narrow layout so its main relationships fit a phone screen.

This is source review and documentation validation, not a new engine benchmark or a full consensus proof. The later landing-page work should use these canonical explanations and keep planned sponsorship distinct from shipped behavior.
