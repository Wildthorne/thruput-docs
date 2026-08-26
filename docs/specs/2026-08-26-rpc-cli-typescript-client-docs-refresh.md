# RPC, CLI, and TypeScript Client Documentation Refresh
**Date:** 2026-08-26  
**Status:** Implemented  
**RPC baseline:** `groundhog-rpc` `c6051ef` (`0.10.3`)  
**TypeScript baseline:** `client-ts` `4126576` (`v0.4.0`)
## Goal
Update the public documentation to match the current RPC, CLI, and TypeScript client. The revised docs must teach:

- network-bound transaction signing;
  
- cluster-aware TypeScript clients and endpoint identity validation;
  
- TypeScript wallet accounts, wallet clients, and invocation adapters;
  
- local development account loading;
  
- JSON-RPC network discovery and airdrops;
  
- current CLI configuration, account, funding, output, and automation behavior;
  
- the current local and Devnet workflows.
  

The result should let a developer connect to a Groundhog network, validate its identity, prepare and sign transactions for that network, fund an account, deploy and call contracts, and automate CLI commands without relying on stale API shapes.
## Problem
The docs were last refreshed against RPC and CLI `0.9.6` or earlier and TypeScript client `0.2.0`. The current repositories have changed the public surface in several connected areas:

1. Transaction signatures now include a domain separator and network hash.
  
2. The TypeScript client factory is asynchronous and supports cluster identity validation.
  
3. The TypeScript client now includes account models, wallet clients, wallet adapters, and airdrop actions.
  
4. JSON-RPC now exposes network identity and airdrop methods.
  
5. CLI signing profiles require network identity outside local runtime discovery.
  
6. Several CLI JSON payloads changed to camelCase and gained command-specific schema versions.
  
7. Local account roles and wallet funding guidance changed.
  

Updating only version notes would leave examples that do not compile and security guidance that describes the wrong signature preimage.
## Source of Truth
Verify claims against merged source, tests, generated specifications, and maintained examples in:

| Area | Repository and source |
| --- | --- |
| Public JSON-RPC | `groundhog-rpc`: `crates/json-rpc/json-rpc-api/` and `crates/json-rpc/open-rpc-spec/` |
| RPC wire types | `groundhog-rpc`: `crates/json-rpc/json-rpc-types/` |
| CLI syntax and behavior | `groundhog-rpc`: `crates/tools/cli/src/` |
| Signing behavior | `groundhog-rpc`: `crates/tools/signing/` |
| Hosted faucet | `groundhog-rpc`: `crates/faucet/` |
| Local node facade | `groundhog-rpc`: `crates/dev/node-supervisor/` |
| TypeScript public APIs | `client-ts`: `src/` |
| TypeScript examples | `client-ts`: `examples/` |
| TypeScript package surface | `client-ts`: `package.json` |
| Protocol admission semantics | `hogd` and `protocol`: admission source and tests |

Commit messages and repository READMEs are supporting context, not authority when they differ from current source.
## Release Gate Resolution

- TypeScript client `0.4.0` is published at commit `4126576` with coordinated protocol packages `0.8.0`.
  
- The client's pinned OpenRPC metadata says wire `3.3.0`, but its methods and schemas match RPC wire `4.0.0`. Published docs use the current `4.0.0` RPC contract.
  
- Current hogd admission accepts `kPubkeySignature` when the root address matches the pubkey preimage and has no registered source-address auth data.
  
- RPC and CLI source is `0.10.3`, but the latest tagged CLI is `0.10.2`. Installation guidance uses the tagged release and identifies source-only behavior where needed.
## Ground Truth
### Transaction Signatures
Transaction signatures bind the transaction to both a protocol domain and one network:

```text
cxs(DomainSeparator("Transaction")) || networkHash || txs(transaction)
```

The network hash prevents replaying the same signed transaction on another Groundhog network. Transaction identity remains the hash of the inner transaction. It is not the hash of the `SignedTransaction` wrapper or the signature preimage.

