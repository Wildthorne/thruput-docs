# Stellar Thruput Developer Docs

Developer documentation for the [Stellar Thruput](https://thruput.network) blockchain. Built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build).

## Hosted routing

The landing page is at `https://thruput.network/`. Documentation lives under
`/docs/`, with `/docs/` opening Get Started. `www.thruput.network` redirects to
the apex domain. The old docs domains and page URLs remain redirects, including
legacy heading mappings. Caddy keeps the existing password gate on every route
except `/health`.

Markdown, `llms.txt`, and agent guide downloads keep their root URLs. Offline
snapshots retain their original page paths for compatibility with the CLI.

After `pnpm build`, test the production host routing with a local Caddy binary:

```sh
node scripts/smoke-host-routing.mjs /path/to/caddy
```

## Development

```bash
pnpm install       # Install dependencies
pnpm dev           # Dev server at localhost:4321
pnpm build         # Production build to dist/
pnpm preview       # Preview production build locally
```

### Hosted builds without Git

The normal site build also works from a source archive without `.git` or the Git
executable. Markdown exports use Git revision and working-tree status when
available, otherwise Railway's `RAILWAY_GIT_COMMIT_SHA` for GitHub-triggered
deployments. If no valid revision is supplied, the export says it is unavailable.
Unavailable revision/status fields are `null` in the hosted Markdown manifest;
a deployment commit alone does not establish a clean working tree.

`node scripts/smoke-gitless-build.mjs` checks full site builds with and without
Railway commit metadata in a temporary copy that has no Git checkout.
Release snapshot builds below still require a Git checkout and keep their
strict source-identity and packaging checks.

## Documentation snapshot workflow

The site is the producer for `thruput docs`. Its normal Astro/Starlight build
supplies the pages, assets, fonts, and Pagefind search; there is no second site.

```bash
pnpm install --frozen-lockfile
pnpm package:snapshot
```

Use Node 22, the pnpm version in `package.json`, and Python 3. The command creates:

- `dist/docs-snapshot/`: browsable site with `snapshot.json` identifying the
  source commit, dirty-tree status, and historical agent-guide CLI version.
- `dist/docs-artifact/snapshot.tar.gz`: deterministic archive, approximately
  1.5 MB for the initial 50-page site.
- `dist/docs-artifact/snapshot-lock.json`: archive SHA-256, byte length, and
  the same source identity for review and import.

CI builds and uploads `docs-snapshot-<commit>` as a GitHub Actions artifact.
That upload remains subject to repository access; it does not publish the docs
publicly or change hosted-site authentication. CI retention is only the handoff
window: the selected archive is checked into the CLI repository for releases.

To select documentation for a CLI release:

1. Land the site changes and use the artifact from the chosen successful CI run
   on that commit. Check its tutorials/version notes against the intended
   release; the included guide version alone does not qualify the whole site.
2. Download that run's `docs-snapshot-<commit>` artifact. From `groundhog-rpc`, run
   `python3 scripts/import-docs-snapshot.py /path/to/downloaded-artifact`.
3. Review and commit the archive and pin in the CLI change. The importer rejects
   dirty source, checksum/identity mismatches, and unsupported archive content.
4. Build/test/release the CLI through its normal workflow. The CLI embeds the
   selected compressed snapshot and materializes it in the user's cache on
   first `thruput docs`; no first-use download is needed.

The producer's local build can be dirty for previews, but such an artifact cannot
be imported into the CLI. A committed, clean local build can also exercise the
handoff before CI; identify that as local evidence, not a successful CI run.

For content development, `pnpm build:snapshot` builds only the directory:

```bash
thruput docs --dir "$PWD/dist/docs-snapshot" --port 4321
```

Use `--port 0` for an available port or `--json` for readiness metadata. Keep an
explicit `--dir` snapshot unchanged while serving; `pnpm build` or another
snapshot build may replace its output. The bundled cache is separate from this
build tree. The local preview banner identifies source/guide versions, and the
landing prompt uses the local server URL when JavaScript is enabled. External
API references, repositories, and network services still require access.

To exercise the snapshot through the actual CLI in Chromium:

```bash
node scripts/smoke-snapshot.mjs /absolute/path/to/thruput
```

The smoke blocks non-loopback browser requests and checks local search,
tutorial navigation, the agent prompt, Markdown, and desktop/mobile layout.
Screenshots are written below `test-results/snapshot/`.

To validate counter-guide files independently of the examples app, extract a
chapter with `node scripts/prepare-counter-guide.mjs APP_DIR COUNTER_BINDING 4`,
using the binding generated from your counter build. Install the chapter's
dependencies in `APP_DIR` and run its build. Then run
`node scripts/check-counter-recovery.mjs APP_DIR` to check the exact recovery
helper against expiry, network/hash mismatches, receipt and RPC outcomes, storage
failure, and evidence-preserving archival. This check uses the app's installed
SDK and React packages through their public exports.

## Content

Markdown files live in `src/content/docs/`, organized by section. The sidebar is manually configured in `astro.config.mjs`.

| Section | Path | Description |
|---------|------|-------------|
| Concepts | `start/` | Background guides by developer archetype |
| Tutorials | `start/`, `tutorials/` | Getting Started + step-by-step contract builds |
| Tools | `tools/` | TypeScript SDK, block explorer, wallet, faucet |
| How It Works | `how-it-works/` | Architecture, execution model, contracts |
| Programming Model | `programming-model/` | Working model for contract authors: execution, storage types, NNInt, testing |
| Reference | `reference/` | Storage types, syscalls, SDK macros, error handling |
| Ecosystem Guides | `ecosystem/` | EVM, Solana, and Stellar comparison guides |
| Community | `community/` | Contributing, security, roadmap |

## Adding a Page

1. Create a `.md` file in the appropriate `src/content/docs/<section>/` directory
2. Add frontmatter with `title` and `description`
3. Add the slug to the sidebar array in `astro.config.mjs`
4. Run `pnpm build` to verify

## Agent guidance

The landing page imports the prompt from `/start/build-with-an-agent/`.
Maintain its text block there. The prompt installs the Thruput CLI and maintained
skill, exports the docs, and verifies a counter through CLI calls on Devnet.
`public/agent-guide.md` points readers to this workflow and the maintained skill.
Skill content is maintained in `groundhogchain/agent-skills` and updates
independently of CLI releases.

Earlier release guides remain unchanged under `public/agents/<cli-version>/`.
`public/agents/historical.json` records the last selected release artifact and
its checksum. It supplies the historical `agentGuideCliVersion` field required
by the snapshot format; this field does not identify the current skill version.
The build validates those historical bytes. The active handoff is independent
of them. Never modify, remove, or rename existing versioned guide files.

CI compares versioned guide paths against the PR base commit (or the previous
commit for a push to main). To run that check locally, use
`node scripts/check-agent-guide-history.mjs origin/main`.

## Markdown documentation

Documentation titles include an **Agent tools** disclosure with **Copy page**,
the Markdown link, an existing guide task prompt when present, **View Markdown**,
and agent setup. The clicked item's label briefly changes to **Copied**, without
adding space or moving the page.
Copy failures offer selected text in a modal dialog. Navigation
links also work without JavaScript. Task prompts come from each page's
`## Work with an agent` text block; do not maintain a second prompt copy.

Both `pnpm build` and `pnpm build:snapshot` generate Markdown from the rendered
page content. Astro renders Markdown and components first; the exporter removes
navigation and controls and preserves code, warning titles, tables, tab choices,
and described diagrams. The HTML and Markdown therefore share one maintained
source. New content components need export tests when their meaning depends on
special markup.

The build writes:

- `markdown/index.md`: descriptions and links to every exported page and section.
- `markdown/pages/<route>.md`: individual pages, with `pages/index.md` for the home page.
- `markdown/sections/<section>.md`: bundles using the sidebar's section ownership.
- `markdown/full.md`: all page content.
- `markdown/assets/`: local assets used by the exported content.
- `markdown/manifest.json`: page inventory and source identity.
- `llms.txt` and `llms-full.txt`: site-root discovery and full documentation.

Every HTML page advertises its Markdown URL with a `text/markdown` alternate
link. Explicit URLs are the supported access method; HTTP content negotiation
is not implemented. The existing Caddy authentication applies to the exports
as it does to HTML. The build does not publish or fetch content.

Keep explicit Markdown URLs as the hosting baseline. If content negotiation is
added later, verify authentication parity, `Content-Type: text/markdown`, and
`Vary: Accept` before enabling it. Unauthenticated hosted probes currently return
401, so successful hosted export access needs verification after deployment.

The agent setup and CLI pages document `thruput skill` and `thruput docs`
from the GH-459 command implementation. Use a CLI build with those commands
for snapshot export verification.

Markdown links resolve relative to their files. Legacy page and fragment
redirects are resolved during export. The build checks those targets, then
reparses the output to check file and fragment links. Broken links fail the
build. Snapshot code blocks are left unchanged, including URLs inside examples.
Hosted pages update links to the documentation domain.

The whole `markdown/` tree can be copied away from the website. With a CLI
that supports Markdown export, use:

```sh
thruput docs export --dir "$PWD/dist/docs-snapshot" --output /path/to/new-folder
```

Run `pnpm test` for conversion fixtures. The snapshot smoke also checks the
real CLI export, links in the copied folder, and code examples against their
source pages. Markdown output records the docs commit and the historical standalone agent-guide version; the latter does not version the
whole site.
