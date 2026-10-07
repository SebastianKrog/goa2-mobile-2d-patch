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
| 2. Navigation | Footer buttons, pressed/hidden states, safe-area padding |
| 3. Header and connection strip | Icon/value overlays, phase/action strip, disconnect text and dot |
| 4. Shared cards and stats | Large card shell/artwork, Small/Mini rows, Micro/Nano geometry, tier edges, printed/upgraded values |
| 5. Deck browser | Grouped layouts, sort switch, canvas copies, zoom and Compact preview |
| 6. Hero entries and portraits | Shared heading, metadata, Played/history slots, upgrades, portrait/status overlays |
| 7. Board summaries and focus | Six overview columns, turn states, floating row/focus surfaces and portrait navigation |
| 8. Board gestures and controls | SVG rotation, reset, planning proxies and choice launchers |
| 9. Saved event log | Archived log rows and raw event details |
| Motion and media rules | Keyframes, reduced motion, narrow-screen counters and short-screen preview height |

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
- Put safe-area padding after navigation's padding shorthand. `--m2-nav` includes
  that inset and supplies the same reserved height to panes and previews.
- Change complete font shorthands when consolidating text rules, rather than
  retaining a stale font size beside a second size declaration.

## Checks

```sh
npm run css:format
npm run css:format:check
npm test
npm run build:check
```

`test-css-cascade.cjs` checks header typography, strip/dot stability, shared card
gutters and state colors, floating focus sizing, safe-area declarations, and selected
short/narrow/reduced-motion media branches. It selects media branches explicitly
because jsdom does not evaluate screen media queries.

These checks complement the existing layout/artwork fixtures. Real blur, font
rendering, touch behavior and platform safe-area values still need a device check.
