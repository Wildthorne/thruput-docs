# Groundhog Developer Docs v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete Starlight docs site for the Groundhog L1 blockchain with 27 pages: 11 migrated, 4 adapted, 2 new, 10 stubs.

**Architecture:** Starlight (Astro) with manual sidebar config in `astro.config.mjs`. Content lives in `src/content/docs/` organized by section directories. All source content is pulled from 6 external repos and adapted for an external developer audience.

**Tech Stack:** Astro + Starlight, pnpm, Markdown/MDX

---

## Source Repos Reference

| Alias | Path |
|-------|------|
| groundhog-product | `~/docs/groundhog-product/` |
| groundhog-book | `~/code/groundhog-book/` |
| sdk_rs | `~/code/sdk/sdk_rs/` |
| designdocs | `~/docs/designdocs/` |
| hogd | `~/code/hogd/` |
| burrow | `~/code/burrow/` |

---

## Task 1: Scaffold Starlight Project

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/content.config.ts`, `src/content/docs/index.mdx`

**Step 1: Initialize the project**

```bash
cd /Users/markmayo/code/developers-site
pnpm create astro@latest . -- --template starlight --install --no-git
```

If the interactive prompt doesn't accept all flags, answer:
- Where to create: `.` (current directory)
- Template: starlight
- Install dependencies: yes
- Initialize git: no (docs/plans already exists, we manage git ourselves)

**Step 2: Verify the scaffold builds**

```bash
cd /Users/markmayo/code/developers-site
pnpm build
```

Expected: Build succeeds, outputs to `dist/`.

**Step 3: Clean up default content**

Delete the default example content that Starlight generates (likely `src/content/docs/guides/example.md` and similar). Keep `src/content/docs/index.mdx` — we'll replace it in Task 3.

**Step 4: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Starlight project"
```

---

## Task 2: Configure Sidebar and Site Settings

**Files:**
- Modify: `astro.config.mjs`

**Step 1: Replace the astro.config.mjs with full sidebar**

```javascript
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Groundhog',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/groundhog' },
      ],
      sidebar: [
        {
          label: 'Start Here',
          items: [
            'start/choose-your-background',
            'start/for-blockchain-developers',
            'start/for-backend-developers',
            'start/getting-started',
            'start/build-a-token',
            'start/build-a-swap',
          ],
        },
        {
          label: 'Deep Dive',
          items: [
            'deep-dive/architecture',
            'deep-dive/transaction-lifecycle',
            'deep-dive/execution-model',
            'deep-dive/contracts',
            'deep-dive/invocation-frames',
            'deep-dive/storage-economics',
            'deep-dive/commutativity-research',
            'deep-dive/consensus',
            'deep-dive/authorization',
            'deep-dive/networking',
          ],
        },
        {
          label: 'Reference',
          items: [
            'reference/storage-types',
            'reference/syscalls',
            'reference/sdk-macros',
            'reference/error-handling',
            'reference/cross-contract-calls',
            'reference/xdr-protocol',
            'reference/json-rpc-api',
          ],
        },
        {
          label: 'Ecosystem',
          items: [
            'ecosystem/stellar-migration',
            'ecosystem/typescript-sdk',
            'ecosystem/block-explorer',
            'ecosystem/wallet-integration',
            'ecosystem/faucet',
          ],
        },
        {
          label: 'Community',
          items: [
            'community/contributing',
            'community/security',
            'community/roadmap',
          ],
        },
      ],
    }),
  ],
});
```

**Step 2: Commit**

```bash
git add astro.config.mjs
git commit -m "feat: configure sidebar navigation"
```

---

## Task 3: Create Landing Page

**Files:**
- Modify: `src/content/docs/index.mdx`

**Step 1: Write the landing page**

Replace the default `index.mdx` with:

```mdx
---
title: Groundhog
description: Developer documentation for the Groundhog L1 blockchain.
template: splash
hero:
  title: Groundhog
  tagline: The L1 built for parallel execution. Free compute, irrevocable finality, no MEV.
  actions:
    - text: Start Building
      link: /start/choose-your-background/
      icon: right-arrow
      variant: primary
    - text: How It Works
      link: /deep-dive/architecture/
      variant: minimal
---

import { CardGrid, Card } from '@astrojs/starlight/components';

## Why Groundhog?

<CardGrid>
  <Card title="Free Compute" icon="rocket">
    No gas fees. Execution costs zero. You pay only for storage — and it's a refundable deposit, not a burn.
  </Card>
  <Card title="1M+ TPS" icon="seti:bolt">
    Parallel execution by default. Most operations are commutative — they produce the same result regardless of execution order — so they run concurrently without coordination.
  </Card>
  <Card title="Irrevocable Finality" icon="approve-check-circle">
    Transactions are final when confirmed. No reorgs, no probabilistic finality, no waiting for additional blocks.
  </Card>
  <Card title="No MEV" icon="shield">
    Commutative execution eliminates ordering dependency. There's nothing to extract because transaction order doesn't affect outcomes.
  </Card>
</CardGrid>

## Two Ways In

**Want to build?** Start with [Choose Your Background](/start/choose-your-background/) — a 2-minute routing page that points you to the right guide based on what you already know.

**Want to understand?** Start with [Architecture](/deep-dive/architecture/) — how Groundhog achieves parallel execution at the protocol level.
```

