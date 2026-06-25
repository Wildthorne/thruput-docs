# AGENTS.md

Guidance for AI agents working in this repository.

## Project

Developer documentation site for the Groundhog L1 blockchain. Built with Astro and Starlight. Static site, no server-side rendering.

- Package manager: `pnpm`
- Content: `src/content/docs/`
- Sidebar: manually configured in `astro.config.mjs`
- Build: `pnpm build`
- Fast validation: `npx astro check`

## Programming Model Source of Truth

`docs/programming-model/` is authoritative for NNInt, storage types, execution, and gas. Read it before writing or editing related content. Published docs must be derivable from these rules.

Key rules:

- Two `set_add` calls commute if and only if their set values match.
- `strict_inc(delta)` and `inc(delta)` are both commutative. `strict_inc` reads the snapshot for early underflow detection. `inc` skips the read.
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

Verify technical claims against `docs/programming-model/` first, then source code.

Useful local source repos:

- SDK: `~/code/gh/sdk_rs/`
- Core engine: `~/code/gh/hogd/`
- JSON-RPC gateway: `~/code/gh/groundhog-rpc/`
- Protocol definitions: `~/code/gh/protocol/`
- TypeScript protocol bindings: `~/code/gh/protocol-ts/`

Common gotchas:

- SDK uses `strict_inc(delta)`. There is no `strict_add` or `strict_sub`.
- Use `#[contract_error]`, not manual error derives.
- Map access is `.at(key)` and `.at_mut(key)`, not `.get()`.
- Client methods take `&self`. `with_gas_limit` returns a new client.
- Do not invent performance numbers, dates, token economics, validator requirements, RPC fields, or SDK APIs.

## Local Files

`CLAUDE.md` and `docs/plans/` are local working files and should not be committed.
