# Changelog

Published releases, newest first. Each entry groups user-visible changes and fixes. Local previews 0.14.10–0.14.18 are included in 0.15.0; 0.15.1–0.15.11 are included in 0.16.0; 0.16.1–0.16.9 are included in 0.17.0; 0.17.1–0.17.2 are included in 0.18.0; 0.18.1–0.18.6 are included in 0.19.0; 0.19.3–0.19.5 are included in 0.20.0; 0.20.1–0.20.9 are included in 0.21.0.

## 0.21.0

### Added

- Add a phone landscape layout with a full-width board, floating lists on the right, a Card Viewer on the left and navigation at the far-right edge. Keep the map centered in the clear left area across view changes and Reset.
- Adapt Deck, level-up, Settings, Log and starting-position controls to landscape panes, respecting safe areas and viewport offsets.
- Add a supported-browser Fullscreen toggle below Reset, synchronized with Settings and external fullscreen exits.
- Center the map on a hero at 250% using portrait clicks in Heroes or double-clicks in focused Board entries, retaining current rotation and Heroes mode.

### Changed

- Use a slim 27px landscape header, with icon/label pairs shifted down 5px and painting above the phase/action strip. Place Round/Turn and push counters beside the centered coin; pair minions with lives in both orientations.
- Move the landscape phase/action/disconnect strip to the top of the map. Stack Reset, Fullscreen and temporary choice/upgrade buttons on the left.
- Keep card dots plain, with active-effect glow and known-card inspection.
- Include local previews 0.20.1–0.20.9.

### Fixed

- Darken locked same-tier alternatives of current upgrades in Deck and level-up trees. Preserve older item history, native item totals and future-tier choices.
- Keep native map geometry, zoom and pan stable when switching landscape views; restore portrait layout on rotation.

### Validation

- Cover landscape geometry, orientation changes, native control preservation, fullscreen lifecycle, hero centering, plain-dot privacy/effects, header stacking and locked upgrade alternatives.
- All 38 regression files, test/CSS formatting, generated-file and whitespace checks pass.
- Real phone rendering, browser chrome and touch gestures remain device checks.

## 0.20.0

### Added

- Add the Deck-style level-up tree with separate Tier 2/3 selection counts, lower-tier prerequisites and complete-only Commit. Keep Preview isolated from staged upgrades and submit through refreshed native callbacks, waiting for each acknowledgement.
- Retain the native menu when integration data is insufficient, pause interrupted or uncertain batches without automatic retries, and clear local staging on game/player/round changes.

### Changed

- Fill the view like Deck, center the Upgrades heading and reserve the shared Card Viewer space. Keep the tree scrollable with centered help above bottom Preview/Reset controls and a full-width Commit button.
- Use gold borders and changed totals for staged upgrades; use purple for isolated preview plans. Turning Preview off clears those plans and preserves staged selections.
- Include previews 0.19.3–0.19.5.

### Fixed

- Restore printed stats, initiative and paired item grants for known own cards carrying face-down deck flags, without mutating native cards or exposing unknown hidden cards.
- Align standard/alternate cards across tree tiers using shared artwork markers, without hero-specific adaptations.

### Validation

- All 35 regression files, formatting checks, generated-file checks and whitespace checks pass. Phone layout and live multiplayer upgrade flows remain manual checks.

## 0.19.5 (local preview, included in 0.20.0)

### Changed

- Remove the redundant Clear preview button. Turning Preview off clears preview plans and preserves staged upgrades.
- Center help/status text immediately above the bottom Preview/Reset and Commit controls.

## 0.19.4 (local preview, included in 0.20.0)

### Fixed

- Show printed stats, initiative and paired item grants for known own upgrade cards even when their deck-zone flag is face down. Keep native objects and hidden-card protections unchanged.
- Fill the available view like Deck, center the Upgrades heading and reserve the shared Card Viewer height while empty. Scroll the tree independently of the viewer and bottom controls.
- Move Preview and Reset to a compact bottom row with totals, and make Commit full width. Use gold for staged upgrade borders and changed totals outside Preview; isolated preview plans remain purple.

### Validation

- Add realistic face-down deck fixtures and regressions for printed stats/grants, unchanged native flags, reserved viewer geometry, bottom controls, native Board handlers and gold/purple totals.
- All 35 regression files, formatting checks, generated-file checks and whitespace checks pass. Device layout and live multiplayer upgrades remain manual checks.

