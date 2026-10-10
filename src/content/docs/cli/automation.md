---
title: Use the CLI in scripts
description: Use non-interactive commands and structured output without treating output flags as confirmation.
---

Use `--non-interactive` to disable questions and terminal UI. It does not authorize state changes. Supply the command's consent option, such as `--force` for deployment or `--yes` for skill setup.

## Set up explicitly

```bash
thruput init --non-interactive --generate-key
```

`--generate-key` authorizes initial key creation when there are no stored keys or explicit selections. It does not replace an existing key. Use `thruput new` separately to create a project in a script.

## Request structured output

```bash
thruput config get devnet --json
thruput test --json
```

The envelope identifies the command, its `ok` result, warnings, and command data. Payloads carry a command-specific `schemaVersion`; check it before relying on exact fields.

Check the process exit status as well as the envelope. A reported test failure can carry `ok: false` on stdout. Other command failures can emit an error envelope on stderr. Keep the streams separate instead of assuming every failed command produces a successful-data shape on stdout.

With `test --watch --json`, each completed run is a separate JSON record. A long-running `node` or watch command still runs until stopped.

## Confirm intended writes

For a deployment you intend to submit:

```bash
thruput deploy --profile devnet --fund 10 --non-interactive --force --json
```

For preparation without submission, use `--dry-run` instead. Neither `--quiet` nor `--json` substitutes for confirmation.

## Set up agent tools

```bash
thruput skill install --agent opencode --yes --non-interactive --json
thruput docs --background --port 0 --json
```

Unattended skill installation needs both `--yes` and an explicit agent. Updates need `--yes`; add `--global` to either operation for user-wide scope. See [Skills and local docs](/cli/agent-tools/) for prerequisites, targeted updates, and offline reads.

Background docs reports include `running`, `reused`, `server`, and `logPath` in `data`. Read `server.url` and `server.markdownIndex` when a server is present. Use `thruput docs status --json` to inspect it and `thruput docs stop --json` to stop it. A status with `running: false` is a valid result, not a command failure.
