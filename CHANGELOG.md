# Changelog

Published releases, newest first.

## 1.0.1

- Add smaller hex textures with 8% shading, random 70–80% size and 0–60° rotation. Seed each tile by map name for a consistent appearance.
- Give minion and hero spawn textures a 1 px light border, beneath unit icons.
- Add a default-on Board texture toggle under Settings → Appearance; remember the preference and apply it immediately.

## 1.0.0

- Show your played card above action choices and confirmation menus, with an eye icon on Board.
- Move board-selection instructions into the message bar and put Undo and optional Skip on the left. Keep native action handlers and fit menus to the visible viewport.
- Add a CSS ticker for overflowing action text: advance, pause, reset, pause. Keep the phase and dot still and respect reduced motion.
- Tap the message bar to expand it to three rows; tap elsewhere to collapse it. Support keyboard expansion without triggering game shortcuts.
- Capitalize the disconnect message as “Reconnecting”.
- Shorten README while preserving installation instructions. Consolidate release notes and remove separate preview entries.

## 0.23.0

- Add defense to tree cards, put Tier 1 on its own row and right-align Tier 2/3 below it. Keep shared headings and consistent spacing; stop connectors at card edges.
- Keep Gold, Silver and a compact Ultimate together in a centered row. Show Ultimate as a three-cell card with a bold U.
- Highlight the card shown in the viewer with an animated white gradient. Use CSS only and respect reduced motion.
- Open other heroes’ revealed current cards when their deck is masked. Preserve hidden-card protection and reserve enough space for H/P/D indicators in both orientations.
- Close Deck through its native handler and time out stalled decision-history requests after 15 seconds.
- Refactor into explicit ES modules with checked dependencies and an esbuild userscript bundle; remove obsolete code and styles.

## 0.22.0

- Join the header and message bar without a pixel gap.
- Fit Report a bug and Fix game state to the visible phone viewport, including keyboard changes, while preserving native forms and actions.
- Remove the Board take-back popup while retaining the control in Hand.
- Replace completed roadmap items with remaining work.

## 0.21.0

- Add phone landscape panes: Card Viewer on the left, lists on the right and navigation at the far-right edge. Adapt Deck, level-up, Settings, Log and starting-position controls.
- Keep board geometry, pan and zoom stable across view changes and rotation. Center the map in the clear left area.
- Add supported-browser Fullscreen controls and portrait-based hero centering at 250%.
- Refine landscape header counters and stack board controls on the left.
- Darken locked upgrade alternatives and keep card dots plain, with inspection and active-effect highlights.

## 0.20.0

- Add the level-up tree with Tier 2/3 counts, lower-tier prerequisites and complete-only Commit. Submit choices through native handlers, waiting for each acknowledgement.
- Keep Preview separate from staged upgrades. Use gold for staged choices and purple for preview plans, with item totals, Reset and Commit at the bottom.
- Pause interrupted or uncertain submissions without automatic retries; retain the native picker when integration data is insufficient.
- Fit level-up to the full view with a reserved Card Viewer. Show printed stats and paired grants for known own cards, and align standard/alternate paths consistently.

## 0.19.2

- Move Log into the footer, separating locally received events from player-scoped server decision history. Preserve hidden-card masking and cancel stale requests.
- Group Settings into Appearance, Game and Tools. Add saved artwork and font-size preferences, sound/volume controls and supported fullscreen.
- Add tappable and hoverable setting explanations, including defaults, persistence and reload requirements.

## 0.19.0

- Add Deck trees with per-game/hero build plans, observed choices, paired item grants and projected item totals. Planning does not submit game actions.
- Distinguish current cards, future plans, acquired items and rejected/replaced alternatives. Retain observed choices across tier replacements and release them after undo.
- Make Tree the default Deck view, followed by List and Grid; migrate older saved preferences.
- Add Ultimate indicators and shared card-viewer sizing. Refine empty icon slots, inline rule icons, preview controls, header counters and footer spacing.

## 0.18.0

- Consolidate component styles and add CSS formatting and cascade checks.
- Keep action proxies synchronized with native text, disabled states and replacement controls, without unnecessary redraws or refresh loops.
- Improve artwork retries and readable fallbacks; clean up obsolete Deck controls and restore native views on deactivation.
- Preserve event-history writes and game isolation, reject malformed entries and prevent trimmed events from returning to the archive.
- Refine off-board portraits, tier alignment, safe-area spacing and header/Board surfaces.

## 0.17.0

- Slim the header and overlay values on lives, minions, push and coin icons. Count surviving minions still on the board.
- Add a translucent phase/action strip with connection warnings and a fixed pulsing dot.
- Float Board summaries and focused heroes over the map. Add turn-ordered portrait switching and a return control.
- Remove black backgrounds from portrait initiative badges.

## 0.16.0

- Add faded, blurred artwork to Large cards and Small Hand rows while keeping text sharp and preserving plain fallbacks.
- Enlarge Large-card title/body icons and center tier labels.
- Add matching tier stripes to Small/Mini cards and tier edges to Micro/Nano cards without changing their size.

## 0.15.0

- Align Board overview columns for turn/status, names, level/gold, card piles, current card and upgrades. Keep resolved cards visible but faded.
- Add card inspection and focused heroes from the Board overview; share compact hero entries across Board, Heroes and Hand.
- Reserve Turn 1–4 and Discard history slots, with compact defense cards and active-effect highlights.
- Keep multi-figure heroes on-board while any owned figure remains. Render supported rule icons and preserve known own committed-card details without revealing opponents’ facedown cards.
- Fix compact-card sizing, colors, spacing and focus navigation.

## 0.14.9

- Align resolved Board rows and upgrades. Keep the local hero above Hand while omitting duplicate local hand cards from Heroes.
- Replace Large Deck with Compact rows and an independently scrolling card preview; migrate saved preferences.

## 0.14.8

- Make Board the default view, with toggle tabs for Heroes, Hand, Deck and Settings.
- Overlay card details above Heroes/Hand lists, keep Settings in the lower pane and make Deck full-screen. Keep Setup contextual.

## 0.14.7

- Reserve card-inspection space in Heroes and Hand and add compact hero metadata, history and upgrade rows.
- Add top-left choice launchers, level-up selection status and distinct printed/awarded upgrade icons.
- Preserve hidden-card protection in the compact Board overview.
