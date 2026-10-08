# Roadmap

Remaining UI work for the GoA II Mobile 2D patch after 0.15.0. This is a working roadmap rather than a fixed release plan. Completed Board/Heroes work and bugfixes are recorded in [CHANGELOG.md](CHANGELOG.md); the current card sizes are documented in [README.md](README.md#card-display-system).

The Extended Micro cards and Deck tree are implemented in 0.18.2. Their behavior is documented in [README.md](README.md#deck-tree). The tree-based upgrade-selection menu below remains outstanding.

## Upgrade menu

Provide an alternative upgrade-selection interface based on the same Deck tree.

The tree should clearly distinguish:

- cards already in the deck;
- cards currently eligible to be selected;
- cards that are no longer selectable.

Behavior:

- Selecting an eligible card updates a **Confirm / Choose this** control at the bottom.
- Selecting an ineligible card only opens its **Large** Card view.
- If an ineligible card represents a relevant future choice:
  - highlight it in purple;
  - slightly darken the opposite future choice;
  - update the projected stats at the bottom in purple.

This should let players plan later upgrade choices without confusing planned selections with actual game state.

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

