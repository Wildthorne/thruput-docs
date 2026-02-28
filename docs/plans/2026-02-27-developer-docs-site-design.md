# Design: Groundhog External Developer Documentation Site

**Date:** 2026-02-27
**Status:** Approved
**Goal:** Create an external-facing developer documentation site for Groundhog, consolidating content from groundhog-product/guides, groundhog-book, sdk_rs/docs, designdocs, and burrow into a unified, well-structured site.

---

## Decisions

- **Framework:** Starlight (Astro) — fast, markdown-first, built-in search, sidebar generation, good DX
- **Repository:** New standalone repo (`groundhog-docs` or similar)
- **Deployment:** Static site. GitHub Pages or Netlify initially; custom domain when ready.
- **Structure:** Two-track model — "Start Here" (build fast) and "Deep Dive" (understand deeply) plus Reference and Ecosystem sections
- **Scope:** Full site structure stubbed out (26 pages). 16 pages with real content in v1, 10 stubs with descriptions of planned content.

---

## Site Map

### Landing Page (`/`)

**Source:** New (draw from PRD executive summary and deck messaging)
**Status:** Needs writing (~300 words)
**Content:** What Groundhog is, 4-5 differentiators (free compute, 1M+ TPS, irrevocable finality, no MEV, commutative semantics), two entry points: "Start Building" → /start/, "How It Works" → /deep-dive/

---

### Start Here (`/start/`)

The fast path for developers who want to build.

| Page | Slug | Source | Status |
|------|------|--------|--------|
| Choose Your Background | `/start/choose-your-background` | `guides/programming-model-overview.md` | **Ready** — migrate |
| For Blockchain Developers | `/start/for-blockchain-developers` | `guides/programming-model-blockchain-devs.md` | **Ready** — migrate |
| For Backend Developers | `/start/for-backend-developers` | `guides/programming-model-backend-devs.md` | **Ready** — migrate |
| Getting Started | `/start/getting-started` | `sdk_rs/docs/getting-started.md` | **Ready** — migrate, trim "What is Groundhog" preamble (routing page handles it) |
| Build a Token | `/start/build-a-token` | `sdk_rs/example-contracts/erc20/` | **Needs writing** — tutorial walkthrough of ERC-20, step by step. Code exists; narrative wrapper doesn't. |
| Build a Swap | `/start/build-a-swap` | `sdk_rs/example-contracts/swap/` | **STUB** — AMM tutorial when ready |

---

### Deep Dive (`/deep-dive/`)

For developers who want to understand how the system works.

| Page | Slug | Source | Status |
|------|------|--------|--------|
| Architecture | `/deep-dive/architecture` | `groundhog-book/docs/guide/overview.md` | **Ready** — migrate, expand slightly |
| Transaction Lifecycle | `/deep-dive/transaction-lifecycle` | `groundhog-book/docs/guide/transaction-lifecycle.md` | **Ready** — migrate |
| Execution Model | `/deep-dive/execution-model` | `designdocs/ledger.md` + `guides/groundhog-developer-guide-storage-and-execution.md` | **Needs adaptation** — combine snapshot isolation, delta merging, reservation into one external-facing page |
| Contracts | `/deep-dive/contracts` | `groundhog-book/docs/technical-specs/contracts.md` | **Ready** — migrate |
| Invocation Frames | `/deep-dive/invocation-frames` | `groundhog-book/docs/technical-specs/invocation-frames.md` | **Ready** — migrate |
| Storage Economics | `/deep-dive/storage-economics` | `designdocs/storage_costs.md` + `designdocs/storage_pricing.md` + PRD | **Needs adaptation** — combine into external-facing explanation of HOG deposits and Balance-Proportional Scheduling |
| Commutativity Analysis | `/deep-dive/commutativity-research` | `guides/stellar_classification_spec.md` + `burrow/docs/specification.md` | **Needs adaptation** — extract the "82% of operations" research with methodology |
| Consensus | `/deep-dive/consensus` | — | **STUB** — SCP-based consensus, finality model. Write when protocol docs are ready. |
| Authorization | `/deep-dive/authorization` | `designdocs/authorization.md` | **STUB** — Auth model. Adapt from designdoc when stabilized. |
| Networking | `/deep-dive/networking` | `designdocs/wire.md` + `chuckd/doc/` | **STUB** — Protocol layer, message types. Write when ready. |

---

### Reference (`/reference/`)

Canonical API and type reference.