**Step 2: Build and verify**

```bash
pnpm build
```

Expected: Build succeeds. The landing page renders with hero and cards.

**Step 3: Commit**

```bash
git add src/content/docs/index.mdx
git commit -m "feat: add landing page with hero and differentiator cards"
```

---

## Task 4: Create All Stub Pages

Create 10 stub pages so the sidebar resolves. Each stub follows the same template. Create all directories first, then all files.

**Files:**
- Create: `src/content/docs/start/build-a-swap.md`
- Create: `src/content/docs/deep-dive/consensus.md`
- Create: `src/content/docs/deep-dive/authorization.md`
- Create: `src/content/docs/deep-dive/networking.md`
- Create: `src/content/docs/reference/xdr-protocol.md`
- Create: `src/content/docs/reference/json-rpc-api.md`
- Create: `src/content/docs/ecosystem/typescript-sdk.md`
- Create: `src/content/docs/ecosystem/block-explorer.md`
- Create: `src/content/docs/ecosystem/wallet-integration.md`
- Create: `src/content/docs/ecosystem/faucet.md`
- Create: `src/content/docs/community/contributing.md`
- Create: `src/content/docs/community/security.md`
- Create: `src/content/docs/community/roadmap.md`

**Step 1: Create directories**

```bash
mkdir -p src/content/docs/{start,deep-dive,reference,ecosystem,community}
```

**Step 2: Create stub pages**

Use this template for each stub, customizing the title, description, and details:

```markdown
---
title: [Page Title]
description: [One-line description]
---

import { Aside } from '@astrojs/starlight/components';

<Aside type="caution" title="Coming Soon">
This page is planned but not yet written.
</Aside>

## What Will Go Here

[2-3 sentences describing planned content]

**Depends on:** [what needs to happen first]

**Source material:** [links to internal docs, if any]
```

Individual stub content:

**`start/build-a-swap.md`** — title: "Build a Swap", description: "Tutorial: build an AMM on Groundhog". What will go here: Step-by-step tutorial building an automated market maker using the swap example contract. Depends on: Swap contract example stabilization. Source material: `sdk_rs/example-contracts/swap/`

**`deep-dive/consensus.md`** — title: "Consensus", description: "How Groundhog achieves consensus and finality". What will go here: SCP-based consensus protocol, finality model, block production. Depends on: Protocol documentation. Source material: None yet.

**`deep-dive/authorization.md`** — title: "Authorization", description: "Groundhog's authorization model". What will go here: How authorization works — signatures, auth claims, delegation. Depends on: Auth model stabilization. Source material: `designdocs/authorization.md`

**`deep-dive/networking.md`** — title: "Networking", description: "Groundhog's network protocol". What will go here: Protocol layer, message types, peer discovery, overlay network. Depends on: Network protocol documentation. Source material: `designdocs/wire.md`, `hogd/protocol/`

**`reference/xdr-protocol.md`** — title: "XDR Protocol", description: "Auto-generated XDR type reference". What will go here: Complete type reference generated from XDR definitions in `hogd/protocol/`. Depends on: XDR documentation tooling. Source material: `hogd/protocol/*.x`

**`reference/json-rpc-api.md`** — title: "JSON-RPC API", description: "API endpoints for interacting with a Groundhog node". What will go here: RPC method reference with request/response examples. Depends on: WS3 JSON-RPC server shipping. Source material: None yet.

**`ecosystem/typescript-sdk.md`** — title: "TypeScript SDK", description: "TypeScript SDK for Groundhog". What will go here: Installation, configuration, and usage of the TypeScript SDK. Depends on: TypeScript SDK development. Source material: None yet.

**`ecosystem/block-explorer.md`** — title: "Block Explorer", description: "Groundhog block explorer". What will go here: How to use the block explorer to inspect transactions, contracts, and state. Depends on: Explorer documentation. Source material: None yet.

**`ecosystem/wallet-integration.md`** — title: "Wallet Integration", description: "Wallet integration guide for Groundhog". What will go here: How to connect wallets, sign transactions, manage keys. Depends on: Wallet development. Source material: None yet.

**`ecosystem/faucet.md`** — title: "Faucet", description: "Get testnet HOG tokens". What will go here: How to use the testnet faucet to get HOG for development. Depends on: Faucet deployment. Source material: None yet.

