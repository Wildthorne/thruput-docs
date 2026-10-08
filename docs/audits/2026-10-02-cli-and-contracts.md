# GH-450: CLI and Smart Contracts

## Changes

- Replaced the single CLI guide with focused project, configuration, wallet, build/test, local-node, deployment, transaction/event, codegen, automation, and troubleshooting pages.
- Added a table-only command reference.
- Added contract methods/interfaces and debugging guides. Moved error handling and cross-contract calls from Reference into Smart Contracts while retaining their detailed examples.
- Converted SDK macro and storage references to tables. Corrected `Balance` signatures to nonnegative `i128` and removed the stale claim that `contract_exception` derives `Clone`.
- Added application authorization guidance to the existing authorization page. Retained the existing event walkthrough rather than creating a second version.
- Updated SDK Rustdoc entry points and documented local generation against the project's resolved dependency.
- Moved the existing local/Devnet counter walkthroughs to Guides in the sidebar. Their end-to-end consolidation remains part of GH-454.

## Source evidence

| Input | Version or revision | Use |
| --- | --- | --- |
| Released Linux x86_64 CLI | `0.22.0` | Help output, scaffold, native/artifact/integration checks, codegen, snapshot server |
| CLI release source identity | `7699af852e4fdee8cfbbf3da4a2aeff60a72d5a1` | Reported by released binary during node startup |
| CLI archive | `groundhog-v0.22.0-x86_64-unknown-linux-gnu.tar.gz` | SHA-256 verified against release `SHA256SUMS` |
| Generated SDK dependency | `=0.42.2` | Fresh `docs-contract` scaffold |
| Generated RPC client dependency | `0.22.0` | Fresh scaffold's host-only integration dependency |
| SDK release source | `65f5ad23cdc58e3a58861d02a6c095ccd0d457fa`, tag `v0.42.2` | Storage, client helpers, macro generation, errors |
| RPC working checkout | `770a456d7a66dbb9906b480a14aa76da1d02cfb0` | CLI workflow documentation and integration-runner failure investigation; distinguished from release identity |
| Managed local runtime | `hog-devnode 0.1.30-rc.1` | Downloaded and started by the released integration runner |

Temporary verification files are in `/tmp/opencode/gh450/`. CLI configuration and cache were isolated with `XDG_CONFIG_HOME` and `XDG_CACHE_HOME`. Cargo used the existing configured registry access.

Relevant SDK paths:

- `crates/sdk/src/storage/balance.rs`: `i128` signatures, nonnegative range, missing-as-zero, negative-amount rejection.
- `crates/sdk/src/storage/value.rs`: typed storage access and missing-value handling.
- `crates/macros/src/contract_exception.rs`: generated derives, name/version parameters, generic rejection.
- `crates/macros/src/common/client.rs`: reserved names and configured client copies.
- `crates/sdk/src/invoke_config.rs`: default gas request and invocation flags.
- `crates/sdk/src/call/raw_call_error.rs`: rejected calls, exceptions, faults, and decoding failures.

## Executable results

| Check | Result |
| --- | --- |
| `cargo test` in the fresh counter | Passed two native tests; artifact and integration targets correctly ignored |
| `groundhog test` | Passed one RV32 artifact test |
| Methods guide in an isolated native test | Passed: missing counter reads zero, increments of 5 and 7 return 12; trait and custom return-type declarations compile |
| `groundhog codegen ts target/groundhog/docs_contract.spec.xdr --output target/groundhog/docs_contract.ts` | Passed |
| `cargo doc -p sdk --no-deps` | Passed |
| `groundhog test --integration` | Failed at automatic deployment before executing the test; see GH-461 |
| `npx astro check` | Passed, 0 errors/warnings/hints |
| `pnpm test` | Passed, 11 tests |
| `pnpm test:browser` | Passed, 44 tests, including new pages, links, sidebar ownership, and migrated fragments |
| `pnpm build:snapshot` and real CLI snapshot smoke | Passed, including all three migrated URLs with fragments, search, local prompt, and mobile/desktop checks |
| `git diff --check` | Passed |