Low-level TypeScript signing requires:

```ts
const signed = await signTransaction(transaction, signers, networkHash);
```
### RPC Network Identity
`groundhog_networkInfo` returns:

```json
{
  "networkHash": "0x<64 lowercase hex characters>"
}
```

Profile and runtime-manifest configuration stores the network hash as 64 lowercase hex characters without `0x`. Public JSON-RPC uses `0x`-prefixed lowercase hex.
### TypeScript Client Creation
The current factory is asynchronous and takes an options object:

```ts
const client = await createGroundhogClient({
  cluster: devnet(),
});
```

Supported cluster helpers are `mainnet()`, `devnet()`, `localnet()`, and `defineCluster()`.

- A cluster connection calls `groundhog_networkInfo` before returning.
  
- A supplied `networkHash` pins the endpoint identity.
  
- `devnet()` has a default endpoint but is not identity-pinned unless the caller supplies a network hash.
  
- `localnet()` has a default endpoint and default local network hash.
  
- Cluster capabilities declare expected client actions. They are not server capability discovery.
  
- An unqualified `{ transport }` client skips cluster identity comparison.
  
### TypeScript Wallet Clients
Groundhog has two account models:

- **Pubkey accounts** derive their address from a public key and nonce. Every new pubkey account has a DefaultWallet and can sign transactions immediately.
  
- **Source-address accounts** use a smart wallet contract deployed at the source address. The account's contract defines how application invocations are wrapped and authorized. DevWallet is one example smart wallet for a source-address account.
  

The TypeScript client supports both models. It represents their authorization and wallet behavior through account objects and invocation adapters.

The client exposes:

- `createPubkeyAccount()`;
  
- `createSourceAddressAccount()`;
  
- `createWalletClient()`;
  
- `defaultWalletAdapter`;
  
- `devWalletAdapter`;
  
- `defineWalletInvocationAdapter()`.
  

A wallet client binds one account and its signers to an existing client. Pubkey accounts receive the DefaultWallet adapter automatically. Source-address accounts require an explicit invocation adapter to expose `prepareExecution()` and `execute()`.

Wallet decoration binds account-specific closures to a client instance. Each client instance can be bound once. Applications operating multiple accounts must create separate client instances.

`prepareTransaction()` defaults to a random unsigned 64-bit nonce and an expiry 100 blocks after the current tip. It accepts `blockExpiryHeight` or `expiryBlocks`, but not both.
### Local Development Accounts
Node.js applications can import `loadLocalDevAccount()` from `@groundhogchain/client/local-dev`.

- The default role is `local_user`.
  
- `roleOffset` selects among accounts sorted by derivation index.
  
- The loader reads `GROUNDHOG_RUNTIME_MANIFEST` or the active local runtime from Groundhog config.
  
- It returns the account address, signer, role, index, key name, and network hash.
  
- Deterministic local signers must not be used for production networks or funds of value.
  

The local node reserves `dev-0` as its fixed faucet. Normal local users begin at `dev-1`.
### RPC Airdrops
The request contains a recipient and a 1-to-32-byte client nonce. Responses are either pending or succeeded. A succeeded attempt means the transaction committed, but clients must still inspect `status.result` for execution success.

The TypeScript client exposes:

- `requestAirdropAttempt()` for caller-managed idempotency and polling;
  
- `requestAirdrop()` for generated nonces, pending retries, timeout, and cancellation.
  

A timeout or cancellation does not prove that the transfer failed.
### CLI Account and Funding Behavior
The target is optional for:

```bash
groundhog balance [TARGET]
groundhog airdrop [RECIPIENT]
groundhog tx list [TARGET]
```

An omitted target resolves to the effective wallet. Documentation should explain the behavior once in the CLI guide and use omission in tutorials only after a default wallet is established.

