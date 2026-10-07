# Roadmap

Planned UI work for the GoA II Mobile 2D patch. This is a working roadmap rather than a fixed release plan.

## Card display system

Standardize card presentation into a small set of reusable sizes:

- **Full / Image** — the rendered card image.
- **Large** — full text-card view, as used in the Card Viewer in Hand, Heroes and Deck. May vary slightly between upgrade, Deck and in-play contexts. Uses a colored header bar.
- **Small** — full-width, fixed-height card showing title plus icons/values, but no ability text. Used in Hand.
- **Mini / Tiny** — similar to Small, but shorter.
- **Micro** — fixed-width inline colored card showing only selected icons/numbers, with no text. Uses a breathing highlight while the card has an active ability.
- **Nano** — single-icon, fixed-width representation with the same height as Micro.
- **Dot** — colored dot only. Also breathes for an active card.

## Board

### Minimal hero list

- Rework the list into a more tabular layout with fixed-width columns.
- Keep a played card visible after resolution, but darken/fade it.
- Tapping a Mini card opens that card in the **Large** Card Viewer at the top.
- Tapping a hero name replaces the minimal list with that hero's expanded Heroes-list entry.
- In this focused hero view, show a **<** back button on the hero portrait to return to the minimal list.

## Heroes

Improve the expanded hero view:

- Move the current / played / unresolved / just-resolved card to a **Mini** card beneath the upgrades.
- Replace the old current-card area with five Mini-sized history slots:
  - Turn 1
  - Turn 2
  - Turn 3
  - Turn 4
  - Discard
- Use grey placeholder text while a slot is empty.
- Populate these slots during resolution as cards are resolved or discarded.
- Within the history slots, use **Nano** card representations showing the defense icon/value when the card has a defense stat.
- Do not show active effects separately; the relevant Micro/Nano card should breathe instead.
- Move turn-order initiative from below the hero portrait to the portrait's lower-left corner.
- On the portrait, render turn positions as **2nd**, **3rd**, **4th**, etc., with superscript suffixes rather than a trailing period.
- Keep the existing dotted turn-number style in the minimal Board list.

## Deck

### Tree view

Add an upgrade-tree view for testing and visualizing builds.

- Use modified **Micro** cards.
- Add the gained upgrade icon at the right edge with an overlaid **+**, without a colored background.
- In this tree, show the icon for the upgrade the selected card itself grants, rather than the upgrade another card receives.
- Lay each upgrade path out with:
  - T1 on the left
  - T2 in the middle
  - T3 on the right
  - alternate T2/T3 choices directly below their standard counterparts
- Tapping any card still opens its normal **Large** Deck card in the Card Viewer.

For uncommitted T2/T3 choices:

- Tapping a choice highlights it.
- Slightly darken the alternative at the same tier.
- Use this as a non-binding build-planning state.
- Summarize the currently highlighted build at the bottom of the view.

For upgrades already chosen in the actual game:

- Permanently highlight the selected upgrade.
- Darken the unavailable alternative more strongly.
- Tapping either card only opens its Large Card view and does not alter the highlight state.

The **Large** Deck card remains unchanged, including its existing bottom row.

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

- Move **Log** into the bottom menu immediately before **Settings**.
- Replace the current log approach if possible.
- Preferred solution: a REST-style implementation that retrieves log deltas from the server.
- Possible fallback: derive history from the replay list. This is incomplete and should be treated as a temporary compromise.

## Horizontal phone layout

Create a dedicated landscape-phone layout:

- Board / Card Viewer on the left.
- Lists on the right.
- Menu buttons at the far right.
- Rework the top menu for landscape, either:
  - primarily left-aligned; or
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

## Bugs / fixes

- **Razzle:** currently shown as dead when one figure is still on the board.
- **Inline token/marker icons:** card rules text that refers to tokens or markers should render the corresponding icon inline instead of plain text.
  - Example: Emmitt's Silver card. Exact icon mapping/details still TBD.
