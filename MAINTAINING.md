# Publishing and maintenance

For local setup and content contributions, start with [README.md](README.md).
This guide covers the hosted site, Markdown exports, and documentation bundled
with the Thruput CLI.

## Hosted site

`pnpm build` writes the static site to `dist/`. The landing page is at `/` and
documentation is under `/docs/`. Markdown exports, `llms.txt`, and agent guide
downloads keep their root URLs. Offline snapshots omit the `/docs` prefix.

[astro.config.mjs](astro.config.mjs) configures the site;
[src/navigation.ts](src/navigation.ts) owns the documentation navigation.
[scripts/docs-routing.mjs](scripts/docs-routing.mjs) handles hosted and snapshot
paths. Preserve existing page URLs and legacy fragment redirects when moving content.

[Caddyfile](Caddyfile) serves the built files, redirects alias hosts to
`thruput.network`, and applies basic authentication to every route except
`/health`. Authentication also covers Markdown exports. Repository visibility
does not change this configuration. After a build, verify host routing with:

```sh
node scripts/smoke-host-routing.mjs /path/to/caddy
```

### Builds without Git

Hosted builds can run from a source archive without `.git` or the Git executable.
Markdown exports use the Git revision and working-tree status when available.
Otherwise, they use a valid `RAILWAY_GIT_COMMIT_SHA` for the revision. Unavailable
fields are `null`; a deployment revision does not establish a clean working tree.

```sh
node scripts/smoke-gitless-build.mjs
```

Release snapshot builds require a Git checkout.

## Markdown exports and agent prompts

The build derives Markdown from rendered page content. Maintain HTML and Markdown
in the same source. Components with special markup need export coverage so code,
tables, warnings, tabs, and diagrams retain their meaning.

The build writes these paths under its output directory:

- `markdown/index.md`, `markdown/sections/`, and `markdown/full.md`: page index,
  section bundles, and the full documentation.
- `markdown/pages/`: individual pages; the home page is `index.md`.
- `markdown/assets/` and `markdown/manifest.json`: local assets and source metadata.
- `llms.txt` and `llms-full.txt`: discovery links and the full documentation.

HTML pages advertise their Markdown URL with a `text/markdown` alternate link.
Explicit URLs are supported; HTTP content negotiation is not implemented.
The exporter resolves legacy redirects, rewrites local links for portable output,
and checks file and fragment targets. Broken links fail the build. URLs inside
code examples remain unchanged in snapshots.

Maintain each task prompt in its page's `## Work with an agent` text block.
The landing page's setup prompt comes from
[src/content/docs/start/build-with-an-agent.md](src/content/docs/start/build-with-an-agent.md).
[public/agent-guide.md](public/agent-guide.md) directs readers to that workflow
and the skill maintained in
[thruputchain/agent-skills](https://github.com/thruputchain/agent-skills).

Never modify, remove, or rename existing `public/agents/<cli-version>/agent-guide.md`
files. These are historical release artifacts. `public/agents/historical.json`
records the selected artifact and checksum. Its `agentGuideCliVersion` metadata
does not version the current skill or the whole site. The build verifies the
historical bytes; CI also checks their history against the PR base. To check locally:

```sh
node scripts/check-agent-guide-history.mjs origin/main
```

## CLI documentation snapshots

Use Node.js and pnpm versions from `package.json`, plus Python 3:

```sh
pnpm install --frozen-lockfile
pnpm package:snapshot
```

The command creates:

- `dist/docs-snapshot/`: browsable site with source identity in `snapshot.json`.
- `dist/docs-artifact/snapshot.tar.gz`: deterministic archive.
- `dist/docs-artifact/snapshot-lock.json`: archive hash, size, and source identity.

CI uploads `docs-snapshot-<commit>` as a GitHub Actions artifact. This is a release
handoff, not a site deployment. To include it in a CLI release:

1. Land the docs changes and select the artifact from a successful CI run on that
   commit. Check the content against the target CLI and SDK releases.
2. Download the artifact. From `thruput-tools`, run
   `python3 scripts/import-docs-snapshot.py /path/to/downloaded-artifact`.
3. Review and commit the imported archive and pin. The importer rejects dirty
   source, identity or checksum mismatches, and unsupported archive content.
4. Follow the CLI release workflow. The CLI embeds the archive and materializes
   it in the user's cache on first use, without downloading it.

Dirty local builds are useful for previews but cannot be imported into a CLI
release. A clean, committed local build can check the handoff; it does not replace
successful CI evidence.

To preview a snapshot without packaging the archive:

```sh
pnpm build:snapshot
thruput docs --dir "$PWD/dist/docs-snapshot" --port 4321
```

Use `--port 0` for an available port or `--json` for readiness metadata. Keep the
snapshot directory unchanged while serving it; builds may replace the output.
External API references and network services still require access.

The generated `markdown/` directory can also be copied independently of the site:

```sh
thruput docs export --dir "$PWD/dist/docs-snapshot" --output /path/to/new-folder
```

## Validation

The standard content checks are in [README.md](README.md#contribute). For UI changes:

```sh
pnpm exec playwright install --with-deps chromium
pnpm test:browser
```

For snapshot packaging changes, also run:

```sh
python3 -m unittest discover -s scripts -p 'test_*.py'
pnpm package:snapshot
node scripts/smoke-snapshot.mjs /absolute/path/to/thruput
```

The snapshot smoke uses the actual CLI and Chromium. It blocks non-loopback
browser requests and checks search, navigation, prompts, Markdown exports, and
desktop/mobile layout. Screenshots go to `test-results/snapshot/`. Use a CLI
release that supports `thruput docs` and `thruput skill`.

To validate counter tutorial files independently of the examples app:

```sh
node scripts/prepare-counter-guide.mjs APP_DIR COUNTER_BINDING 4
```

Use the binding generated from the counter build. Install the chapter's dependencies
in `APP_DIR` and run its build, then run
`node scripts/check-counter-recovery.mjs APP_DIR`. This checks the recovery helper
against expiry, network/hash mismatches, receipts, RPC outcomes, and storage
failures using the app's installed SDK and React packages.

See [.github/workflows/ci.yml](.github/workflows/ci.yml) for the full CI sequence.
