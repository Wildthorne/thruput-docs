# GH-453: Markdown and page actions

## Implementation

Integrated Markdown producer commit `6ec960d` from `gh-459-markdown-export` into
the current developer-site branch without creating a commit. The exporter now
uses the updated guide structure and preserves explicit redirect-fragment mappings.

Documentation pages have one title-area **Agent tools** disclosure with a robot
icon. It contains Copy page, the Markdown link, task prompt where present,
Markdown view, and agent setup. A successful copy briefly changes the clicked
item's label to **Copied**. There is no status footer or reserved space, and the
dropdown and article keep their positions. Task prompts are extracted from the existing page source. The
controls use native buttons, links, disclosure, and dialog elements.

Successful copies show a short confirmation. Clipboard denial opens a dialog
with selected text. Fetch failures show a retry message. Escape closes the
disclosure and returns focus; the manual-copy dialog also restores focus.
Navigation links work without JavaScript. Local snapshot links and copied task
prompts use the loopback origin.

Build outputs include 91 page exports, section bundles, a portable index, full
bundles, assets, provenance, and HTML alternate links. The CLI export contains
103 Markdown files including bundles and the standalone agent guide.

## Verification

- `pnpm test`: 17 checks passed.
- `pnpm test:browser`: all 53 checks passed, including eight page-action checks.
- `npx astro check`: no errors, warnings, or hints.
- `python3 -m unittest discover -s scripts -p 'test_*.py'`: three packaging checks passed.
- `pnpm build:snapshot`: passed.
- `node scripts/smoke-snapshot.mjs /home/chambaz/Work/groundhog-rpc/target/debug/groundhog`: passed using the local GH-459 CLI build. Verified portable links, representative code preservation, local page links and task prompts, Markdown MIME type, search, desktop/mobile, and no external browser requests.
- Reviewed light/dark screenshots at 320px and 1280px. The full shell suite also covers widths through 1920px.

The first full browser run found that the heading-anchor test included the new
closed dialog's heading. It now tests article headings within
`.sl-markdown-content`. All existing article-anchor checks remain active.

## Publication dependencies

Released CLI 0.22.1 does not expose `groundhog skill` or `groundhog docs export`.
The integrated agent setup copy targets the GH-459 CLI work. Coordinate its
publication with that CLI release. The local-build smoke is not a released-CLI
verification claim.

Unauthenticated probes to hosted `/llms.txt` and `/get-started/` with
`Accept: text/markdown` returned HTTP 401. The current Caddy configuration
protects all paths except `/health`, including exports. Authenticated hosted
delivery still needs verification after deployment.

Explicit Markdown URLs remain the supported baseline. Content negotiation is
deferred; any later implementation must preserve authentication and return
`Content-Type: text/markdown` with `Vary: Accept`. No hosting bypass or deployment
was introduced.
