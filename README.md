# GoA II — Mobile 2D

A mobile userscript for the existing Guards of Atlantis II frontend at
`https://goa2.frontend.pedroliv.dev/game/*`, with `3d=0` in the query string.
It activates at widths of 900 CSS pixels or less. The website retains responsibility
for game rules and actions; the script adapts presentation and proxies native controls.

## Install

Install `dist/goa2-mobile-2d.user.js` with your userscript manager, or use the
versioned `.txt` copy when transferring/pasting the script on Android.
The generated file includes everything: no hosted JavaScript dependencies are required.
Calling `GOA2Mobile2D.destroy()` removes an active installation from the page.

## Build and test

Use Node.js 24 (minimum 22.12).

```sh
npm ci
npm run build
npm test
```

Building alone needs no npm packages: `node scripts/build.mjs` also works before
`npm ci`. Dependencies are used only by the browser-fixture tests.

- `npm run build` combines source files into readable, unminified output in `dist/`.
- `npm run build:check` checks that committed output matches the source.
- `npm test` builds and runs all 16 regression test files in isolated Node processes.
- GitHub Actions checks committed output and runs the tests on pushes and pull requests.

Edit `src/`, then rebuild and commit both source and `dist/`. Do not edit generated
output directly. For a version change, update `package.json`, the metadata in
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
| `src/board.js` | Header, settings, compact summaries, rotation, planning controls |
| `src/heroes.js` | Rendered component props, hero dashboards, card inspection, upgrades |
| `src/history.js` | Per-game local archive of received events |
| `src/main.js` | DOM reconciliation, observers, initialization, teardown |

These JavaScript files are **ordered source fragments sharing one private closure**,
not separately executable ES modules. The builder wraps them in one IIFE, preserving
the existing initialization order and keeping internal state off `window`. Only
`window.GOA2Mobile2D` is intentionally exported. The CSS marker is replaced at build
time with an escaped template literal. No minification or runtime loader is used.

The `m0`–`m3` names inside the painter are inherited internal wrappers and are explained
in that file. Other UI code calls the painter through its small returned API.

## Tests and boundaries

The jsdom fixtures cover navigation, card layouts, hero status/expansion, upgrades,
rotation/reset, event persistence and game isolation, lifecycle cleanup, and Deck
redraw behavior. `tests/fixtures/goa2-mobile-2d-v0.14.2.txt` is an intentionally frozen
baseline used to compare canvas commands for 72 card variants. Do not rebuild it.
Fixtures are synthetic; no live game history or credentials are included.

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
