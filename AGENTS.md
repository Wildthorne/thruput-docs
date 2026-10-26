# AGENTS.md

Guidance for AI agents working in this repository.

## Project

Developer documentation site for the Project Thruput blockchain. Built with Astro and Starlight. Static site, no server-side rendering.

- Package manager: `pnpm`
- Node and pnpm versions: `engines` and `packageManager` in `package.json`
- Content: `src/content/docs/`
- Navigation and sidebar ownership: `src/navigation.ts`, imported by `astro.config.mjs`
- Standalone site pages and legacy redirects: `src/pages/`
- Build: `pnpm build`
- Type check: `pnpm astro check`

## Programming Model Guidance

The sibling source repos are authoritative for SDK APIs, protocol semantics, execution, gas, and storage economics. Verify claims against the release or revision the page targets. Check package versions, CLI surface metadata, and protocol baselines before using a sibling checkout; its HEAD may be older or newer than the documented release. Report verification gaps when matching source is unavailable.

Key rules:

- Teach Balance first for nonnegative counters and amounts. All Counter examples and tutorials use Balance. Explain NNInt afterward as the lower-level API for signed deltas and explicit bases.
- NNInt uses a `set + add` model with a commit-time floor: `value >= min(set, 0)`. Negative explicit `set` values are allowed by current source; Balance requires nonnegative values.
- Concurrent `set_add` updates commute when their resolved set values match. Matching bases do not guarantee inclusion: aggregate floor, overflow, and other reservation checks still apply.
- `strict_inc(delta)` and `inc(delta)` can merge when their resolved bases match. `strict_inc` loads the current base for early underflow and overflow checks. `inc` skips that snapshot read.
- Gas costs zero tokens. Root transactions use the declared gas limit for scheduling capacity. There is no unused-gas refund path.
- Say "gas price estimation" when discussing other-chain pain. The problem is price volatility, not usage prediction.
- Exclusion from a proposal does not commit the transaction or consume its replay nonce. It does not guarantee automatic mempool requeue. The scheduler can requeue transactions when a nomination is abandoned or a different proposal commits. A committed abort, revert, or out-of-gas fault consumes the nonce.
- Do not equate exclusion with a guaranteed `retry` status. `retry` reports scheduler processing failure; `recentFailure` is an advisory proposal-attempt diagnostic and can also accompany another status. A timeout, `unknown`, or `recentFailure` alone does not prove nonexecution or authorize replacement. Resume observation using the original hash and network. When resubmission is appropriate, use the same signed transaction while it remains valid. Receipt polling does not resubmit automatically.

## Content Rules

- Author Markdown links with absolute logical paths such as `/how-it-works/architecture/`. The routing transform adds `/docs` for the hosted site and keeps root paths for offline snapshots. In Astro components, use `docsPath` from `scripts/docs-routing.mjs` for documentation links.
- Markdown pages use Starlight admonitions, not JSX components.
- `title` and `description` frontmatter are required for docs pages.
- Reference pages describe API contracts, mainly through tables. Use short explanations and request/response examples where needed. Link to the relevant concept, task guide, or tutorial for usage guidance.
- Keep concept and section landing pages high level. Put setup steps in quickstarts and task pages, and complete walkthroughs in tutorials or guides. Follow the section ownership in `src/navigation.ts` rather than inferring page purpose from its directory.
- Prefer editing existing pages over creating parallel pages.
- Maintain agent task prompts in their source page, not a second copy. Follow the Markdown-export and agent-prompt workflows in `MAINTAINING.md`.
- Agent porting skill source generally lives in `../agent-skills/`. Users install the Thruput skill with `npx skills add thruputchain/agent-skills --skill thruput`. Keep supporting guidance near the relevant CLI, SDK, docs, or other source.

## Writing Style

- No em dashes. Use periods, commas, colons, or parentheses.
- Avoid: "key insight", "it's worth noting", "importantly", "notably", "leverage", "crucial", "vital", "robust", "seamlessly", "comprehensive", "straightforward", "game-changer", "paradigm".
- Challenger brand tone: competent, concise, confident.
- Say it once. No filler paragraphs.
- Show code examples over prose when possible.
- Keep blockchain comparison claims narrow and sourced.

## Verification

Choose checks that cover the change. `pnpm build` does not run the type checker or test suites.

| Change | Checks |
| --- | --- |
| Documentation content or navigation | `pnpm test`, `pnpm astro check`, `pnpm build` |
| Components, styles, routing, or browser behavior | The checks above and relevant `pnpm test:browser` coverage |
| Markdown export or snapshot packaging | Relevant export/packaging tests and smoke checks in `MAINTAINING.md` and `.github/workflows/ci.yml` |
| Repository instructions only | `git diff --check` and verify the referenced paths and commands |

`pnpm test` covers navigation, Markdown export, provenance, historical guides, package-version consistency, and CLI command shapes. The CLI check scans shell fences and inline code in `src/content/docs/` Markdown/MDX against `scripts/cli-surface.json`; it does not execute examples or scan Astro pages or `text` prompts. Validate changed examples outside that coverage separately. When the docs move to a new CLI release, regenerate the surface with `THRUPUT_CLI=/path/to/thruput node scripts/cli-surface.mjs` using the target binary.

Never modify, remove, or rename existing `public/agents/<cli-version>/agent-guide.md` files. They are historical release artifacts. See `MAINTAINING.md` for the current skill handoff and the history check.

Changes to content components must preserve meaning in rendered HTML and exported Markdown. Add export coverage when meaning depends on special markup. Verify hosted and offline routes when changing routing.

Other repos:

- Rust contract SDK (`thruput-sdk`): `../thruput-sdk-rs/`
- Core engine: `../hogd/`
- CLI and JSON-RPC gateway: `../thruput-tools/` (`crates/cli`, `crates/json-rpc`)
- Protocol definitions: `../thruput-protocol/`
- TypeScript protocol bindings: `../thruput-protocol-ts/`
- TypeScript client/SDK: `../thruput-sdk-ts/`
- Examples: `../thruput-examples/`
- Reference wallet: `../freighter/`

Some sibling repos may not be cloned locally. Locate the matching repository or release source rather than guessing API behavior. For packages not listed here, follow their package metadata and source links.

Rust contract SDK gotchas:

- NNInt uses `strict_inc(delta)`. There is no `strict_add` or `strict_sub`. Balance uses `increase`, `decrease`, and their lazy variants.
- Use `#[contract_exception]`, not manual error derives.
- Map access is `.at(key)` and `.at_mut(key)`, not `.get()`.
- Client methods take `&self`. `with_gas_limit` returns a new client.

Do not invent performance numbers, dates, token economics, validator requirements, RPC fields, or SDK APIs.

## Local Files

`CLAUDE.md` is a local working file and should not be committed.
Keep commits scoped to the task. Leave unrelated working-tree changes untouched.