## 0.19.3 (local preview, included in 0.20.0)

### Added

- Replace level-up choices with Extended Micro trees, omitting basics and Ultimate and showing separate required Tier 2/3 selection counts. Gate Tier 3 on the complete lower-tier selection and clear dependent selections when Tier 2 changes.
- Keep Preview as an isolated toggle with projected item totals. Commit requires Preview off/cleared and a complete legal batch; submit through the native callback once per acknowledged, newly eligible choice.
- Pause uncertain submissions without retries, clear local staging on game/player/round or menu changes, and retain the native picker when integration data is insufficient.

### Fixed

- Align standard and alternate cards on consistent rows in both Deck and level-up trees using shared A/B artwork markers, without hero-specific card adaptations.

### Validation

- Cover mixed-tier batches, native callback/acknowledgement boundaries, Preview isolation, paired grants, selection editing, external changes, timeout, teardown and reversed source ordering.
- All 35 regression files pass; additional upgrade/Deck checks cover ambiguous pools, interrupted batches and retained item history. Formatting and generated-file checks pass. Live multiplayer level-up and phone layout remain manual checks.

## 0.19.2

### Added

- Add info icons beside every appearance/game setting, with tappable explanations and label/icon hover help. Keep help separate from the switches so reading an explanation never changes a preference; allow one explanation at a time and Escape to close it.
- Explain defaults, font-step multipliers, immediate changes, saved preferences and Apply & reload requirements.
- Include the 0.19.1 preview: footer Log with server decision history and refined Settings with artwork, typography, sound, cursors and fullscreen controls.

### Validation

- Cover help accessibility, opening/closing, unchanged preferences, retained help during refresh and hidden unsupported fullscreen help.
- Settings, resolution and CSS regressions pass (12 checks); formatting and generated-file checks pass.

## 0.19.1 (local preview, included in 0.19.2)

### Added

- Move Log into the footer before Settings. Separate locally received events from server decision history, with earlier choices and undone decisions retrieved through the player-scoped REST API. Preserve hidden-card masking, support conditional requests, and cancel stale requests when closing, changing links or tearing down.
- Replace the rough Settings panel with grouped Appearance/Game/Tools controls. Add default-on card artwork, a centered font-size slider with 0.95/1.1 step multipliers and a Default reset, native sound/volume preferences, and supported fullscreen controls.
- Keep appearance preferences immediate and persistent. Native sound/cursor preferences use Apply & reload; tool actions remain native proxies with availability checks.

### Validation

- Add regressions for footer order, server history, authorization scope, conditional requests, rewinds, failed responses, stale-request cancellation, preferences, typography/geometry, artwork toggling, tool proxies, fullscreen and teardown.
- All 34 regression files and formatting checks pass; generated userscript/TXT match source. Live private-game history and device sound/fullscreen remain manual checks.
- Full event-delta backfill remains unavailable: the API exposes decision history, not historical combat events.

## 0.19.0

### Changed

- Make Tree the default Deck view, followed by List and Grid. Rename Compact to List, remove the old full-card List renderer and its CSS, and migrate its saved preferences to the new List.
- Include the 0.18.1–0.18.6 previews: Deck trees with persistent build planning and five card states, paired item grants, item-stat previews, Ultimate indicators and consistent card viewer sizing.
- Refine Deck/header controls, floating Board surfaces, Large-card icon spacing, the single-row Preview and footer geometry.

### Validation

- Cover the default view and option order, saved preference migration, view switching, printed-card details and Grid canvas synchronization.
- All 32 regression files and formatting checks pass; generated userscript/TXT match source.

## 0.18.6 (local preview, included in 0.19.0)

### Changed

- Match the Deck control row to the main header height and remove its extra top inset.
- Increase the shared card viewer height by 3% across Board, Heroes, Hand and Deck, including short screens.
- Flatten the build Preview into one row with its label on the left, stat icons centered and Reset on the right.
- Remove the empty footer band below the navigation buttons while keeping 44px touch targets and visual viewport positioning.

### Validation

- Extend layout regressions for header sizing, shared viewer heights, single-row Preview placement and footer touch-target geometry.
- All 32 regression files and formatting checks pass; generated userscript/TXT match source.

## 0.18.5 (local preview, included in 0.19.0)

### Fixed

