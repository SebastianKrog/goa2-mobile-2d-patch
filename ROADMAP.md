# Roadmap

Remaining work for the GoA II Mobile 2D patch. Released features and fixes are
recorded in [CHANGELOG.md](CHANGELOG.md); installation and usage basics are in
[README.md](README.md).

## Hero-specific information and markers

Add a shared area for hero-specific information and markers to hero boards and
the minified Board list. This is planned work; settle the other review findings
separately after further feedback.

### Hero boards

- Replace the **Played:** label with this area when there is something to show;
  retain the label otherwise.
- Show multiple markers and hero-specific indicators next to one another. At
  three or more indicators, shorten the displayed played card to make room.
- For Gydion, add a **spells cast** counter that is also a button. Make it
  available to all players and open a list of his played/cast spells.
- Use Gydion's icon as the counter's backdrop. Overlay dots colored by the cast
  spells, arranged like dice pips as the count increases. Show dots through nine
  spells; above nine, replace them with a number.
- Let Gydion's counter coexist with markers in the same area.

### Minified Board list

- Reserve room for one tiny marker or hero-specific indicator. Gydion's single
  indicator uses a tiny symbol with the spell count.
- When there are multiple markers/hero-specific indicators, show their combined
  count in a distinct color instead of showing each indicator. Count the
  indicators themselves: Gydion's spell counter contributes one indicator,
  regardless of how many spells it represents.

### Gydion's Deck

Show his spells properly in Deck for the Gydion player. Keep this separate from
the public cast-spell list opened by his hero-board counter.

## Bottom navigation

Offer three options: the current bottom menu, a drawer opened by a button, and no bottom menu. Keep Settings and Log accessible in every mode; Hand and Deck already have Board shortcuts.

## Tablet layout

Create a layout for tablet-sized screens:

- Keep the Board in the center.
- Place the Card Viewer above Hand and Deck in a left panel.
- Place Heroes, Log and secondary views in a right panel.
- Adapt the header to the wider layout.
- Split navigation between the two side panels.
- Let the Card Viewer switch between **Full/Image** and **Large/Text**.

## Server event history

Add retrieval of complete match events missed while the browser was closed or
offline. This depends on a player-scoped server event endpoint with delta
retrieval. The current API only exposes decision history, so the Log currently
combines locally received events with a separate server-backed Decisions tab.

## Device refinement

Continue testing on real phones and refine:

- Very long card text.
- Large hero rosters.
- Landscape column balance.
- Browser chrome and keyboard changes.
- Native two-finger board gestures and canvas/font rendering.

## Desktop

Consider carrying reusable card, hero-list and header improvements into the
desktop interface where they fit cleanly.