**`community/contributing.md`** — title: "Contributing", description: "How to contribute to Groundhog". What will go here: Contribution guidelines, code of conduct, development setup. Depends on: Contribution process definition. Source material: None yet.

**`community/security.md`** — title: "Security", description: "Security policy and bug bounty". What will go here: Responsible disclosure policy, bug bounty program, security contact. Depends on: Security policy definition. Source material: None yet.

**`community/roadmap.md`** — title: "Roadmap", description: "Groundhog development roadmap". What will go here: Public roadmap with milestones and timelines. Depends on: Public roadmap approval. Source material: None yet.

**Step 3: Build and verify**

```bash
pnpm build
```

Expected: Build succeeds. All sidebar links resolve. Every stub page renders with the "Coming Soon" aside.

**Step 4: Commit**

```bash
git add src/content/docs/
git commit -m "feat: add all stub pages"
```

---

## Task 5: Migrate Start Here — Choose Your Background

**Files:**
- Create: `src/content/docs/start/choose-your-background.md`

**Step 1: Copy and adapt**

Source: `~/docs/groundhog-product/guides/programming-model-overview.md` (57 lines)

Copy the file and make these changes:
1. Add frontmatter:
   ```yaml
   ---
   title: Choose Your Background
   description: Pick the right Groundhog guide based on what you already know.
   ---
   ```
2. Fix internal links:
   - `[Guide for Backend & Database Developers](programming-model-backend-devs.md)` → `[Guide for Backend & Database Developers](/start/for-backend-developers/)`
   - `[Guide for Blockchain Developers](programming-model-blockchain-devs.md)` → `[Guide for Blockchain Developers](/start/for-blockchain-developers/)`
   - `[Storage & Execution Guide](groundhog-developer-guide-storage-and-execution.md)` → `[Storage & Execution Guide](/deep-dive/execution-model/)`
3. Keep all content as-is — it's already external-facing.

**Step 2: Build and verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/content/docs/start/choose-your-background.md
git commit -m "feat: migrate Choose Your Background page"
```

---

## Task 6: Migrate Start Here — For Blockchain Developers

**Files:**
- Create: `src/content/docs/start/for-blockchain-developers.md`

**Step 1: Copy and adapt**

Source: `~/docs/groundhog-product/guides/programming-model-blockchain-devs.md` (317 lines)

1. Add frontmatter:
   ```yaml
   ---
   title: "For Blockchain Developers"
   description: Map your Ethereum, Solana, or Move experience to Groundhog's programming model.
   ---
   ```
2. No internal links to fix — self-contained.
3. Preserve all code blocks (Solidity + Rust), tables, and inline examples.

**Step 2: Build and verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/content/docs/start/for-blockchain-developers.md
git commit -m "feat: migrate For Blockchain Developers guide"
```

---

## Task 7: Migrate Start Here — For Backend Developers

**Files:**
- Create: `src/content/docs/start/for-backend-developers.md`

**Step 1: Copy and adapt**

Source: `~/docs/groundhog-product/guides/programming-model-backend-devs.md` (315 lines)

1. Add frontmatter:
   ```yaml
   ---
   title: "For Backend Developers"
   description: Map your Postgres and database experience to Groundhog's programming model.
   ---
   ```
2. No internal links to fix — self-contained.
3. Preserve SQL code blocks, Rust code blocks, and ASCII diagrams.

**Step 2: Build and verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/content/docs/start/for-backend-developers.md
git commit -m "feat: migrate For Backend Developers guide"
```

---

## Task 8: Migrate Start Here — Getting Started

**Files:**
- Create: `src/content/docs/start/getting-started.md`

**Step 1: Copy and adapt**

Source: `~/code/sdk/sdk_rs/docs/getting-started.md` (486 lines)

1. Add frontmatter:
   ```yaml
   ---
   title: Getting Started
   description: Set up the Groundhog Rust SDK and write your first contract.
   ---
   ```
2. **Trim the "What is Groundhog" preamble** — the routing page already handles this. Remove everything before the first practical section (likely "Repository Structure" or "Your First Contract").
3. Fix links:
   - `doc/macro-contract.md` → `/reference/sdk-macros/`
   - `doc/macro-storage.md` → `/reference/sdk-macros/`
   - References to `./scripts/dev.sh` → keep as-is (refers to SDK repo)
   - `https://groundhog.dev/` → keep as-is
4. **Remove the error handling and cross-contract call sections** — these will become their own pages (Tasks 14 and 15). Add cross-links instead:
   - Where error handling was: "See [Error Handling](/reference/error-handling/) for the complete error model."
   - Where cross-contract calls were: "See [Cross-Contract Calls](/reference/cross-contract-calls/) for calling other contracts."
