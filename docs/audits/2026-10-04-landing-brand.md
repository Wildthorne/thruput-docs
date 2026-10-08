# GH-455 and GH-457: Landing page and brand review

## Review surfaces

- `/`: revised technical landing page, compact prompt preview, direct copy,
  shared-state illustration, developer workflow, and grouped footer.
- `/architecture/`: documentation typography, header, badge, sidebar, and TOC.

The user selected the pixel bolt and sans-serif navigation during review. Both
are now the site defaults, with a matching pixel favicon. Headings and code
retain monospace. The header uses the exact `alpha-pre.1` badge, with a compact
mobile arrangement.

THRUPUT remains the existing header wordmark. The hero identifies Groundhog as
the Layer 1 project without introducing an unverified company/product claim.

## Content checks

The narrative follows the Introduction, Parallel Execution, and Compute,
Capacity & Storage pages. The counter illustration is explicitly illustrative,
with compatibility and network-limit qualifications.

Source checks used:

- `groundhog-examples-guides/contracts/counter/src/implementation.rs`: exact
  increment method shown in the code example.
- `groundhog-hogd/hogd/hog_db/item_lock/nnint128_lock.cc`: base compatibility,
  delta bounds, and committed delta application.
- `groundhog-hogd/hogd/hog_mempool/scheduler.cc`: root declared gas limit in
  scheduling accounting.
- `groundhog-hogd/hogd/hog_db/item_lock/balance_lock.cc`: storage-backed balance
  accounting and committed storage credits.
- `docs/programming-model/`: working-model review alongside those sources.

No throughput figures, other-chain comparisons, or unlimited-resource promises
were added. The homepage code example is a method excerpt, not a full contract.

Footer destinations use the current documentation routes and confirmed GitHub
repositories: `groundhogchain`, `developers-site`, `groundhog-rpc`, and
`agent-skills`. GitHub API checks confirmed the docs and RPC repositories and
their issue trackers. Unverified social, email, and security-report destinations
were not invented.

## Interaction and validation

The prompt comes from the existing onboarding source. Its preview button opens
one dialog containing the full selectable prompt and outcome. Direct copy works
without opening the dialog. Clipboard denial opens the dialog and selects the
text. Keyboard checks cover Tab containment, Escape, close, and focus return.

- Browser checks cover responsive shells from 320px to
  1920px, light/dark docs, links, Markdown content, and
  reduced-motion behavior.
- A final dialog-centering adjustment passed both targeted 320px/1280px tests.
- All 17 script checks and three packaging checks passed.
- Astro diagnostics: no errors, warnings, or hints.
- Production/snapshot builds and the real GH-459 CLI snapshot/export smoke passed.
- Reviewed homepage, documentation, and prompt-dialog captures.

Logo and navigation type are approved. The user requested a checkpoint commit;
further homepage review is ongoing. Hero feedback removed the eyebrow and preview
note, grouped “for abundance” on one line, and put “Compute without gas fees.”
on a separate line. Guided links remain below the prompt. Section headings use
1.25 line height, the wide-screen hero has 4rem top padding, and the prompt has
3rem top margin. Final validation results and the commit identifier are recorded
in Linear.
