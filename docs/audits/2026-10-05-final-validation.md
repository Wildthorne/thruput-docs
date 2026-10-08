# GH-456: Final documentation audit

## Scope and status

Audit started from developer-site commit `7957b7b` on
`gh-447-developer-site-refactor`. Work is in progress. Passing earlier checks do
not establish that the current clean-install workflows pass.

Review every published page for purpose, prerequisites, narrative, clarity,
duplication, terminology, links, and technical claims. Exercise clean CLI and
application workflows, then validate the generated site and portable exports.

## Release dependencies checked

- React PR #7 is open and unmerged. Its client `^0.14.0` compatibility fix is
  not yet a published-package guarantee.
- RPC PR #501 is open and unmerged. The site intentionally describes its
  skill/docs commands as available, per user instruction. Actual released CLI
  behavior and branch-build behavior must be reported separately.
- Latest GitHub CLI release checked: v0.22.1.
- Hosted receipt decoding and live AMM qualification require fresh checks;
  earlier failures are not assumed resolved.

## Copy coverage

`Read` means the full maintained source was inspected in this audit. Final
outcomes and edits are recorded below as each section is completed.

| Section | Pages read | Status |
| --- | --- | --- |
| Get Started | index, cli, contract, typescript, react | Read; stale overview corrected |
| Agent onboarding | start/build-with-an-agent | Read |
| CLI | index, install, configuration, wallets, create-project, build-and-test, local-node, deploy-and-call, transactions, codegen, agent-tools, automation, troubleshooting, reference | Read |
| Understand Groundhog | architecture/index and all nine how-it-works pages | Read |
| Smart Contracts and Programming Model | all eight contracts pages and all four programming-model pages | Read |
| TypeScript | all twelve typescript pages | Read |
| React | all eleven react pages | Read |
| Guides | overview and six tutorial pages | Inspected; counter workflow evidence below |
| Tools | all eight tools pages | Inspected |
| Reference | contract-spec, json-rpc-api, sdk-macros, storage-types, syscalls, xdr-protocol | Inspected; current API drift corrected; full source-to-table reconciliation remains open |
| Developer backgrounds and ecosystem comparisons | three background pages and EVM, Solana, Stellar | Read; comparison corrections below |
| Homepage and shared UI copy | homepage, footer, prompt, counter example, snapshot banner | Inspected; browser suite passed |

## Findings

1. Get Started still describes the agent handoff as two setup commands and a
   complete application. The accepted shared prompt now owns setup and ends
   with a CLI counter. Corrected the introduction.
2. Three old community routes contained only coming-soon placeholders. Their
   retirement needs an explicit disposition in the migration inventory.
3. Parallel Execution incorrectly suggested that an earlier credit from another
   transaction could rescue a lazy decrease exceeding the snapshot balance.
   `hogd/hog_db/item_lock/nnint128_lock.h/.cc` maintains separate add/subtraction
   budgets; positive reservations do not enlarge subtraction capacity. Corrected
   this claim, qualified successful reservations, and removed a self-referential
   paragraph defending the simplified model.
4. Create a project described a configuration-inspection command as network
   selection. Clarified the purpose and explicit deployment profile.
5. Replaced the 342-line repeated invocation-frame walkthrough with a concise
   lifecycle, outcome table, and one nested-call example. Preserved its section
   headings and links. Removed a repeated library-error example and generic
   architecture draft warning; tightened networking and economics introductions.
6. Contract artifact limits were described as universal constants. The current
   RPC validator reads chain-configured contract/code/memory bounds. Replaced
   the fixed-size claim with the actual limit categories.
7. Qualified the NNInt/Map examples: matching bases are not an inclusion
   guarantee, strict operations can use an already-loaded base, and a decrement
   example needs a sufficient starting value. Checked Vector's exclusive length
   updates and LibraryExn fields against installed SDK 0.42.2 source.
8. Quickstarts linked to the entire package-setup workflow after creating their
   own project. Linked directly to registry access instead and moved the
   TypeScript quickstart entry under `src/` to match the documented type-check
   configuration.
9. Corrected ecosystem comparisons: ordinary Solana CPI does not require PDA
   signer seeds; Soroban temporary deletion differs from persistent/instance
   archival; Groundhog snapshot isolation is separate from its reentrancy guard.
   Removed duplicate token implementations and unsupported broad comparisons.
