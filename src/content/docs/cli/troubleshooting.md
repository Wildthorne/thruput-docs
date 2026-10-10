---
title: Troubleshooting
description: Diagnose configuration, build, runtime, funding, and transaction-observation problems.
---

Start with the command's error and the selected environment:

```bash
thruput --version
thruput status --profile devnet
thruput config get devnet --sources
```

For local work, use `--profile local`. `status` can exit nonzero when it finds warnings; inspect the findings rather than assuming the report itself failed.

## Cargo cannot access packages

Complete [Cargo access setup](/cli/install/#configure-cargo-access) in the terminal running the build. A registry token alone is not enough if Cargo has no credential provider configured. Repository access does not imply registry access.

## The wrong profile or account is selected

An explicit `--profile` wins over `THRUPUT_PROFILE`, which wins over project and global defaults. A profile-specific key or selected wallet can also override the global key. Inspect both configuration and `wallet ls --profile NAME` before changing them.

Use [Profiles and networks](/cli/configuration/) and [Keys and wallets](/cli/wallets/) to change the intended layer. Preserve existing keys rather than generating replacements to hide a selection error.

## The local runtime is missing or incompatible

```bash
thruput toolchain list
thruput toolchain install
thruput toolchain which
```

Check for an intentional `THRUPUT_DEVNODE_BINARY` override or an adjacent binary. The installed CLI's catalog chooses a compatible managed runtime. A protocol-token override does not fix a wire-format mismatch. See [runtime selection](/cli/local-node/#runtime-selection).

On Linux, a missing shared-library error identifies the system dependency to install. See [CLI installation](/cli/install/) for runtime-library guidance.

## The node restarted and the deployment disappeared

An ephemeral local node loses chain state on shutdown. Restarting it does not restore the old wallets, balances, or deployments, even when local configuration still has their aliases. Redeploy on the new chain, or use a persistent [data directory](/cli/local-node/#preserve-state).

## Deployment needs funding

Native deployment requires an explicit `--fund` amount. The sender needs funds for the transfer and scheduling capacity; the deployed contract needs funds for its own storage. Inspect the sender with `thruput balance --profile NAME`, then request appropriate test funding or reduce the operation. See [Deploy and call](/cli/deploy-and-call/).

## Submission timed out or status is unknown

Keep the transaction hash and original network. Run `thruput tx show TX_HASH --profile NAME` to inspect it. A timeout is not proof of failure. Do not automatically repeat a deployment or sign a replacement call.

## A view or call cannot resolve a method

Use the correct contract alias and the spec from the matching build. Rebuild after interface changes. At a Cargo workspace root, select the package with `-p`. Explicit entrypoint calls require the matching encoded calldata; changing only the entrypoint does not adapt an incompatible interface.

## The integration target is missing

Current CLI projects include `tests/integration.rs` and its activation wiring. Compare an older project with a fresh scaffold before adding them; do not replace its dependency configuration blindly. See [Test contracts](/programming-model/testing/#what-the-scaffold-gives-you).
