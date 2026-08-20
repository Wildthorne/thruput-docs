# CLI DX Documentation Update Specification
**Date:** 2026-08-03  
**Status:** Ready for implementation  
**Source baseline:** `groundhog-rpc` `v0.6.1` at `a096869`  
**Feature PRs:** `#191`, `#192`, `#194`, `#195`, `#196`, `#197`
## Goal
Update the public documentation to match the current Groundhog CLI. The revised docs must teach:

- global profiles as the reusable configuration base;
  
- project `groundhog.toml` files as optional overlays;
  
- profile inspection and mutation through `groundhog config`;
  
- native HOG transfers;
  
- transaction inspection and address history;
  
- contract event inspection and decoding;
  
- canonical token transfer history;
  
- persistent and memory-limited local-node options.
  

The result should let a developer configure Groundhog, move between projects, transfer HOG, and inspect activity without reading CLI source or editing TOML for routine profile changes.
## Problem
The current docs describe a CLI between versions `0.5.17` and `0.5.18`. The current release is `0.6.1`.

The documentation has five material gaps:

1. It does not explain the current global-plus-project configuration model.
  
2. It still directs users to edit TOML for routine profile setup.
  
3. It claims an implicit `default` profile fallback that no longer exists.
  
4. It omits the transfer, transaction, event, token, and config command surfaces.
  
5. It describes `groundhog node` as ephemeral-only and omits `--data-dir` and `--ramdb-bytes`.
  
## Ground Truth
### Configuration Layers
Groundhog has two durable configuration layers:

| Layer | Location | Responsibility |
| --- | --- | --- |
| Global | `${XDG_CONFIG_HOME:-$HOME/.config}/groundhog/config.toml` | Reusable profiles, profile defaults, endpoint settings, signing-key selection, wallet bindings, credentials, and active local-runtime state |
| Project | Nearest ancestor `groundhog.toml` | Optional profile overrides, project default selection, contract aliases, and project-specific wallet bindings |

For the selected profile name, the CLI merges global and project values field by field. Project scalar values override global values. Contract and wallet maps merge by entry, with project entries winning on conflicts.

Do not describe this as project configuration being removed. Describe it as **global profiles with optional project overlays**.
### Profile Selection
The active profile resolves in this order:

1. command `--profile`;
  
2. `GROUNDHOG_PROFILE`;
  
3. project `default_profile`;
  
4. global `default_profile`.
  

If nothing selects a profile, commands that require one fail with `no_active_profile`. The name `default` has no special fallback behavior.
### Profile Management
Routine profile inspection and scalar mutation should use:

```bash
groundhog config get [PROFILE] [--sources]
groundhog config profiles
groundhog config new <PROFILE> --network <NETWORK> [OPTIONS]
groundhog config set <FIELD> <VALUE> --profile <PROFILE>
groundhog config unset <FIELD> --profile <PROFILE>
groundhog config use <PROFILE>
groundhog config rm <PROFILE>
```

The editable scalar fields are `network`, `rpc-url`, `faucet-url`, and `default-key`.

Mutation scope rules:

- Outside a project, omitted scope means global.
  
- Inside a project, pass exactly one of `--global` or `--project`.
  
- `config get` reads the persisted merged profile. It does not apply active local-node state, signer fallback, environment runtime manifests, or command overrides.
  
- `config unset` removes only the selected layer's value. An inherited global value may become visible.
  
- `config rm` removes the complete profile in one layer, including aliases and wallet bindings owned by that layer.
  

Contract aliases and wallet bindings are not editable through `config set`. Deployment owns project contract aliases. Wallet commands own wallet bindings.
### Local Runtime Overlay
`groundhog node` records its active endpoint and runtime manifest in global transient state. A selected profile with `network = "local"` can inherit missing runtime fields from that state. Explicit profile values continue to win.

The built-in `dev-0` signer is a final fallback only when:

- the selected profile is local;
  
- it still targets the active local runtime; and
  
- neither the profile nor `groundhog keys use` selected another key.
  
### Address Resolution
Commands that accept a target resolve saved wallets before contract aliases, then direct addresses, then manifest-backed `dev-N` accounts. Documentation examples should use names where that improves readability, but state when a command accepts all target forms.
## Scope
### Required Pages
1. `src/content/docs/tools/groundhog-cli.md`
  
2. `src/content/docs/tutorials/develop-locally.md`
  
3. `src/content/docs/tutorials/develop-on-devnet.md`
  
4. `src/content/docs/start/getting-started.md`
  
