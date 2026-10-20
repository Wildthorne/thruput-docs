# Stellar Thruput brand assets

The Stellar wordmark and symbol come from the official Logo Press Kit 2026.
The SVG paths were exported from `Stellar Logo Final Black CMYK.pdf` with
`pdftocairo -svg`. The viewBox removes print margins; the paths are unchanged.
`stellar.svg` uses black. `stellar-dark.svg` uses bone. The favicon uses the
symbol paths and follows the system color scheme.

## Shared conventions

Use Inter Variable for headings (500), body text (400), and small UI labels
(600). Use Inconsolata Variable for code, numbers, balances, and system labels.
Self-host the fonts through Fontsource with `font-display: swap`. Unicode ranges
let the browser load only the subsets used on the page.

| Role | Dark | Light |
| --- | --- | --- |
| Canvas | `#0A0A0A` | `#F5F5F0` |
| Surface | `#111111` | `#FFFFFF` |
| Primary text | `#F5F5F0` | `#0A0A0A` |
| Secondary text | `#A8A8A8` | `#626262` |
| Border | `#2C2C2C` | `#D6D6D0` |
| Signal yellow | `#FDDA24` | `#FDDA24` |
| Text on yellow | `#0A0A0A` | `#0A0A0A` |
| Accent text / focus | `#FDDA24` | `#705C00` |
| Accent tint | `#433B10` | `#FFF3B3` |
| Live status | `#30A46C` | `#18794E` |

The dark palette comes from marketing. The light palette is derived from it,
with stellar.org as a reference. Use dark text on yellow buttons in both themes.
Do not use signal yellow as body text on a light background. Keep error and
warning colors distinct from the brand accent.

Source references: [GH-533](https://linear.app/grndhg/issue/GH-533).
