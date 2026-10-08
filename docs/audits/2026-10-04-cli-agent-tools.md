# GH-459: Developer-site command alignment

## Source

Reviewed the clean `gh-459-agent-setup` checkout in `groundhog-rpc` at
`37367c12`. Command definitions in `crates/cli/src/main.rs`, skill behavior in
`skill.rs`, and docs serving, export, and service implementations are the
authority. The published-site prose treats these commands as available, as
requested, without claiming that the branch has actually merged or released.

## Changes

- Added the CLI task page **Skills and local docs** and its sidebar entry.
- Documented project/global skill installation, repeated agent selection,
  targeted updates, direct `npx skills` commands, offline bundled reads, and
  the distinction between maintained-source and bundled guidance.
- Documented unattended `--yes`/`--agent` requirements and `--offline` behavior.
- Covered foreground/background docs, repeat-start reuse, status, stop, log
  output, retained Markdown, export destinations, and trusted snapshots.
- Updated reference tables, automation guidance, the CLI overview, and the
  concise agent onboarding links. Preserved the old local-documentation anchor.
- Removed the pending-release framing from the README's usage guidance.

## Verification

- Inspected the branch binary's install, update, show, docs, export, and status help.
- Read the entry, all five topics, and complete bundled guidance with
  `--offline --json`. Provenance identifies skill revision `aad9be0`.
- Used an isolated cache to start background docs, repeat the same start
  (`reused: true`), inspect status, export offline, stop, and verify
  `running: false`. The user's background server was not touched.
- Astro diagnostics, all 17 script checks, all 53 browser checks, and the
  production build with Markdown link validation passed.
- No new skill installation was performed. Installer semantics were checked
  against source and the existing GH-459 verification evidence.

The branch binary reports CLI version 0.22.1. That version string alone does not
identify these source changes; this audit records the exact source revision.