- Reserve the Large-card initiative slot on Ultimate headers and the footer item slot on cards without an item, keeping both bars consistent with cards that display icons.
- Reduce inline rule stat/token icons to 1.1em, with baseline alignment that fits the existing text line height. Sidebar and action-heading icons retain their size.

### Validation

- Extend Large-card regressions for empty header/footer slots, retained footer visibility and smaller inline stat/token icons.
- All 32 regression files and formatting checks pass; generated userscript/TXT match source.

## 0.18.4 (local preview, included in 0.19.0)

### Changed

- Center the enlarged item-stat Preview, rename its reset control, remove the color helper and label the Tree columns Tier 1/2/3. Show Gold, Silver and Ultimate first, with extra basic cards wrapping below in three-column rows.
- Distinguish five Tree states: grey unselected, white current hand/discard/played pool, purple future selection, light grey actual item cards, and dark grey rejected/replaced cards. Tier 1 cards never receive item treatment; current basic cards and the level 8 Ultimate receive white borders too.
- Reserve the empty initiative slot on Ultimate Small/Mini cards. Heroes upgrade rows gain a centered Nano U before their item icons; compact Board rows gain a reserved Ultimate dot. Both are grey before level 8 and breathe purple when unlocked, with static glow for reduced motion.

### Validation

- Add Ultimate spacing/unlock/relock coverage. Extend Deck tests for all five states, item history, basic/Ultimate ownership, centered Preview and overflow ordering.
- All 32 regression files pass; formatting checks pass and generated userscript/TXT match source.

## 0.18.3 (local preview, included in 0.19.0)

### Fixed

- Keep all four Deck view buttons and the sort toggle on one line. Remove the Deck title and Tree color/basic subtitles.
- Extended Micro now shows the item earned from the paired alternative. Large Deck/Hero cards retain their centered printed item and add a grey **Gives** label with the alternative's item and a plus; native upgrade choices use the same footer.
- Replace the selected-card build list with Hero-style upgrade totals. Use native acquired item values plus only tentative future grants, with grey empty icons, white acquired bonuses and purple projected totals. Tree game choices now highlight in white; plans remain purple.

### Validation

- Cover both sides of each paired grant, missing/ambiguous/hidden alternatives, Large-card footers, one-row controls, removed titles and acquired/planned totals (including storage, refresh, radius aliases and no double counting).
- All 31 regression files pass. Generated userscript and TXT match source.

## 0.18.2 (local preview, included in 0.19.0)

### Changed

- Add Tree to Deck with T1/T2/T3 columns, alternate choices below their standard counterparts, and connecting paths. Extended Micro cards add a printed initiative cap and the card's own upgrade icon with an overlaid plus on a clear cap.
- Tapping a Tree card opens the unchanged Large Deck card. Uncommitted T2/T3 taps highlight a tentative choice and dim its alternative; the build summary lists planned and game-chosen cards separately. Clear plan removes only tentative choices.
- Observe owned upgrades to lock actual game choices and darken unavailable alternatives more strongly. Retain observed earlier choices after higher-tier replacement, release them on observed rollback/renewed native eligibility, and persist plans and observations per game and hero. Planning never selects a native upgrade.

### Fixed

- Use one responsive card-viewer height across Board, Heroes, Hand, Compact Deck and Tree Deck, including short screens. Size the Heroes/Hand board pane around that height instead of using a separate percentage.
- Fit Compact/Tree Deck into the space remaining below its native header so the card list and build summary remain scrollable above the footer.

### Validation

- Add Tree regressions for five slots, tier positions, correct grants, printed values/privacy, preview/plan behavior, committed choices, refresh/reopen/reload, game/hero isolation, rollback and storage failures. Include Tree in saved view/sort preference coverage.
- All 31 regression files pass; formatting checks pass and generated userscript/TXT match source.

## 0.18.1 (local preview)

### Fixed

- Shorten the card inspection area in Heroes and Hand from 43% to 38% of the available pane height. Keep the Options panel aligned to the same split.
- Give the Compact Deck preview its own taller responsive height, including in short landscape viewports.
- Move both header minion counters outward by mirrored offsets, with extra clearance on narrow screens.
- Give the empty/selecting card slot a translucent fill in focused Board view so the board remains visible through it.

## 0.18.0

### Changed