10. JSON-RPC reference named wire 7.0.0 and omitted current API fields. Checked
    the RPC branch's API and serialized types, which declare wire 8.1.0. Added
    `serverLimits`, view `gasLimit` and required `gasUsed`, and optional airdrop
    registration. Corrected version metadata: unavailable release identity fields
    are omitted, not serialized as null. This documents the checked source, not
    a claim that hosted Devnet already serves this wire format.
11. Updated the storage Rustdoc link from SDK 0.34.3 to 0.42.2. Removed stale
    CLI/spec-tool and syscall release labels. The fresh scaffold's spec still
    uses `gh_contract_spec_v1`. XDR source links now use the revision embedded in
    installed `groundhog-xdr` 0.43.0: `dc6e80b6472d0eda0440eab190c24b20233c839c`.
    GitHub confirmed the commit and all six linked definition paths. Removed
    the syscall page's unsupported claim that this maintained page is generated.

## Workflow evidence

The release archive is in the persistent examples worktree's ignored
`.local/gh456/release/`. Clean workflow files and isolated XDG configuration are
under `/home/chambaz/Work/groundhog-docs-validation`, outside existing Cargo
workspaces. No existing user wallet or deployment is reused.

- Downloaded CLI v0.22.1 afresh. Archive SHA-256
  `b29954e4e4a4c374d1f1cda8a6d86b2586e0c1e086d6be53f202604f67823ba7`
  matches release SHA256SUMS. Binary identifies commit `c91f442b`.
- `init --non-interactive --generate-key --json`: passed with fresh config.
- `wallet create --profile devnet --non-interactive --force --json`: passed.
  Public address: `0x971c688f0296aff13e9d52298ec93f83b2362ea5b156dd57fe91ef69faa45fc9`.
- `airdrop --profile devnet --non-interactive --force --json`: blocked before
  submission by `network_descriptor_mismatch`, expected schemaVersion 4,
  received 3. Read-only retrieval of `https://faucet.thruput.network/v1/network`
  confirmed schema 3 and the expected Devnet RPC URL. No alternate funding
  path was used to disguise this quickstart failure.
- Fresh `groundhog new counter`, `groundhog build`, native `cargo test` (two
  passing logic tests), and `groundhog test` (one passing RV32 artifact test)
  passed. The generated project resolved SDK 0.42.2 and protocol/runtime family
  0.43.0. Native Cargo runs correctly leave node/artifact-only tests ignored.
- Generated the app binding directly from the new contract's `.spec.xdr`.
  Part-2 TypeScript dependencies installed successfully. The exact HOG-supply
  quickstart read failed with `Invalid view response: expected gasUsed to be a
  u64`. Hosted CLI and SDK incompatibilities are tracked in GH-464, which blocks
  GH-456.
- Counter part 2's exact extracted files passed strict TypeScript checking with
  client 0.14.0, protocol 0.12.0, and TypeScript 7.0.2. Part 3's documented React
  installation still fails with `ERESOLVE`: published React 0.3.1 requires client
  `^0.11.0`. This is the open React PR #7 release dependency, not a passing guide
   installation. No forced peer resolution was used.
- In a separate branch-qualified app, counter parts 3 and 4 pass strict
  TypeScript checking and production builds with the packed React PR #7 package.
  The part-4 build emits bundler warnings about dependency `use client`
  directives; it exits successfully. This does not qualify the published install.
- The local-node wallet harness passed with that branch package and the freshly
  built counter artifact. Evidence is in the examples worktree at
  `.local/counter-wallet-V9tVvC`. This uses a controlled provider and real local
  transactions, not hosted Devnet or an installed wallet extension.
- GH-459's branch CLI installed the maintained Groundhog skill successfully in
  the isolated `agent-run` directory using `skills@1.7.0`. Installed source hash:
  `5f224d8a4cc5fcdd3cc42767a405a4149af876693d49e6d61f70ac9df4145791`.
  The installed instructions were read; no independent coding-agent run is claimed.

## Migration inventory

Compared `git ls-tree -r --name-only 8ee0dcf src/content/docs src/pages` with
the current source and redirect inventory. The baseline contains 51 page routes:
38 retained, 10 redirected, and three retired empty placeholders.