5. Keep: SDK installation, Cargo.toml setup, storage types overview, counter contract example, build and test instructions, design guidelines.

**Step 2: Build and verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/content/docs/start/getting-started.md
git commit -m "feat: migrate Getting Started guide"
```

---

## Task 9: Migrate Deep Dive — Architecture

**Files:**
- Create: `src/content/docs/deep-dive/architecture.md`

**Step 1: Copy and adapt**

Source: `~/code/groundhog-book/docs/guide/overview.md` (56 lines)

1. Add frontmatter:
   ```yaml
   ---
   title: Architecture
   description: How Groundhog achieves parallel execution at the protocol level.
   ---
   ```
2. Fix internal links:
   - `[key-value store](./state-storage)` → remove link or point to relevant reference page
   - `[consensus protocol](./consensus)` → `/deep-dive/consensus/`
   - `[Related Work](./related-work)` → remove (not in our site)
3. Content is conceptual and external-ready. Keep as-is.

**Step 2: Build and verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/content/docs/deep-dive/architecture.md
git commit -m "feat: migrate Architecture page"
```

---

## Task 10: Migrate Deep Dive — Transaction Lifecycle

**Files:**
- Create: `src/content/docs/deep-dive/transaction-lifecycle.md`

**Step 1: Copy and adapt**

Source: `~/code/groundhog-book/docs/guide/transaction-lifecycle.md` (82 lines)

1. Add frontmatter:
   ```yaml
   ---
   title: Transaction Lifecycle
   description: The five stages of transaction execution in Groundhog.
   ---
   ```
2. Fix internal links:
   - `[Authorization](../technical-specs/authorization)` → `/deep-dive/authorization/`
   - `[Invocation Frames](../technical-specs/invocation-frames)` → `/deep-dive/invocation-frames/`
   - `[Transaction Structure](../technical-specs/transaction-structure)` → remove (not in site)
   - `[Transaction Commit](./transaction-commit)` → remove (not in site)
3. Preserve footnotes.

**Step 2: Build and verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/content/docs/deep-dive/transaction-lifecycle.md
git commit -m "feat: migrate Transaction Lifecycle page"
```

---

## Task 11: Migrate Deep Dive — Contracts

**Files:**
- Create: `src/content/docs/deep-dive/contracts.md`

**Step 1: Copy and adapt**

Source: `~/code/groundhog-book/docs/technical-specs/contracts.md` (230 lines)

1. Add frontmatter:
   ```yaml
   ---
   title: Contracts
   description: Contract types, deployment, and address derivation in Groundhog.
   ---
   ```
2. Fix internal links:
   - `[Contract Interfaces](./contract-interfaces)` → remove or inline explanation
   - Syscall references → `/reference/syscalls/`
3. Clean up TODO items — either resolve them or remove them.
4. Keep code examples (WASM, Rust pseudocode) as-is.

**Step 2: Build and verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/content/docs/deep-dive/contracts.md
git commit -m "feat: migrate Contracts page"
```

---

## Task 12: Migrate Deep Dive — Invocation Frames

**Files:**
- Create: `src/content/docs/deep-dive/invocation-frames.md`

**Step 1: Copy and adapt**

Source: `~/code/groundhog-book/docs/technical-specs/invocation-frames.md` (342 lines)

1. Add frontmatter:
   ```yaml
   ---
   title: Invocation Frames
   description: Execution context, call stack management, and frame lifecycle.
   ---
   ```
2. Fix internal links:
   - `[Contract Interfaces](./contract-interfaces)` → remove
   - `[Transaction Structure](./transaction-structure)` → remove
   - `[Two-Phase Commit](../guide/two-phase-commit)` → remove (not in site)
   - Syscall references → `/reference/syscalls/`
3. Preserve footnotes and the detailed nested execution example.

**Step 2: Build and verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/content/docs/deep-dive/invocation-frames.md
git commit -m "feat: migrate Invocation Frames page"
```

---

## Task 13: Migrate Ecosystem — Stellar Migration

**Files:**
- Create: `src/content/docs/ecosystem/stellar-migration.md`

**Step 1: Copy and adapt**

Source: `~/code/burrow/docs/stellar_migration_guide.md` (389 lines)

1. Add frontmatter:
   ```yaml
   ---
   title: Stellar Migration
   description: Guide for Stellar developers adapting applications to Groundhog.
   ---
   ```
2. Fix internal links:
   - `[stellar_classification_spec.md](stellar_classification_spec.md)` → `/deep-dive/commutativity-research/`
   - `[hogd_reference.md](hogd_reference.md)` → remove
   - `[specification.md](specification.md)` → `/deep-dive/commutativity-research/`
3. Remove the "Generated by Burrow v0.1" footer.
4. Keep all comparison tables, code examples, and traffic analysis data.

**Step 2: Build and verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/content/docs/ecosystem/stellar-migration.md
git commit -m "feat: migrate Stellar Migration guide"
```