5. `src/content/docs/tools/faucet.md`
  
6. `src/content/docs/tools/block-explorer.md`
  
7. `src/content/docs/tutorials/add-events-to-a-contract.md`
  
### Conditional Pages
- `src/content/docs/reference/json-rpc-api.md`: add cross-links to CLI inspection commands only. Do not document open PR `#187` as shipped.
  
- `src/content/docs/tools/typescript-sdk.md`: update only if its statements about available gateway methods conflict with `groundhog-rpc` main after this work begins.
  
### No New Page by Default
Keep the CLI surface on `tools/groundhog-cli.md`. Create a separate configuration page only if the revised CLI page becomes difficult to scan after editing. The preferred implementation is fewer, authoritative pages with strong headings and cross-links.
## Required Changes
### 1. Groundhog CLI Reference
Rewrite `tools/groundhog-cli.md` as the canonical overview of CLI configuration and command behavior.

Version Note

- Update the checked CLI version to `0.6.1`.
  
- Verify the SDK version from the current scaffold before changing the existing SDK claim.
  
- Use the actual verification date.
  

Command Map

Add these goals and commands:

| Goal | Command |
| --- | --- |
| Inspect the merged persisted profile | `groundhog config get [PROFILE] [--sources]` |
| List profiles and selection state | `groundhog config profiles` |
| Create or select a profile | `groundhog config new`, `groundhog config use` |
| Change a profile field | `groundhog config set`, `groundhog config unset` |
| Transfer native HOG | `groundhog transfer <recipient> <amount>` |
| Inspect one transaction | `groundhog tx show <hash>` |
| List address-rooted transaction history | `groundhog tx list <target>` |
| List contract events | `groundhog events list <contract>` |
| Decode contract events | `groundhog events list <contract> --spec <path>` |
| List canonical token transfers | `groundhog token transfers <token>` |

Configuration Section

Add a dedicated **Configuration** section before build and test. It must:

- identify both config files and their responsibilities;
  
- explain profile selection precedence;
  
- state that no implicit `default` profile exists;
  
- explain field and map merging;
  
- show `config profiles` and `config get devnet --sources` before mutation examples;
  
- show global profile creation through `config new --global --use`;
  
- show a project override through `config set ... --project`;
  
- explain mutation scope inside and outside a project;
  
- distinguish persisted config inspection from runtime resolution;
  
- state that aliases and wallet bindings have command-specific owners.
  

Use this Devnet setup as the primary example:

```bash
groundhog config new devnet \
  --network devnet \
  --rpc-url "$DEVNET_RPC_URL" \
  --faucet-url "$DEVNET_FAUCET_URL" \
  --default-key alice \
  --global \
  --use

groundhog config get devnet --sources
```

Show project override behavior separately:

```bash
groundhog config set rpc-url http://127.0.0.1:9546 \
  --profile local \
  --project
```

Do not imply that every project needs complete local and Devnet profile definitions.

Native HOG Transfers

Document:

```bash
groundhog transfer alice 10.5
groundhog transfer 0x<address> 10.5 --from alice
groundhog transfer alice 10.5 --dry-run
```

State that:

- amounts support at most seven decimal places;
  
- `--from` selects a saved source wallet owned by the active signing key;
  
- the CLI never switches signing keys to fit a wallet;
  
- dry run produces a real signed, expiring transaction but does not submit it;
  
- successful live execution requires a committed receipt with successful execution;
  
- an inconclusive confirmation must not be blindly resubmitted; use `tx show`.
  

Avoid reproducing internal token addresses, selectors, or gas constants unless users need them.

Transaction Inspection

Document:

```bash
groundhog tx show 0x<transaction-hash>
groundhog tx list alice --limit 25
groundhog tx list alice --cursor 0x<cursor>
```

State that:

- `tx show` performs a one-shot lookup and does not wait;
  
- it fetches a receipt only for committed status;
  
- a reverted committed transaction is still a successful inspection command;
  
- `tx list` requests one newest-first page and does not hydrate receipts;
  
- cursors are opaque and reusable only with the same query;
  
- address history covers root invocations, not a complete incoming or outgoing asset ledger.
  

Event Inspection

Document raw and decoded forms:

```bash
groundhog events list my-counter
groundhog events list my-counter --topic0 0x<topic>
groundhog events list my-counter \
  --spec target/groundhog/my_counter.spec.xdr \
  --event CounterIncremented
```

State that:

- the command requests one newest-first page for one emitter;
  
- repeated values within one topic position are ORed;
  
- different topic positions are ANDed;
  