### Retained routes

| Area | Retained pages |
| --- | --- |
| Homepage | `/` |
| Ecosystem | evm, solana, stellar |
| How it works | architecture, authorization, consensus, contracts, execution-model, invocation-frames, networking, storage-economics, transaction-lifecycle |
| Programming model | execution, nnint, storage-types, testing |
| Reference | contract-spec, json-rpc-api, sdk-macros, storage-types, syscalls, xdr-protocol |
| Start | build-with-an-agent (MDX converted to Markdown), for-backend-developers, for-blockchain-developers, for-distributed-systems-developers |
| Tools | block-explorer (display title Explorer), faucet, rust-api-docs, typescript-bindings, typescript-sdk, wallet-integration, wallet-provider |
| Tutorials | build-a-counter, build-a-token, connect-a-wallet-to-your-app, work-with-groundhog-from-typescript |

### Redirected routes

| Previous route | Default destination |
| --- | --- |
| `/start/` | `/architecture/` |
| `/start/getting-started/` | `/get-started/contract/` |
| `/tools/groundhog-cli/` | `/cli/reference/` |
| `/reference/cross-contract-calls/` | `/contracts/cross-contract-calls/` |
| `/reference/error-handling/` | `/contracts/errors/` |
| `/programming-model/advanced/` | `/programming-model/storage-types/` |
| `/tutorials/add-events-to-a-contract/` | `/contracts/events/` |
| `/tutorials/design-a-swap/` | `/tutorials/build-an-amm/` |
| `/tutorials/develop-locally/` | `/cli/local-node/` |
| `/tutorials/develop-on-devnet/` | `/cli/deploy-and-call/` |

Task-specific fragments can select a different destination through
`LegacyRedirect`. Existing browser and snapshot tests exercise representative
fragment mappings. The EVM rewrite preserves its six removed heading anchors
with explicit spans; Solana, Stellar, and Invocation Frames retain their heading
names. A complete historical-fragment comparison against `8ee0dcf` remains open.

### Retired placeholders

`/community/contributing/`, `/community/roadmap/`, and `/community/security/`
contained only Coming soon notices at the baseline. They remain retired with no
redirect because no replacement policy or roadmap page exists. In particular,
the old security placeholder contained no private reporting instructions to
preserve. Current generated documentation links pass local-link validation.

Current page ownership is checked by the script test that requires exactly one
sidebar owner per published documentation page. The build exports 93 maintained
Markdown pages, including the homepage, plus section bundles and indexes.

## Final site checks

| Check | Result |
| --- | --- |
| `npx astro check` | 53 files; zero errors, warnings, or hints |
| `pnpm test` | 17 passed |
| `pnpm build` | Passed; 93 Markdown pages exported and local links/fragments validated |
| `pnpm exec playwright test --timeout=60000` | 70 passed, including search, navigation, keyboard access, themes, mobile layouts, animations, and copy fallbacks |
| `pnpm build:snapshot` | Passed |
| `node scripts/smoke-snapshot.mjs /home/chambaz/Work/groundhog-rpc/target/debug/groundhog` | Passed with GH-459 branch binary: 105 Markdown files exported, source code examples preserved, local search/navigation/copy actions passed, no external requests |
| `git diff --check` | Passed |

The build reports existing Astro Markdown-plugin deprecations, unused dependency
imports, and a missing optional `404` content entry. These do not fail the build.
The final reference-label/link edits also passed a fresh `pnpm build` and
`git diff --check`. Browser and snapshot checks ran before those label/link edits.

## Remaining qualification

- Finish full reference-table/source reconciliation and historical-fragment audit.
- Resolve GH-464 before qualifying hosted funding, reads, and deployment journeys.
- Publish the React compatibility fix and GH-459 CLI commands, then repeat clean
  release installs. Branch tarballs and binaries are separate evidence.
- Complete the remaining native/RV32 token and AMM checks and live funding
  qualification tracked in GH-461/GH-463.
- Qualify authenticated hosted documentation delivery, manual extension signing,
  unfamiliar-developer findability, and an independent coding-agent workflow.
- Preserve the examples harness's local `COUNTER_ARTIFACT` override change when
  reviewing this work across repositories.
