# Changelog

Published releases, newest first.

## 1.2.0

- Add shared hero-board indicators in place of **Played:** when present: yellow
  Bounty and green Poison labels, alongside Gydion's spell counter. Three or more
  indicators shorten the current card's name area while keeping the row height.
- Show Gydion's portrait behind spell-colored dice pips through nine cast spells,
  then a number. Every player can open and inspect his public cast-spell list.
- Reserve one compact Board indicator slot: B/P circles for single markers,
  Gydion's icon and spell count, or a purple combined indicator count.
- Show the owning Gydion player's prepared spellbook by rank and public cast
  spells in all Deck layouts, with complete landscape spell faces for inspection.
  Preserve count-only opponent spellbooks and native card state.

## 1.1.3

- Preserve compact-row scroll and keyboard focus while countdowns update. Reconcile clock text, urgency and running state in place, including transitions back to resolution order.
- Synchronize Position/Done with native starting-position adjustment, including Back and native Done. Retire mobile navigation history entries when the layout deactivates.
- Show both of Emmitt's committed cards: two initiative-bearing Micro cards in Heroes and two Nano cards in the compact Board list, each centered in its own half. Preserve independent inspection, upgrades, active-effect highlights and hidden-opponent boundaries; handle either committed slot remaining after retrieval.
- Match the skill/defense artwork's visual size to the shield without enlarging its value overlay.
- Use initiative-bearing Micro cards without an upgrade cap for Tier 1 Deck cards and basics; retain item-grant slots on Tier 2/3 cards.
- Expand regression coverage for timed navigation, desktop/mobile transitions, Emmitt and Gydion data boundaries, and two-card commitment transitions.

## 1.1.2

- Present discard decisions as Hand-style cards with a separate confirmation button, preserving native submission and Board-peek controls.
- Show printed + and ! notation for primary card values and range/radius modifiers across card sizes. Apply known item upgrades without losing the printed suffix; Nano discards use the appropriate defense or skill/defense icon.
- Show animated dots while upgrading and checkmarks when committed. Hero boards show Upgrading... or Committed ✓ in the status slot, and replace Selected with Committed ✓ during planning.
- Keep upgrade completion current when private offers disappear, using native turn eligibility and unambiguous public waiting names where available.
- Record planned Gydion spell displays and shared hero-specific/marker areas in the roadmap.

## 1.1.1

- Keep same-initiative heroes grouped by team during resolution. Show each team's earliest predicted position on one hero and TIE on their teammates; later groups still account for every tied hero.
- Predict coin flips across remaining initiative groups, preserving the server's selected actor and recalculating from current game state. Show ties in both hero portraits and the compact list; running clocks still take precedence.
- Read resolution data even when the native queue is collapsed.

## 1.1.0

- Show timed-match clocks after hero names as phase allowance / bank, using the native synchronized values. Replace locked planning clocks with a dash.
- Show each hero's relevant countdown in the compact Board status slot, switching to the bank once the phase allowance is exhausted. Use a checkmark for locked cards; during resolution, retain turn order and completion marks unless a timer is running.
- Replace the Setup footer tab with a Position button on Board that opens native starting-position adjustment directly.
- Fit pause votes and paused-match readiness dialogs into the mobile layout while preserving native controls.
- Show known card details in Deck regardless of their facedown commitment state. Hero views display only committed cards, not a highlighted Hand selection.

## 1.0.6

- Give active H/P/D dots a slightly larger breathing glow with a 10% minimum intensity, and breathe their colour to 20% lighter at the peak. Preserve reduced-motion behaviour.

## 1.0.5

- Back also dismisses card views and decision dialogs, using native Board-peek/close controls without choosing or undoing a game action.
- Add saved Small/Tiny Hand-card sizes, remove the Hand heading, and centre the committed message and Take back button in equal-width sections. Keep Commit in place.
- Give Deck the same header and Board/list layout as Hand and Heroes in portrait and landscape. Inspect cards over the Board in every Deck mode; keep the landscape list clear of the header.
- Move Tree/List/Grid controls into a shorter bottom bar with Tier/Color labels above a horizontal switch. Add a saved bar visibility setting and view/sort choices in Settings. Centre Preview and Reset within their sections.

## 1.0.4

- Remove native keyboard hints from Board button labels, so Undo appears as “Undo” instead of “Undo U” and retains its amber styling and position. Preserve native availability and rollback handlers.

## 1.0.3

- Open Hand from your hand dots or H/P/D indicators on Board; open Deck from your upgrade icons.
- Add subtle translucent grey shortcut borders without shifting the dots, icons or hero layout. Keep compact buttons at Micro card height and reserve five hand-dot slots in the expanded hero.
- Device/browser Back closes the selected menu and returns to Board. Switching menus uses one history entry; closing through the footer or native Deck controls clears it.

## 1.0.2

- Tapping your current card on Board reopens Options while its action choice is pending.
- Keep the played card at its usual width and minimum height in action-selection menus; scroll the whole menu rather than compressing the card body.
- Show attack and movement options with stat icons and values. Remove zero values from Hold and Clear while preserving native controls.

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
