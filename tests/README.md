# Regression coverage

Run `npm ci` once, then `npm test`. The command rebuilds the userscript and runs
all 40 `test-*.cjs` files in separate Node processes, each with a 30-second timeout.
Failures retain their assertion stacks; the runner lists failed filenames at the end.

To investigate one file, build first and run it directly:

```sh
npm run build
node tests/test-lifecycle.cjs
```

The newer fixtures use named `node:test` scenarios and cleanup hooks. Existing
fixtures retain their assertions and standalone execution, with expanded formatting
so stack traces identify individual assertions. The shared
[`helpers/browser.cjs`](helpers/browser.cjs) creates synthetic jsdom pages and can
expose selected private functions inside the evaluated test copy of the built bundle.
These hooks are not added to production output. Tests do not contact a live game.

## Formatting

```sh
npm run test:format
npm run test:format:check
npm run css:format:check
```

Prettier is pinned and configured by [`.prettierrc.json`](.prettierrc.json). It formats
test JavaScript and helpers; the frozen painter fixture is excluded. The stylesheet
has its own formatting commands. CI runs both formatting checks, build comparison,
and regression suite.

## Coverage map

This is a map of asserted behaviors, not a line or branch coverage percentage.
The suite evaluates the userscript in jsdom; some fixtures inject hooks into that
copy, and canvas/image/font APIs are simulated where needed.

