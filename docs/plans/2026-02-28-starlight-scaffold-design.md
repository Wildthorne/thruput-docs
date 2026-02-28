# Design: Groundhog Developer Docs — Starlight Scaffold

**Date:** 2026-02-28
**Status:** Approved
**Parent plan:** `2026-02-27-developer-docs-site-design.md`
**Goal:** Scaffold a Starlight (Astro) site and populate it with all v1 content in a single pass.

---

## Decisions

- **Framework:** Starlight (Astro) via `npm create astro@latest` with Starlight template
- **Package manager:** pnpm
- **Sidebar:** Manual configuration in `astro.config.mjs` — full control over ordering
- **Landing page:** Starlight built-in hero (`template: splash`) + `<CardGrid>` for differentiators
- **Content adaptation:** Best-effort merge of internal docs into external-facing pages
- **Tutorial:** Write a full Build a Token tutorial from the erc20 example contract
- **Scope:** Full v1 — scaffold + migrate 11 pages + adapt 4 pages + write 2 pages + create 10 stubs

---

## Project Structure

```
developers-site/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── src/
│   ├── content.config.ts
│   └── content/
│       └── docs/
│           ├── index.mdx                    # Landing (hero + cards)
│           ├── start/
│           │   ├── choose-your-background.md
│           │   ├── for-blockchain-developers.md
│           │   ├── for-backend-developers.md
│           │   ├── getting-started.md
│           │   ├── build-a-token.md
│           │   └── build-a-swap.md          # stub
│           ├── deep-dive/
│           │   ├── architecture.md
│           │   ├── transaction-lifecycle.md
│           │   ├── execution-model.md       # adapted
│           │   ├── contracts.md
│           │   ├── invocation-frames.md
│           │   ├── storage-economics.md     # adapted
│           │   ├── commutativity-research.md # adapted
│           │   ├── consensus.md             # stub
│           │   ├── authorization.md         # stub
│           │   └── networking.md            # stub
│           ├── reference/
│           │   ├── storage-types.md
│           │   ├── syscalls.md              # adapted
│           │   ├── sdk-macros.md
│           │   ├── error-handling.md
│           │   ├── cross-contract-calls.md
│           │   ├── xdr-protocol.md          # stub
│           │   └── json-rpc-api.md          # stub
│           ├── ecosystem/
│           │   ├── stellar-migration.md
│           │   ├── typescript-sdk.md        # stub
│           │   ├── block-explorer.md        # stub
│           │   ├── wallet-integration.md    # stub
│           │   └── faucet.md               # stub
│           └── community/
│               ├── contributing.md          # stub
│               ├── security.md             # stub
│               └── roadmap.md              # stub
└── docs/
    └── plans/
```

---

## Sidebar Configuration

Manual sidebar in `astro.config.mjs`:

- **Home** → `/`
- **Start Here** → choose-your-background, for-blockchain-developers, for-backend-developers, getting-started, build-a-token, build-a-swap
- **Deep Dive** → architecture, transaction-lifecycle, execution-model, contracts, invocation-frames, storage-economics, commutativity-research, consensus, authorization, networking
- **Reference** → storage-types, syscalls, sdk-macros, error-handling, cross-contract-calls, xdr-protocol, json-rpc-api
- **Ecosystem** → stellar-migration, typescript-sdk, block-explorer, wallet-integration, faucet
- **Community** → contributing, security, roadmap

---

## Landing Page

Uses Starlight's `template: splash` with hero component:
- **Title:** Groundhog
- **Tagline:** The L1 built for parallel execution. Free compute, irrevocable finality, no MEV.
- **CTAs:** "Start Building" → `/start/choose-your-background/`, "How It Works" → `/deep-dive/architecture/`
- **Below hero:** `<CardGrid>` with 4-5 differentiator cards (free compute, 1M+ TPS, irrevocable finality, no MEV, commutative semantics)

---

## Content Strategy

### Ready to migrate (11 pages)

Copy source markdown, add Starlight frontmatter (`title`, `description`), fix internal links to new slugs, strip references to internal tooling.

| Page | Source |
|------|--------|
| Choose Your Background | `groundhog-product/guides/programming-model-overview.md` |
| For Blockchain Developers | `groundhog-product/guides/programming-model-blockchain-devs.md` |
| For Backend Developers | `groundhog-product/guides/programming-model-backend-devs.md` |
| Getting Started | `sdk_rs/docs/getting-started.md` |
| Architecture | `groundhog-book/docs/guide/overview.md` |
| Transaction Lifecycle | `groundhog-book/docs/guide/transaction-lifecycle.md` |
| Contracts | `groundhog-book/docs/technical-specs/contracts.md` |
| Invocation Frames | `groundhog-book/docs/technical-specs/invocation-frames.md` |
| SDK Macros | `sdk_rs/doc/macro-contract.md` + `sdk_rs/doc/macro-storage.md` |
| Error Handling | extracted from `sdk_rs/docs/getting-started.md` |
| Cross-Contract Calls | extracted from `sdk_rs/docs/getting-started.md` |

### Needs adaptation (4 pages)

Read source docs, combine into external-facing narrative, remove internal jargon.

| Page | Sources |
|------|---------|
| Execution Model | `designdocs/ledger.md` + `groundhog-product/guides/groundhog-developer-guide-storage-and-execution.md` |
| Storage Economics | `designdocs/storage_costs.md` + `designdocs/storage_pricing.md` |
| Commutativity Research | `groundhog-product/guides/stellar_classification_spec.md` + `burrow/docs/specification.md` |
| Syscalls | `designdocs/syscalls.md` + `hogd/protocol/syscalls.md` |

### Needs writing (2 pages)

| Page | Approach |
|------|----------|
| Landing page | Hero + differentiator cards drawn from PRD messaging |
| Build a Token | Step-by-step tutorial walking through `sdk_rs/example-contracts/erc20/` |

### Stubs (10 pages)

Each stub contains: title, "planned but not yet written" note, what will go here, depends on, source material links.

Pages: Build a Swap, Consensus, Authorization, Networking, XDR Protocol, JSON-RPC API, TypeScript SDK, Block Explorer, Wallet Integration, Faucet, Contributing, Security, Roadmap.

---

## Frontmatter Convention

Every page:
```yaml
---
title: Page Title
description: One-line description for SEO/meta
---
```

Stub pages add a visible note via Starlight's `<Aside>` component indicating planned content.

---

## Source Repos

| Alias | Path |
|-------|------|
| groundhog-product | `~/docs/groundhog-product/` |
| groundhog-book | `~/code/groundhog-book/` |
| sdk_rs | `~/code/sdk/sdk_rs/` |
| designdocs | `~/docs/designdocs/` |
| hogd | `~/code/hogd/` |
| burrow | `~/code/burrow/` |
