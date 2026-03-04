# Groundhog Developer Docs

Developer documentation for the [Groundhog](https://groundhogchain.dev) L1 blockchain. Built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build).

## Development

```bash
pnpm install       # Install dependencies
pnpm dev           # Dev server at localhost:4321
pnpm build         # Production build to dist/
pnpm preview       # Preview production build locally
```

## Content

Markdown files live in `src/content/docs/`, organized by section. The sidebar is manually configured in `astro.config.mjs`.

| Section | Path | Description |
|---------|------|-------------|
| Concepts | `start/` | Background guides by developer archetype |
| Tutorials | `start/`, `tutorials/` | Getting Started + step-by-step contract builds |
| Tools | `tools/` | TypeScript SDK, block explorer, wallet, faucet |
| How It Works | `how-it-works/` | Architecture, execution model, contracts |
| Reference | `reference/` | Storage types, syscalls, SDK macros, error handling |
| Migration Guides | `migration/` | Stellar, EVM, Solana migration paths |
| Community | `community/` | Contributing, security, roadmap |

## Adding a Page

1. Create a `.md` file in the appropriate `src/content/docs/<section>/` directory
2. Add frontmatter with `title` and `description`
3. Add the slug to the sidebar array in `astro.config.mjs`
4. Run `pnpm build` to verify