The build still reports the existing Astro plugin deprecation and missing custom 404 content notices. Neither prevents the build.

The temporary methods-test harness initially captured a mock contract across an unwind boundary. Copying its code hash before the closure, as the published Testing example already does, fixed the harness. The guide's contract code did not need a change.

These checks do not qualify every CLI command against a live network. Hosted Devnet flows and remote Rustdoc pages were not requalified in this pass. Prior GH-451 live-network follow-ups still apply.

## Migration behavior

| Old URL | Destination |
| --- | --- |
| `/tools/groundhog-cli/` | `/cli/reference/` |
| `/reference/error-handling/` | `/contracts/errors/` |
| `/reference/cross-contract-calls/` | `/contracts/cross-contract-calls/` |

Astro's generated meta-refresh pages dropped URL fragments in a browser check. These migrations instead use a shared static redirect page that carries the query and fragment to its local destination. A no-JavaScript meta refresh and visible link provide page-level fallback. The real CLI snapshot server passed the same fragment checks without external requests.

## Integration blocker

[GH-461](https://linear.app/grndhg/issue/GH-461/fix-deployment-funding-in-groundhog-test-integration) records the released runner failure:

```text
native deployment requires an explicit --fund <HOG> amount
```

`groundhog test` exposes no `--fund` option. The source helper `prepare_deploy_for_rpc_with_manifest` uses default deployment options, while native deployment requires explicit funding. The test runner needs a tooling fix. Per user direction, published documentation describes the intended working integration flow without error notes or workarounds. Failure evidence remains in this internal audit and GH-461; the integration run has not passed.

The initial pass remained uncommitted for review. After the follow-up below, the user approved the documentation and requested a commit. Integration requalification remains tracked in GH-461.

## Review follow-up: contract structure

Applied the agreed contract reading order: overview, project structure, methods, execution, storage, NNInt, authorization, errors, events, cross-contract calls, invocation frames, testing, debugging, client bindings, artifacts/addresses, reference.

- Renamed Contracts to Contract artifacts and addresses and clarified code hashes versus deployment addresses. Removed WASM references from that page and Invocation Frames.
- Added a Rust-only Events page. The full counter-to-application event walkthrough now belongs to Guides and names TypeScript setup and bindings as prerequisites.
- Moved reusable event query/iteration guidance into the existing TypeScript Bindings page. The guide retains its application-persistence example and links to the API usage explanation.
- Added Generate client bindings after debugging, with one build command and links to CLI instructions and TypeScript usage.
- Renamed NNInt In Depth to NNInt and concurrent updates, directly after Storage Types.
- Merged Advanced Patterns into NNInt (negative bases) and Storage Types (exclusive writes and lock requests). Its old URL routes fragments to the matching destination.
- Corrected the macro reference's topic-encoding table against SDK `crates/sdk/src/event.rs`: supported integer scalars and bool have direct encodings; they are not CXS-hashed topics.

Verification after these changes:

| Check | Result |
| --- | --- |
| New event example against SDK 0.42.2 | Passed native emission assertions for signature, caller topic, payload, and event count |
| `groundhog build --bindings ts` with CLI 0.22.0 | Passed, emitted artifact, specs, and TypeScript bindings |
| TypeScript event queries | Checked against client source `getContractEvents.ts` and `iterateEventPages.ts`; no live-network execution claimed |
| Astro check | 0 errors/warnings/hints |
| Unit checks | 11 passed |
| Navigation browser checks | 7 passed, including all new pages, moved guide ownership, and split-fragment redirects |
| Snapshot build and real CLI smoke | Passed, including both Advanced Patterns fragment destinations |
| Published-content search | No WASM, old Advanced Patterns links, or old NNInt title remain |

The CLI review changes were also applied: removed conflicting next-step copy, reordered profiles/wallets before project creation, removed the transaction-evidence section from scripting, and introduced managed runtime setup in installation.
