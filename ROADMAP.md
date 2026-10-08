# Roadmap

Remaining UI work for the GoA II Mobile 2D patch after 0.15.0. This is a working roadmap rather than a fixed release plan. Completed Board/Heroes work and bugfixes are recorded in [CHANGELOG.md](CHANGELOG.md); the current card sizes are documented in [README.md](README.md#card-display-system).

The Extended Micro cards and Deck tree are implemented in 0.18.2. The level-up tree is released in 0.20.0. Their behavior is documented in [README.md](README.md#deck-tree).

## Upgrade menu

Released in 0.20.0: the level-up menu uses Extended Micro trees without basic or
Ultimate cards. Separate Tier 2/3 counters show all required selections. Tier 3
unlocks only after the remaining Tier 2 choices are staged; editing Tier 2 clears
dependent Tier 3 choices. Standard/alternate rows use the shared artwork A/B markers.

Preview is a separate toggle. Its purple plans/stat totals never become game
selections. Commit requires every upgrade selected with Preview off/cleared and
submits through the native picker callback, waiting for each acknowledgement and
checking current server eligibility. Missing data retains the native menu.

## Log

Implemented in 0.19.1: **Log** sits immediately before **Settings** in the footer.
The panel shows the local received-event archive and a separate **Decisions** tab
backfilled from the player-scoped `GET /api/games/{game_id}/overrides/history` API.
That endpoint applies hidden-card masking and works without the admin replay API.
Requests run only while Log is open; unchanged history uses ETags when supported.

Remaining: a full server event log with delta retrieval. The current API has no
event-delta route. Decision history recovers earlier choices, not their complete
combat/event output, so it is a temporary supplement to locally received events.

## Horizontal phone layout

Create a dedicated landscape-phone layout:

- Board / Card Viewer on the left.
- Lists on the right.
- Menu buttons at the far right.
- Rework the top menu for landscape, either:
  - on a leftmost left-side vertical bar
  - split between the two corners with a small central status area.

## Tablet layout

Create a tablet-specific layout:

- Board in the center.
- Left panel:
  - Card Viewer at the top;
  - Hand / Deck below.
- Right panel:
  - Heroes;
  - Log and other secondary views.
- Revamp the top bar for the wider layout.
- Split bottom-menu controls between the left and right side panels rather than using one shared bottom bar.
- Allow switching the Card Viewer between **Full/Image** and **Large/Text** views.

## Desktop

Consider carrying the reusable visual improvements from the mobile UI into the desktop interface where they fit cleanly.