---

## Task 14: Migrate Reference — Error Handling

**Files:**
- Create: `src/content/docs/reference/error-handling.md`

**Step 1: Extract and expand**

Source: Error handling section from `~/code/sdk/sdk_rs/docs/getting-started.md` (around lines 166-187, plus related patterns throughout)

1. Add frontmatter:
   ```yaml
   ---
   title: Error Handling
   description: How errors work in Groundhog contracts — aborts, ensures, and error types.
   ---
   ```
2. Extract the error handling content and expand into a standalone reference:
   - Abort-centric model: methods return values directly, not `Result`
   - Automatic aborts: `strict_inc()` aborts on underflow/overflow
   - Manual checks: `ensure(condition, error)` pattern
   - Error type definition with `#[repr(i32)]` and XDR derives
   - Example error enum
   - How errors propagate through cross-contract calls (link to `/reference/cross-contract-calls/`)
3. Include code examples from the getting-started guide.

**Step 2: Build and verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/content/docs/reference/error-handling.md
git commit -m "feat: add Error Handling reference page"
```

---

## Task 15: Migrate Reference — Cross-Contract Calls

**Files:**
- Create: `src/content/docs/reference/cross-contract-calls.md`

**Step 1: Extract and expand**

Source: Cross-contract calls section from `~/code/sdk/sdk_rs/docs/getting-started.md` (around lines 365-419)

1. Add frontmatter:
   ```yaml
   ---
   title: Cross-Contract Calls
   description: How to call other contracts — direct calls, try calls, and error handling.
   ---
   ```
2. Extract and expand into a standalone reference:
   - Client generation: `#[contract]` macro generates `FooClient`
   - Direct calls (abort on error): `client.method(args)` — returns value directly, aborts on failure
   - Try calls (error handling): `client.try_method(args)` — returns `Result<T, CallError>`
   - `CallError` variants: `Abort(CrossExn<E>)` and `Fault(FaultString)`
   - `CrossExn` methods: `as_contract_exn()`, `as_library_exn()`, `is_unknown()`
   - Exception types table
   - Link to `/reference/error-handling/` for error type definitions

**Step 2: Build and verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/content/docs/reference/cross-contract-calls.md
git commit -m "feat: add Cross-Contract Calls reference page"
```

---

## Task 16: Migrate Reference — SDK Macros

**Files:**
- Create: `src/content/docs/reference/sdk-macros.md`

**Step 1: Combine and expand**

Sources:
- `~/code/sdk/sdk_rs/doc/macro-contract.md` (36 lines)
- `~/code/sdk/sdk_rs/doc/macro-storage.md` (12 lines)

These are very short rustdoc snippets. Combine into one page and expand with examples from the getting-started guide.

1. Add frontmatter:
   ```yaml
   ---
   title: SDK Macros
   description: Reference for #[contract], #[storage], and #[init] macros.
   ---
   ```
2. Structure:
   - `#[contract]` macro: What it does (generates C ABI exports + client stubs), where to apply it (trait impl, inherent impl, free function), `throws` parameter for error types, example from erc20 contract
   - `#[storage]` macro: What it does (derives `WriteXDR` + `Storage` traits providing `ReadXDRPath`, `LoadKeypath`, `DefaultFromKeypath`), example struct from erc20
   - `#[init]` attribute: Marks a method as the initialization entrypoint, called once at deploy time, example from erc20
3. Fix rustdoc links: Replace `mod@crate` and `crate::storage::*` references with plain descriptions.
4. Add concrete examples from the erc20 contract to illustrate each macro.

**Step 2: Build and verify**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/content/docs/reference/sdk-macros.md
git commit -m "feat: add SDK Macros reference page"
```

---

## Task 17: Adapt Deep Dive — Execution Model

**Files:**
- Create: `src/content/docs/deep-dive/execution-model.md`

**Step 1: Read source materials**

Read both sources completely:
- `~/docs/designdocs/ledger.md` (282 lines) — internal design doc covering storage types, deltas, commit model
- `~/docs/groundhog-product/guides/groundhog-developer-guide-storage-and-execution.md` (205 lines) — external-ready guide covering the execution model from a developer perspective

**Step 2: Write the adapted page**

1. Add frontmatter:
   ```yaml
   ---
   title: Execution Model
   description: How Groundhog executes transactions — snapshots, deltas, and commutative storage.
   ---
   ```
2. Structure (combine both sources):
   - **The Core Idea**: Transactions read from a consistent snapshot and produce deltas (from storage-and-execution guide, "The Trade" section)
   - **Snapshot Isolation**: Each transaction sees the ledger as it was at the start of the block (from ledger.md concepts)
   - **Delta Writes**: Instead of `SET balance = 50`, you write `INC balance BY 10` — the delta, not the final value (from storage-and-execution guide)
   - **Typed Merge Rules**: Each storage type has built-in merge rules (NNInt adds, Map merges per-key, etc.) (from ledger.md StorageObject Types + storage-and-execution primitives)
   - **What Commutes and What Doesn't**: When deltas can merge (same-direction operations) and when they conflict (from storage-and-execution guide "Commutativity" section)
   - **Storage Primitives**: NNInt, Map, Bytestring, RetrocausalQueue, Vector — brief description of each with merge behavior (from ledger.md + storage-and-execution guide)
   - **How This Compares**: Brief comparison to Ethereum, Solana, Soroban (from storage-and-execution guide)
3. Remove all internal jargon: "AddressAndKey", editorial notes, internal cross-references.
4. Keep code examples but simplify where needed.

**Step 3: Build and verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/content/docs/deep-dive/execution-model.md
git commit -m "feat: add Execution Model page (adapted from ledger.md + storage guide)"
```

