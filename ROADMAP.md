# Roadmap

Remaining work for the GoA II Mobile 2D patch. Released features and fixes are
recorded in [CHANGELOG.md](CHANGELOG.md); current behavior and card sizes are
documented in [README.md](README.md).

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
