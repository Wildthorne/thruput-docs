# GH-452: TypeScript review checkpoint

## Scope and delivery

Implemented the TypeScript portion of GH-452. The user approved the content and organization, including Accounts and wallet clients, and requested a commit before proceeding to React.

The section now follows this order:

1. Overview
2. Package setup
3. Connect to a network
4. Configure HTTP transport
5. Addresses and amounts
6. Use contract bindings
7. Read contract data
8. Read events
9. Accounts and wallet clients
10. Connect a wallet
11. Use a signer in scripts
12. Send transactions
13. Track transaction results
14. Deploy a contract
15. Reference: client API and wallet provider

The overview explains public clients, bindings, account authorization, and package responsibilities. The read path uses the supplied HOG binding and address, without Rust, signing, or deployment prerequisites.

## Content changes

- Split the large SDK guide into focused tasks. Its existing URL now holds table-only API reference and links to usage instructions.
- Reworked bindings around interface selection and typed calls. Event querying has its own page.
- Replaced the large wallet lifecycle function with smaller discovery, connection, and cleanup examples. Provider execution and persistence are explained at the send/observation boundaries.
- Converted the provider reference to tables and verified its capability extension against the current release.
- Corrected local bootstrap accounts to native pubkey accounts. Deployment now uses explicit `DeploymentOptions` with `amount`, `gasLimit`, and optional initializer.
- Updated the existing TypeScript and browser-wallet guides where they used stale installation commands, missing deployment funding, source-address bootstrap assumptions, or a flat ERC-20 export.
- Preserved existing tools-page URLs and old lookup anchors. Updated task links where a focused page is now the better destination.
- Kept React content unchanged. Published pages describe expected supported behavior without deployment-bug notes.

## Verification inputs

| Input | Value |
| --- | --- |
| Published client | `@groundhogchain/client@0.14.0` |
| Published protocol package | `@groundhogchain/protocol@0.12.0` |
| Client source | `b588adefdb5ce1df10da6c8ef6b7b67794411776`, tag `v0.14.0`; clean checkout |
| TypeScript | `5.9.3` |
| Node | `22.23.1` |
| tsx | `4.23.15` |
| Vite | `8.3.2` |
| CLI | Released Linux x86_64 `0.22.0` |
| Managed local runtime | `0.1.30-rc.1`, confirmed by `toolchain which --json` |
| Counter fixture | CLI-generated SDK `0.42.2` artifact and matching TypeScript binding from GH-450 |

Registry credentials came from the existing environment and were not written into documentation or fixtures. The verification project, lockfile, extracted snippets, and runtime harness are under `/tmp/opencode/gh452/`.

Authoritative client paths:

- `src/index.ts`, `src/client.ts`, `src/cluster.ts`: exports, async creation, cluster identity and capability declarations.
- `src/wallet/account.ts`, `client.ts`, `deployment.ts`, `execution.ts`: native account derivation, execution, explicit deployment funding, receipt and observation errors.
- `src/local-dev/index.ts`: native manifest verification and Node-only account loading.
- `src/wallet/providerClient.ts`, `src/provider/types.ts`: capability advertisement, provider binding, signing validation, pre-submit persistence, invalidation.
- `src/actions/public/getContractEvents.ts`, `iterateEventPages.ts`: typed pages and bounded historical iteration.
- `src/actions/public/waitForTransactionReceipt.ts`, `src/types/rpc.ts`: status, nullable receipt lookups, and observation semantics.
- `src/transport/http.ts`: timeout, batching, and transport errors.

## Executable results

| Check | Result |
| --- | --- |
| Extracted TypeScript task examples | Strict type-check passed with `noUncheckedIndexedAccess`; setup context supplied where a page continues an earlier block |
| Complete browser-wallet guide | All three blocks assembled; strict type-check and Vite production build passed |
| Counter tutorial's complete view/write modules | Strict type-check passed against a freshly generated binding |
| Fresh native account and airdrop | Passed on isolated local runtime |
| Supplied HOG binding: supply and balance views | Passed locally |
| Typed HOG transfer | Passed with documented 500,000 child / 1,000,000 root budgets; verified receipt, status, decoded void result, and balance change |
| Event receipt decoding, typed query, raw paginated walk | Passed locally |
| Oversized transfer | Produced a committed `TransactionExecutionError` as expected |
| Canceled view | Classified as `cancelled` |
| Funded counter deployment with atomic initialization | Passed; predicted address matched, counter read returned 10 |
| Provider discovery/signing/submission | Passed with a protocol test provider and real local RPC execution |
| Provider atomic batch | Two transfers passed with ordered returns; a batch containing a failing call rolled back the earlier transfer |
| Failed provider persistence callback | Prevented broadcast |
| Provider session change | Invalidated the adapter as expected |
| `npx astro check` | 0 errors, warnings, or hints |
| `pnpm test` | 11 passed |
| `pnpm test:browser` | 44 passed, including the expanded TypeScript navigation and internal-link coverage |
| `git diff --check` | Passed |

The provider runtime check uses a test provider, not an installed browser extension. The browser guide was type-checked and production-built; no manual extension approval flow is claimed.

Three checks improved the documentation or verification harness:

- A committed status does not make `getTransactionReceipt` non-null in its type contract. The status example now handles an unavailable receipt explicitly.
- A view immediately after a successful receipt can still use an older snapshot. Local assertions now wait for a view height at least as new as the receipt. The read task explains this distinction.
- The provider fixture initially omitted `supportedMethods: ["getCapabilities"]`. The adapter correctly treated batching as unsupported. The fixture and provider reference now include advertisement semantics.

## Hosted Devnet qualification

Rechecked with the installed published client:

- Connection, network identity, chain tip, and version queries passed. Observed wire format: `5.2.0`.
- The supplied HOG event query completed successfully with an empty page, which is a valid result.
- The typed HOG supply read reproduced the existing compatibility failure: `Invalid view response: expected gasUsed to be a u64`.

This is the previously recorded GH-451 live-read follow-up, also relevant to final GH-456 qualification. Local tests do not establish that the hosted typed-read path passes. No public-network writes were performed in this pass. Per user direction, the deployment-specific failure is recorded here and in Linear, not in published content.

Hosted generated API sites remain external references. Their authenticated contents were not used as verification evidence; package declarations and source were used instead.