- Consolidate the stylesheet into component sections with one definition per selector and media context. Remove obsolete native-header, split-view, expanded-Hero and Large Deck rules, plus legacy summary-specific card sizing. Document the cascade and add CSS formatting checks to CI.

### Fixed

- Keep card-action proxies synchronized with native labels, availability and replacement buttons without rebuilding card artwork. Check native button availability again at click time.
- Observe native text, coin artwork and disabled-state changes. Filter generated subtrees and adapter class changes so updates settle without a refresh loop.
- Restore queued event-history writes before collecting new events when returning to a game, including when storage reads fail. Preserve per-game isolation and deduplication.
- Retry failed sprite, font and background loads. Retry basic-card artwork on reconnect and reopening Deck, including recovery while a failed request is still pending. Paint offscreen so drawing errors preserve the readable fallback.
- Remove the obsolete Deck browser, preview and canvas hooks when native sources disappear or become invalid; restore the native fallback and allow remounting.
- Restore native empty-log visibility when leaving mobile mode or tearing down the adapter.
- Gray only an off-board hero's portrait image, preserving the team ring and status overlay colors.
- Keep trimmed entries from oversized native logs from rotating back into the event archive or causing idle writes. Ignore malformed live entries before collecting or rendering history.
- Keep BLUE/ORANGE overlays bold white by removing the stale gray coin-label rule. Preserve shared Mini tier gutters, hidden-card centering, muted resolved tier edges and the gray 19px return triangle while consolidating styles.
- Reserve the safe-area inset in navigation height and pane offsets, and apply its padding after the shorthand so it cannot be discarded.

### Validation

- Add three regression files covering native update observation/action synchronization, storage/navigation recovery, artwork retries and Deck cleanup. Update the portrait regression to check image-only grayscale.
- Expand regression formatting so assertion failures have distinct source lines, add pinned formatting commands and a CI check, and list failed test files in the runner summary.
- Add four regression files covering saved Deck preferences, committed React tree replacement, viewport/lifecycle transitions and event archive boundaries. Document the behavior coverage map and manual checks.
- Add a CSS cascade regression covering typography, card/container boundaries, turn-state surfaces, narrow/short/reduced-motion rules and safe-area declarations. Make existing CSS assertions tolerate formatting whitespace and independently defined tier stripes.
- All 30 regression files pass; generated userscript and versioned TXT match source.

## 0.17.0

### Changed

- Slim the top header and overlay bold white values with shadows on lives, push, minion and coin icons. Coin labels use smaller, bold BLUE/ORANGE text. Minion counters sit between the coin and lives and count unique minions still on the board.
- Move phase and action into a translucent, blurred single-line strip flush below the header, with square upper corners and no upper border. Center the phase in its fixed-width column and truncate long actions with an ellipsis.
- Show Disconnected/Reconnecting in that strip with a translucent red background, retaining the gold pulsing dot in the same position. Restore the latest phase/action after reconnection.
- Place reset and option controls below the status strip and extend card inspection to cover its top edge.
- Float Board summary rows and focused Hero entries over the board. Individual entries have translucent, blurred backgrounds; the surrounding container stays transparent.
- Add floating portraits below the focused Hero in turn order, including initiative/status overlays, active selection highlighting and click-to-switch. A left triangle in the focused portrait returns to the summaries.

### Fixed

- Remove the black rectangular background behind portrait initiative badges in both Heroes and Board.
- Make the focused Hero's return triangle gray.

### Validation

- All 22 regression test files pass, including connection recovery, stable dot placement, surviving minion counts, ordered focus switching, transparent initiative badges and gray return control.
- Generated userscript and versioned TXT match the source.

## 0.16.0

### Changed

- Large cards use cropped original artwork with one continuous image across title, body and footer. Artwork fades from fully transparent at top left to 40% visible at bottom right, preserving the colored title and dark card surfaces underneath.
- Title and footer blur that same artwork in place while keeping text and controls sharp. The footer has a slightly darker base.
- Enlarge Large-card title/body stat icons and overlaid values by 30%, including inline rule icons. Footer controls retain their size.
- Small Hand cards show horizontally faded, blurred artwork only within their colored central band. Mini cards retain plain colored backgrounds.
- Small and Mini cards show matching tier stripes at both edges: one for basic/Tier I, two for Tier II and three for Tier III. Fixed gutters and primary/range slots keep titles and icons aligned even when a stat is absent.
- Micro and Nano cards show tier within their existing side edges: basic/Tier I reserves one colored border pixel and two card-fill pixels; Tier II uses color/fill/color; Tier III uses three solid color pixels. Outer dimensions remain unchanged.