- `--event` requires `--spec`;
  
- `.wasm` and `.xdr` specs are trusted local artifacts;
  
- raw topics and data remain authoritative when decoding fails;
  
- malformed records remain visible instead of failing the page.
  

Token Transfer Inspection

Document:

```bash
groundhog token transfers my-token
groundhog token transfers my-token --from alice --to bob
groundhog token transfers my-token --account alice
```

State that:

- the command projects canonical `TransferEvent` records;
  
- `--account` conflicts with `--from` and `--to`;
  
- participant filters run on the server;
  
- mint, burn, transfer, and malformed records remain distinguishable;
  
- amounts are raw base-unit decimal strings because metadata and decimal formatting are not fetched.
  

Local Node

Correct the ephemeral-only statement. Document both modes:

```bash
groundhog node                         # ephemeral state
groundhog node --data-dir .groundhog/node
groundhog node --ramdb-bytes <bytes>
```

State that:

- omitting `--data-dir` creates an ephemeral node;
  
- a clean stop and restart with the same data directory preserves state;
  
- `--ramdb-bytes` forwards the RAM database capacity to `hog-devnode`;
  
- `--reset` is not available;
  
- users who need a clean persistent chain should choose a new directory.
  
### 2. Local Development Tutorial
Update `tutorials/develop-locally.md` to teach the current configuration path.

- Update the checked CLI version and installation command.
  
- Explain that the scaffolded `groundhog.toml` is a project overlay.
  
- Replace manual `default_key = "dev-0"` editing with `groundhog config set default-key dev-0 --profile local --project` when forcing `dev-0` is necessary.
  
- Use `groundhog config get local --sources` to verify persisted values.
  
- Keep `groundhog status --profile local` for effective runtime diagnostics, but explain that it is not the same as persisted config inspection.
  
- Present ephemeral node startup as the default tutorial path.
  
- Add a short optional persistent-node callout using `--data-dir`.
  
- Add an **Inspect Activity** step after a successful call. It should show `tx show`, `tx list`, and `events list` without turning the tutorial into an exhaustive reference.
  
- Link detailed transfer, event, and token behavior back to the CLI reference.
  

Do not require a persistent key for the local tutorial.
### 3. Devnet Tutorial
Update `tutorials/develop-on-devnet.md` to make global config the normal setup path.

- Update the checked CLI version and installation command.
  
- Replace opening `~/.config/groundhog/config.toml` with `groundhog config new` or `config set` commands.
  
- Use `--global` explicitly, even when the command runs outside a project, so the tutorial teaches intent.
  
- Replace `groundhog status --profile devnet` as the first config check with `groundhog config get devnet --sources`.
  
- Keep status as an optional effective-environment diagnostic.
  
- Explain that the project overlay inherits global endpoint, key, and wallet values.
  
- Preserve project alias behavior after deployment.
  
- Add a native transfer example after wallet funding.
  
- Add transaction and token history inspection after a successful transfer or contract call.
  
- Keep wallet creation outside a project, or explicitly explain that wallet commands write to the nearest project profile when one exists and global config otherwise.
  
- Update troubleshooting to use `config get --sources` rather than asking users to inspect TOML tables.
  

If a profile may already exist after `groundhog init`, avoid presenting `config new` as idempotent. Use one of these patterns:

1. tell users to run `config profiles`, then choose `config new` or `config set`; or
  
2. make the tutorial start from a named profile that it creates explicitly.
  

Prefer the first pattern because it reflects real existing installations.
### 4. Getting Started
Update `start/getting-started.md`:

- describe generated `groundhog.toml` as a project overlay containing project selection and aliases;
  
- identify the global config path and its reusable profile role;
  
- add a short configuration flow linking to the CLI reference;
  
- update the checked CLI version;
  
- include transfer and inspection commands in the description of the network workflow without expanding this page into a reference.
  

Suggested generated-file description:

```text
groundhog.toml          # project profile overrides, default selection, and contract aliases
```
### 5. Faucet
Update `tools/faucet.md`:

- identify the Devnet profile as global;
  
- replace the unscoped TOML snippet with `groundhog config` commands;
  
- show `config get devnet --sources` before wallet creation;
  
- retain endpoint descriptor validation and idempotency guidance;
  
- link to the configuration section of the CLI reference.
  
### 6. Block Explorer Status
Update `tools/block-explorer.md` to distinguish UI availability from CLI inspection capability.

- Keep the statement that no supported public explorer UI exists, if still true.
  