---

## Task 18: Adapt Deep Dive — Storage Economics

**Files:**
- Create: `src/content/docs/deep-dive/storage-economics.md`

**Step 1: Read source materials**

- `~/docs/designdocs/storage_costs.md` (84 lines) — design doc for storage cost accounting
- `~/docs/designdocs/storage_pricing.md` (84 lines) — pricing proposal with dynamic pricing model

**Step 2: Write the adapted page**

1. Add frontmatter:
   ```yaml
   ---
   title: Storage Economics
   description: How storage pricing works — HOG deposits, cost accounting, and Balance-Proportional Scheduling.
   ---
   ```
2. Structure:
   - **Execution Is Free**: Zero gas fees for computation. You only pay for storage. (from storage-and-execution guide)
   - **Storage Is a Deposit**: When you store data, you lock HOG proportional to the size. When you delete it, you get the HOG back. Not a burn — a deposit. (from storage_costs.md)
   - **The Native Token**: HOG serves two roles — transfer of value and storage deposits. The native token contract looks like any other ERC-20 to other contracts. (from storage_costs.md design section)
   - **Cost Accounting**: How storage costs are tracked per contract (from storage_costs.md accounting section)
   - **Dynamic Pricing**: Storage price adjusts based on utilization to limit state growth (from storage_pricing.md, simplified)
   - **Sponsoring Users**: How contracts can pay storage costs on behalf of users (from storage-and-execution guide)
3. Remove: TBD items, internal design rationale, proposal-style language. Present as decisions, not proposals.
4. Simplify math notation (storage_pricing.md uses LaTeX-style formulas).

**Step 3: Build and verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/content/docs/deep-dive/storage-economics.md
git commit -m "feat: add Storage Economics page (adapted from storage_costs + storage_pricing)"
```

---

## Task 19: Adapt Deep Dive — Commutativity Research

**Files:**
- Create: `src/content/docs/deep-dive/commutativity-research.md`

**Step 1: Read source materials**

- `~/docs/groundhog-product/guides/stellar_classification_spec.md` (446 lines) — classification system and real traffic analysis
- `~/code/burrow/docs/specification.md` (1,578 lines) — comprehensive specification; focus on Section 2 (Groundhog Semantics Reference) and the executive summary findings

**Step 2: Write the adapted page**

1. Add frontmatter:
   ```yaml
   ---
   title: Commutativity Research
   description: "Empirical analysis: 82% of real blockchain operations are natively commutative."
   ---
   ```
2. Structure:
   - **The Claim**: 82% of real blockchain operations (195M transactions across 6 chains) are natively commutative — they produce the same result regardless of execution order. (from both sources)
   - **What Commutativity Means**: Operations that can run in parallel without coordination. `balance += 10` commutes with `balance += 20` because both produce the same final result regardless of order. `balance = 50` does NOT commute. (from specification.md Section 2)
   - **The C1-C4 Classification**: C1 (fully commutative) through C4 (inherently sequential), with examples of each. (from stellar_classification_spec.md)
   - **Groundhog Primitives**: How each storage type maps to commutativity — NNInt (C1 for increments), Map (C1 for distinct keys), RetrocausalQueue (C1 always), Bytestring (C4 for writes). (from specification.md Section 2)
   - **Real Traffic Analysis**: Results from analyzing 195M transactions across Ethereum, Polygon, Solana, Sui, Stellar, and Arbitrum. Include the key finding tables. (from stellar_classification_spec.md "Real Traffic Analysis" section)
   - **Methodology**: Brief description of how the analysis was conducted — BigQuery datasets, classification algorithms. (from stellar_classification_spec.md, simplified)
3. Remove: Internal implementation details, BigQuery queries, data pipeline architecture, Burrow-specific tooling.
4. Keep: All empirical findings, classification tables, chain-by-chain breakdown.

**Step 3: Build and verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/content/docs/deep-dive/commutativity-research.md
git commit -m "feat: add Commutativity Research page (adapted from classification spec + burrow spec)"
```