### Fixed

- Keep Large-card titles white with a subtle shadow throughout artwork loading and fallback, removing the black-to-white flicker.
- Center Large-card tier labels within their reserved corner.
- Preserve hidden-card privacy and plain-card fallback when artwork is unavailable. Resolved Micro/Nano tier edges remain muted.

### Validation

- All 21 regression test files pass, including artwork ownership, fade/blur/layering, load/error fallback, tier stripes, fixed card sizes, privacy and native interactions.
- Generated userscript and versioned TXT match the source.

## 0.15.0

### Changed

- Board overview uses six aligned columns: turn/status, hero/player name, level/gold, Hand/Played/Discard dots, current card and right-aligned item upgrades. Hero names stay complete; player names fade, with `(You)` for the local player.
- Board Micro cards use three fixed icon slots: primary, range/radius and movement. Secondary defense is omitted. Resolved cards remain visible with faded values; active effects breathe on the corresponding card or dot.
- Tapping a Board Micro opens the Large card viewer above the board. Tapping a hero name replaces the overview with that Hero entry; the portrait's `<` control returns to the list. The overview height stays fixed.
- Heroes, Hand and Board focus share one compact Hero entry with larger item icons, Lv/Gold/Hand metadata and a reserved Played Mini row. The row shows a known current/selected card or a Selected/Selecting status placeholder.
- Hero history has five fixed-width slots: Turn 1–4 and Discard. Empty turn slots have subtle borders and centered labels. Defense-only discard Nano cards overlap symmetrically over the Discard label without increasing the row height.
- Hide Played/Discard dot metadata in Hero entries while retaining their renderers. Hand dots remain visible. Disable unfolded Hero boards for now.
- Portrait turn order uses superscript ordinal suffixes, with initiative at the lower left. Board overview keeps dotted order numbers.
- Remove completed roadmap items and document the current card-size system in README.

### Fixed

- Razzle remains on-board while any owned hero figure is still present.
- Supported token/marker references render as inline icons in card rules; unknown references remain readable text.
- Own selected/committed cards remain visible when their details are already supplied or their ID matches a known own card, including after the native commit handler clears selection. Opponents' facedown cards remain hidden.
- Fix card colors, horizontal Micro layout, fixed-width history slots and card borders/padding within the reserved width. Cards no longer stretch to fill a wider column.
- Keep the focused Hero entry within the summary width and reset scroll offsets on focus/back to prevent left-edge clipping.

### Validation

- 20 regression test files pass, including sizing/cascade, focus/back, planning status, privacy, history, Razzle ownership and inline-icon coverage.
- Generated userscript and versioned TXT match the source.

## 0.14.9

### Changed

- Board overview columns remain aligned after resolution, with item upgrades at the right edge.
- Heroes omits the local hand cards; Hand keeps the local Hero above its card list.
- Deck replaces Large with Compact: slim printed-stat rows, an independently scrolling list and a dark selected-card preview. Existing Large preferences migrate to Compact.

## 0.14.8

### Changed

- Board becomes the default view. Heroes, Hand, Deck and Settings are toggles; pressing the active toggle returns to Board.
- Heroes/Hand keep the board above their list and overlay card details only when selected. Settings uses the same lower pane; Deck fills the view. Setup remains contextual.
- The compact overview omits secondary defense, hides cards after resolution, uses `(You)` for the local player, fades long player names and punctuates turn numbers. Resolved-card visibility changes again in 0.15.0.

## 0.14.7

### Changed

- Hand and Heroes reserve the same fixed card-inspection space, including when empty.
- Hero boards expand independently. Hand keeps the local board open outside planning and omits its duplicate Hand subsection; collapsed boards retain known current/selected cards.
- Planning locks expansion to commitment/status, and history shows only turns reached in the round.
- Item upgrades reserve attack, defense, initiative and a stacked movement/range/radius group; absent upgrades are grey.
- Board combines phase status, hero/player names, level, gold, card-pile dots, current-card stats and upgrades in one overview. Hidden cards disclose no stats.

### Fixed

- Include the 0.14.6 fixes: choice launchers at the top left, level-up selection status and distinct printed/awarded upgrade icons.