Wallet creation prefunds the wallet address so the wallet can be created. The current 1 HOG prefund does not fund a later application deployment. A normal new-wallet workflow includes an airdrop before the first application deploy.
### CLI JSON Contract
Structured output uses a common envelope:

```json
{
  "ok": true,
  "command": "...",
  "warnings": [],
  "data": {}
}
```

Command payloads use camelCase. Automation must inspect the command-specific `data.schemaVersion` where present.

Important current schemas include:

| Command | Schema version |
| --- | ---: |
| `call` | 1   |
| `deploy` | 4   |
| `airdrop` | 3   |
| `wallet.create` | 4   |
| `new` | 1   |
| `build` | 1   |
| `status` | 1   |
| `balance` | 1   |
| `storage` | 1   |
| `keys.export` | 1   |
### RPC Versioning
RPC `0.10.3` advertises wire `4.0.0`. `groundhog_version` reports:

```json
{
  "wireFormat": "4.0.0",
  "implementation": "0.10.3",
  "platformVersion": "0.1.25-rc.1",
  "commitHash": "<commit>"
}
```

`platformVersion` is omitted when unavailable. Consumers may branch on `wireFormat`, not `implementation` or `platformVersion`.
## Scope
### Required Pages
1. `src/content/docs/tools/typescript-sdk.md`
  
2. `src/content/docs/tools/wallet-integration.md`
  
3. `src/content/docs/tools/typescript-bindings.md`
  
4. `src/content/docs/reference/json-rpc-api.md`
  
5. `src/content/docs/how-it-works/authorization.md`
  
6. `src/content/docs/tools/groundhog-cli.md`
  
7. `src/content/docs/tools/faucet.md`
  
8. `src/content/docs/tutorials/develop-locally.md`
  
9. `src/content/docs/tutorials/develop-on-devnet.md`
  
10. `src/content/docs/start/getting-started.md`
  
11. `src/content/docs/how-it-works/networking.md`
  
### Consistency Sweep
Update a page only where it contains a stale version, API, account, funding, signing, or RPC claim introduced by this work:

- `src/content/docs/how-it-works/transaction-lifecycle.md`
  
- `src/content/docs/tools/block-explorer.md`
  
- `src/content/docs/tutorials/add-events-to-a-contract.md`
  
- `src/content/docs/tutorials/build-a-counter.md`
  
- `src/content/docs/tutorials/build-a-token.md`
  
- `src/content/docs/programming-model/testing.md`
  
- `src/content/docs/reference/contract-spec.md`
  
### Non-Goals
- Do not design or document an official browser wallet provider that does not exist.
  
- Do not change RPC, CLI, faucet, protocol, or TypeScript implementation code in this workstream.
  
- Do not invent a Mainnet endpoint, Mainnet network hash, or release schedule.
  
- Do not promise that a cluster capability proves the server implements that feature.
  
- Do not document `platformVersion` as a compatibility field.
  
- Do not expose private keys, signed transaction bytes, credentials, or deterministic local seeds.
  
- Do not document configurable faucet policy values as network guarantees.
  
- Do not create parallel pages when an existing page owns the topic.
  
- Do not expand the block explorer page beyond functionality verified in its repository and deployment state.
  
## Required Changes
### 1. TypeScript SDK
Rewrite `tools/typescript-sdk.md` around the current high-level flow:

1. Install a confirmed coordinated package set.
  
2. Create a cluster-aware client.
  
3. Read network and chain state.
  
4. Create or load an account.
  
5. Bind a wallet client.
  
6. Request funds where supported.
  
7. Build a generated application invocation.
  
8. Execute through the appropriate wallet adapter.
  
9. Wait for and decode the receipt.
  

Required details:

- Replace every positional `createGroundhogClient(transport)` call.
  
- Document cluster identity pinning and the unpinned Devnet default.
  
- Add `getNetworkInfo()` and airdrop actions to supported operations.
  
- Add `@groundhogchain/client/local-dev` to public entry points.
  