---

## Task 20: Adapt Reference — Syscalls

**Files:**
- Create: `src/content/docs/reference/syscalls.md`

**Step 1: Read source materials**

- `~/docs/designdocs/syscalls.md` (313 lines) — structured reference with error codes and method signatures
- `~/code/hogd/protocol/syscalls.md` (165 lines) — implementation-level reference with real signatures

**Step 2: Write the adapted page**

1. Add frontmatter:
   ```yaml
   ---
   title: Syscalls
   description: Complete reference for Groundhog contract syscalls.
   ---
   ```
2. Structure:
   - **Overview**: Syscalls are the interface between contract code (WASM) and the Groundhog runtime. Contracts call syscalls to read/write storage, invoke other contracts, and interact with the ledger.
   - **Error Codes**: Table of `SyscallErrorCode` values with brief explanations (from designdocs/syscalls.md)
   - **Call Format**: How syscalls are invoked from WASM (from designdocs/syscalls.md)
   - **Syscall Reference**: Organized by category, merge both sources:
     - **General**: SHA256, GetMsgSender, Log, GetSourceTransactionHash, VerifySignature
     - **Storage Access**: Read/write operations for each storage type
     - **Nonnegative Integers**: strict_inc, try_get, etc.
     - **Bytestrings**: BytestringGetLen, BytestringGet, BytestringSet
     - **Invocations**: Invoke, Return, GetReturnedBuffer, Exit, GetDeployAddress, DeployContract
   - For each syscall: signature, description, error conditions, return value
3. Replace internal jargon: "bytespan" → "byte buffer", "RuntimeMemoryLength" → "length".
4. Remove internal cross-references to ledger.md, transaction.md, common.md.

**Step 3: Build and verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/content/docs/reference/syscalls.md
git commit -m "feat: add Syscalls reference (adapted from designdocs + hogd)"
```

---

## Task 21: Write Reference — Storage Types

**Files:**
- Create: `src/content/docs/reference/storage-types.md`

**Step 1: Read source materials**

- `~/code/sdk/sdk_rs/src/storage/nnint.rs`
- `~/code/sdk/sdk_rs/src/storage/map.rs`
- `~/code/sdk/sdk_rs/src/storage/bytestring.rs`
- `~/code/sdk/sdk_rs/src/storage/vector.rs`
- `~/code/sdk/sdk_rs/src/storage/mod.rs`
- Storage sections from `~/code/sdk/sdk_rs/docs/getting-started.md`
- Storage type descriptions from `~/docs/designdocs/ledger.md`

**Step 2: Write the reference page**

1. Add frontmatter:
   ```yaml
   ---
   title: Storage Types
   description: Reference for Groundhog's commutative storage types — NNInt, Map, Bytestring, Vector, and RetrocausalQueue.
   ---
   ```
2. Structure — for each type:
   - **What it is**: One-sentence description
   - **Commutativity**: What operations commute and what conflicts
   - **API**: Methods with signatures and descriptions
   - **Example**: Code snippet showing typical usage
3. Types to cover:
   - **NNInt** (NonnegativeInt): Non-negative integer supporting commutative increments. `strict_inc(diff)` adds/subtracts; aborts if result would be negative. `try_get()` reads current value. Commutes when: all operations are increments/decrements that don't underflow.
   - **Map<K, V>**: Key-value map. Operations on different keys always commute. Operations on the same key follow the commutativity rules of the value type. `get(key)` returns handle to value.
   - **Bytestring**: Arbitrary byte data. Reads commute; writes are C4 (last-write-wins with conflict on concurrent writes of different values).
   - **Vector**: Ordered list. Append commutes; indexed writes may conflict.
   - **RetrocausalQueue**: Multi-producer queue. Enqueue always commutes (C1). Dequeue processes in a future block.
4. Include code examples from the erc20 contract to illustrate real usage.

**Step 3: Build and verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/content/docs/reference/storage-types.md
git commit -m "feat: add Storage Types reference page"
```

---

## Task 22: Write Start Here — Build a Token Tutorial

**Files:**
- Create: `src/content/docs/start/build-a-token.md`

**Step 1: Read source materials**

- `~/code/sdk/sdk_rs/example-contracts/erc20/src/implementation.rs` — the full contract
- `~/code/sdk/sdk_rs/example-contracts/erc20/src/lib.rs` — module setup
- `~/code/sdk/sdk_rs/example-contracts/erc20/Cargo.toml` — dependencies
- `~/code/sdk/sdk_rs/example-contracts/erc20/tests/test.rs` — test setup
- Getting Started guide for SDK patterns and context