- Add `tx show`, `tx list`, `events list`, and `token transfers` as current terminal inspection options.
  
- Preserve the root-invocation history limitation.
  
- Do not claim block reads from open PR `#187` are shipped.
  
### 7. Events Tutorial
Update `tutorials/add-events-to-a-contract.md`:

- retain the raw JSON-RPC example as the protocol-level reference;
  
- add `groundhog events list` as the primary CLI inspection path;
  
- show decoding with the generated `.spec.xdr` artifact;
  
- state that raw evidence remains available when decode status is unknown or malformed;
  
- link to both the CLI and JSON-RPC references.
  
## Information Architecture
Use the following ownership rules to avoid repetition:

| Topic | Canonical page | Other pages should |
| --- | --- | --- |
| Config layers, selection, CRUD | `/tools/groundhog-cli/` | Show task-specific commands and link back |
| Native transfer behavior | `/tools/groundhog-cli/` | Show one workflow example |
| Transaction and event CLI semantics | `/tools/groundhog-cli/` | Show one workflow example |
| Local development sequence | `/tutorials/develop-locally/` | Link to it |
| Devnet wallet and deployment sequence | `/tutorials/develop-on-devnet/` | Link to it |
| JSON-RPC request and response contracts | `/reference/json-rpc-api/` | Avoid duplicating API tables |
| Event declaration and emission | `/tutorials/add-events-to-a-contract/` | Link to it |
## Writing Requirements
- Use “global profile” for reusable user-wide network configuration.
  
- Use “project overlay” for `groundhog.toml`.
  
- Use “active profile” only for the profile selected by precedence.
  
- Use “effective profile” only after persisted layers, local runtime state, and command overrides have been applied.
  
- Distinguish persisted inspection (`config get`) from effective diagnostics (`status`).
  
- Say “one page” for `tx list`, `events list`, and `token transfers`.
  
- Say “root invocation history,” not transaction history without qualification.
  
- Say “raw base units” for token transfer amounts.
  
- Do not describe `--dry-run` as simulation. Transfer, deploy, and call dry runs prepare signed transactions.
  
- Do not use an implicit `default` profile in examples.
  
- Do not expose private keys, credentials, runtime seeds, or full signed transaction bytes in examples.
  
- Keep examples shell-safe and use quoted environment expansions for URLs and paths.
  
- Use absolute internal links.
  
- Use Starlight admonitions, not JSX.
  
- Do not use em dashes.
  
## Version and Source Verification
Before editing each page:

1. Verify command syntax against `../groundhog-rpc/crates/tools/cli/src/main.rs`.
  
2. Verify config behavior against `config/read.rs`, `config/mutate.rs`, and `config/project.rs`.
  
3. Verify transfer behavior against `transfer.rs` and `account_resolution.rs`.
  
4. Verify transaction behavior against `tx.rs`.
  
5. Verify event and token behavior against `events.rs`, `event_spec.rs`, and `token.rs`.
  
6. Verify current package versions in `../groundhog-rpc/Cargo.toml` and the generated scaffold template.
  
7. Treat merged source as authoritative. Do not document open PR `#187` as available.
  
## Acceptance Criteria
### Configuration
- No page claims that configuration is project-only.
  
- No page claims that project configuration was removed.
  
- The CLI reference names both durable layers and explains merge precedence.
  
- No page claims an implicit `default` profile fallback.
  
- Routine profile setup uses `groundhog config` rather than direct TOML editing.
  
- At least one example demonstrates `config get --sources`.
  
- Scope rules inside and outside a project are documented.
  
- Project aliases remain documented as project-owned when deployment runs in a project.
  
### CLI Surface
- The CLI reference includes transfer, transaction, event, token, and config commands.
  
- Every paginated inspection command is described as a one-page request.
  
- Transaction history carries the root-invocation limitation.
  
- Event decoding preserves raw evidence in the explanation.
  
- Token amounts are identified as unformatted base units.
  
- Dry-run documentation says signed preparation, not simulation.
  
### Local Node
- Ephemeral and persistent node modes are both documented.
  
- `--data-dir` and `--ramdb-bytes` appear in the CLI reference.
  
- The docs do not imply that `--reset` exists.
  
### Quality
- All changed pages retain required `title` and `description` frontmatter.
  
- Internal links are absolute and resolve.
  
- Command examples parse against CLI `0.6.1` help.
  
- `npx astro check` passes.
  
- `pnpm build` passes.
  
- A repository search finds no stale CLI `0.5.17` or `0.5.18` version note on pages changed by this work.
  
