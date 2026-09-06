# AGENTS.md

Guidance for AI agents working in this repository.

## Project

Developer documentation site for the Groundhog L1 blockchain. Built with Astro and Starlight. Static site, no server-side rendering.

- Package manager: `pnpm`
- Content: `src/content/docs/`
- Sidebar: manually configured in `astro.config.mjs`
- Build: `pnpm build`
- Fast validation: `npx astro check`

## Programming Model Guidance

The sibling source repos are authoritative for SDK APIs, protocol semantics, execution, gas, and storage economics. `docs/programming-model/` is a compact working model for doc authors. Read it before editing related content, but verify its claims against source before publishing.

Key rules:

- NNInt uses a `set + add` model with a commit-time floor: `value >= min(set, 0)`. Negative explicit `set` values are allowed by current source, but ordinary balances and counters should still use nonnegative bases.
- Two `set_add` calls commute if and only if their resolved set values match.
- `strict_inc(delta)` and `inc(delta)` are both commutative. `strict_inc` loads the current base for early underflow detection. `inc` skips that read.
- Gas costs zero tokens. Root transactions use the declared gas limit for scheduling capacity. There is no unused-gas refund path.
- Say "gas price estimation" when discussing other-chain pain. The problem is price volatility, not usage prediction.
- Excluded transactions are returned to the mempool, not retried next block.

## Content Rules

- Use absolute internal links such as `/how-it-works/architecture/`.
- Markdown pages use Starlight admonitions, not JSX components.
- `title` and `description` frontmatter are required for docs pages.
- Reference pages are API tables only. Link to Programming Model for usage guidance.
- Concept pages in `start/` stay high level. Link to Programming Model and tutorials for details.
- Prefer editing existing pages over creating parallel pages.

## Writing Style

- No em dashes. Use periods, commas, colons, or parentheses.
- Avoid: "key insight", "it's worth noting", "importantly", "notably", "leverage", "crucial", "vital", "robust", "seamlessly", "comprehensive", "straightforward", "game-changer", "paradigm".
- Challenger brand tone: competent, concise, confident.
- Say it once. No filler paragraphs.
- Show code examples over prose when possible.
- Keep blockchain comparison claims narrow and sourced.

## Verification

Verify technical claims against source code first, then reconcile `docs/programming-model/` and published docs with what the source says.

Other repos:

- SDK: `../sdk_rs/`
- Core engine: `../hogd/`
- JSON-RPC gateway: `../groundhog-rpc/`
- Protocol definitions: `../protocol/`
- TypeScript protocol bindings: `../protocol-ts/`
- TypeScript client/SDK: `../client-ts/`

Common gotchas:

- SDK uses `strict_inc(delta)`. There is no `strict_add` or `strict_sub`.
- Use `#[contract_exception]`, not manual error derives.
- Map access is `.at(key)` and `.at_mut(key)`, not `.get()`.
- Client methods take `&self`. `with_gas_limit` returns a new client.
- Do not invent performance numbers, dates, token economics, validator requirements, RPC fields, or SDK APIs.

## Local Files

`CLAUDE.md` is a local working file and should not be committed.
