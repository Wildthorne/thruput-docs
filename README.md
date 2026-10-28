# Project Thruput documentation

Source for the [Project Thruput website](https://www.thruput.network/) and
[developer documentation](https://www.thruput.network/docs/). The site is built with
Astro and Starlight and published as static HTML, with Markdown exports and
offline documentation for the Thruput CLI.

## Run locally

Use Node.js 22 and the pnpm version specified in [package.json](package.json).

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