- Introduce pubkey accounts and source-address accounts before the wallet-client example. Explain that pubkey accounts use DefaultWallet immediately, while source-address accounts use a deployed smart wallet such as DevWallet.
  
- Show how `createWalletClient()` binds one account, its signers, and its wallet invocation behavior to a client instance.
  
- Replace the manual DevWallet deployment example with the current wallet-client flow.
  
- Retain a short low-level signing example only to explain `networkHash` and custom signer integration.
  
- Document DefaultWallet and DevWallet exports from `@groundhogchain/client/contracts`.
  
- Correct the maintained examples section: chain tip and HOG transfer use Devnet; balance and deployment use Localnet.
  
- Keep typed views, descriptor invocations, root-receipt decoding, and transport error guidance that remains current.
  
### 2. Wallet Integration
Rewrite `tools/wallet-integration.md` to distinguish three layers:

| Layer | Current support |
| --- | --- |
| Signers and account models | Published TypeScript API after release confirmation |
| Wallet transaction construction | TypeScript wallet clients and invocation adapters |
| Browser connection and permission UX | No official provider or adapter yet |

Document:

- signer input is the domain-separated, network-bound preimage;
  
- pubkey and source-address account models;
  
- how a wallet client binds an account, its signers, network identity, and invocation adapter;
  
- automatic DefaultWallet behavior;
  
- explicit adapters for source-address wallets;
  
- network identity requirements;
  
- one account binding per client instance;
  
- the boundary between wallet transaction construction and browser-wallet UX.
  

Remove claims that the TypeScript client cannot construct wallet-root invocations.
### 3. Authorization
Update `how-it-works/authorization.md`:

- replace the bare XDR transaction signature description with the full preimage;
  
- explain cross-network replay protection;
  
- distinguish transaction hash, signature preimage, and signed wrapper;
  
- verify and correct `kPubkeySignature` admission support;
  
- preserve source-address signer ordering, allowed-key, and threshold rules after source verification.
  

Add only a concise network-bound signing note to `transaction-lifecycle.md` if needed for consistency. Keep detailed admission semantics on the authorization page.
### 4. JSON-RPC Reference
Rewrite `reference/json-rpc-api.md` as an API reference rather than a combined concept essay and method list.

Required method updates:

- add `groundhog_networkInfo`;
  
- add `groundhog_requestAirdrop`;
  
- update `groundhog_version`;
  
- replace the declared `BlockInfo` shape;
  
- change the current deterministic engine category to `kind: "fault"`;
  
- preserve the current not-implemented status for block reads and pending count if source still returns `-32052` during implementation.
  

Document airdrop request fields, pending and succeeded variants, idempotency, timeout ambiguity, and execution-status inspection.

Move reusable conceptual material about typed JSON into an appropriate concept page only if it remains useful. Do not keep a long ecosystem comparison essay in an API-table reference.
### 5. TypeScript Bindings
Update `tools/typescript-bindings.md` only where the runtime and standard binding surface changed:

- use the confirmed package versions;
  
- add DefaultWallet and DevWallet standard bindings;
  
- link generated application invocations to wallet-client execution;
  
- preserve the distinction between root-receipt decoding and nested application calls;
  
- retain current method, event, exception, and type-mapping material that remains accurate.
  
### 6. Groundhog CLI
Update `tools/groundhog-cli.md` as the canonical CLI behavior page.

Configuration:

- add `network-hash` to editable profile fields;
  
- explain runtime discovery versus persisted hosted identity;
  
- show network identity in a hosted profile example.
  

Keys and destructive commands:

- add `groundhog keys export <name>`;
  
- warn that export prints secret key material;
  
- document interactive deletion and `--force` for non-TTY, JSON, and quiet use;
  
- apply the same automation guidance to `config rm`;
  
- mention `chain restore -f` only where restore is already documented.
  

Defaults and funding:

- document omitted targets for `balance`, `airdrop`, and `tx list`;
  
- correct the `dev-0` faucet and `dev-1+` user roles;
  
- correct wallet-create prefund guidance.
  

Automation:

- add the common JSON envelope and schema table;
  
- state that command payload fields use camelCase;
  
- advise scripts to check `data.schemaVersion`.
  

Environment and node behavior:

- document standard proxy environment variables for CLI HTTP requests;
  
- add repeatable `node --contract-artifacts-dir` behavior;
  
- remove current-page WASM flags and differential commands that no longer exist;
  
- retain supported RV32 build and test guidance.
  
### 7. Faucet
Update `tools/faucet.md`:

- describe network descriptor schema 3 and `networkHash` only to the extent users need it;
  
- state that CLI remote airdrops use `groundhog_requestAirdrop`;
  
- distinguish direct hosted faucet APIs from the preferred public RPC method;
  
- explain pending attempts, idempotency records, and exact-command retries;
  
- explain that timeout does not prove failure;
  
- correct the wallet prefund and first-deploy funding sequence;
  
- show omitted-recipient CLI usage after establishing a default wallet;
  
- add or link a TypeScript airdrop example.
  

Do not present deployment-configurable quota values as stable Devnet guarantees.
### 8. Local Tutorial
Update `tutorials/develop-locally.md`:

- update verified versions and installation guidance;
  
- use a `local_user`, normally `dev-1`, for ordinary development;
  
- reserve `dev-0` for faucet behavior;
  
- explain `loadLocalDevAccount()` where the tutorial links into TypeScript development;
  
- show local airdrop behavior when using a newly created saved wallet;
  
- mention `--contract-artifacts-dir` only for nonstandard artifact layouts;
  
- preserve the simple default `groundhog node` workflow.
  
### 9. Devnet Tutorial
Update `tutorials/develop-on-devnet.md`:

- update verified versions and installation guidance;
  
- verify the init-created profile includes current network identity fields;
  
- replace stale manual endpoint comparison requirements with current CLI validation behavior;
  
- retain direct descriptor inspection as optional diagnosis, not a routine trust step;
  
- request an airdrop after wallet creation and before the first application deploy;
  
- use omitted wallet targets where that makes the default-wallet behavior clearer;
  
- update cleanup commands for interactive and automated deletion behavior;
  
- link to the cluster-aware TypeScript Devnet flow.
  
### 10. Getting Started
Update `start/getting-started.md`:

- install the current confirmed CLI release;
  
- update scaffold SDK expectations from the current template;
  
- describe `dev-0` as the local faucet and normal users as `dev-1+`;
  
- correct the wallet-create and application-deploy funding sequence;
  
- introduce network identity without expanding the page into protocol detail;
  
- link detailed TypeScript, CLI, faucet, and authorization guidance.
  
### 11. Networking and Gateway Notes
Update `how-it-works/networking.md`:

- remove the alternate coordinator submission path;
  
- state that the public gateway submits directly to the hogd scheduler;
  
- keep operator configuration details out of the concept page unless needed to explain topology.
  

Where operator guidance already exists, update it for:

- default loopback public listener;
  
- required network hash;
  
- removed `submission_backend` and `coordinator_address` fields;
  
- strict TOML unknown-field rejection;
  
- optional hosted faucet configuration.
  

Do not create a new operator page solely for these fields unless the existing information architecture has a clear location for it.
## Information Architecture
Use these ownership rules to avoid repeating volatile details:

