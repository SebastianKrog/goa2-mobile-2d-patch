# Changelog

## Version 0.14.9

Board overview columns now stay aligned after resolution, with item upgrades at the right edge. Heroes no longer duplicates the local hand; Hand keeps the local hero above its card list.

Deck replaces Large with Compact: slim printed-stat rows, an independently scrolling list, and a dark selected-card preview. Existing Large preferences migrate to Compact.

## Version 0.14.8

Board is now the default. Heroes, Hand, Deck and Settings are toggles; pressing the active control returns to Board. Heroes/Hand show the board above their list and overlay card details only when selected. Settings uses the same lower pane; Deck fills the view. Setup remains contextual.

The compact overview omits secondary defense from its microcards, hides microcards after resolution, abbreviates the local player's name to `(You)`, limits the identity width with fading player names, and punctuates turn numbers.

## Version 0.14.7

- Hand and Heroes reserve the same fixed card-inspection space, including when empty.
- Hero boards expand independently; Hand keeps your board open outside planning and omits its duplicate hand subsection. Collapsed boards retain known current/selected cards.
- Planning locks board expansion to commitments/status. History shows only turns reached in the round.
- Item upgrades reserve attack, defense, initiative and a stacked movement/range/radius group; missing upgrades are grey.
- Board uses one compact overview with phase status, separate hero/player names, level, gold, P/H/D dots, current-card stats and upgrades. Hidden cards never disclose their stats.
- Includes the previously supplied 0.14.6 fixes: choice launchers at the top left, level-up selection status, and distinct printed/awarded upgrade icons.