## Verification Checklist
Run:

```bash
npx astro check
pnpm build
```

Search for stale claims:

```text
built-in default profile
then the built-in default profile
chain state is not preserved across node restarts
Open the global configuration
Groundhog CLI 0.5.17
Groundhog CLI source at package version 0.5.18
```

Manually compare examples with:

```bash
groundhog config --help
groundhog config get --help
groundhog config new --help
groundhog config set --help
groundhog transfer --help
groundhog tx show --help
groundhog tx list --help
groundhog events list --help
groundhog token transfers --help
groundhog node --help
```
## Out of Scope
- Documenting block RPC methods from open PR `#187` as shipped.
  
- Designing `groundhog status` beyond its current behavior.
  
- Adding automatic pagination, event following, transaction body decoding, traces, token metadata, or account-ledger aggregation.
  
- Documenting config import/export, profile cloning, aliases through `config set`, or wallet bindings through `config set`.
  
- Changing CLI behavior or config persistence.
  
- Rewriting unrelated SDK or programming-model documentation.
  
## Phased Delivery

Each phase should produce one focused commit. Run `npx astro check` after every phase. Run the full production build before the final commit.

### Phase 1: Configuration Model

**Commit:** `docs: explain global and project CLI configuration`

- Add the canonical two-layer configuration model to `tools/groundhog-cli.md`.
- Document profile selection, merging, mutation scope, and `groundhog config` CRUD.
- Correct the implicit `default` profile claim.
- Update `start/getting-started.md` to describe `groundhog.toml` as a project overlay.
- Replace manual profile editing in `tools/faucet.md` with config commands.
- Replace the Devnet tutorial's manual profile setup with config commands.
- Keep later workflow steps unchanged except where required for consistency.

**Exit criteria:** A developer can create, inspect, select, and override a profile without editing TOML, and every changed page describes the same global-plus-project model.

### Phase 2: CLI Command Reference

**Commit:** `docs: add transfer and activity inspection commands`

- Add native HOG transfer behavior to `tools/groundhog-cli.md`.
- Add `tx show` and `tx list`.
- Add `events list` and spec-based decoding.
- Add `token transfers` and participant filters.
- Expand the command map.
- Document one-page pagination, opaque cursors, root-invocation history, raw event evidence, and raw token units.

**Exit criteria:** The CLI reference covers every command shipped by PRs `#191`, `#192`, and `#194` with its important safety and interpretation limits.

### Phase 3: Local Node Modes

**Commit:** `docs: document persistent local node options`

- Correct the ephemeral-only description in `tools/groundhog-cli.md`.
- Document `--data-dir` and `--ramdb-bytes`.
- Add an optional persistent-node path to `tutorials/develop-locally.md`.
- State that `--reset` is unavailable and that a new directory creates a clean persistent chain.

**Exit criteria:** The docs clearly distinguish ephemeral and persistent nodes and accurately describe the current node flags.

### Phase 4: End-to-End Workflows

**Commit:** `docs: add CLI activity inspection workflows`

- Update the local tutorial to use config inspection and project-scoped mutation commands.
- Add concise transaction and event inspection after a local call.
- Add native transfer and transaction/token inspection to the Devnet tutorial.
- Preserve the distinction between persisted `config get` output and effective `status` diagnostics.
- Keep detailed command semantics in the CLI reference rather than duplicating them.

**Exit criteria:** Both tutorials exercise the new CLI capabilities in realistic sequences and link to the canonical reference for details.

### Phase 5: Discovery and Cross-Links

**Commit:** `docs: surface CLI inspection across tool guides`

- Add terminal inspection options to `tools/block-explorer.md`.
- Add `groundhog events list` and spec decoding to `tutorials/add-events-to-a-contract.md`.
- Add narrow CLI cross-links to `reference/json-rpc-api.md` where useful.
- Recheck `tools/typescript-sdk.md` against merged source and change it only if required.
- Do not document open PR `#187` as shipped.

**Exit criteria:** Developers can discover the CLI inspection commands from the relevant event, explorer, and RPC pages without duplicated API reference material.

### Phase 6: Version and Consistency Pass

**Commit:** `docs: align CLI documentation with v0.6.1`

- Update checked-version notes on every page changed by this work.
- Verify the current scaffold SDK version before publishing SDK claims.
- Search for stale profile, version, and ephemeral-only statements.
- Check internal links and command examples.
- Run `npx astro check` and `pnpm build`.

**Exit criteria:** All acceptance criteria pass, no stale claims remain in scope, and the production build succeeds.