**Step 2: Write the tutorial**

1. Add frontmatter:
   ```yaml
   ---
   title: Build a Token
   description: "Tutorial: build an ERC-20 token contract on Groundhog, step by step."
   ---
   ```
2. Structure — a step-by-step walkthrough building the erc20 contract from scratch:
   - **What We're Building**: An ERC-20 token with transfer, approve, mint, burn. Emphasize what makes the Groundhog version different: `strict_inc` instead of absolute writes means transfers can execute in parallel.
   - **Prerequisites**: Link to [Getting Started](/start/getting-started/) for SDK setup.
   - **Step 1: Define the Interface**: The ERC20 trait — what methods our token will expose. Show the trait definition.
   - **Step 2: Define Storage**: The `TokenContract` struct with `#[sdk::storage]`. Explain each field:
     - `contract_owner: ContractAddress` — who can mint/burn
     - `balances: Map<ContractAddress, NNInt>` — token balances (NNInt = commutative)
     - `allowances: Map<ContractAddress, Map<ContractAddress, NNInt>>` — nested map for approvals
     - `total_supply: NNInt` — total tokens in circulation
   - **Step 3: Implement Helper Methods**: The `_balance_amount_of`, `_adjust_balance`, `_allowance`, `_adjust_allowance` helpers. Explain the pattern: `try_get().unwrap_or(0)` for defaulting to zero.
   - **Step 4: Implement the Interface**: Walk through each method:
     - `initialize` — `#[init]` method, called once at deploy
     - `transfer` — get caller, compute diff, adjust both balances
     - `transfer_from` — check allowance, adjust allowance and both balances
     - `adjust_allowance` — delta-based approval (not set-based like ERC-20 `approve`)
     - `mint` / `burn` — owner-only, adjust balance and total supply
     - Read methods: `get_balance`, `get_balance_of`, `allowance`, `total_supply`
   - **Step 5: Test It**: Show the test setup and how to run tests.
   - **Why This Is Different**: Recap — every `strict_inc` is commutative. Two transfers to different recipients execute in parallel. Two transfers from the same account execute in parallel as long as the balance doesn't underflow. This is why Groundhog can do 1M+ TPS.
3. Include complete code for each step (not just snippets — the reader should be able to build the contract by following along).
4. Link to related pages: [Storage Types](/reference/storage-types/), [SDK Macros](/reference/sdk-macros/), [Error Handling](/reference/error-handling/).

**Step 3: Build and verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/content/docs/start/build-a-token.md
git commit -m "feat: add Build a Token tutorial"
```

---

## Task 23: Polish — Cross-Links and Final Verification

**Files:**
- Modify: Multiple files for cross-linking

**Step 1: Add cross-links between related pages**

Go through each page and ensure it links to related content:

- Choose Your Background → links to both developer guides + getting started
- For Blockchain Developers → link to Getting Started, Storage Types, Execution Model
- For Backend Developers → link to Getting Started, Storage Types, Execution Model
- Getting Started → link to Build a Token, Error Handling, Cross-Contract Calls, SDK Macros
- Build a Token → link to Storage Types, SDK Macros, Error Handling, Getting Started
- Architecture → link to Transaction Lifecycle, Execution Model, Contracts
- Transaction Lifecycle → link to Invocation Frames, Contracts, Authorization
- Execution Model → link to Storage Types, Storage Economics, Commutativity Research
- Contracts → link to Invocation Frames, Syscalls
- Invocation Frames → link to Contracts, Syscalls, Cross-Contract Calls
- Storage Economics → link to Storage Types, Getting Started
- Commutativity Research → link to Execution Model, Storage Types
- Syscalls → link to Storage Types, Contracts, Invocation Frames
- Storage Types → link to Execution Model, Getting Started, Syscalls
- SDK Macros → link to Getting Started, Build a Token
- Error Handling → link to Cross-Contract Calls, Getting Started
- Cross-Contract Calls → link to Error Handling, Contracts
- Stellar Migration → link to Commutativity Research, Getting Started

**Step 2: Full build**

```bash
pnpm build
```

Expected: Clean build, zero errors, all 27 pages rendered.

**Step 3: Dev server check**

```bash
pnpm dev
```

Manually verify: landing page renders, all sidebar links work, card grid displays, code blocks have syntax highlighting.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add cross-links between pages and polish navigation"
```

---

## Task 24: Add .gitignore and Final Cleanup

**Files:**
- Modify: `.gitignore`

**Step 1: Ensure .gitignore covers build artifacts**

Starlight scaffold should already include a `.gitignore`. Verify it includes:
```
node_modules/
dist/
.astro/
```

**Step 2: Final build verification**

```bash
pnpm build
```

Expected: Clean build with all 27 pages.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: verify final build and cleanup"
```
