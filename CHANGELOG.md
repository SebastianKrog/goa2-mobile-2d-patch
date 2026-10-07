# Changelog

Published releases, newest first. Each entry groups user-visible changes and fixes. Local previews 0.14.10–0.14.18 are included in 0.15.0; 0.15.1–0.15.11 are included in 0.16.0; 0.16.1–0.16.9 are included in 0.17.0; 0.17.1–0.17.2 are included in 0.18.0.

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
