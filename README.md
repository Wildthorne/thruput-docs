# Project Thruput documentation

Source for the [Project Thruput website](https://www.thruput.network/) and
[developer documentation](https://www.thruput.network/docs/). The site is built with
Astro and Starlight and published as static HTML, with Markdown exports and
offline documentation for the Thruput CLI.

Ask questions in [Community discussions](https://github.com/thruputchain/thruput-docs/discussions)
or chat in [#thruput](https://discord.com/channels/897514728459468821/1564948118162898954)
on [Stellar Developers Discord](https://discord.gg/stellardev).

## Run locally

Use Node.js 22.23.4 or newer within Node 22, and the pnpm version specified in
[package.json](package.json).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open [localhost:4321](http://localhost:4321/). To preview a production build:

```sh
pnpm build
pnpm preview
```

## Contribute

Corrections, clearer explanations, and tested examples are welcome. Open an
[issue](https://github.com/thruputchain/thruput-docs/issues) or submit a pull request.

If you do not have write access, fork the repository and open a pull request
against `main`. Contributors with write access can use repository branches.
All changes require a pull request and passing CI. Maintainers select reviewers
manually; core maintainers can waive review approval when merging a pull request.

| What you want to change | Where to look |
| --- | --- |
| Documentation pages | [src/content/docs/](src/content/docs/) |
| Documentation navigation | [src/navigation.ts](src/navigation.ts) |
| Landing page and standalone pages | [src/pages/](src/pages/) |
| Shared components and styles | [src/components/](src/components/) and [src/styles/](src/styles/) |

Prefer improving an existing page. New documentation pages need `title` and
`description` frontmatter and an entry in `src/navigation.ts`. Use links such as
`/get-started/cli/` in Markdown; the build adds the hosted `/docs` prefix.

Verify API examples and protocol claims against the release they describe.
See [AGENTS.md](AGENTS.md) for writing conventions and source verification rules.

Before submitting a change, run:

```sh
pnpm test
pnpm astro check
pnpm build
```

For interface changes, also run the [browser checks](MAINTAINING.md#validation).
Publishing, Markdown exports, and CLI snapshot procedures are in
[MAINTAINING.md](MAINTAINING.md).

## License

[Apache License 2.0](LICENSE).

Bundled font notices are in [public/font-licenses/](public/font-licenses/).
For vulnerability reports, see [SECURITY.md](SECURITY.md).
