# Groundhog developer site: architecture and migration
Status: revised after visual review on 2026-10-01. The original site header is retained. Documentation sections live in one expandable sidebar. Content rewrites and newcomer findability review remain in progress.

Workstream: [GH-447](https://linear.app/grndhg/issue/GH-447). Architecture: [GH-448](https://linear.app/grndhg/issue/GH-448).
## 1. Direction
Give readers a clear route to a working result, then let them learn the details as needed.

Site header: **About · Get Started · Documentation · Community**, followed by search and Start Building.

Documentation sidebar sections:

**Get Started → Understand Groundhog → CLI → Smart Contracts → TypeScript → React → Guides → Tools**

All sections remain available in one sidebar. Clicking a section heading expands its pages without navigating away. A deep link opens its containing section and highlights the current page. Search covers the whole site.

Keep each section one level deep by default. Add a subgroup only when it helps distinguish a substantial reference collection, platform comparisons, or chapters in a guide. Labels such as First steps, Use the CLI, and Application tasks do not need separate disclosure levels.

Restructure content around the reader's task. Moving an overloaded page or creating another directory of links does not complete a section. Rewrite its introduction, extract focused tasks, move complete walkthroughs into Guides, and remove repeated explanations.

The homepage introduces the project and links into this structure. Community, contact, and social destinations belong in the site navigation and footer. Remove the empty Contributing, Security, and Roadmap placeholder pages rather than maintaining a Project section. The Community header link goes to the Groundhog GitHub organization.
### Reviewed direction
1. Use the eight sections above in the expandable documentation sidebar, not in the header. Keep Understand Groundhog as the label and use `/architecture/` as its URL root.

2. Keep framework-neutral wallet integration in TypeScript. Give React its own implementation guidance.

3. Use one auxiliary Reference group for the existing protocol reference pages and external generated TypeScript API docs. Do not include a Project group.

4. Keep Guides as the canonical home for complete projects, including the counter app, token tutorial, wallet app tutorial, and swap design. Get Started links prominently to the counter app. TypeScript keeps reusable wallet integration instructions and provider reference.

5. Extend the existing `groundhog-examples` repository rather than create a second examples repository.

## 2. What the audit found
- The global sidebar groups content by broad document categories. A single development task often spans several groups.

- The header's Get Started link and homepage's Start Building action both lead to agent instructions.

- Start Here introduces storage semantics before the reader chooses a task.

- Getting Started combines installation, credentials, versions, configuration, compiler output, test modes, and SDK layers.

- The TypeScript SDK page covers installation through low-level signing in one page.

- The wallet connection tutorial is a vanilla TypeScript application. Moving it wholesale to React would mislabel it.

- React has no published section. Its repository must supply the content; a proposed heading does not establish API support.

- `groundhog-examples` already contains contracts and applications, including counter, token, swap, and wallet examples. Their compatibility and suitability for onboarding still need verification.

- Snapshot packaging currently requires `start/index.html`. Snapshot smoke checks also use current getting-started and counter URLs. Migration must preserve or update these contracts deliberately.

- Agent-guide release artifacts have a checksum check. A content move must preserve those artifacts and the distinction between website content and CLI-bundled instructions.


These are structural findings, not confirmation that the examples run against current releases.
## 3. Developer journeys
| Reader's goal | Entry | First result | Continue with |
| --- | --- | --- | --- |
| Understand the platform | Understand Groundhog | Explain its main differences and constraints | Architecture or a quickstart |
| Try the network from the terminal | Get Started → CLI quickstart | A funded wallet and an inspected transaction | CLI tasks or the contract quickstart |
| Build a first contract | Get Started → Contract quickstart | Passing tests and a verified contract interaction | Build a Counter App |
| Use Groundhog from TypeScript | Get Started → TypeScript quickstart | Read data and complete a small supported interaction | TypeScript tasks or the client chapter of the counter guide |
| Use Groundhog from React | Get Started → React quickstart | A connected interface with a visible result | React tasks or the UI chapter of the counter guide |
| Work with a coding agent | Get Started → Build with an Agent | Give the agent the skill, docs, and one end-to-end prompt | A counter application on Devnet, or an individual quickstart |
| Complete a specific task | CLI, Smart Contracts, TypeScript, or React | Solve that task without reading an entire course | Related API reference |
| Learn the full stack | Guides → Build a Counter App | A working contract, client, UI, and wallet interaction | Devnet deployment and deeper examples |

Quickstarts use Devnet and the latest release installation commands. CLI and contract paths do not require a local node. Application paths begin with a read from an existing contract, without requiring Rust, deployment, or wallet access. Each path has one result and shows its mandatory prerequisites before the first command.

Do not make readers select component versions or navigate a compatibility matrix. Let the CLI scaffold and package manager resolve dependencies, and preserve generated lockfiles. Exact verification versions belong in internal audit notes. Track release or Devnet mismatches as validation follow-ups; they do not change the documented Devnet-first path.

The counter guide adds explanation and connects the stack. Application developers can enter from tested contract and deployment checkpoints.
## 4. Section structure
The lists below are the content inventory for each sidebar section. A line with a path is a page. Group labels organize this working inventory; they are not extra navigation levels by default. The shipped sidebar is flat within a section except for meaningful collections such as reference, platform comparisons, and guide chapters. API reference can expand after source review.
### Get Started: `/get-started/`
- Overview: `/get-started/`

- {==Quickstarts==}{>>Do we need a CLI quick start? e.g install cli, run groundhog init, create a wallet, request an airdrop, view a txn.<<}{id="c2" by="user" at="2026-10-01T17:04:25.205Z"}

  - CLI quickstart: `/get-started/cli/`

  - First contract: `/get-started/contract/`

  - TypeScript application: `/get-started/typescript/`

  - React application: `/get-started/react/`

- Build with an Agent: `/get-started/agents/` (currently `/start/build-with-an-agent/`). Keep this as a short setup and one end-to-end prompt, not a second onboarding manual.


The overview offers guided and agent-assisted entry. Feature the counter app as the complete learning path, linking to its canonical guide. Installation details live with each product. Keep compatibility evidence in internal verification notes rather than a reader-facing version matrix. Quickstarts link to the relevant tool when needed, but Faucet, Block Explorer, and Wallet Extension live in Tools.

The agent handoff is `groundhog --skill`, `groundhog docs`, and one prompt to build a counter application on Devnet with a Rust contract, typed bindings, and a React wallet interface. Describe the commands' current behavior. GH-459 separately tracks installing the skill through `npx skills` and improving direct Markdown access through the CLI.

The CLI quickstart is the shortest terminal-based introduction: install the CLI, run `groundhog init`, select the supported Devnet configuration, create a wallet, request an airdrop, and inspect its transaction and resulting balance. Verify the exact commands and success states before publishing. It does not require compiling or deploying a contract. Include a matching agent prompt. The CLI section links to this same quickstart rather than maintaining another copy.

### {==Understand Groundhog: `/architecture/`==}{>>I'm not keen on /understand as the URL path, perhaps /architecture is better. thoughts?<<}{id="c1" by="user" at="2026-10-01T17:04:01.824Z"}
- Introduction: `/architecture/`. Explain what it is and the central difference with a small worked example.

- Core concepts

  - Parallel execution and shared state: `/architecture/execution/`

  - Transactions: `/architecture/transactions/`

  - Accounts and wallets: `/architecture/accounts/`

  - Compute, capacity, and storage costs: `/architecture/resources/`

- Architecture

  - System overview: `/architecture/system/`

  - Consensus: `/architecture/consensus/`

  - Networking: `/architecture/networking/`

- Coming from...

  - Blockchain development: `/architecture/coming-from/blockchain/`. Retain only useful comparative material; merge repeated explanations into Introduction.

  - EVM and Solidity: `/architecture/coming-from/evm/`

  - Solana and Anchor: `/architecture/coming-from/solana/`

  - Stellar and Soroban: `/architecture/coming-from/stellar/`

  - Backend development: `/architecture/coming-from/backend/`

  - Distributed systems: `/architecture/coming-from/distributed-systems/`

- Protocol reference: links to the shared `/reference/` pages


Use one Introduction page. Consolidate the old Start Here entry into it. Keep the general blockchain-developer comparison under Coming from... while its useful content is reviewed; it is not a second required introduction. Detailed storage API usage belongs in Smart Contracts.

The GH-449 pass is a targeted edit, not a replacement of this section. Its current reading order is Introduction, System Overview, Parallel Execution, Transaction Lifecycle, Compute, Capacity & Storage, Consensus, and Networking. Contract Execution remains under Smart Contracts. Existing public URLs are retained; the target paths in this inventory do not require a route migration as part of that editorial pass.
### CLI: `/cli/`
- Overview: `/cli/`

- Install: `/cli/install/`

- Create a project: `/cli/create-project/`
- Configure profiles and networks: `/cli/configuration/`
- Run a local node: `/cli/local-node/`
- Build and test: `/cli/build-and-test/`
- Manage keys and wallets: `/cli/wallets/`
- Deploy and call a contract: `/cli/deploy-and-call/`
- Inspect transactions and events: `/cli/transactions/`
- Generate TypeScript bindings: `/cli/codegen/`

- Troubleshooting: `/cli/troubleshooting/`

- Command reference: `/cli/reference/`


Command reference can grow into command pages if the inventory warrants it. Link to Coding Agents for skill and local-docs workflows. Link to TypeScript for using generated bindings.
### Smart Contracts: `/contracts/`
- Overview: `/contracts/`

- Write contracts

  - Project structure: `/contracts/project-structure/`

  - Contract methods and interfaces: `/contracts/methods/`

  - Choose storage: `/contracts/storage/`

  - Handle errors: `/contracts/errors/`

  - Authorize calls: `/contracts/authorization/`

  - Emit events: `/contracts/events/`

  - Call other contracts: `/contracts/cross-contract-calls/`

- Test contracts: `/contracts/testing/`

- Programming model

  - Design concurrent updates: `/contracts/concurrency/`

  - Integer storage in depth: `/contracts/nnint/`

  - Advanced storage patterns: `/contracts/advanced/`

  - Deployment and addresses: `/contracts/deployment/`

  - Invocation frames: `/contracts/invocation-frames/`

- Reference

  - SDK overview and Rustdoc links: `/contracts/reference/`

  - Storage APIs: `/contracts/reference/storage-types/`

  - Macros: `/contracts/reference/macros/`

  - Syscalls: `/contracts/reference/syscalls/`


Deployment here explains contract behavior and addresses. CLI owns deployment commands. Guides owns the complete counter and token projects.
### TypeScript: `/typescript/`
- Overview: `/typescript/`

- Install and configure: `/typescript/setup/`

- Connect to a network: `/typescript/networks/`
- Use typed contract bindings: `/typescript/bindings/`
- Read contract data: `/typescript/read-contracts/`
- Send contract transactions: `/typescript/transactions/`
- Integrate a browser wallet: `/typescript/wallets/`
- Read events and receipts: `/typescript/events/`
- Work with tokens: `/typescript/tokens/`
- Handle errors and recover submissions: `/typescript/errors/`

- API reference: `/typescript/reference/`

- Wallet provider reference: `/typescript/reference/wallet-provider/`


This is the home for framework-neutral application guidance. React can link to these explanations without requiring readers to build a vanilla TypeScript UI first. CLI code generation and application binding usage each have a clear owner.
### React: `/react/`
- Overview: `/react/`

- Install and configure: `/react/setup/`

- Connect a wallet: `/react/wallets/`
- Display balances: `/react/balances/`
- Use a contract client in a component: `/react/contracts/`
- Handle connection and request states: `/react/states/`

- Provider and hook reference: `/react/reference/`


Verify the current library before finalizing these pages. Distinguish library-provided hooks from patterns composed with the TypeScript client. React quickstart content belongs in Get Started and links here for setup detail.
### Guides: `/guides/`
- Overview: `/guides/`

- Build a Counter App

  - Outcome and prerequisites: `/guides/counter/`

  - Create and test the contract: `/guides/counter/contract/`

  - Deploy locally: `/guides/counter/local-deployment/`

  - Connect a typed client: `/guides/counter/typescript/`

  - Build the React interface: `/guides/counter/react/`

  - Connect a wallet: `/guides/counter/wallet/`

  - Deploy to Devnet: `/guides/counter/devnet/`

- Build a Token: `/guides/token/`

- Connect a Wallet to Your App: `/guides/wallet-app/`

- Design a Swap: `/guides/swap/`


Each guide states its type, scope, prerequisites, and result. Link to runnable code when available. A design walkthrough must not imply a verified application. Start with this collection and add projects when their code and maintenance are ready.
### Tools

Place Tools after Guides, with a flat list:

- Faucet: `/tools/faucet/`
- Block Explorer: `/tools/block-explorer/`
- Wallet Extension: `/tools/wallet-extension/` (pending verified installation and distribution instructions in GH-458)

Each page explains its purpose, launch or installation steps, supported networks, and its main workflow. Keep wallet integration APIs in TypeScript and React. Preserve the existing Faucet and Block Explorer URLs. Do not publish an empty Wallet Extension page before the instructions are ready.

### Reference
Retain these stable paths:

- `/reference/json-rpc-api/`

- `/reference/contract-spec/`

- `/reference/xdr-protocol/`

Add these external links beneath the internal reference pages:

- TypeScript Client API: `https://client-ts.thruput.network/`
- TypeScript Protocol API: `https://protocol-ts.thruput.network/`

The group label is Reference. The eight documentation sections remain visible alongside it. External API sites keep their own documentation and access controls; do not copy their generated content into this site.
## 5. Canonical ownership
| Topic | Canonical home | Other sections do this |
| --- | --- | --- |
| Network configuration | CLI configuration and TypeScript client setup | Quickstarts use the Devnet defaults and link to configuration when needed |
| Faucet, explorer, and wallet extension | Tools | Quickstarts link to the tool at the step that needs it; application sections keep integration APIs |
| Package and tool access | CLI installation and TypeScript package setup | Link to the relevant setup; keep exact tested versions in internal audit notes |
| CLI profiles, keys, and local-node operation | CLI | Use the required steps, then link for configuration detail |
| Accounts, wallets, and transaction concepts | Understand Groundhog | Explain only the API usage needed for the current task |
| Contract-level authorization | Smart Contracts | Link to the contract rules rather than repeat them |
| Browser-wallet protocol and framework-neutral integration | TypeScript | React explains its provider/hooks; Guides shows a complete app |
| React provider and hooks | React | Link to actual APIs and avoid invented hooks |
| Storage API choice and concurrent contract design | Smart Contracts | Understand Groundhog introduces the model without teaching every API |
| Execution, resource economics, and engine architecture | Understand Groundhog | Summarize the relevant consequence and link to the explanation |
| RPC wire API and serialized formats | Shared reference | CLI and TypeScript link from related tasks and reference indexes |
| Agent handoff | Get Started → Build with an Agent | Context menus and task prompts link to the concise setup and end-to-end prompt |
| End-to-end example explanations | Guides | Quickstarts and product pages link to useful entry chapters |
| Runnable example code | Existing examples repository | Docs use verified snippets and link to the matching revision |

Canonical ownership does not forbid a small repeated command when needed to complete a task. It prevents multiple independent installation guides, compatibility tables, and competing explanations.
## 6. Existing-page migration map
Paths below are relative to the site root. A directory ending in `/` denotes its index page. All old public routes remain available until their replacements are ready. For split pages, redirect to the best entry point and provide clear links to the extracted topics. Fragments need their own audit because servers do not receive URL fragments.
### Entry pages
| Current route | Disposition and primary destination | Additional destinations |
| --- | --- | --- |
| `/` | Rewrite in place, GH-455 | Header branding: GH-457 |
| `/start/` | Consolidate → `/architecture/` | Redirect to the single Introduction; remove Start Here from the sidebar |
| `/start/getting-started/` | Split → `/get-started/contract/` | `/cli/install/`, `/contracts/project-structure/`, and the existing Testing page |
| `/start/build-with-an-agent/` | Rewrite → `/get-started/agents/` | Short skill/docs setup and one end-to-end prompt; preserve current URL during implementation |
| `/start/for-blockchain-developers/` | Review → `/architecture/coming-from/blockchain/` | Place under platform comparisons; merge repeated introductory content into `/architecture/` |
| `/start/for-backend-developers/` | Rewrite → `/architecture/coming-from/backend/` | Link to canonical execution explanation |
| `/start/for-distributed-systems-developers/` | Rewrite → `/architecture/coming-from/distributed-systems/` | Link to architecture and consensus |
### Tools
| Current route | Disposition and primary destination | Additional destinations |
| --- | --- | --- |
| `/tools/groundhog-cli/` | Split → `/cli/` | CLI workflow pages and command reference |
| `/tools/rust-api-docs/` | Move → `/contracts/reference/` | Keep links to generated Rustdoc |
| `/tools/typescript-sdk/` | Split → `/typescript/` | Setup, networks, reads, transactions, events, tokens, errors, reference |
| `/tools/typescript-bindings/` | Split → `/typescript/bindings/` | `/cli/codegen/` for command usage |
| `/tools/block-explorer/` | Retain URL; place in Tools | Link to CLI inspection fallback |
| `/tools/wallet-integration/` | Merge → `/typescript/wallets/` | `/typescript/errors/` for recovery details |
| `/tools/wallet-provider/` | Split → `/typescript/reference/wallet-provider/` | Usage and explanatory details to wallet tasks |
| `/tools/faucet/` | Retain URL; place in Tools | Preserve CLI and TypeScript entry points |
### Tutorials
| Current route | Disposition and primary destination | Additional destinations |
| --- | --- | --- |
| `/tutorials/build-a-counter/` | Rewrite → `/guides/counter/contract/` | Link to whole-guide overview |
| `/tutorials/develop-locally/` | Split → `/guides/counter/local-deployment/` | `/cli/local-node/`, `/cli/troubleshooting/`, `/contracts/testing/` |
| `/tutorials/develop-on-devnet/` | Split → `/guides/counter/devnet/` | `/cli/configuration/`, `/cli/wallets/`, `/cli/troubleshooting/` |
| `/tutorials/work-with-groundhog-from-typescript/` | Split → `/guides/counter/typescript/` | `/typescript/tokens/`, `/typescript/events/`, `/typescript/transactions/` |
| `/tutorials/connect-a-wallet-to-your-app/` | Rewrite → `/guides/wallet-app/` | Keep the complete application in Guides; reusable integration details belong in TypeScript |
| `/tutorials/add-events-to-a-contract/` | Split → `/contracts/events/` | `/typescript/events/` for querying and resuming |
| `/tutorials/build-a-token/` | Rewrite → `/guides/token/` | Link to canonical storage and testing explanations |
| `/tutorials/design-a-swap/` | Move and review → `/guides/swap/` | Retain its design-walkthrough scope |

The existing legacy redirect `/tutorials/build-a-swap/` should eventually point directly to `/guides/swap/`, without a chain through the current route.
### Programming model
| Current route | Disposition and primary destination | Additional destinations |
| --- | --- | --- |
| `/programming-model/execution/` | Split → `/contracts/concurrency/` | Merge engine explanation into `/architecture/execution/`; economics into `/architecture/resources/` |
| `/programming-model/storage-types/` | Rewrite → `/contracts/storage/` | Keep exact signatures in reference |
| `/programming-model/nnint/` | Move → `/contracts/nnint/` | Cross-link storage selection and reference |
| `/programming-model/testing/` | Rewrite → `/contracts/testing/` | CLI owns command flags; guide owns counter test sequence |
| `/programming-model/advanced/` | Move → `/contracts/advanced/` | Link from relevant storage topics |
### How it works
| Current route | Disposition and primary destination | Additional destinations |
| --- | --- | --- |
| `/how-it-works/architecture/` | Rewrite → `/architecture/system/` | Overview links to deeper components |
| `/how-it-works/execution-model/` | Merge → `/architecture/execution/` | Practical contract design in `/contracts/concurrency/` |
| `/how-it-works/transaction-lifecycle/` | Rewrite → `/architecture/transactions/` | SDK and CLI pages link to this lifecycle |
| `/how-it-works/contracts/` | Split → `/contracts/deployment/` | Basic account/contract distinction in `/architecture/accounts/` |
| `/how-it-works/invocation-frames/` | Move → `/contracts/invocation-frames/` | Link from cross-contract calls |
| `/how-it-works/storage-economics/` | Rewrite → `/architecture/resources/` | Preserve explicit limits and source-backed economics |
| `/how-it-works/consensus/` | Move → `/architecture/consensus/` | Keep deep detail off quickstarts |
| `/how-it-works/authorization/` | Split → `/contracts/authorization/` | Account and admission overview in `/architecture/accounts/` |
| `/how-it-works/networking/` | Move → `/architecture/networking/` | Distinguish engine networking from connecting an SDK client |
### Reference
| Current route | Disposition and primary destination | Additional destinations |
| --- | --- | --- |
| `/reference/storage-types/` | Move → `/contracts/reference/storage-types/` | Link to storage usage guidance |
| `/reference/syscalls/` | Move → `/contracts/reference/syscalls/` | Preserve generated-source provenance |
| `/reference/sdk-macros/` | Split → `/contracts/reference/macros/` | Usage examples in `/contracts/methods/` and project structure |
| `/reference/error-handling/` | Rewrite → `/contracts/errors/` | Exact API links via SDK reference |
| `/reference/cross-contract-calls/` | Rewrite → `/contracts/cross-contract-calls/` | Exact API links via SDK reference |
| `/reference/contract-spec/` | Retain at current route | Link from bindings, codegen, and contract interfaces |
| `/reference/xdr-protocol/` | Retain at current route | Link from protocol reference and low-level client material |
| `/reference/json-rpc-api/` | Retain at current route | Link from CLI and TypeScript reference |

Some current reference pages contain teaching material. Their new home reflects the reader's task. Reference pages themselves follow the repository's API-table convention and link to usage pages.
### Ecosystem and community
| Current route | Disposition and primary destination |
| --- | --- |
| `/ecosystem/evm/` | Rewrite → `/architecture/coming-from/evm/` |
| `/ecosystem/solana/` | Rewrite → `/architecture/coming-from/solana/` |
| `/ecosystem/stellar/` | Rewrite → `/architecture/coming-from/stellar/` |
| `/community/contributing/` | Retire the coming-soon placeholder; Community navigation links to GitHub |
| `/community/security/` | Retire the coming-soon placeholder |
| `/community/roadmap/` | Retire the coming-soon placeholder |
## 7. Page conventions
| Page type | Opening | Body | Finish |
| --- | --- | --- | --- |
| Section introduction | What the tool or concept is and when to use it | Explain the core model with one concrete example; avoid a directory of existing pages | One recommended starting point |
| Quickstart | Concrete result and mandatory prerequisites | One recommended path with small steps and expected output | Verify success, then one main next step |
| Task page | The task and required setup | Copyable steps, expected behavior, common failure recovery | Relevant reference and related task |
| Explanation | The question and a short answer | Worked example or diagram, then rules and tradeoffs | Link to practical usage and deeper detail |
| Reference | API scope and supported version context | API tables and exact types/values; link to generated source where appropriate | Usage links |
| Guide chapter | Current goal and required checkpoint | Continue one project, explain decisions, provide working code | Success check and next chapter |

Every docs page has a title and description. Use absolute internal links, plain language, and specific headings. Introduce unfamiliar terms before relying on them. Keep paragraphs short and use code when it explains a task better.

Use admonitions for information that changes the current step. Move rare cases into troubleshooting pages. Keep required setup in view; do not hide it behind optional disclosures.

For AI handoff, a task prompt includes the goal, source/version context, prerequisite checkpoint, and verification steps. Markdown export preserves the same technical meaning as HTML. One maintained source serves both readers.
## 8. Navigation behavior
- Desktop: retain the single-row project header with About, Get Started, Documentation, Community, search, and Start Building. No second row of documentation sections.

- Within docs: show all eight sections as expandable sidebar headings. Each opens its submenu in place. Start with the active section expanded and highlight the current page. Preserve native keyboard and disclosure behavior. Do not repeat the section name above an identical page heading.

- Mobile: show the original site navigation and the same expandable docs sidebar in the menu. Section toggles keep the menu open; following a page link closes it. Avoid unnecessary nested disclosure levels.

- Search: index the whole site, including useful auxiliary pages. Add section context to results where supported. Exclude redirects and avoid duplicate HTML/Markdown search entries.

- Guides: previous/next navigation stays within the guide sequence. Product reference pages do not accidentally become the next chapter of a tutorial.

- Global Get Started links go to the choice page. The homepage's agent prompt remains a direct agent entry alongside the human quickstart link.

## 9. Implementation sequence
1. Review this map and settle canonical ownership and URL choices.

2. Use Starlight's expandable sidebar groups beneath the original site header. Keep section definitions in one maintained place. Avoid a separate custom routing system.

3. Rewrite one coherent content slice at a time. Define the reader's task, draft the focused page, verify it against source, and then consolidate or redirect the old content. A page move or a new link directory alone does not complete the slice. React needs source-backed content before its entry becomes a published promise.

4. Update internal links and redirects with each migration slice. Keep old routes working throughout. Audit fragment links for split pages and retain stable anchors or a useful migration landing page where needed.

5. Coordinate content rewrites under GH-449, GH-450, GH-451, and GH-452. Coordinate AI support under GH-453 and Guides under GH-454.

6. Update snapshot packaging and smoke checks alongside URL changes. Preserve versioned agent artifacts and their checksum checks.

7. Validate section navigation, active state, mobile behavior, search, and direct links. Run `npx astro check`, `pnpm build`, and relevant existing checks for the affected code.

8. Record findings in GH-448. Keep the issue open until navigation is implemented and the findability review is complete. GH-456 owns the later site-wide migration and end-to-end audit.


GH-455 owns the landing page and prompt dialog. GH-457 owns logo exploration and the exact `alpha-pre.1` header badge. Their header work should share the navigation layout rather than create another header implementation.
## 10. Findability review
Ask a developer unfamiliar with this structure where they would go for each task before giving them the answer. Record their first choice, detours, and confusing labels. A stakeholder review of this file does not replace that test.

| Task | Expected route |
| --- | --- |
| Install the CLI | CLI → Install |
| Try the network without writing a contract | Get Started → CLI quickstart |
| Write and test a first contract | Get Started → First contract |
| Change the RPC/network used by CLI commands | CLI → Configure profiles and networks |
| Read typed contract data from a service | TypeScript → Read contract data |
| Connect a wallet in React | React → Connect a wallet |
| Connect a wallet without React | TypeScript → Connect a browser wallet |
| Explain Groundhog's execution differences | Understand Groundhog → Introduction, then Parallel Execution |
| Give a coding agent the right setup | Get Started → Build with an Agent |
| Build a complete counter application | Guides → Build a Counter App |
| Look up an RPC method | TypeScript or CLI reference link → JSON-RPC API; also available through search |
### Completion evidence
- [x] Architecture reviewed; URL-root and CLI-quickstart feedback incorporated.
- [x] Existing content assigned to sections; automated inventory check confirms one sidebar owner per page.
- [x] Original header restored; eight documentation sections placed in one expandable sidebar, including Tools.
- [x] Desktop, mobile, and keyboard section-navigation behavior verified.
- [x] Current legacy routes preserved; new overview links and their fragments checked.
- [x] Local snapshot smoke test and agent-artifact checks pass.
- [x] Build, Astro diagnostics, unit checks, and browser navigation checks pass. Run details are recorded in GH-448.
- [ ] Search results display the indexed section metadata.
- [ ] Findability review with a developer unfamiliar with the structure completed and findings addressed.

### Current implementation

`src/navigation.ts` owns section definitions and current page membership. Starlight renders all sidebar groups, with the active page's ancestors open. Route middleware keeps automatic pagination within the page's section. The earlier header section-switcher and filtered sidebars were rejected during visual review and have been removed.

The platform Introduction and CLI Introduction have been rewritten rather than left as link directories. The old Start Here page now redirects to the platform Introduction. The general blockchain comparison is optional, under platform comparisons. The wallet app tutorial is in Guides; framework-neutral wallet integration remains in TypeScript.

GH-451 adds four Devnet quickstarts, canonical CLI/package installation, and task-specific agent prompts. The old overloaded getting-started page redirects to the contract quickstart; its generated-project detail is preserved in Project structure and Testing. The complete counter app guide and deeper product-section rewrites remain separate work. See `docs/audits/2026-10-01-getting-started.md` for verification and hosted-network follow-ups.

The Introduction's integer-update example was checked against `groundhog-protocol/storage_item.x` and `groundhog-hogd/hogd/hog_db/item_lock/nnint128_lock.cc`. CLI workflow descriptions were checked against the CLI repository documentation and the existing command guide. React surface descriptions use the React package's public exports.

Verification includes the hosted static build and `pnpm build:snapshot`, followed by the snapshot smoke test through the installed Groundhog CLI. The snapshot test checks real search navigation, the local agent prompt, Markdown guide access, desktop/mobile layout, and absence of external browser requests.

---
comments:
  c3:
    body: "Agreed. I changed the URL root to /architecture/ throughout the sitemap and migration map. The navigation label stays Understand Groundhog, so newcomers still see a learning entry point. The deeper System overview uses /architecture/system/ to avoid /architecture/architecture/."
    by: OpenCode
    at: "2026-10-01T17:05:40.000Z"
    re: c1
  c4:
    body: "Yes. I added a CLI quickstart at /get-started/cli/, ahead of the contract quickstart. Its result is a funded wallet and an inspected transaction: install, groundhog init, configure Devnet, create a wallet, request an airdrop, and verify the transaction and balance. It needs no contract build. The CLI section links to the same page, and it gets a matching agent prompt. Exact commands will be verified during quickstart implementation."
    by: OpenCode
    at: "2026-10-01T17:05:40.000Z"
    re: c2
