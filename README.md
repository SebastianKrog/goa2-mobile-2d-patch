# GoA II — Mobile 2D

A mobile userscript for the existing Guards of Atlantis II frontend at
`https://goa2.frontend.pedroliv.dev/game/*`, with `3d=0` in the query string.
It activates at widths of 900 CSS pixels or less. The website retains responsibility
for game rules and actions; the script adapts presentation and proxies native controls.

## Install

### Android — Firefox

I recommend **Firefox for Android** because it supports browser extensions, unlike Chrome for Android. This allows the script to be installed and managed cleanly through Greasemonkey.

1. Install [Firefox for Android](https://play.google.com/store/apps/details?id=org.mozilla.firefox).
2. Install [Greasemonkey](https://addons.mozilla.org/firefox/addon/greasemonkey/).
3. In Greasemonkey, choose **Install from URL**.
4. Paste:

   `https://raw.githubusercontent.com/SebastianKrog/goa2-mobile-2d-patch/main/dist/goa2-mobile-2d.user.js`

5. Reload the GoA2 page.

### iPhone / iPad

On iOS, use Safari with the free [Userscripts app](https://apps.apple.com/us/app/userscripts/id1463298887). Enable its Safari extension, then install the script from the URL above.

## Build and test

Use Node.js 24 (minimum 22.12).

```sh
npm ci
npm run build
npm test
```

Building alone needs no npm packages: `node scripts/build.mjs` also works before
`npm ci`. Dependencies are used only by the browser-fixture tests and test formatter.

- `npm run build` combines source files into readable, unminified output in `dist/`.
- `npm run build:check` checks that committed output matches the source.
- `npm test` builds and runs all 32 regression test files in isolated Node processes.
- `npm run test:format` formats test JavaScript; `npm run test:format:check` checks it.
- `npm run css:format` formats the stylesheet; `npm run css:format:check` checks it.
- GitHub Actions checks test/CSS formatting, committed output and regressions on pushes and pull requests.

Edit `src/`, then rebuild and commit both source and `dist/`. Do not edit generated
output directly. For a version change, update `package.json` and `package-lock.json`, the metadata in
`src/userscript-header.txt`, and the public API version near the end of `src/main.js`.

## Source guide

| File | Responsibility |
| --- | --- |
| `src/userscript-header.txt` | Installation metadata and script usage notes |
| `src/manifest.json` | Explicit build order |
| `src/init.js` | Shared UI state, installation guard, stylesheet attachment |
| `src/styles.css` | Mobile layout and component styles |
| `src/navigation.js` | Generated containers, navigation, keyboard/click routing |
| `src/painter.js` | Self-contained canvas artwork renderer for basic Deck cards |
| `src/cards.js` | Shared text cards, compact rows' stat helpers, upgrade values |
| `src/deck.js` | Deck preferences, browser, canvas copy synchronization |
| `src/deck-tree.js` | Upgrade paths, tentative builds, observed game choices and per-game/hero persistence |
| `src/board.js` | Header, settings, compact summaries, rotation, planning controls |
| `src/heroes.js` | Rendered component props, hero dashboards, card inspection, upgrades |
| `src/history.js` | Per-game local archive of received events |
| `src/main.js` | DOM reconciliation, observers, initialization, teardown |

These JavaScript files are **ordered source fragments sharing one private closure**,
not separately executable ES modules. The builder wraps them in one IIFE, preserving
the existing initialization order and keeping internal state off `window`. Only
`window.GOA2Mobile2D` is intentionally exported. The CSS marker is replaced at build
time with an escaped template literal. No minification or runtime loader is used.
See [the stylesheet guide](src/STYLES.md) for component ownership, cascade rules and CSS checks.

The `m0`–`m3` names inside the painter are inherited internal wrappers and are explained
in that file. Other UI code calls the painter through its small returned API.

## Tests and boundaries

The jsdom fixtures cover navigation, card layouts, hero status/focus, upgrades,
rotation/reset, event persistence and game isolation, lifecycle cleanup, and Deck
redraw behavior. `tests/fixtures/goa2-mobile-2d-v0.14.2.txt` is an intentionally frozen
baseline used to compare canvas commands for 72 card variants.

Fixtures are synthetic; no live game history or credentials are included.
See [the regression coverage map](tests/README.md) for asserted behaviors, individual
test commands, formatting rules and remaining manual checks.

Tests do not replace visual checks on Android Firefox. In particular, verify native
two-finger gestures, browser chrome changes, and real canvas/font rendering on a phone.
The adapter reads private React fibers and generated CSS-module class names; website
changes can require selector/prop updates even when these local tests pass.

## Local data

Display preferences and up to 2,000 received events per game are stored in the site's
localStorage. The event archive cannot recover events missed while the browser was
closed or offline. Deck shows printed stats; Hand and hero details apply known upgrades.

## Attribution

The canvas card painter is adapted from `PedroVIOliv/goa2-frontend-portfolio`.
Card art, icons, and fonts are loaded from the game website and are not copied into
this repository. No new license grant is asserted for third-party code or artwork.

## Card display system

| Size | Content and use |
| --- | --- |
| Full / Image | Rendered card artwork in Deck. |
| Large | Complete text card with colored header and rules; selected-card viewers and upgrade choices. |
| Small | Full-width title and stat icons without rules text; Hand rows. |
| Mini / Tiny | Slim title/stat row; current or selected card in Hero entries and List Deck. |
| Micro — Board | Three fixed 20px icon slots: primary, range/radius, movement. 70px total width including gaps and border/padding; no secondary defense, title or initiative. |
| Micro — Hero history | Four fixed icon slots: primary, range/radius, movement, defense. 64px total width. |
| Extended Micro | Five slots for Deck trees: initiative, three colored Micro cells (primary, range/radius, movement), and the granted item from its paired alternative with an overlaid plus. Clear end caps; 110px wide and 24px high. |
| Nano | One defense icon/value for a discarded card; 20px wide and the same 24px height as Micro. |
| Dot | Card color only; card-pile summaries. |

Large cards use one CSS-cropped original artwork layer across the title, body and
footer. The artwork itself fades from fully transparent at the top left to 40%
visible at the bottom right, revealing the original title color and dark card
surfaces underneath. Both bars blur that same image in place; text stays sharp.
Large-card titles stay white with a subtle shadow, and their title/body stat icons
are enlarged without changing footer controls. Missing artwork retains the plain-card
appearance. Large Ultimate headers and itemless footers reserve the missing icon
slot. Inline rule icons use text-relative sizing and baseline alignment, keeping
paragraph line spacing consistent.

Small Hand rows use horizontally faded, blurred artwork only in their colored center.
Small and Mini rows have one/two/three solid tier stripes at both edges with equal
reserved gutters; fixed primary/range slots keep their titles centered. Mini rows
have no background artwork.

Micro and Nano cards indicate tier inside their existing widths. Basic/Tier I has
one colored edge pixel plus two card-fill pixels; Tier II uses color/fill/color;
Tier III has three solid colored edge pixels. Resolved edges remain muted.

Missing Micro stats keep their cell empty. Known in-play upgrades use purple values;
Deck uses printed values. Active effects breathe on their Micro/Nano/Dot source.
Facedown cards do not reveal hidden names or stats. Small/Mini and Extended Micro
Ultimate cards retain the empty initiative slot, keeping their content aligned.
Hero upgrade rows reserve a grey Nano **U** before their item icons, and compact
Board rows reserve a grey Ultimate dot. At level 8 both glow purple; the Nano U
and border breathe together. Reduced-motion mode keeps a static glow.

Board, Heroes, Hand, List Deck and Tree Deck use the same responsive Large-card
viewer height. Heroes/Hand reserve that height above their lists. Long rules scroll
inside the viewer; there is one shared short-screen height too.

### Deck tree

Deck view buttons and the sort toggle share one row, without a Deck title. Tree
columns read Tier 1/2/3. The basic row starts Gold, Silver, Ultimate; additional cards
wrap below in three-column rows.
Deck opens in **Tree** by default, with controls ordered **Tree**, **List**, **Grid**.
**List** is the former Compact layout; the old full-card List layout is removed. Saved
Compact preferences keep their layout, and old List preferences migrate to the new List.
Choose **Tree** in Deck to see each color's T1, T2 and T3 path. Standard choices sit
above alternates. Tap any card to open its normal Large Deck card, with printed stats
and a centered printed item. To its right, grey **Gives** text and an icon with a plus
show the item earned from the alternative card. The same paired item appears in the
Tree end cap and native upgrade picker; T1/basic/Ultimate cards grant no item.

T2/T3 taps mark tentative choices in purple and darken the rejected alternative.
Cards in the current hand/discard/played pool have white borders, including basic
cards and the unlocked Ultimate. Alternatives that actually became items have light
grey borders; replaced playable cards (including Tier 1) and rejected choices are
dark grey. Other unselected cards remain grey. Inspecting a committed choice or its
item alternative does not change the build. The compact bottom bar places **Preview**
on the left, upgrade totals in the center and **Reset** on the right. It shows totals
using the Hero entry icons: grey for none, white for acquired bonuses, and purple
when a total includes planned bonuses. Its tooltip separates acquired and planned
amounts. Native item totals are authoritative; only tentative plans are added, so
observed game choices are never counted twice.
**Reset** clears tentative selections only. Tree taps do not submit game actions.

Plans and observed choices persist separately for each game and hero. Observations
come from native owned-card data, including while Deck is closed, and survive later
tier replacement. The script cannot reconstruct older choices that were replaced
before it observed them. Native eligibility and a lower level release observations
after an undo. The separate tree-based upgrade-selection menu remains on the roadmap.

## Release notes and planned work

See [CHANGELOG.md](CHANGELOG.md) for published releases and [ROADMAP.md](ROADMAP.md)
for unfinished work. Version 0.19.0 adds Deck trees with build previews, paired item
grants, Ultimate indicators and shared card-viewer sizing. It also simplifies Deck
to Tree, List and Grid. Version 0.18.0 fixes native update synchronization, history and
artwork recovery, Deck cleanup, desktop log restoration and off-board portrait colors.
Version 0.17.0 adds a slimmer overlaid-icon header and a single-line,
translucent phase/action strip with blur. Connection warnings replace that strip's
text while preserving its pulsing dot. Board summaries and focused Hero entries float
over the board with blurred surfaces; focused entries have a turn-ordered portrait
selector and a gray return triangle. Portrait initiative badges have transparent
backgrounds in both Heroes and Board. Unfolded Hero boards remain disabled.
