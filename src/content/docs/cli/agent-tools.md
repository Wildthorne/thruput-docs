---
title: Skills and local docs
description: Install, update, and read the groundhog skill, and serve or export local documentation.
---

Use `groundhog skill` for coding-agent instructions and `groundhog docs` for the developer documentation. For a first project, follow [Build with an Agent](/start/build-with-an-agent/).

## Install the maintained skill

Installation requires Node.js 22.20 or newer, npm, Git, and access to the private [skill repository](https://github.com/groundhogchain/agent-skills). Configure repository authentication through Git, GitHub CLI, or SSH.

```bash
groundhog skill install
```

The installer lets you choose your agents, project or global scope, and installation method. Project scope is the default. To select an agent or use a user-wide installation explicitly:

```bash
groundhog skill install --agent opencode
groundhog skill install --global --agent claude-code
```

Repeat `--agent` to select more than one agent. These commands run `npx skills` against the maintained source. You can also install directly:

```bash
npx skills add groundhogchain/agent-skills --skill groundhog
```

Installing the skill does not configure Cargo or npm access for a contract or application. Follow the relevant [quickstart](/get-started/) for those dependencies.

## Update an installed skill

Run the update in the same scope as the installation:

```bash
groundhog skill update
groundhog skill update --global
```

Each command updates only the `groundhog` skill, not other installed skills. If `groundhog` is absent from that scope, run `skill install` there first. A current installation needs no change. Repeating installation uses the installer again; it does not create a second skill name.

For a direct project-scoped update:

```bash
npx skills update groundhog --project
```

<span id="read-bundled-guidance-offline"></span>

## Read installed guidance offline

```bash
groundhog skill show
groundhog skill list
groundhog skill show contracts
groundhog skill show contracts --global
groundhog skill list --global
```

`show` prints the installed `SKILL.md` unchanged. `list` lists the Markdown references in that installation. Select a topic, such as `contracts`, to read its reference. There is no `--all` option; read the entry and the references needed for your task.

By default, these commands look for `.agents/skills/groundhog` in the current directory, then under your home directory. Run them from the directory where you installed the project skill. `--global` selects only the home-directory installation. An invalid project installation reports an error rather than falling back to the global copy.

Install the skill before reading it. Once installed, `show` and `list` need no Node.js, npm, Git, or network access. Missing files produce an installation or read error, not bundled fallback content. Add `--json` for the selected scope, file path, and content or topic list.

Updates change the installed files that `show` and `list` read. This is separate from `groundhog docs`, which serves a documentation snapshot bundled with the CLI.

## Automate skill setup

For an intended unattended installation or update:

```bash
groundhog skill install --agent opencode --yes --non-interactive --json
groundhog skill update --yes --non-interactive --json
```

Installation requires an explicit `--agent` when prompts are unavailable. Both operations require `--yes` to authorize npm execution and skill changes. Add `--global` for user-wide scope. `--non-interactive` and `--json` do not grant consent. `--offline` rejects installation and updates before invoking npm.

## Serve local documentation

```bash
groundhog docs
```

This serves the CLI's bundled site on `127.0.0.1:4321` until you press Ctrl-C. `--foreground` makes that mode explicit. The command prints the browser URL, Markdown index path, and snapshot source. It starts no blockchain node.

To keep the server running after the command returns:

```bash
groundhog docs --background --port 0
groundhog docs status
groundhog docs stop
```

Port `0` chooses an available port. Background startup returns only when the server is ready and reports the browser URL, Markdown index, and log path. Repeating the same start command reuses a matching instance. Stop it before changing its port, snapshot, or CLI executable.

`status` and `stop` manage the current user's background server, not a foreground process. The server does not start automatically after reboot. Stopping it leaves the extracted Markdown available. Add `--json` to start, status, or stop for structured reports.

Use the printed Markdown index to find individual pages under `pages/`, focused bundles under `sections/`, and the complete `full.md`. Agents on the same machine can read these files without keeping the server running. Bundled documentation is a snapshot and can differ from the hosted site.

## Export Markdown without a server

```bash
groundhog docs export --output ./groundhog-docs
```

The destination must not exist, and its parent directory must exist. The CLI copies the Markdown tree and snapshot identity, then prints the absolute path to `index.md`. It does not start a server or replace an existing export. Choose a new destination for another export.

Share the whole folder with an agent on another machine. Relative links and local assets remain usable away from the website. A remote agent cannot use your local filesystem path or loopback URL directly.

## Use a trusted site snapshot

```bash
groundhog docs --dir /path/to/docs-snapshot --port 0
groundhog docs export --dir /path/to/docs-snapshot --output ./exported-docs
```

Pass a directory produced by the documentation snapshot build, including its `snapshot.json`. Keep it unchanged while serving. Export requires `markdown/index.md` in that snapshot. The override does not fetch the hosted site.

Serving bundled docs and exporting them work offline. Linked repositories, package registries, and network services can still require network access.