| Topic | Canonical page | Other pages should |
| --- | --- | --- |
| TypeScript client and wallet workflow | `/tools/typescript-sdk/` | Show one task-specific example and link back |
| Browser-wallet support boundary | `/tools/wallet-integration/` | State the boundary briefly and link back |
| Generated descriptors and types | `/tools/typescript-bindings/` | Avoid repeating descriptor tables |
| Transaction admission and signature preimage | `/how-it-works/authorization/` | Mention network binding briefly |
| JSON-RPC request and response contracts | `/reference/json-rpc-api/` | Link instead of duplicating response tables |
| CLI command behavior and JSON schemas | `/tools/groundhog-cli/` | Show workflow commands only |
| Faucet and funding semantics | `/tools/faucet/` | Show the required funding step and link back |
| Local workflow | `/tutorials/develop-locally/` | Link to it |
| Devnet workflow | `/tutorials/develop-on-devnet/` | Link to it |
## Writing Requirements
- Lead with the task a developer is trying to complete.
  
- Prefer one recommended path. Mention alternatives only when they solve a real user need.
  
- Explain new terms simply at the point where developers need them.
  
- Use short, runnable examples instead of lengthy descriptions.
  
- Keep implementation details out of user guides unless they affect correctness, security, compatibility, or troubleshooting.
  
- Keep exhaustive field and method details in reference pages. Tutorials and tool guides should include only what their workflow needs.
  
- Remove stale material instead of preserving it as historical context.
  
- Do not document edge cases that users cannot act on.
  
- Say "network hash" for the identity bound into transaction signatures.
  
- Distinguish an endpoint handshake from identity pinning.
  
- Say that cluster capabilities are declared, not discovered.
  
- Say "transaction signature preimage," not "transaction bytes," when describing signer input.
  
- Distinguish transaction commitment from successful execution.
  
- Say "effective wallet" when describing omitted CLI target resolution.
  
- Distinguish wallet-creation prefunding from application deployment funding.
  
- Identify `dev-0` as the local faucet and `dev-1+` as local users.
  
- Use camelCase for public JSON and snake_case only for persisted TOML fields or Rust names.
  
- Use absolute internal links.
  
- Use Starlight admonitions, not JSX.
  
- Do not use em dashes.
  
- Keep version notes specific about published releases versus source snapshots.
  
- Do not reproduce internal constants unless users need them to use the public API safely.
  
## Phased Delivery
### Phase 0: Close Release Gates
- Confirm the TypeScript release version and tag.
  
- Compare the client OpenRPC schema with RPC wire `4.0.0` and record any compatibility gap.
  
- Verify `kPubkeySignature` against current admission source and tests.
  
- Record the coordinated package versions and CLI scaffold SDK version.
  

**Exit criteria:** The spec has one publishable version matrix, no unresolved authorization claim, and any source metadata follow-up is tracked outside the docs implementation.
### Phase 1: Network Identity and Authorization
- Update authorization and transaction-lifecycle guidance.
  
- Update the JSON-RPC version and network identity methods.
  
- Add the airdrop RPC contract.
  
- Correct networking topology.
  

**Exit criteria:** Every public signing description uses the current domain-separated, network-bound preimage, and the RPC reference matches wire `4.0.0`.
### Phase 2: TypeScript Client and Wallets
- Rewrite the SDK client setup and transaction flow.
  
- Rewrite wallet integration boundaries.
  
- Update standard bindings and maintained examples.
  
- Add local development account loading.
  

**Exit criteria:** All TypeScript examples type-check against the confirmed release and no page claims wallet-root construction is unavailable.
### Phase 3: CLI and Faucet
- Update profile network identity.
  
- Add key export, force behavior, omitted targets, proxy behavior, and artifact directories.
  
- Add CLI JSON schema guidance.
  
- Correct account roles and wallet funding.
  
- Update faucet RPC and idempotency guidance.
  

**Exit criteria:** CLI workflows and automation examples match `0.10.3`, and no page relies on obsolete snake_case command payloads.
### Phase 4: Tutorials and Onboarding
- Update Getting Started.
  
- Update Local and Devnet tutorials.
  
- Apply the narrow consistency sweep.
  
- Remove stale versions and duplicated obsolete claims.
  

**Exit criteria:** A new developer can complete both workflows using the current account roles, funding sequence, CLI, and client APIs.
### Phase 5: Verification and Editorial Pass
- Validate all commands against current help.
  
