# Stylesheet guide

`styles.css` is the canonical stylesheet. At installation, `&` expands to
`html[data-m2-active]`, keeping native overrides limited to the active mobile 2D
adapter. The inactive visibility guard lives in `init.js`.

Edit the existing component definition when changing its appearance. Avoid appending
another block for the same selector. The CSS regression rejects duplicate definitions
within the same media context and empty rules. Different states and media conditions
may have their own selectors.

## Sections

| Section | Ownership |
| --- | --- |
| 1. Layout and native panes | Shared variables, native sidebar/Deck/tool adaptation, pane visibility, card inspection positioning |
| 2. Navigation | Footer buttons, pressed/hidden states, viewport offset; Settings/Log utility panels live with native pane layout |
| 3. Header and connection strip | Icon/value overlays, phase/action strip, disconnect text and dot |
| 4. Shared cards and stats | Large card shell/artwork, Small/Mini rows, Micro/Nano geometry, tier edges, printed/upgraded values |
| 5. Deck browser | Grouped layouts, sort switch, canvas copies, zoom, List/Tree preview, shared paths/build totals and level-up staging/commit surfaces |
| 6. Hero entries and portraits | Shared heading, metadata, Played/history slots, upgrades, portrait/status overlays |
| 7. Board summaries and focus | Six overview columns, turn states, floating row/focus surfaces and portrait navigation |
| 8. Board gestures and controls | SVG rotation/centering, reset, planning proxies and choice launchers |
| 9. Event log | Floating-trigger suppression, Events/Decisions tabs, history rows and raw details |
| Motion and media rules | Keyframes, reduced motion, narrow-screen counters and short-screen preview height and phone landscape panes/rail |

## Cascade rules

- Keep native adaptation rules strong enough to override the website's inline and
  component styles. The remaining `!important` declarations also enforce pane
  visibility and selected/action colors where stronger shared rules apply.
- Define Micro/Nano geometry and colors in the shared card section. Board and
  focused Hero containers must not redefine their widths, stat cells or fills.
- Set the default tier-edge variable on the shared card base. A resolved card sets
  the muted variable through its state selector, so a size variant cannot reset it.
- Keep native Hero-row padding limited to unadapted rows. Adapted rows use their
  card renderer's padding; Hero Mini vertical padding must not reset tier gutters.
- Turn-state defaults follow base summary rows. More specific translucent summary
  surfaces follow those defaults, keeping current/done entries blurred.
- Keep artwork, blur panes and text in the same documented stacking order: the
  cropped artwork is layer 1, blur is layer 2, and content is layer 3. Small/Mini
  tier stripes stay above decorative artwork without blocking controls.
- Navigation ends at the bottom of its 44px touch targets, with no bottom padding.
  `--m2-nav` includes the top border and padding and supplies the same reserved
  height to panes and previews. `--m2-offset` follows visual viewport changes.
- Every card viewer uses `--m2-card-display-height`. Heroes/Hand reserve that height
  plus the bottom gutter through `--m2-board-pane-height`; Deck's preview does not
  define its own height. The native Deck title is hidden; controls, preview, scrolling list and build stat
  totals share a flex column so they fit above navigation. Keep all four controls
  on one row, reserving a fixed-width final column for the sort toggle.
- Deck controls share `--m2-head` with the main header. The Tree build Preview
  places its left-aligned label, centered stat icons and Reset button in one row.
- Change complete font shorthands when consolidating text rules, rather than
  retaining a stale font size beside a second size declaration.
- Font scaling materializes pixel font sizes and line heights from the canonical
  stylesheet. It replaces that sheet rather than adding overrides; the center step
  restores its exact original text. Board dimensions and touch targets are not scaled.
- The root's `data-m2-no-card-art` state hides existing artwork layers and disables
  their bar blur, leaving card structure, stats and loaded assets intact.

## Phone landscape

The final landscape media block owns the orientation-specific geometry. It uses
`--m2-nav-width` for the right navigation rail and `--m2-list-width` for the right
pane; `--m2-nav` becomes zero because there is no bottom footer. Keep browser
viewport offsets and safe-area insets in fixed panel bounds.

The board stays full width and height across landscape modes. The native sidebar
is positioned over its right edge; floating Board summaries have no permanent
panel background. Deck also keeps the board rendered behind its overlay so its
geometry does not collapse. The message strip attaches to the map below the
27px landscape header. Its icon/label pairs translate down 5px without affecting
header measurement or Round/Turn positioning. The landscape header paints above
the sibling status strip, so protruding icons remain visible; card viewers keep
higher overlay priority. Reset/Fullscreen stack
at the left below the strip; temporary choice launchers follow beneath them.
`--m2-control-stack-h` reserves only the controls present, including the gap after
the stack. Portrait keeps its existing header height and control positions.
Lives/minions use adjacent outer grid columns in both orientations; flexible
columns flank the coin. Landscape aligns Round/Turn and the push counter toward
the coin within those columns.
The SVG's landscape-only `translate` shifts it left by half the reserved list
width: the full board's midpoint then coincides with the clear left area's
midpoint. This screen-space offset stays separate from native pan/zoom and
rotation, remains constant across modes and Reset, and disappears in portrait.
Hero centering uses native wheel/pan state with a final screen-space translation
in the SVG transform when the pan clamp stops short. `--m2-center-x/y` belong
to the rotation host and clear with Reset or teardown. Card dots remain plain
circles in their `--effect-color`; active effects retain their breathing glow.

Generated Deck/upgrade
roots use grids to put the shared viewer on the left and controls/lists on the
right. Upgrade content uses `display: contents` so its two children join the host
grid; no native nodes are reparented. Grid Deck cards also have a scrolling list
container, and their image zoom is confined to the left pane.

The media query is limited to landscape widths 600–1200px and heights up to 600px.
The extra activation beyond the existing 900px limit requires a coarse pointer.
Portrait component definitions remain the base; do not mix rail widths into their
footer-height calculations.

## Checks

```sh
npm run css:format
npm run css:format:check
npm test
npm run build:check
```

`test-css-cascade.cjs` checks header typography, strip/dot stability, shared card
gutters and state colors, floating focus sizing, footer geometry, and selected
short/narrow/reduced-motion media branches. It selects media branches explicitly
because jsdom does not evaluate screen media queries. `test-landscape.cjs` and
the level-up fixture select the landscape branch through `helpers/screen-media.cjs`
and cover pane/rail geometry, unchanged landscape map dimensions and native
transforms across modes, shared fullscreen state, viewport offsets and rotation lifecycle.

These checks complement the existing layout/artwork fixtures. Real blur, font
rendering, touch behavior and platform safe-area values still need a device check.