| Page | Slug | Source | Status |
|------|------|--------|--------|
| Storage Types | `/reference/storage-types` | `sdk_rs/src/storage/` + getting-started storage section | **Needs writing** — dedicated reference for NNInt, Map, Bytestring, RetrocausalQueue, Vector with full API |
| Syscalls | `/reference/syscalls` | `designdocs/syscalls.md` + `hogd/protocol/syscalls.md` | **Needs adaptation** — merge two syscall docs into one canonical reference |
| SDK Macros | `/reference/sdk-macros` | `sdk_rs/doc/macro-contract.md` + `sdk_rs/doc/macro-storage.md` | **Ready** — migrate, expand with more examples |
| Error Handling | `/reference/error-handling` | `sdk_rs/docs/getting-started.md` (error section) | **Ready** — extract and expand |
| Cross-Contract Calls | `/reference/cross-contract-calls` | `sdk_rs/docs/getting-started.md` (cross-contract section) | **Ready** — extract and expand |
| XDR Protocol | `/reference/xdr-protocol` | `hogd/protocol/` + `groundhog-book/generated/` | **STUB** — auto-generated type reference when tooling is ready |
| JSON-RPC API | `/reference/json-rpc-api` | — | **STUB** — API endpoints when WS3 JSON-RPC server ships |

---

### Ecosystem (`/ecosystem/`)

Tools, SDKs, and integration guides.

| Page | Slug | Source | Status |
|------|------|--------|--------|
| Stellar Migration | `/ecosystem/stellar-migration` | `burrow/docs/stellar_migration_guide.md` | **Ready** — migrate |
| TypeScript SDK | `/ecosystem/typescript-sdk` | — | **STUB** — when TS SDK exists |
| Block Explorer | `/ecosystem/block-explorer` | — | **STUB** — when Jack's explorer is documented |
| Wallet Integration | `/ecosystem/wallet-integration` | — | **STUB** — when wallet exists |
| Faucet | `/ecosystem/faucet` | — | **STUB** — when faucet exists |

---

### Community (`/community/`)

| Page | Slug | Source | Status |
|------|------|--------|--------|
| Contributing | `/community/contributing` | — | **STUB** |
| Security | `/community/security` | — | **STUB** — security policy, bug bounty when ready |
| Roadmap | `/community/roadmap` | — | **STUB** — public roadmap when ready |

---

## Content Status Summary

| Status | Pages | Description |
|--------|-------|-------------|
| **Ready to migrate** | 11 | Copy from source, adjust frontmatter, minor edits |
| **Needs adaptation** | 4 | Combine multiple sources, rewrite for external audience |
| **Needs writing** | 2 | New content (landing page, Build a Token tutorial) |
| **Stub** | 10 | Placeholder with description of planned content |
| **Total** | **27** | (including landing page) |

## Content Sources Cross-Reference

| Source Repo | Pages Contributed | Notes |
|-------------|-------------------|-------|
| `groundhog-product/guides/` | 5 (overview, blockchain devs, backend devs, storage guide, stellar spec) | All external-ready |
| `groundhog-book/` | 4 (architecture, tx lifecycle, contracts, invocation frames) | Solid technical content |
| `sdk_rs/docs/` | 1 (getting-started) + extracted sections (errors, cross-contract, macros) | Practical tutorial content |
| `sdk_rs/doc/` | 1 (macros reference) | API reference |
| `designdocs/` | Portions of 3 pages (execution model, storage economics, syscalls) | Internal → external adaptation needed |
| `burrow/docs/` | 2 (commutativity research, stellar migration) | Research content |
| New writing | 2 (landing page, build-a-token tutorial) | |

## Stub Page Format

Each stub page should contain:

```markdown
---
title: [Page Title]
stub: true
---

# [Page Title]

This page is planned but not yet written.

**What will go here:** [2-3 sentences describing the planned content]

**Depends on:** [what needs to happen before this can be written — e.g., "TS SDK shipping", "auth model stabilization"]

**Source material:** [links to internal docs that will feed this page, if any]
```

## Implementation Approach

1. **Scaffold the Starlight project** — `npm create astro@latest` with Starlight template, configure sidebar nav matching the site map above
2. **Migrate ready content** — Copy the 11 ready pages, adjust frontmatter for Starlight format, fix internal links
3. **Create all stubs** — 10 stub pages with planned content descriptions
4. **Adapt content** — Rewrite the 4 pages that need adaptation (execution model, storage economics, commutativity research, syscalls)
5. **Write new content** — Landing page and Build a Token tutorial
6. **Polish** — Cross-linking between pages, consistent terminology, navigation testing

## What's NOT In This Site

These are explicitly out of scope and tracked as future work:

- Tokenomics / HOG distribution (not public)
- Validator / node operator documentation (not relevant until public testnet)
- Governance documentation (not designed yet)
- Marketing / non-technical content (separate website)
- Blog (separate, if ever)