- Type-check TypeScript snippets where practical.
  
- Check internal links and frontmatter.
  
- Run Astro checks and the production build.
  
- Search for stale versions and claims.
  

**Exit criteria:** All acceptance criteria pass and the production build succeeds.
## Verification
Run:

```bash
npx astro check
pnpm build
```

Validate TypeScript examples against the confirmed package set with the client repository's type-check and example tooling.

Manually compare CLI examples with:

```bash
groundhog --version
groundhog config new --help
groundhog config set --help
groundhog keys export --help
groundhog keys rm --help
groundhog balance --help
groundhog airdrop --help
groundhog tx list --help
groundhog node --help
```

Search published docs for stale API and behavior markers:

```text
@groundhogchain/client@0.2.0
protocol packages 0.7.1
Groundhog CLI 0.6.3
Groundhog CLI 0.9.6
wire 3.0.0
wire 2.3.1
createGroundhogClient(
signTransaction(transaction, [
canonical transaction bytes
does not provide the descriptor-driven wallet transaction builder
dev-0 explicitly for a stable local workflow
immediate airdrop is unnecessary
tx_hash
status_summary
```

Review each match in context. Some historical specs under `docs/specs/` may retain old baselines and should not be rewritten as part of implementation.
## Acceptance Criteria
### Release and Versions
- Every published version claim names a confirmed release or clearly labels a source snapshot.
  
- The TypeScript and RPC wire relationship is accurate.
  
- Installation commands use a coordinated, available package set.
  
- CLI and scaffold SDK versions match current release artifacts.
  
### Security and Identity
- Every signer description uses the domain-separated, network-bound preimage.
  
- The docs explain endpoint identity pinning without overstating `devnet()` defaults.
  
- Transaction hash and signature preimage are clearly distinguished.
  
- `kPubkeySignature` guidance matches current admission behavior.
  
### TypeScript
- Every client factory example uses `await` and an options object.
  
- The SDK page covers cluster-aware and unqualified clients.
  
- Wallet client examples use the current account and adapter APIs.
  
- Local examples use `loadLocalDevAccount()` where appropriate.
  
- Low-level signing examples pass `networkHash`.
  
- Maintained example descriptions match their current target networks.
  
### RPC
- The reference documents `groundhog_networkInfo` and `groundhog_requestAirdrop`.
  
- `groundhog_version` shows wire `4.0.0` and optional `platformVersion`.
  
- The declared block shape matches source.
  
- Airdrop commitment and execution success are distinguished.
  
- The reference is primarily API tables rather than a concept essay.
  
### CLI and Workflows
- Profile docs include `network-hash`.
  
- `dev-0` is consistently described as the local faucet.
  
- Normal local users begin at `dev-1`.
  
- Wallet prefunding is not presented as application deployment funding.
  
- Omitted targets are documented as effective-wallet resolution.
  
- CLI JSON examples use camelCase and identify schema versions.
  
- Non-interactive destructive commands include `--force` guidance.
  
- Secret key export includes a clear handling warning.
  
- Removed WASM and differential CLI flags do not appear as current commands.
  
### Quality
- Changed docs retain required `title` and `description` frontmatter.
  
- Internal links are absolute and resolve.
  
- Examples do not expose secrets or signed transaction material.
  
- Technical claims are source-verified.
  
- `npx astro check` passes.
  
- `pnpm build` passes.
  
## Out of Scope Follow-Ups
Track separately if discovered during implementation:

- publishing or designing a browser wallet provider;
  
- changing predefined cluster pinning defaults;
  
- changing RPC capability discovery;
  
- implementing block or pending-count backends;
  
- publishing a public block explorer URL;
  
- creating a complete gateway operator handbook;
  
- changing faucet quotas or persistence semantics;
  
- changing the TypeScript, RPC, CLI, or protocol APIs.