| Source / behavior | Regression files | Assertions |
| --- | --- | --- |
| ES module dependency contracts | [modules](test-modules.cjs) | Missing application imports, writes to imported bindings, shared state properties, module-local shadowing and missing owner exports; every source module checked during each build |
| `bootstrap.js`, `runtime.js`, `ui.js`, `navigation.js`: installation and panes | [2d](test-2d.cjs), [board-toggles](test-board-toggles.cjs), [lifecycle](test-lifecycle.cjs) | 2D guard, reinjection, pane toggles, native Deck unmount and footer close/reopen, missing sidebar, mobile/desktop/3D transitions, original native attributes, teardown and reinstall |
| `main.js`: reconciliation and events | [native-sync](test-native-sync.cjs), [review-fixes](test-review-fixes.cjs), [lifecycle](test-lifecycle.cjs) | Native text/src/disabled/class changes, replacement and removed actions, stable artwork/dismiss button, no idle feedback, detached-node bookkeeping, frame coalescing, viewport offsets, cancellation and listener/timer cleanup |
| `react.js`: committed React props | [react-props](test-react-props.cjs), [review-fixes](test-review-fixes.cjs) | Obsolete host pointer, new `root.current` without a refresh, removed hosts, sibling hosts, isolated roots, missing/null/falsy props and ancestor limit |
| `cards.js`: card presentation | [unified](test-unified.cjs), [mobile-rows](test-mobile-rows.cjs), [compact-overview](test-compact-overview.cjs), [large-artwork](test-large-artwork.cjs) | Shared text-card controls, printed/upgraded values, compact stat order and empty slots, hidden-card privacy, artwork ownership/path guards, load/error fallback and tier edges |
| `heroes.js`: dashboards and selection | [hero-dashboard](test-hero-dashboard.cjs), [expanded-hero](test-expanded-hero.cjs), [portrait-status](test-portrait-status.cjs), [selection-status](test-selection-status.cjs), [roadmap-lists](test-roadmap-lists.cjs) | Off-board transitions, image-only grayscale, active effects, visible history/discard slots, own selection/commit versus opponent secrecy, selection animation, completion status, Razzle figure ownership and inline rule icons |
| `heroes.js`: upgrades and choices | [upgrade-layout](test-upgrade-layout.cjs), [choice-status](test-choice-status.cjs), [review-fixes](test-review-fixes.cjs) | Paired upgrade item, printed choice stats, native selection handlers, choice status/proxy stability, live inspection updates, Escape cleanup |
| `upgrade-tree.js`: level-up selection | [upgrade-tree](test-upgrade-tree.cjs) | Known face-down deck stats/grants without native mutation, reserved Card Viewer and full-screen/bottom controls, gold/purple totals, basic omission, A/B ordering, tier quotas/prerequisites, edit/deselect/reset, isolated Preview, native paired-item totals, complete-only Commit, fresh callbacks/options per acknowledgement, timeout and external changes, mobile/game lifecycle and native restoration |
| `board.js`, `header.js`: summaries, focus and header | [floating-hud](test-floating-hud.cjs), [roadmap-lists](test-roadmap-lists.cjs), [compact-overview](test-compact-overview.cjs) | Disconnect/reconnect strip and stable dot, coin casing, surviving minions, focused hero switching/back, ordered highlighted portraits, summary/status columns |
| `controls.js`, `main.js`: planning and resolution | [planning-layout](test-planning-layout.cjs), [resolution](test-resolution.cjs) | Status text, take-back placement/native click, resolution queue and stat presentation |
| `camera.js`: gestures | [rotation](test-rotation.cjs) | Two-touch rotation, fit transform composition, pointer-up/cancel, native reset, native transform change and cleanup |
| `camera.js`: hero shortcuts | [hero-centering](test-hero-centering.cjs) | Portrait clicks retain Heroes mode; focused entry/portrait double-click, 250% native zoom from different starting scales, current rotation, native clamp correction, owned figures, absent/off-board data, no tile actions or swallowed clicks, pending Reset/teardown cancellation |
| `card-rows.js`: card dots | [card-dots](test-card-dots.cjs) | Plain colored circles across tiers and piles, unchanged sizes, retained active glow and card inspection, hidden-card privacy and effect reconciliation |
| `deck.js`: browser and preferences | [deck](test-deck.cjs), [deck-preferences](test-deck-preferences.cjs) | Tier/color grouping, Tree/List/Grid and previews, printed stats, native canvas retention, all saved view/sort combinations, legacy migration, corrupt/unavailable storage and persistence across installations |
| `deck-tree.js`: upgrade paths and planning | [deck-tree](test-deck-tree.cjs) | Five-slot Extended Micro cards, printed values and paired-alternative grants, tier/alternate placement, Large Gives footers, acquired/planned stat totals, one-row controls, preview and tentative selection, locked game choices, rebuild/reopen/reload, hero/game isolation, rollback/native eligibility, one upgrade-request discovery per refresh across roster/Deck/focus, malformed or failed storage and shared viewer heights, five card states and basic-card wrapping |
| Revealed hero card inspection | [hero-inspection](test-hero-inspection.cjs) | Other heroes' revealed Tier II/III current cards open from Board, Heroes and Board focus with masked count-only decks; current item bonuses, close controls, hidden-card protection and no invented paired grants |
| Shared Deck/level-up tree presentation | [upgrade-tree](test-upgrade-tree.cjs) | Identical path geometry, A/B slots and paired grants; Deck planning cannot stage native upgrades, upgrade staging/Preview/Reset cannot write saved Deck plans, and neither view submits before Commit |
| Ultimate presentation | [ultimate-indicators](test-ultimate-indicators.cjs) | Reserved Small/Mini/Extended Micro initiative cells; centered Nano U and compact dot; level 8 unlock/relock, retained item slots and reduced-motion glow |
| `deck.js`, `painter.js`: drawing and recovery | [deck-redraw](test-deck-redraw.cjs), [deck-recovery](test-deck-recovery.cjs), [painter-cleanup](test-painter-cleanup.cjs) | No idle redraw, native draw triggers copying, bounded zoom copies, restored canvas methods, sprite/font/background retries, staged fallback, reconnect during pending work, invalid/removed source cleanup and unchanged canvas commands for 72 variants |
| `history.js`: persistence and boundaries | [saved-log](test-saved-log.cjs), [history-recovery](test-history-recovery.cjs), [history-boundaries](test-history-boundaries.cjs), [review-fixes](test-review-fixes.cjs) | Pagehide capture, duplicate polling, reload/ID restart, per-game isolation and stale-array quarantine, queued writes across navigation/read failure, native empty-log restoration, 2,000-event cap without idle churn and malformed stored/live data |
| `log.js`: footer/server history | [log-panel](test-log-panel.cjs) | Footer order, archive/live deduplication, masked server labels, player token scope, request coalescing/cooldown, stalled request/body timeout and retry, ETags, rewinds, error fallback, link/game isolation and stale-request cancellation |
| `settings.js`: appearance/game preferences | [settings](test-settings.cjs) | Grouped controls, default-on art, center font scaling/reset, unchanged board/touch geometry, restored/corrupt/unavailable storage, native cursor/sound keys, live tool availability/replacement, supported fullscreen, tappable/hover help with unchanged preferences and teardown |
| Phone landscape: panes and lifecycle | [landscape](test-landscape.cjs), [upgrade-tree](test-upgrade-tree.cjs) | Explicit landscape media branches, full Board with floating summaries, left viewer/right lists, scrolling navigation rail, centered coin/map disconnect strip, stable map geometry and native transforms across modes, shared fullscreen state/failure handling, Settings/Log/setup bounds, Tree/List/Grid placement, gated upgrade controls, rotation with unchanged native nodes/selection/actions, wide-phone versus tablet/desktop activation and visual viewport offsets |
| `styles.css`: asserted layout rules | [css-cascade](test-css-cascade.cjs), [large-artwork](test-large-artwork.cjs), [roadmap-lists](test-roadmap-lists.cjs), [floating-hud](test-floating-hud.cjs), [board-toggles](test-board-toggles.cjs) | Unique nonempty definitions, bold white overlays, gutters, state colors and card sizing across containers, explicit narrow/short/reduced-motion branches, footer touch-target geometry, opacity/blur, tier stripes, pane visibility and transparent portrait badges |

## Remaining boundaries

jsdom does not verify rendered pixels or native touch behavior. Check blur/compositing,
text clipping, card artwork/fonts, browser chrome/keyboard movement and two-finger
gestures on Android Firefox. The rotation regression covers one two-touch sequence;
three-touch transitions and real device cancellation remain manual checks.

The React tests use synthetic committed trees. Live website changes to fiber shape,
CSS-module names and supplied prop schemas still require compatibility checks.
Asset/API failures are simulated; real network/CORS behavior, private live-game history,
sound playback, fullscreen and reload application remain manual checks.

[`fixtures/goa2-mobile-2d-v0.14.2.txt`](fixtures/goa2-mobile-2d-v0.14.2.txt) is a frozen
baseline for painter command comparison. It must not be rebuilt from current source.
