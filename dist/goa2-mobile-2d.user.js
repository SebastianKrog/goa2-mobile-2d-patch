// ==UserScript==
// @name         GoA II — Mobile 2D
// @namespace    goa2-mobile-local
// @version      0.14.5
// @description  Compact 2D HUD, Board/Hand modes, contained setup and utility panels.
// @match        https://goa2.frontend.pedroliv.dev/game/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
/* Open your existing game URL with &3d=0. Install as a userscript or paste this
   entire file in the page console. Only activates at <=900 CSS pixels.
   Remove: GOA2Mobile2D.destroy(). Reload also removes a console-installed patch.
   Loads card artwork from this site; no automatic moves. Stores display preferences and up to 2,000 received events per game locally.
   Live markup inspected 2026-10-02. Desktop layout is preserved.
   Validation: DOM lifecycle/navigation tests; phone visual testing still needed.
*/
(() => {
  // READER GUIDE
  // This file adapts the existing 2D page; the website still owns game state and actions.
  // Search for these section labels to navigate the file:
  //   1. Installation and local UI state
  //   2. Mobile stylesheet
  //   3. Navigation and generated containers
  //   4. Artwork painter (self-contained canvas helpers)
  //   5. Shared card presentation and upgrade values
  //   6. Deck browser and canvas synchronization
  //   7. Header, settings, compact Board summaries, and gestures
  //   8. Public component props and hero dashboards
  //   9. Received-event history
  //   10. DOM reconciliation and teardown
  //
  // Data flows from rendered DOM/component props into presentation helpers, then back
  // into generated DOM. Native buttons are clicked for actions; no game commands are sent.
  // `data-m2-*` attributes mark adapted website elements; `.m2-*` classes mark our UI.
  // Render keys avoid rebuilding unchanged content. schedule() batches DOM changes.
  //
  // 1. Installation and local UI state
  'use strict';

  // Reinstall safely: undo the previous adapter before attaching another one.
  window.GOA2Mobile2D?.destroy();
  if (new URLSearchParams(location.search).get('3d') !== '0') return;
  window.GOA2Mobile?.destroy();
  // The root carries layout flags. These registries retain only nodes/attributes we
  // need to clean up when the adapter is disabled or reinstalled.
  const root = document.documentElement,
    ac = new AbortController(),
    tagged = new Set();
  const media = matchMedia('(max-width:900px)');

  // Match the stable portion of the website’s generated CSS-module class names.
  const c = (n) => `[class*="_${n}_"]`,
    q = (s, e = document) => e.querySelector(s);
  const tag = (e, n) => {
    if (e && e.getAttribute('data-m2') !== n) {
      e.setAttribute('data-m2', n);
      tagged.add(e);
    }
  };
  // Navigation, detail selection, and lifecycle state.
  let mode = 'split',
    panel = '',
    deckOpen = false;
  // Dismissal remembers the current card/tooltip, so a refresh does not reopen it.
  // Expanded hero identity and selected card identity are separate: opening a hero
  // reveals its rows; selecting one row opens just that card in the detail display.
  let hiddenCardKey = '',
    dismissedTip = null,
    expandedHeroId = null;
  let frame = 0,
    dead = false;
  let selectedHeroCard = null;
  const changedAttributes = new Map();

  // Remember native attributes so destroy() can restore keyboard and ARIA behavior.
  function managedAttribute(el, key, value) {
    let before = changedAttributes.get(el);
    if (!before) {
      before = new Map();
      changedAttributes.set(el, before);
    }
    if (!before.has(key)) before.set(key, el.getAttribute(key));
    if (el.getAttribute(key) !== String(value)) el.setAttribute(key, value);
  }
  function clearHeroCard() {
    selectedHeroCard = null;
    heroPanel.replaceChildren();
    delete heroPanel.dataset.key;
  }
  // Deck preferences persist independently of the active navigation tab.
  let deckView = 'grid',
    deckSort = 'tier',
    deckState = null;
  const deckPreferencesKey = 'goa2-mobile-deck';
  const style = document.createElement('style');
  style.id = 'goa2-m2-style';
  // 2. Mobile stylesheet
  // The ampersand is a placeholder replaced with html[data-m2-active] below.
  // Rules are deliberately ordered: shared layout first, followed by narrower view
  // and component overrides. Keep that order when changing selectors or specificity.
  const css = `
  /* Mobile layout. Rule order is intentional; later sections refine shared styles. */
  & {
  }
  /* Base mobile layout: constrain overscroll and reserve space for fixed controls. */
  & body {
    overscroll-behavior: none;
  }
  & [data-m2="layout"] {
    box-sizing: border-box;
    padding-bottom: var(--m2-nav);
    overflow: hidden;
  }
  & [data-m2="header"] {
    box-sizing: border-box;
    z-index: 80;
  }
  & [data-m2="header"] [class*="_teamPanel_"] {
    min-height: 28px !important;
    border-radius: 7px;
  }
  & [data-m2="header"] [class*="_teamIdentity_"] {
    display: none;
  }
  & [data-m2="header"] [class*="_tieBreaker_"] {
    width: 20px !important;
    height: 20px !important;
    transform: none !important;
  }
  & [data-m2="header"] [class*="_matchMeta_"] {
    font-size: 8px;
  }
  & [data-m2="header"] [class*="_matchMeta_"] > span {
    display: inline !important;
  }
  & [data-m2="header"] [class*="_waveCounter_"] {
    width: 14px;
    height: 14px;
  }
  & [data-m2="header"] [class*="_status_"] {
    box-sizing: border-box;
    padding: 3px 8px;
  }
  & [data-m2="header"] [class*="_statusDetail_"] {
    display: none;
  }
  & [data-m2="header"] [class*="_statusCopy_"] strong {
    font: 600 12px system-ui;
  }
  & [data-m2="main"] {
    flex: 1 1 0 !important;
    min-height: 0;
    flex-direction: column !important;
    overflow: hidden;
  }
  & [data-m2="board"] {
    flex: 0 0 43% !important;
    min-height: 0 !important;
  }
  & [data-m2="sidebar"] {
    box-sizing: border-box;
    width: 100% !important;
    flex: 1 1 0 !important;
    min-height: 0 !important;
    padding: 8px !important;
    overflow: auto;
    border-left: 0;
    overscroll-behavior: contain;
  }
  &[data-m2-mode="board"] [data-m2="board"] {
    flex: 1 1 0 !important;
  }
  &[data-m2-mode="board"] [data-m2="sidebar"] {
    display: none !important;
  }
  &[data-m2-mode="hand"] [data-m2="board"] {
    flex: 0 0 22% !important;
  }
  & [data-m2="sidebar"] [class*="_row_"]:has([class*="_cardName_"]) {
    box-sizing: border-box;
    min-height: 44px;
    padding: 6px 8px;
    gap: 5px;
    touch-action: manipulation;
  }
  & [data-m2="sidebar"] [class*="_cardName_"] {
    white-space: normal;
    overflow: visible;
    font-size: 13px;
    line-height: 1.2;
  }
  & [data-m2="sidebar"] [class*="_shortcutBadge_"] {
    display: none;
  }
  & [data-m2="sidebar"] [class*="_stat_"] {
    min-width: 0;
    padding: 2px 3px;
  }
  & [data-m2="sidebar"] [class*="_stats_"] {
    flex-shrink: 0;
  }
  & [data-m2="commit"] {
    background: #111722;
  }
  & [data-m2="commit"] button {
    width: 100%;
    min-height: 44px;
    font-size: 15px;
  }
  & [data-m2="commit"] [class*="_shortcutHint_"] {
    display: none;
  }
  & [data-m2="setup"],
  & [data-m2="tools"] {
    display: none !important;
  }
  &[data-m2-panel="setup"] [data-m2="setup"],
  &[data-m2-panel="tools"] [data-m2="tools"] {
    display: flex !important;
    position: fixed !important;
    box-sizing: border-box;
    left: 8px !important;
    right: 8px !important;
    top: auto !important;
    bottom: calc(var(--m2-nav) + 8px) !important;
    width: auto !important;
    max-width: none !important;
    max-height: 40dvh !important;
    overflow: auto !important;
    padding: 10px !important;
    transform: none !important;
    z-index: 200 !important;
    background: #141b27f7;
    border: 1px solid #59667c;
    border-radius: 12px;
  }
  & [data-m2="setup"] button,
  & [data-m2="tools"] button {
    min-height: 44px;
    opacity: 1;
    font-size: 13px;
  }
  & [data-m2="tip"] {
    box-sizing: border-box !important;
    left: 8px !important;
    right: 8px !important;
    width: auto !important;
    max-width: none !important;
    overflow: auto !important;
    pointer-events: auto !important;
    transform: none !important;
    animation: none !important;
    opacity: 1 !important;
    z-index: 400 !important;
  }
  & [data-m2="tip"][data-m2-dismissed] {
    display: none !important;
  }
  &:has([data-m2="tip"]:not([data-m2-dismissed])) [data-m2="setup"] {
    display: none !important;
  }
  & #goa2-m2-close {
    position: fixed;
    right: 8px;
    z-index: 410;
    min-height: 40px;
    padding: 8px 15px;
    background: #253248;
    color: #fff;
    border: 1px solid #73829a;
    border-radius: 8px;
    font: 600 13px system-ui;
  }
  /* Bottom navigation stays outside the native sidebar so every main view can reach it. */
  & #goa2-m2-nav {
    box-sizing: border-box;
    display: grid;
    gap: 3px;
    position: fixed;
    left: 0;
    right: 0;
    background: #101621;
    border-top: 1px solid #3f4c61;
  }
  & #goa2-m2-nav button {
    min-width: 0;
    border: 0;
    background: transparent;
    color: #c0cbdc;
    font: 600 12px system-ui;
    touch-action: manipulation;
  }
  & #goa2-m2-nav button[aria-pressed="true"] {
    color: #ffe09c;
    background: #303c4f;
  }
  & [data-m2="deck"] {
    box-sizing: border-box;
    overscroll-behavior: contain;
  }
  & [data-m2="deck"] [class*="_header_"] {
    position: sticky;
    top: -12px;
    z-index: 2;
    min-height: 44px;
    padding: 8px 0 !important;
    background: var(--bg-secondary, #111722);
  }
  & [data-m2="deck"] [class*="_closeBtn_"] {
    width: 44px;
    height: 44px;
    font-size: 24px;
  }
  & [data-m2="deck"] [class*="_cardGrid_"] {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }
  & [data-m2="deck"] [class*="_cardGrid_"] > div {
    width: min(100%, 360px);
  }
  & [data-m2="deck"] [class*="_cardGrid_"] canvas {
    width: 100% !important;
    height: auto !important;
  }
  & {
    --m2-safe: min(env(safe-area-inset-bottom, 0px), 16px);
  }
  & [data-m2="layout"] {
    height: var(--m2-vh, 100dvh) !important;
  }
  & [data-m2="header"] {
    grid-template-rows: 24px 18px 28px;
    overflow: hidden;
  }
  & [data-m2="header"] [class*="_matchPanel_"] {
    display: contents;
  }
  & [data-m2="header"] [class*="_matchMeta_"] {
    grid-column: 2;
    grid-row: 1;
    flex-wrap: nowrap;
    white-space: nowrap;
  }
  & [data-m2="header"] [class*="_waveLanes_"] {
    grid-column: 2;
    grid-row: 2;
  }
  & [data-m2="header"] [class*="_status_"] {
    grid-column: 1/-1;
    grid-row: 3;
    min-width: 0 !important;
  }
  & [data-m2="header"] [class*="_redPanel_"] {
    grid-column: 1;
    grid-row: 1/3;
  }
  & [data-m2="header"] [class*="_bluePanel_"] {
    grid-column: 3;
    grid-row: 1/3;
  }
  & [data-m2="header"] [class*="_lifeCounters_"] {
    max-width: 100%;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0;
  }
  & [data-m2="header"] [class*="_lifeCounter_"] {
    width: 12px !important;
    margin: 0-1px !important;
  }
  & #goa2-m2-nav {
    padding-bottom: calc(3px + var(--m2-safe));
    bottom: var(--m2-offset, 0px);
  }
  &[data-m2-mode="hand"] [data-m2="board"] {
    visibility: hidden;
    position: absolute !important;
    width: 1px;
    height: 1px;
    overflow: hidden;
    pointer-events: none;
  }
  & [data-m2="sidebar"] [class*="_hint_"] {
    display: none;
  }
  & [data-m2="hero"] {
    margin: 0 !important;
  }
  & [data-m2="hero"] [class*="_viewDeckBtn_"] {
    margin-top: 4px;
    padding: 5px 10px;
    min-height: 32px;
  }
  & [data-m2="empty-pile"] {
    display: none !important;
  }
  & [data-m2="tip"] {
    top: calc(var(--m2-head) + 8px) !important;
    bottom: auto !important;
    max-height: calc(var(--m2-vh, 100dvh) - var(--m2-head) - var(--m2-nav) - 120px) !important;
    padding: 8px !important;
  }
  & #goa2-m2-close {
    bottom: calc(var(--m2-nav) + var(--m2-offset, 0px) + 60px);
  }
  & [data-m2="commit"] {
    left: 8px;
    right: 8px;
    bottom: calc(var(--m2-nav) + var(--m2-offset, 0px));
  }
  &[data-m2-mode="board"] [data-m2="commit"] {
    display: none !important;
  }

  & #goa2-m2-nav button {
    font-size: 11px;
    padding: 3px 1px;
  }
  &[data-m2-mode="heroes"] [data-m2="board"] {
    visibility: hidden;
    position: absolute !important;
    width: 1px;
    height: 1px;
    overflow: hidden;
    pointer-events: none;
  }
  &[data-m2-mode="heroes"] [data-m2="hand-list"] {
    display: none !important;
  }
  &[data-m2-mode="hand"] [data-m2="hero"][data-m2-other] {
    display: none !important;
  }
  &[data-m2-mode="board"] [data-m2="board"] {
    margin-bottom: var(--m2-summary-h, 78px);
  }
  /* Compact Board overview. Its measured row count determines the reserved height. */
  &[data-m2-mode="board"] #goa2-m2-summary {
    display: flex;
    box-sizing: border-box;
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(var(--m2-nav) + var(--m2-offset, 0px));
    height: var(--m2-summary-h, 78px);
    z-index: 90;
    gap: 2px;
    padding: 5px 8px;
    flex-direction: column;
    overflow: hidden;
    background: #111722f5;
    border-top: 1px solid #384459;
  }
  & #goa2-m2-summary article {
    display: grid;
    align-items: center;
    gap: 4px;
    flex: 0 0 24px;
    box-sizing: border-box;
    min-width: 0;
    padding: 2px 6px;
    border: 1px solid #435066;
    border-radius: 8px;
    background: #202936;
  }
  & #goa2-m2-summary strong {
    display: block;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  & #goa2-m2-summary small {
    display: block;
    font-size: 11px;
    color: #c4cede;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  & #goa2-m2-summary .m2-colors {
    display: flex;
    gap: 3px;
    margin-top: 0;
    align-items: center;
    justify-content: flex-end;
    font-size: 9px;
    color: #9facbf;
  }
  & #goa2-m2-summary .m2-colors i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: block;
  }
  & {
    --m2-nav: 48px;
  }
  & #goa2-m2-nav {
    height: 48px;
    padding: 2px 4px;
  }
  & #goa2-m2-nav button {
    min-height: 44px;
    border-radius: 6px;
  }
  & [data-m2="commit"] {
    position: static !important;
    padding: 6px 0 !important;
    z-index: auto !important;
  }
  & [data-m2="sidebar"]:has([data-m2="commit"]) {
    padding-bottom: 12px !important;
  }
  & [data-m2="hero"]:has([class*="_viewDeckBtn_"]) {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 2px 8px;
    align-items: center;
  }
  & [data-m2="hero"] > [class*="_name_"] {
    grid-column: 1;
    grid-row: 1;
  }
  & [data-m2="hero"] > [class*="_details_"] {
    grid-column: 1;
    grid-row: 2;
  }
  & [data-m2="hero"] > [class*="_viewDeckBtn_"] {
    grid-column: 2;
    grid-row: 1/3;
    margin: 0 !important;
    min-height: 36px;
  }
  &
    [data-m2="hero"]:has([class*="_viewDeckBtn_"])
    > div:not([class*="_name_"]):not([class*="_details_"]) {
    grid-column: 1/-1;
  }
  &[data-m2-panel="setup"] [data-m2="setup"] {
    visibility: visible !important;
    pointer-events: auto !important;
    z-index: 600 !important;
  }
  &[data-m2-panel="tools"] [data-m2="tools"] {
    visibility: visible !important;
    pointer-events: auto !important;
    z-index: 600 !important;
  }
  &[data-m2-panel="setup"] [data-m2="board"],
  &[data-m2-panel="tools"] [data-m2="board"] {
    overflow: visible !important;
  }
  & [data-m2="life-fraction"] [class*="_lifeCounters_"] {
    display: none !important;
  }
  & [data-m2="life-fraction"]:after {
    content: attr(data-m2-fraction);
    font: 700 18px system-ui;
    display: block;
    text-align: center;
  }
  & .m2-hand-actions {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    margin: 5px 0 8px;
  }
  & .m2-hand-actions button,
  & #goa2-m2-details button {
    min-height: 36px;
    padding: 5px 10px;
    border: 1px solid #52627a;
    border-radius: 7px;
    background: #233046;
    color: #e7edf5;
    font: 600 12px system-ui;
  }
  & #goa2-m2-details {
    display: none;
  }
  &[data-m2-mode="hand"] #goa2-m2-details:not(:empty) {
    display: block;
    box-sizing: border-box;
    flex: 0 0 auto;
    max-height: 42dvh;
    overflow: auto;
    margin: 6px 8px;
    border-radius: 10px;
  }
  &[data-m2-mode="hand"] [data-m2="tip"] {
    display: none !important;
  }
  &[data-m2-mode="hand"] #goa2-m2-close {
    display: none !important;
  }
  & #goa2-m2-details > div {
    max-width: none !important;
  }
  /* Hide native Deck content only after the replacement is ready; retain it as the data source. */
  & [data-m2-deck-ready] > [class*="_tierGroup_"] {
    display: none !important;
  }
  & [data-m2-deck-ready] > [class*="_header_"] {
    margin-bottom: 4px;
  }
  /* Deck view controls and grouped card layouts. Canvas copies preserve artwork proportions. */
  & .m2-deck-controls {
    position: sticky;
    z-index: 3;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    background: var(--bg-secondary, #111722);
  }
  & .m2-deck-controls button,
  & .m2-deck-zoom > button {
    min-height: 36px;
    border: 1px solid #536179;
    border-radius: 7px;
    background: #233046;
    color: #e7edf5;
  }
  & .m2-deck-controls button[aria-pressed="true"] {
    background: #405473;
    color: #ffe09c;
  }
  & .m2-deck-browser h3 {
    margin: 12px 0 5px;
    font-size: 12px;
    text-transform: capitalize;
    color: #aabbd1;
  }
  & .m2-deck-cards {
    display: grid;
    gap: 6px;
  }
  & .m2-deck-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  & .m2-deck-list,
  & .m2-deck-large {
    grid-template-columns: minmax(0, 1fr);
  }
  & .m2-deck-card {
    min-width: 0;
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  & .m2-deck-card canvas {
    display: block;
    width: 100% !important;
    height: auto !important;
    border-radius: 6px;
  }
  & .m2-deck-large .m2-deck-card {
    width: min(100%, 360px);
    justify-self: center;
  }
  & .m2-deck-list .m2-deck-card {
    border-radius: 8px;
  }
  & .m2-deck-list strong {
    display: block;
    font-size: 14px;
  }
  & .m2-deck-list small {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    line-height: 1.4;
    color: #b4c2d5;
  }
  & .m2-deck-list p {
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.45;
    white-space: pre-line;
  }
  /* Enlarged artwork sits above the browser; hidden zoom roots must not capture taps. */
  & .m2-deck-zoom:not([hidden]) {
    display: flex;
    position: fixed;
    inset: 8px;
    z-index: 10000;
    padding: 10px;
    box-sizing: border-box;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: #0d1420f7;
    border: 1px solid #63728a;
    border-radius: 12px;
    overflow: auto;
  }
  & .m2-deck-zoom > button {
    position: sticky;
    top: 0;
    align-self: flex-end;
    min-width: 90px;
  }
  & .m2-deck-zoom canvas {
    width: min(100%, 440px) !important;
    height: auto !important;
    flex: none;
  }
  /* Shared text-card shell used for details, Deck list view, and upgrade choices. */
  & .m2-text-card {
    border: 1px solid #47515e;
    border-radius: 9px;
    background: #191e26;
    color: #e5e7eb;
    overflow: hidden;
    text-align: left;
    font: 13px/1.45 system-ui;
    width: 100%;
    box-sizing: border-box;
  }
  & .m2-card-top {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) 32px;
    align-items: center;
    gap: 4px;
    padding: 8px;
    background: var(--card-color);
    color: #131820;
  }
  & .m2-card-top > b {
    text-align: center;
    font-size: 15px;
  }
  & .m2-card-top > span:last-child {
    text-align: right;
    font-weight: 700;
  }
  /* Shared stat icon wrapper. Later value-overlay rules center numbers on the artwork. */
  & .m2-symbol {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
    font-weight: 650;
  }
  & .m2-symbol img {
    width: 21px;
    height: 21px;
    object-fit: contain;
    filter: grayscale(1);
  }
  & .m2-card-body {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 8px;
    padding: 10px 8px;
  }
  & .m2-card-body > aside {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  & .m2-card-type {
    align-items: center;
    gap: 5px;
    margin-bottom: 9px;
  }
  & .m2-card-type > b {
    flex: 1;
    font-size: 12px;
  }
  & .m2-card-effect {
    white-space: pre-line;
    line-height: 1.5;
  }
  & .m2-card-foot {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: center;
    padding: 7px 8px;
  }
  & .m2-card-foot:empty {
    display: none;
  }
  & .m2-card-foot .m2-action,
  & .m2-card-foot button {
    border: 1px solid currentColor;
    border-radius: 4px;
    padding: 4px 6px;
    font-size: 11px;
    background: #252b32;
    color: #d2d6dc;
  }
  & .m2-card-foot [data-action="MOVEMENT"] {
    color: #7bbded !important;
  }
  & .m2-card-foot [data-action="DEFENSE"] {
    color: #87cb8b !important;
  }
  & .m2-card-foot [data-action="ATTACK"] {
    color: #ef8b83 !important;
  }
  & .m2-card-foot [data-action="SKILL"],
  & .m2-card-foot [data-action="DEFENSE_SKILL"] {
    color: #d0a4ed !important;
  }
  & .m2-deck-list .m2-deck-card {
    padding: 0;
    border: 0;
    background: none;
  }
  /* Native tooltip adaptation: suppress old contents only when our replacement exists. */
  & [data-m2="tip"]:has(> .m2-text-card) {
    padding: 0 !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }
  & [data-m2="tip"]:has(> .m2-text-card) > :not(.m2-text-card) {
    display: none !important;
  }
  &[data-m2-mode="hand"] #goa2-m2-details {
    display: block;
    box-sizing: border-box;
    height: clamp(190px, 30dvh, 260px);
    min-height: clamp(190px, 30dvh, 260px);
    max-height: none;
    flex: 0 0 auto;
    overflow: auto;
    margin: 6px 8px;
    padding: 0;
    border: 0;
    background: none;
    border-radius: 9px;
  }
  & #goa2-m2-details:empty:after {
    content: "Select a card to view details";
    display: grid;
    place-items: center;
    height: 100%;
    color: #97a2b3;
    font-size: 13px;
  }
  /* Hand details use a dedicated display area rather than a second border around the card. */
  & #goa2-m2-details > .m2-text-card {
    min-height: 100%;
  }
  & #goa2-m2-nav {
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
  & [class*="_viewDeckBtn_"] {
    display: none !important;
  }
  &[data-m2-mode="hand"] [data-m2="hero"] {
    display: none !important;
  }
  & [class*="_modal_"] [class*="_cardGrid_"] {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 6px !important;
  }
  & [class*="_modal_"] [class*="_cardGrid_"] > div {
    min-width: 0 !important;
  }
  & [class*="_modal_"] [class*="_cardGrid_"] canvas {
    width: 100% !important;
    height: auto !important;
  }
  & .m2-text-card {
    display: flex;
    flex-direction: column;
  }
  & .m2-card-type {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) 40px;
  }
  & .m2-card-type > b {
    text-align: center;
  }
  & .m2-card-type > .m2-symbol:last-child:not(:first-child) {
    justify-self: end;
  }
  & .m2-card-foot {
    margin-top: auto;
    justify-content: center;
    background: #11161e;
    min-height: 24px;
  }
  &[data-m2-mode="hand"] #goa2-m2-details:not(:empty) {
    border: 0 !important;
    padding: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }
  & .m2-sort-switch {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 7px;
  }
  & .m2-sort-switch > span {
    display: flex;
    flex-direction: column;
    font-size: 10px;
    line-height: 15px;
  }
  & .m2-sort-switch > i {
    position: relative;
    display: block;
    width: 15px;
    height: 29px;
    border-radius: 9px;
    background: #101823;
    border: 1px solid #8796aa;
  }
  & .m2-sort-switch > i:after {
    content: "";
    position: absolute;
    left: 2px;
    top: 2px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #ebd99a;
    transition: transform 0.12s;
  }
  & .m2-sort-switch[aria-checked="true"] > i:after {
    transform: translateY(14px);
  }
  & [data-m2="life-fraction"] {
    display: flex !important;
    gap: 3px;
    align-items: center;
    justify-content: center;
  }
  & [data-m2="life-fraction"]:before {
    content: "";
    display: block;
    width: 18px;
    height: 22px;
    background: url(/icons/life_counter_red_front.png) center/contain no-repeat;
  }
  & [aria-label^="Blue team"] [data-m2="life-fraction"] {
    flex-direction: row-reverse;
  }
  & [aria-label^="Blue team"] [data-m2="life-fraction"]:before {
    background-image: url(/icons/life_counter_blue_front.png);
  }
  & [data-m2="header"] [class*="_matchMeta_"] {
    display: grid !important;
    position: relative;
  }
  & [data-m2="header"] [class*="_matchMeta_"] > span:first-child {
    grid-column: 1;
    grid-row: 1;
    font-size: 8px;
    white-space: nowrap;
  }
  & [data-m2="header"] [class*="_matchMeta_"] > span:nth-child(3) {
    grid-column: 1;
    grid-row: 2;
    font-size: 8px;
    white-space: nowrap;
  }
  & [data-m2="header"] [class*="_phase_"] {
    grid-column: 2;
    grid-row: 1;
    align-self: center;
  }
  & [data-m2="header"] [class*="_tieBreaker_"] {
    justify-self: center;
  }
  & [data-m2="header"] [class*="_matchMeta_"]:after {
    content: attr(data-m2-coin);
    text-align: center;
    text-transform: none;
  }
  & [data-m2="header"] [class*="_waveCounterStack_"],
  & [data-m2="header"] [class*="_waveLaneLabel_"] {
    display: none !important;
  }
  & [data-m2="header"] [class*="_waveLane_"]:after {
    content: attr(data-m2-waves);
    font-size: 10px;
  }
  & [data-m2="header"] [class*="_waveLane_"]:before {
    content: "";
    width: 17px;
    height: 17px;
    background: url(/icons/wave_counter.png) center/contain no-repeat;
  }
  & [data-m2="header"] [class*="_waveLane_"] {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  & [data-m2="header"] [class*="_waveLanes_"] {
    pointer-events: none;
  }
  /* The tier/color control is a switch, visually separate from the view buttons. */
  & .m2-deck-controls .m2-sort-switch {
    background: transparent !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  & [data-m2="deck"] > [class*="_header_"] {
    display: none !important;
  }
  & .m2-deck-title {
    text-align: center;
    font: 600 13px system-ui;
    padding: 5px 0 7px;
  }
  & .m2-deck-controls {
    top: 0 !important;
    margin: 0 0 7px;
    padding: 5px 0;
  }
  & [data-m2="deck"] {
    position: fixed !important;
    inset: 0 0 calc(var(--m2-nav) + var(--m2-offset, 0px)) !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    max-height: none !important;
    margin: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    padding: 6px 8px !important;
  }
  & [class*="_backdrop_"]:has([data-m2="deck"]) {
    bottom: calc(var(--m2-nav) + var(--m2-offset, 0px)) !important;
  }
  /* A mounted native Deck modal must not leak into another tab when Deck is closed. */
  &:not([data-m2-deck-open]) [class*="_backdrop_"]:has([data-m2="deck"]),
  &:not([data-m2-deck-open]) [data-m2="deck"] {
    display: none !important;
  }
  & #goa2-m2-nav {
    z-index: 10001 !important;
  }
  & [data-m2="header"] {
    grid-template-columns: 78px minmax(0, 1fr) 78px !important;
    gap: 4px !important;
  }
  & [data-m2="header"] [class*="_teamPanel_"] {
    padding: 3px !important;
  }
  & [data-m2="life-fraction"]:after {
    font-size: 17px;
  }
  & [data-m2="header"] [class*="_matchMeta_"] {
    grid-template-rows: 20px 16px !important;
    gap: 0 2px !important;
    align-items: center;
  }
  & [data-m2="header"] [class*="_phase_"] {
    justify-self: center;
    white-space: nowrap;
  }
  & [data-m2="header"] [class*="_waveLanes_"] {
    margin-top: -16px;
    min-height: 16px;
  }
  & [data-m2="header"] [class*="_matchMeta_"] > span:first-child,
  & [data-m2="header"] [class*="_matchMeta_"] > span:nth-child(3) {
    font-size: 7px;
  }
  & [data-m2="header"] [class*="_matchMeta_"]:after {
    font-size: 7px;
  }
  & #goa2-m2-close {
    display: none !important;
  }
  & .m2-card-top {
    position: relative;
  }
  & .m2-card-foot.m2-has-dismiss {
    position: relative;
    padding-right: 38px;
    min-height: 30px;
  }
  & .m2-card-foot .m2-card-dismiss {
    position: absolute;
    right: 3px;
    bottom: 3px;
    min-height: 28px !important;
    width: 28px;
    padding: 0 !important;
    border: 0 !important;
    background: transparent !important;
    color: #c4cedb !important;
    font: 22px system-ui !important;
  }
  & #goa2-m2-nav button[data-mode="tools"] {
    font-size: 25px;
    line-height: 1;
  }
  & [data-m2="header"] {
    position: relative !important;
  }
  & [data-m2="header"] [class*="_matchPanel_"],
  & [data-m2="header"] [class*="_matchMeta_"] {
    position: static !important;
  }
  & [data-m2="header"] [class*="_matchMeta_"] {
    grid-template-columns: 38px minmax(0, 1fr) 38px !important;
  }
  & [data-m2="header"] [class*="_tieBreaker_"] {
    grid-column: 2 !important;
    grid-row: 1 !important;
  }
  & [data-m2="header"] [class*="_matchMeta_"]:after {
    grid-column: 2 !important;
    grid-row: 2 !important;
  }
  & [data-m2="header"] [class*="_waveLanes_"] {
    position: absolute !important;
    right: 86px;
    top: 10px;
    margin: 0 !important;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 38px;
  }
  & [data-m2="header"] [class*="_phase_"] {
    position: absolute !important;
    left: 8px !important;
    bottom: 5px !important;
    top: auto !important;
    width: calc(50% - 10px) !important;
    max-width: none !important;
    height: 25px;
    display: flex !important;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    font-size: 10px !important;
    padding: 3px 8px !important;
    transform: none !important;
  }
  & [data-m2="header"] [class*="_phase_"]:before {
    position: static !important;
    margin-right: 5px;
  }
  & [data-m2="header"] [class*="_status_"] {
    position: absolute !important;
    left: auto !important;
    right: 8px !important;
    bottom: 5px !important;
    top: auto !important;
    width: calc(50% - 10px) !important;
    min-height: 25px;
    height: 25px;
    max-width: none !important;
    transform: none !important;
    margin: 0 !important;
  }
  & [data-m2="header"] [class*="_statusCopy_"] strong {
    font-size: 11px;
  }
  & [data-m2="header"] [class*="_teamPanel_"] {
    align-self: start !important;
    margin-top: 5px;
  }
  & [aria-label^="Blue team"] [class*="_teamTop_"] {
    justify-content: flex-end !important;
  }
  & [aria-label^="Blue team"] [data-m2="life-fraction"] {
    margin-left: auto !important;
    justify-content: flex-start !important;
    width: max-content !important;
  }
  & [data-m2="header"] {
    display: block !important;
    height: auto !important;
    min-height: 0 !important;
    flex: 0 0 auto !important;
    padding: 5px 8px !important;
  }
  /* Keep native header elements mounted for data reads while showing only the compact HUD. */
  & [data-m2="header"] > :not(.m2-hud) {
    display: none !important;
  }
  & {
    --m2-head: 84px;
    --m2-radius: 8px;
    --m2-border: #394353;
    --m2-gap: 6px;
  }
  & .m2-hud {
    width: 100%;
  }
  /* Mirrored lives flank round/turn, coin, and waves; narrow columns may shrink without overflow. */
  & .m2-hud-top {
    display: grid;
    grid-template-columns: minmax(44px, 1fr) 54px 40px 54px minmax(44px, 1fr);
    align-items: center;
    gap: 4px;
    height: 40px;
  }
  & .m2-life {
    display: flex;
    gap: 3px;
    align-items: center;
    font-size: 17px;
    white-space: nowrap;
  }
  & .m2-life.red {
    color: #f27070;
    justify-content: flex-start;
  }
  & .m2-life.blue {
    color: #69b5fc;
    justify-content: flex-end;
  }
  & .m2-life img {
    width: 19px;
    height: 23px;
    object-fit: contain;
  }
  & .m2-round {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 8px;
    line-height: 15px;
    text-transform: uppercase;
    font-variant-numeric: tabular-nums;
  }
  & .m2-coin {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  & .m2-coin img {
    width: 24px;
    height: 24px;
  }
  & .m2-coin small {
    font-size: 7px;
  }
  & .m2-waves {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font-size: 11px;
  }
  & .m2-waves img {
    width: 18px;
    height: 18px;
  }
  /* Phase and action each occupy half the row. Action text may wrap inside its own half. */
  & .m2-hud-bottom {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 6px;
    min-height: 30px;
    height: auto;
    margin-top: 4px;
  }
  & .m2-hud-bottom > div {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #48515c;
    border-radius: 9px;
    text-align: center;
    font: 600 10px/1.15 system-ui;
    overflow: hidden;
  }
  & .m2-phase {
    color: #b6d9c1;
    background: #17312a;
  }
  & .m2-status {
    color: #ead49d;
    background: #29251c;
  }
  & [data-m2="commit"] button:not(:disabled) {
    background: var(--m2-card-accent) !important;
    border-color: var(--m2-card-accent) !important;
    color: #10151b !important;
  }
  & [data-m2="sidebar"] [class*="_row_"][class*="_selected_"] {
    border-color: var(--m2-card-accent) !important;
    box-shadow: 0 0 0 1px var(--m2-card-accent) !important;
    background: color-mix(in srgb, var(--m2-card-accent) 14%, #191f29) !important;
  }
  & [data-m2="resolution-queue"] {
    display: none !important;
  }
  &[data-m2-mode="heroes"] [data-m2="sidebar"] {
    display: flex !important;
    flex-direction: column;
    gap: 8px;
  }
  & .m2-current-hero {
    outline: none !important;
    border-color: #6d6244 !important;
    box-shadow: inset 2px 0 #d6bc77 !important;
    background: #25272a !important;
  }
  & .m2-resolution-info {
    font-size: 11px;
    color: #e7cc83;
    margin-top: 4px;
    grid-column: 1/-1;
  }

  &[data-m2-hide-cursors] [class*="_remoteCursor_"] {
    display: none !important;
  }
  &[data-m2-mode="split"] [data-m2="sidebar"],
  &[data-m2-mode="heroes"] [data-m2="sidebar"] {
    display: flex !important;
    flex-direction: column;
  }
  &[data-m2-mode="split"] [data-m2="own-wrapper"],
  &[data-m2-mode="heroes"] [data-m2="own-wrapper"] {
    display: contents !important;
  }
  &[data-m2-mode="split"] [data-m2="hand-list"] {
    order: -1;
  }
  & .m2-resolution-info {
    display: flex;
    align-items: center;
  }
  & #goa2-m2-summary small .m2-symbol img {
    width: 13px;
    height: 13px;
  }
  & img[src*="/hero-cards/"] {
    width: auto !important;
    height: auto !important;
    max-width: calc(100vw - 24px) !important;
    max-height: calc(100dvh - 90px) !important;
    object-fit: contain;
  }
  & .m2-hud-bottom > div {
    position: relative;
    box-sizing: border-box;
    min-width: 0;
    padding: 3px 17px;
    white-space: pre-line;
    overflow-wrap: anywhere;
    line-height: 12px;
    font-size: 9px;
  }
  & .m2-hud-bottom > div:before {
    content: "";
    position: absolute;
    left: 7px;
    top: 50%;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    transform: translateY(-50%);
    animation: m2-breathe 2s ease-in-out infinite;
  }
  /* Action indicator pulse; phase remains static so only the requested action draws attention. */
  @keyframes m2-breathe {
    0%,
    100% {
      opacity: 0.45;
      box-shadow: 0 0 0 0 currentColor;
    }
    50% {
      opacity: 1;
      box-shadow: 0 0 7px 1px currentColor;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    & .m2-hud-bottom > div:before {
      animation: none;
    }
  }
  & img[class*="_heroCard_"][src*="/hero-cards/"] {
    position: fixed !important;
    left: 50% !important;
    top: 50% !important;
    right: auto !important;
    bottom: auto !important;
    transform: translate(-50%, -50%) !important;
    animation: none !important;
    z-index: 10002 !important;
  }
  & .m2-phase:before {
    animation: none !important;
    opacity: 1;
    box-shadow: none;
  }
  & [data-m2="hero"] {
    position: relative;
  }
  & [data-m2="hero"] > [class*="_name_"] {
    padding-right: 88px;
  }
  & .m2-resolution-info {
    position: absolute;
    right: 9px;
    top: 9px;
    margin: 0 !important;
    gap: 7px;
  }
  & .m2-resolution-info > .m2-symbol img {
    width: 17px;
    height: 17px;
  }
  @media (max-height: 500px) {
    & {
    }
    & [data-m2="header"] [class*="_waveLanes_"] {
      display: none;
    }
    &[data-m2-mode="split"] [data-m2="main"] {
      flex-direction: row !important;
    }
    &[data-m2-mode="split"] [data-m2="board"] {
      flex: 1 1 0 !important;
    }
    &[data-m2-mode="split"] [data-m2="sidebar"] {
      flex: 0 0 44% !important;
      width: 44% !important;
    }
  }
  /* Compact hero panels; their card rows match the 24px board summaries. */
  & [data-m2="hero"] {
    border-radius: var(--m2-radius);
    border-color: var(--m2-border);
    padding: 6px 7px !important;
    box-shadow: none;
  }
  & [data-m2="hero"] > [class*="_details_"] {
    margin-top: 2px;
    font-size: 11px;
    line-height: 15px;
  }
  & [data-m2="hero"] [class*="_currentCard_"] {
    margin-top: 4px;
    padding: 4px 0 0;
  }
  & [data-m2="hero"] [class*="_currentLabel_"] {
    font-size: 10px;
    line-height: 12px;
    margin-bottom: 3px;
  }
  & [data-m2="hero"] [class*="_row_"]:has([class*="_cardName_"]) {
    height: 24px;
    min-height: 24px;
    padding: 2px 6px;
    gap: 4px;
    border-radius: 6px;
  }
  & [data-m2="hero"] [class*="_row_"] [class*="_cardName_"] {
    font-size: 11px;
    line-height: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  & [data-m2="hero"] [class*="_row_"] [class*="_stat_"] {
    min-width: 0;
    padding: 0 2px;
    gap: 1px;
    font-size: 10px;
    line-height: 16px;
  }
  & [data-m2="hero"] [class*="_row_"] [class*="_statIcon_"] {
    width: 12px;
    height: 12px;
  }
  & [data-m2="hero"] [class*="_row_"] [class*="_colorPip_"] {
    width: 8px;
    height: 8px;
  }
  & [data-m2="hero"] .m2-resolution-info {
    top: 7px;
    right: 8px;
    gap: 5px;
    font-size: 10px;
    line-height: 17px;
  }
  & [data-m2="hero"] .m2-resolution-info > .m2-symbol img {
    width: 15px;
    height: 15px;
  }
  & .m2-life b,
  & .m2-waves b {
    font-variant-numeric: tabular-nums;
  }
  & .m2-coin small {
    color: #bac2cf;
    line-height: 11px;
  }
  & [data-m2="sidebar"] [class*="_row_"],
  & .m2-text-card,
  & .m2-deck-controls button:not(.m2-sort-switch) {
    border-radius: var(--m2-radius);
  }
  &[data-m2-mode="split"] [data-m2="sidebar"],
  &[data-m2-mode="heroes"] [data-m2="sidebar"] {
    gap: var(--m2-gap);
  }
  @media (max-height: 500px) {
    & {
      --m2-head: 72px;
    }
    & .m2-hud-top {
      height: 30px;
    }
    & .m2-hud-bottom {
      margin-top: 2px;
    }
    & .m2-coin img {
      width: 20px;
      height: 20px;
    }
    &[data-m2-mode="hand"] #goa2-m2-details {
      height: 160px;
      min-height: 160px;
    }
  }

  & .m2-done-hero {
    background: #171d26 !important;
    border-color: #303844 !important;
    box-shadow: none !important;
  }
  & .m2-done-hero > [class*="_name_"],
  & .m2-done-hero > strong {
    opacity: 0.65;
  }
  & .m2-done-hero .m2-resolution-info {
    color: #a9b8aa;
  }

  /* Compact public hero dashboard. Later heading rules place upgrades at the upper right. */
  & [data-m2="hero"]:has(> .m2-hero-dashboard) > :has([class*="_dots_"]),
  & [data-m2="hero"]:has(> .m2-hero-dashboard) [class*="_items_"] {
    display: none !important;
  }
  & .m2-hero-dashboard {
    flex-direction: column;
    gap: 5px;
    margin-top: 5px;
    font-size: 10px;
    line-height: 15px;
  }
  & .m2-hero-history,
  & .m2-hero-upgrades,
  & .m2-hero-effects {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }
  & .m2-hero-history {
    padding-top: 5px;
    border-top: 1px solid #ffffff12;
  }
  & .m2-history-slot {
    display: inline-flex;
    align-items: center;
    border-radius: 4px;
    color: #abb7c8;
    font-size: 10px;
    cursor: pointer;
  }
  & .m2-history-slot:disabled {
    cursor: default;
    opacity: 0.6;
  }
  /* Hand, played, and discard dots share geometry; active styling is added independently. */
  & .m2-history-marker {
    background: var(--effect-color, #4b5360);
  }
  & .m2-history-slot img {
    object-fit: contain;
  }
  & .m2-hero-upgrades > .m2-symbol {
    border-radius: 4px;
  }

  & .m2-hero-effects button,
  & .m2-offboard-label {
    border: 1px solid #a3b4c544;
    background: #151c29;
    color: #dbe4ee;
    border-radius: 5px;
    font-size: 10px;
    line-height: 16px;
    padding: 2px 6px;
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  & .m2-hero-effects button {
    border-color: var(--effect-color);
    cursor: pointer;
  }
  /* Active effects share the card color through --effect-color, including tiny pile dots. */
  & .m2-effect-active {
    animation: m2-effect-breathe 2.8s ease-in-out infinite;
  }
  /* Gentle glow marks a continuing effect; it does not indicate turn order or selection. */
  @keyframes m2-effect-breathe {
    0%,
    100% {
      box-shadow: 0 0 1px var(--effect-color, #bbab73);
    }
    50% {
      box-shadow: 0 0 7px var(--effect-color, #bbab73);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    & .m2-effect-active {
      animation: none;
      box-shadow: 0 0 3px var(--effect-color, #bbab73);
    }
  }

  /* Hero heading: portrait, name, upgrades, off-board marker. */
  & [data-m2="hero"]:has(> .m2-hero-dashboard) {
    display: grid !important;
    column-gap: 6px;
    row-gap: 3px;
    align-items: center;
  }
  & [data-m2="hero"]:has(> .m2-hero-dashboard) > [class*="_name_"] {
    grid-column: 2;
    grid-row: 1;
    padding: 0;
    min-width: 0;
    font-size: 12px;
    line-height: 16px;
    overflow-wrap: anywhere;
  }
  & [data-m2="hero"]:has(> .m2-hero-dashboard) > [class*="_details_"] {
    grid-column: 2/-1;
    grid-row: 2;
    margin: 0;
  }
  & [data-m2="hero"]:has(> .m2-hero-dashboard) > .m2-resolution-info {
    position: static;
    grid-column: 2/-1;
    grid-row: 3;
    justify-self: end;
  }
  & [data-m2="hero"]:has(> .m2-hero-dashboard) > [class*="_currentCard_"],
  & [data-m2="hero"]:has(> .m2-hero-dashboard) > [class*="_ultimate_"] {
    grid-column: 1/-1;
    grid-row: 5;
  }
  & .m2-hero-dashboard {
    display: contents;
  }
  /* Portrait anchor for turn number/NOW, completion checkmark, and off-board skull overlays. */
  & .m2-hero-portrait {
    grid-column: 1;
    grid-row: 1/3;
    align-self: start;
    border: 2px solid;
    border-radius: 50%;
    background: #111822;
    box-sizing: border-box;
  }
  & .m2-hero-portrait img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  /* Keep upgrades in their own layout slot rather than appending them to the hero name. */
  & .m2-hero-upgrades {
    grid-column: 3;
    grid-row: 1;
    justify-content: flex-end;
    gap: 2px;
  }
  & .m2-hero-upgrades > .m2-symbol {
    padding: 0 2px;
    background: none;
    border: 0;
    font-size: 10px;
    gap: 1px;
  }

  & .m2-offboard-label {
    grid-column: 4;
    grid-row: 1;
    align-self: center;
    padding: 0;
    border: 0;
    background: none;
    color: #969da7;
    font-size: 18px;
    line-height: 20px;
  }
  & .m2-hero-history {
    grid-column: 2/-1;
    padding: 0;
    border: 0;
    gap: 3px;
    color: #9ba7b7;
    font-size: 9px;
  }
  & .m2-history-slot {
    min-height: 18px;
    height: 18px;
    min-width: 10px;
    padding: 0;
    border: 0;
    background: none;
    gap: 1px;
  }
  & .m2-history-marker {
    width: 8px;
    height: 8px;
    border: 0;
    border-radius: 50%;
  }
  & .m2-history-slot img {
    width: 11px;
    height: 11px;
  }
  & .m2-hero-effects {
    grid-column: 1/-1;
    grid-row: 6;
  }

  & [data-m2="hero"]:has(> .m2-hero-dashboard) > [class*="_details_"]:first-of-type {
    display: none !important;
  }
  & [data-m2="hero"]:has(> .m2-hero-dashboard) > [class*="_name_"] + [class*="_details_"] {
    display: none !important;
  }
  & .m2-hero-history {
    grid-row: 2;
    line-height: 16px;
  }
  & .m2-hero-history > span:first-child {
    white-space: nowrap;
  }
  & .m2-selection-status {
    grid-row: 3;
    color: #b8c6b9;
    font-size: 10px;
    line-height: 14px;
  }

  & [data-m2="hero"] [class*="_currentLabel_"] {
    display: none !important;
  }
  & .m2-selection-status {
    grid-column: 1/-1;
    justify-self: stretch;
    text-align: center;
    border-top: 1px solid #ffffff16;
    padding-top: 7px;
    margin-top: 4px;
  }
  & .m2-hero-history {
    column-gap: 4px;
  }
  & .m2-history-slot {
    margin: 0 1px;
  }
  & .m2-hero-portrait {
    position: relative;
  }
  & .m2-hero-portrait:has(.m2-offboard-label) img {
    opacity: 0.5;
  }
  & .m2-hero-portrait .m2-offboard-label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 21px;
    line-height: 1;
    color: #d5d8dc;
    text-shadow:
      0 1px 3px #000,
      0 0 3px #000;
  }

  & .m2-selecting-dots {
    display: inline-block;
    font-family: monospace;
    width: 1.8em;
    text-align: left;
    animation: m2-selecting-dots 1.5s infinite step-end;
  }
  @keyframes m2-selecting-dots {
    0% {
      clip-path: inset(0 66.666% 0 0);
    }
    33.333% {
      clip-path: inset(0 33.333% 0 0);
    }
    66.666%,
    100% {
      clip-path: inset(0 0 0 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    & .m2-selecting-dots {
      animation: none;
    }
  }

  & #goa2-m2-summary small.m2-summary-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    overflow: visible;
    font-size: 9px;
  }
  & #goa2-m2-summary .m2-summary-turn {
    white-space: nowrap;
    font-size: 8px;
    flex-shrink: 0;
  }
  & #goa2-m2-summary .m2-summary-piles {
    min-width: 0;
  }
  & #goa2-m2-summary .m2-summary-piles > span {
    gap: 2px;
  }
  & #goa2-m2-summary .m2-summary-piles i {
    width: 6px;
    height: 6px;
  }
  & #goa2-m2-summary .m2-summary-upgrades {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  & #goa2-m2-summary .m2-summary-upgrades .m2-symbol {
    font-size: 8px;
    gap: 1px;
  }

  & .m2-upgraded-value {
    color: #d7a4ff !important;
    font-weight: 750;
  }
  /* One hero layout, including the local player. Native card rows keep their handlers. */
  & [data-m2="hero"]:has([class*="_viewDeckBtn_"]) {
    display: block;
  }
  & .m2-own-colors {
    display: inline-flex;
    gap: 3px;
    align-items: center;
    margin-right: 5px;
  }
  & .m2-own-colors i {
    display: block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  & [data-m2="sidebar"] [class*="_row_"]:has(> .m2-list-card) > :not(.m2-list-card) {
    display: none !important;
  }
  & [data-m2="sidebar"] [class*="_row_"]:has(> .m2-list-card) {
    padding: 0 5px;
    overflow: hidden;
  }
  & .m2-list-card {
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 42px;
    align-items: stretch;
    gap: 5px;
    min-width: 0;
  }
  & .m2-list-card > .m2-symbol {
    flex: 0 0 32px;
    justify-content: center;
  }
  & .m2-list-band {
    display: flex;
    align-items: center;
    gap: 5px;
    flex: 1 1 0;
    min-width: 0;
    background: color-mix(in srgb, var(--card-color) 27%, #18202b);
    border-left: 3px solid var(--card-color);
    padding: 2px 5px;
  }
  & .m2-list-name {
    flex: 1;
    min-width: 0;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12px;
    font-weight: 600;
  }
  & .m2-list-secondary {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    flex: 0 0 60px;
    min-width: 60px;
  }
  & .m2-list-card .m2-symbol {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    white-space: nowrap;
    font-size: 11px;
    flex-shrink: 0;
    color: #e1e5eb;
  }
  & .m2-list-card .m2-symbol img {
    object-fit: contain;
  }
  & .m2-list-secondary:empty {
    display: flex;
  }
  & [data-m2="hero"] .m2-list-card {
    min-height: 22px;
    gap: 3px;
  }
  & [data-m2="hero"] .m2-list-secondary {
    flex-basis: 48px;
    min-width: 48px;
  }
  & [data-m2="hero"] .m2-list-card > .m2-symbol {
    flex-basis: 25px;
  }
  & [data-m2="hero"] .m2-list-name {
    font-size: 11px;
  }
  & [data-m2="hero"] .m2-list-band {
    padding: 1px 4px;
    gap: 3px;
  }
  & [data-m2="hero"] .m2-list-card .m2-symbol {
    font-size: 10px;
    gap: 1px;
  }

  & #goa2-m2-summary article {
    grid-template-columns: minmax(85px, 0.85fr) minmax(0, 1.65fr);
  }
  & #goa2-m2-summary .m2-summary-controls {
    display: flex;
    gap: 4px;
    flex: 0 0 28px;
    align-items: stretch;
  }
  & .m2-summary-controls button {
    flex: 1;
    padding: 2px 4px;
    border: 1px solid #394353;
    border-radius: 6px;
    background: transparent;
    color: #bcc6d3;
    font: 600 10px system-ui;
  }
  & .m2-summary-controls button[aria-pressed="true"] {
    background: #303c4f;
    color: #ffe09c;
  }
  & #goa2-m2-summary .m2-summary-piles {
    display: flex;
    align-items: center;
  }
  & .m2-summary-piles > span {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  & .m2-summary-piles i {
    display: inline-block;
    flex-shrink: 0;
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  /* Shared overlaid values: retain purple only for modified card values. */
  & .m2-symbol {
    position: relative;
    justify-content: center;
    vertical-align: middle;
  }
  & .m2-symbol-value {
    font-size: 1.15em;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-weight: 800;
    line-height: 1;
    text-shadow:
      0 1px 2px #000,
      1px 0 2px #000,
      -1px 0 2px #000,
      0 -1px 2px #000;
    z-index: 1;
  }
  & .m2-list-card .m2-symbol img {
    width: 24px;
    height: 24px;
  }
  & [data-m2="hero"] .m2-list-card .m2-symbol img {
    width: 19px;
    height: 19px;
  }
  & .m2-hero-upgrades img {
    width: 23px;
    height: 23px;
  }
  & #goa2-m2-summary .m2-summary-upgrades img {
    width: 18px;
    height: 18px;
  }
  & [data-m2="hero"]:has(> .m2-hero-dashboard) {
    grid-template-columns: 36px minmax(0, 1fr) auto;
  }
  & .m2-hero-upgrades {
    justify-self: end;
    max-width: 144px;
  }
  & .m2-gold {
    display: inline-flex;
    gap: 2px;
    align-items: center;
    vertical-align: middle;
    white-space: nowrap;
  }
  & .m2-gold svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: #d9c07c;
    stroke-width: 1.6;
    stroke-linecap: round;
  }
  & [data-m2="hero"].m2-pending-hero {
    border-color: #8993a2;
  }
  & [data-m2="hero"].m2-current-hero {
    border-color: #cabb83 !important;
  }
  & .m2-hero-portrait {
    width: 34px;
    height: 34px;
    overflow: visible;
    justify-self: center;
  }
  & .m2-hero-portrait img {
    border-radius: 50%;
  }
  & .m2-hero-portrait:has(.m2-resolution-info) {
    margin-bottom: 15px;
  }
  & .m2-hero-portrait:has(.m2-resolution-info) img {
    opacity: 0.45;
  }
  & .m2-hero-portrait:has(.m2-resolution-info) .m2-offboard-label {
    display: none;
  }
  & [data-m2="hero"] .m2-hero-portrait > .m2-resolution-info {
    position: absolute;
    inset: -2px;
    display: block;
    margin: 0 !important;
    padding: 0;
    width: auto;
    height: 34px;
    pointer-events: none;
    z-index: 1;
    line-height: 1;
  }
  & .m2-turn-number {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 23px;
    font-weight: 800;
    line-height: 1;
    color: #fff;
    text-shadow:
      0 1px 3px #000,
      0 0 3px #000;
  }
  & .m2-current-hero .m2-turn-number {
    font-size: 13px;
    color: #ffe5a1;
  }
  & [data-m2="hero"] .m2-hero-portrait .m2-resolution-info > .m2-symbol {
    position: absolute;
    left: 50%;
    top: 35px;
    transform: translateX(-50%);
    height: 14px;
    font-size: 10px;
  }
  & [data-m2="hero"] .m2-hero-portrait .m2-resolution-info > .m2-symbol img {
    width: 16px;
    height: 14px;
    opacity: 0.45;
  }
  & [data-m2="hero"] .m2-hero-portrait .m2-resolution-info .m2-symbol-value {
    color: #abb2bc;
  }
  & #goa2-m2-summary small.m2-summary-content {
    gap: 3px;
  }
  & #goa2-m2-summary .m2-summary-piles {
    gap: 4px;
    font-size: 8px;
  }
  & #goa2-m2-summary .m2-mini-current {
    display: inline-flex;
    flex-shrink: 0;
    width: 13px;
    height: 18px;
    border: 1px solid var(--card-color);
    border-radius: 2px;
    background: color-mix(in srgb, var(--card-color) 40%, #18202b);
    align-items: center;
    justify-content: center;
    color: #ddd;
    font-size: 10px;
  }
  & #goa2-m2-summary .m2-mini-current .m2-symbol img {
    width: 11px;
    height: 13px;
  }

  & button[class*="_upgradeCard_"]:has(> .m2-text-card) {
    padding: 0 !important;
    background: transparent !important;
    border: 0 !important;
    text-align: left;
    min-width: 0;
    width: 100%;
  }
  & button[class*="_upgradeCard_"]:has(> .m2-text-card) > :not(.m2-text-card) {
    display: none !important;
  }
  & button[class*="_upgradeCard_"] > .m2-text-card {
    margin: 0;
    width: 100%;
    box-sizing: border-box;
    height: 100%;
    cursor: pointer;
  }
  & button[class*="_upgradeCard_"]:focus-visible {
    outline: 2px solid #e9c956;
    outline-offset: 3px;
  }
  & .m2-hero-history {
    row-gap: 2px;
  }
  & .m2-expanded-board {
    grid-column: 1/-1;
    grid-row: 5;
    display: flex;
    flex-direction: column;
    gap: 9px;
    border-top: 1px solid #ffffff1b;
    padding-top: 7px;
    min-width: 0;
  }
  & .m2-expanded-board section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  & .m2-expanded-board h4 {
    margin: 0;
    color: #aeb9c8;
    font-size: 10px;
    font-weight: 600;
  }
  & .m2-hero-slot {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    min-height: 24px;
  }
  & .m2-slot-label {
    flex: 0 0 37px;
    font-size: 9px;
    color: #9da9b9;
  }
  & .m2-slot-empty,
  & .m2-slot-hidden {
    color: #8b96a6;
    font-size: 10px;
  }
  & .m2-expanded-card {
    display: block;
    flex: 1;
    min-width: 0;
    height: 26px;
    overflow: hidden;
    padding: 0 3px;
    background: #202731;
    border: 1px solid #ffffff16;
    border-radius: 5px;
    color: #e1e5eb;
    cursor: pointer;
  }
  & [data-m2="hero"] .m2-expanded-card .m2-list-card {
    height: 24px;
    min-height: 24px;
  }
  & [data-m2="hero"] .m2-expanded-card .m2-list-secondary {
    flex-basis: 42px;
    min-width: 42px;
  }
  & .m2-expanded-hand-dots {
    display: flex;
    align-items: center;
    gap: 5px;
    min-height: 18px;
  }
  & [data-m2="hero"].m2-hero-expanded > [class*="_currentCard_"],
  & [data-m2="hero"].m2-hero-expanded > [class*="_ultimate_"] {
    display: none !important;
  }
  & #goa2-m2-hero-display {
    display: none;
  }
  &[data-m2-mode="heroes"] #goa2-m2-hero-display {
    display: block;
    position: relative;
    box-sizing: border-box;
    flex: 0 0 38dvh;
    height: 38dvh;
    overflow: auto;
    margin: 6px 8px;
    border-radius: 9px;
  }
  &[data-m2-mode="heroes"] #goa2-m2-hero-display:empty:after {
    content: "Select a card to view details";
    display: grid;
    place-items: center;
    height: 100%;
    color: #97a2b3;
    font-size: 12px;
  }
  &[data-m2-mode="split"] #goa2-m2-hero-display:not(:empty) {
    display: block;
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    max-height: calc(100% - 16px);
    z-index: 70;
    overflow: auto;
    padding: 0;
    background: #171d27f5;
    border: 1px solid #465060;
    border-radius: 9px;
  }
  & #goa2-m2-hero-display .m2-expanded-board {
    padding: 0;
    border: 0;
    gap: 7px;
  }
  & #goa2-m2-hero-display h4:empty {
    display: none;
  }
  & #goa2-m2-hero-display .m2-list-card {
    min-height: 24px;
    height: 24px;
    gap: 3px;
  }
  & #goa2-m2-hero-display .m2-list-card > .m2-symbol {
    flex-basis: 25px;
  }
  & #goa2-m2-hero-display .m2-list-secondary {
    flex-basis: 44px;
    min-width: 44px;
  }
  & #goa2-m2-hero-display .m2-symbol img {
    width: 19px;
    height: 19px;
  }
  & #goa2-m2-hero-display .m2-list-name {
    font-size: 11px;
  }
  & [data-m2="hero"] > [class*="_currentCard_"],
  & [data-m2="hero"] > [class*="_ultimate_"] {
    display: none !important;
  }
  & .m2-saved-events {
    border-bottom: 1px solid #ffffff22;
    margin-bottom: 6px;
    padding-bottom: 5px;
    font-size: 11px;
  }
  & .m2-saved-events > small {
    color: #9da9b9;
  }
  & .m2-saved-events details {
    padding: 3px 0;
  }
  & .m2-saved-events pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 10px;
  }
  & .m2-expanded-board h4:empty {
    display: none;
  }
  &[data-m2-mode="heroes"] #goa2-m2-hero-display {
    padding: 0;
    border: 0;
    background: none;
  }
  & #goa2-m2-hero-display > .m2-text-card {
    min-height: 100%;
    margin: 0;
  }
  & #goa2-m2-nav button[hidden] {
    display: none !important;
  }
  & [data-m2-rotation-host] {
    position: absolute !important;
    inset: 0;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow: hidden;
    touch-action: none;
  }
  & svg[data-m2-rotate] {
    transform: var(--m2-native-transform) rotate(var(--m2-angle)) scale(var(--m2-rotation-fit)) !important;
    transform-origin: 50% 50%;
  }
  & [data-m2-rotation-host] > [class*="_zoomReset_"] {
    display: none !important;
  }
  .m2-board-controls {
    display: none;
  }
  & .m2-board-controls {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    z-index: 60;
    touch-action: manipulation;
  }
  & .m2-board-controls button {
    height: 34px;
    min-width: 34px;
    padding: 4px 8px;
    border: 1px solid #48515c;
    border-radius: 8px;
    background: #10151ee8;
    color: #e0e6ed;
    font: 600 12px system-ui;
  }

  & [class*="_takeBackBtn_"],
  & [class*="_finishPlanningBtn_"] {
    display: none !important;
  }
  & .m2-planning-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    margin-top: 8px;
  }
  & .m2-planning-actions button {
    min-height: 36px;
    padding: 6px 14px;
    border: 1px solid #637b9d;
    border-radius: 8px;
    background: #1b2637;
    color: #a8ccff;
    font: 600 12px system-ui;
  }
  & .m2-planning-actions.m2-on-board {
    position: absolute;
    bottom: 8px;
    left: 8px;
    right: 76px;
    margin: 0;
    z-index: 65;
    pointer-events: none;
  }
  & .m2-planning-actions.m2-on-board button {
    pointer-events: auto;
  }
  `;
  style.textContent =
    'html:not([data-m2-active]) :is(#goa2-m2-nav,#goa2-m2-close,#goa2-m2-summary,#goa2-m2-details,#goa2-m2-hero-display,.m2-list-card,.m2-text-card,.m2-hero-dashboard,.m2-resolution-info,.m2-hud,.m2-planning-actions,.m2-deck-browser,.m2-deck-zoom,.m2-own-colors,.m2-cursors,.m2-saved-events){display:none!important}' +
    css.replaceAll('&', 'html[data-m2-active]');
  document.head.append(style);
  // 3. Navigation and generated containers
  // These roots sit outside React ownership; native elements are tagged rather than replaced.
  const nav = document.createElement('nav');
  nav.id = 'goa2-m2-nav';
  nav.setAttribute('aria-label', 'Mobile 2D controls');
  for (const [key, label] of [
    ['split', 'All'],
    ['board', 'Board'],
    ['heroes', 'Heroes'],
    ['hand', 'Hand'],
    ['deck', 'Deck'],
    ['setup', 'Setup'],
    ['tools', '⋮'],
  ]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.mode = key;
    b.textContent = label;
    if (key === 'tools') b.setAttribute('aria-label', 'Menu');
    b.setAttribute('aria-pressed', 'false');
    nav.append(b);
  }
  const close = document.createElement('button');
  close.id = 'goa2-m2-close';
  close.type = 'button';
  close.textContent = 'Close details ×';
  const summary = document.createElement('section');
  summary.id = 'goa2-m2-summary';
  summary.setAttribute('aria-label', 'Hero summaries');
  document.body.append(nav, close, summary);
  // Hand details and inspected hero cards use different containers, so switching
  // views does not confuse a playable selection with a read-only inspection.
  const detailsPanel = document.createElement('section');
  detailsPanel.id = 'goa2-m2-details';
  const extras = new Set();
  const heroPanel = document.createElement('section');
  heroPanel.id = 'goa2-m2-hero-display';

  // Global listeners share teardown; detached generated nodes retain no global listener registry.
  const on = (e, n, f, options = {}) =>
    e.addEventListener(
      n,
      f,
      e instanceof Node && e !== document ? options : { ...options, signal: ac.signal },
    );
  // Hide the current native tooltip without changing the website’s selected card.
  function dismiss() {
    const tip = q('[data-m2="tip"]');
    if (tip) {
      dismissedTip = tip;
      tip.setAttribute('data-m2-dismissed', '');
    }
    refresh();
  }
  on(close, 'click', dismiss);
  function setDeckOpen(open) {
    deckOpen = open;
    root.toggleAttribute('data-m2-deck-open', open);
  }
  // Deck is backed by the native modal, while setup/tools are temporary panels.
  // The underlying All/Board/Hand/Heroes choice remains available when panels close.
  function navigate(key) {
    if (!key) return;
    if (key === 'deck') {
      setDeckOpen(true);
      panel = '';
      dismiss();
      if (!q('[data-m2="deck"]'))
        q('[data-m2="hero"]:not([data-m2-other]) ' + c('viewDeckBtn'))?.click();
      schedule();
      return;
    }
    setDeckOpen(false);
    dismiss();
    if (key === 'setup' || key === 'tools') panel = panel === key ? '' : key;
    else {
      mode = key;
      panel = '';
    }
    refresh();
    if (key === 'hand')
      q('[data-m2="sidebar"] ' + c('cardName'))
        ?.closest(c('row'))
        ?.scrollIntoView({ block: 'nearest' });
  }
  // Reflect the actual open panel and show Setup only while starting-position UI exists.
  function syncNavigation() {
    const setupButton = q('[data-mode="setup"]', nav);
    const setupAvailable = !!q('[aria-label="Starting position"]');
    setupButton.hidden = !setupAvailable;
    nav.style.gridTemplateColumns = 'repeat(' + (setupAvailable ? 7 : 6) + ',minmax(0,1fr))';
    if (!setupAvailable && panel === 'setup') {
      panel = '';
      root.dataset.m2Panel = '';
    }
    const selected = deckOpen ? 'deck' : panel || mode;
    for (const button of nav.children) {
      const pressed = String(button.dataset.mode === selected);
      if (button.getAttribute('aria-pressed') !== pressed)
        button.setAttribute('aria-pressed', pressed);
    }
  }
  on(nav, 'click', (e) => navigate(e.target.closest('button')?.dataset.mode));
  on(document, 'pointerdown', (e) => {
    if (e.target.closest?.('[data-m2="sidebar"] ' + c('row'))) {
      dismissedTip?.removeAttribute('data-m2-dismissed');
      dismissedTip = null;
      hiddenCardKey = '';
      panel = '';
      schedule();
    }
  });
  on(
    document,
    'click',
    (e) => {
      if (!root.hasAttribute('data-m2-active')) return;
      const box = e.target.closest?.('[data-m2="hero"]');
      if (!box) return;
      if (e.target.closest('button,a,input,' + c('row') + ',.m2-hero-effects,.m2-hero-history'))
        return;
      const hero = componentProp(box, 'hero');
      if (!hero) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      expandedHeroId = expandedHeroId === hero.id ? null : hero.id;
      clearHeroCard();
      dismissedTip = q('[data-m2="tip"]');
      dismissedTip?.setAttribute('data-m2-dismissed', '');
      schedule();
    },
    { capture: true },
  );
  on(document, 'keydown', (e) => {
    if (e.key === 'Escape') {
      panel = '';
      clearHeroCard();
      dismiss();
      return;
    }
    if (
      ['Enter', ' '].includes(e.key) &&
      e.target.matches?.('[data-m2="hero"]>[class*="_name_"]')
    ) {
      e.preventDefault();
      e.target.click();
    }
  });
  // Deck adapter: read only card props belonging to already-rendered deck canvases.
  // Does not inspect the game store, sockets, or other players' hidden cards.
  // Card painter adapted from PedroVIOliv/goa2-frontend-portfolio.
  // Numeric-only renderer for gold/silver deck artwork. Values come from card props.
  // 4. Artwork painter
  // This isolated block supplies missing basic-card canvases for Deck. The internal
  // m3/m2/m1/m0 names are inherited module wrappers: vocabulary, drawing, icon mapping,
  // and the public card-to-painter adapter respectively. Most UI edits belong below it.
  const m2Painter = (() => {
    // Painter vocabulary and sprite filenames, not a table of hero card statistics.
    const m3 = (() => {
      const Color = {
        GOLD: 'GOLD',
        SILVER: 'SILVER',
        RED: 'RED',
        BLUE: 'BLUE',
        GREEN: 'GREEN',
        PURPLE: 'PURPLE',
      };
      const Type = {
        SKILL: 'SKILL',
        ATTACK: 'ATTACK',
        MOVEMENT: 'MOVEMENT',
        DEFENSE: 'DEFENSE',
        DEFENSE_SKILL: 'DEFENSE_SKILL',
      };
      const ValueSign = {
        NONE: 'NONE',
        PLUS: 'PLUS',
        MINUS: 'MINUS',
        EXCLAMATION: 'EXCLAMATION',
      };
      const Modifier = {
        NONE: 'NONE',
        RANGE: 'RANGE',
        AREA: 'AREA',
      };
      const Item = {
        ATTACK: 'ATTACK',
        DEFENSE: 'DEFENSE',
        INITIATIVE: 'INITIATIVE',
        RANGE: 'RANGE',
        AREA: 'AREA',
        MOVEMENT: 'MOVEMENT',
      };
      const defaultEmoji = [
        'area_blue',
        'area_gold',
        'area_green',
        'area_purple',
        'area_red',
        'area_silver',
        'attack_blue',
        'attack_gold',
        'attack_green',
        'attack_red',
        'attack_silver',
        'defense_blue',
        'defense_gold',
        'defense_green',
        'defense_red',
        'defense_silver',
        'defense_skill_blue',
        'defense_skill_gold',
        'defense_skill_green',
        'defense_skill_red',
        'defense_skill_silver',
        'initiative',
        'life_counters',
        'marker_bounty',
        'marker_poison',
        'movement_blue',
        'movement_gold',
        'movement_green',
        'movement_red',
        'movement_silver',
        'range_blue',
        'range_gold',
        'range_green',
        'range_purple',
        'range_red',
        'range_silver',
        'rune_bird',
        'rune_bird_marker',
        'rune_axe',
        'rune_axe_marker',
        'rune_anvil',
        'rune_anvil_marker',
        'rune_horn',
        'rune_horn_marker',
        'skill_blue',
        'skill_gold',
        'skill_green',
        'skill_red',
        'skill_silver',
        'tiebreaker_blue',
        'tiebreaker_orange',
        'token_barrier',
        'token_blast',
        'token_dud',
        'token_glitch',
        'token_grenade',
        'token_ice',
        'token_illusion',
        'token_magma',
        'token_rock',
        'token_smoke_bomb',
        'token_totem',
        'token_tree',
        'token_zombie',
      ];
      // Static artwork manifest. These names select image assets; numeric game values
      // come from the card object passed to paintCard().
      const imageNames = [
        'area_blue',
        'area_gold',
        'area_green',
        'area_purple',
        'area_red',
        'area_silver',
        'attack',
        'attack_blue',
        'attack_gold',
        'attack_green',
        'attack_red',
        'attack_silver',
        'banner_blue_bottom',
        'banner_blue_top',
        'banner_gold_bottom',
        'banner_gold_top',
        'banner_green_bottom',
        'banner_green_top',
        'banner_red_bottom',
        'banner_red_top',
        'banner_silver_bottom',
        'banner_silver_top',
        'bottom_long',
        'bottom_short',
        'colorblind_blue',
        'colorblind_gold',
        'colorblind_green',
        'colorblind_purple',
        'colorblind_red',
        'colorblind_silver',
        'defense',
        'defense_blue',
        'defense_gold',
        'defense_green',
        'defense_red',
        'defense_silver',
        'defense_skill_blue',
        'defense_skill_gold',
        'defense_skill_green',
        'defense_skill_red',
        'defense_skill_silver',
        'frame_blue_bottom',
        'frame_blue_middle',
        'frame_blue_middle_cut',
        'frame_blue_top',
        'frame_empty_bottom',
        'frame_gold_bottom',
        'frame_gold_middle',
        'frame_gold_top',
        'frame_green_bottom',
        'frame_green_middle',
        'frame_green_middle_cut',
        'frame_green_top',
        'frame_purple_bottom',
        'frame_purple_middle',
        'frame_purple_top',
        'frame_red_bottom',
        'frame_red_middle',
        'frame_red_middle_cut',
        'frame_red_top',
        'frame_silver_bottom',
        'frame_silver_middle',
        'frame_silver_top',
        'initiative',
        'item_area',
        'item_attack',
        'item_defense',
        'item_initiative',
        'item_movement',
        'item_range',
        'level_i',
        'level_ii',
        'level_iii',
        'level_iv',
        'level_h',
        'life_counters',
        'marker_bounty',
        'marker_poison',
        'movement',
        'movement_blue',
        'movement_gold',
        'movement_green',
        'movement_red',
        'movement_silver',
        'range_blue',
        'range_gold',
        'range_green',
        'range_purple',
        'range_red',
        'range_silver',
        'rune_bird',
        'rune_bird_marker',
        'rune_axe',
        'rune_axe_marker',
        'rune_anvil',
        'rune_anvil_marker',
        'rune_horn',
        'rune_horn_marker',
        'skill_blue',
        'skill_gold',
        'skill_green',
        'skill_red',
        'skill_silver',
        'tiebreaker_blue',
        'tiebreaker_orange',
        'title',
        'title_ultimate',
        'token_barrier',
        'token_blast',
        'token_dud',
        'token_glitch',
        'token_grenade',
        'token_ice',
        'token_illusion',
        'token_magma',
        'token_rock',
        'token_smoke_bomb',
        'token_totem',
        'token_tree',
        'token_zombie',
      ];

      return { Color, Type, ValueSign, Modifier, Item, defaultEmoji, imageNames };
    })();
    // Low-level canvas compositor. Coordinates use the original 1192 × 1664 artwork
    // space; CSS scales the resulting canvas to its mobile display size.
    const m2 = (() => {
      // Draw the card in layers: background/title, action banners and numbers, then
      // description and footer. The positional arguments mirror the original renderer.
      function updateCanvas(
        canvas,
        context,
        customEmoji,
        background,
        color,
        handicap,
        extra,
        name,
        description,
        level,
        item,
        initiative,
        primaryActionType,
        primaryActionValue,
        primaryActionValueSign,
        modifier,
        modifierValue,
        modifierValueSign,
        secondaryMovementValue,
        secondaryDefenseValue,
        secondaryAttackValue,
        initiativeBonus = 0,
        attackBonus = 0,
        defenseBonus = 0,
        areaBonus = 0,
        rangeBonus = 0,
        movementBonus = 0,
      ) {
        clear(canvas, context);
        context.fillStyle = 'black';
        if (background instanceof HTMLImageElement) {
          context.drawImage(background, 0, 0, 1192, 1664);
        }
        if (color == Color.PURPLE) {
          addImage(context, 'title_ultimate', 0, 0);
          addTitle(context, name, 594, 140, 760);
        } else {
          addImage(context, 'title', 0, 0);
          addTitle(context, name, 632, 140, 710);
        }
        // Measure rules text before placing its panel so wrapping and banners agree.
        const rawDescriptionLines = description.split(/\r\n|\r|\n/);
        const descriptionLines = wrapDescriptionLines(context, rawDescriptionLines, 960);
        const descriptionHeight = descriptionLines.length;
        const descriptionLayout = getCardDescriptionLayout(context, descriptionLines);
        cardDescriptionIndent = descriptionLayout.indent;
        descriptionFontSizeAdjustment = descriptionLayout.longestLineWidth >= 1000 ? -2 : 0;
        // Missing secondary attack is represented by null, distinct from a printed zero.
        const hasSecondaryAttack = secondaryAttackValue !== null;
        const hasSecondaryMovement = color != Color.SILVER && secondaryMovementValue !== 0;
        const hasSecondaryDefense =
          primaryActionType != Type.DEFENSE && primaryActionType != Type.DEFENSE_SKILL;
        const secondaryBannerOffset =
          hasSecondaryAttack &&
          hasSecondaryMovement &&
          hasSecondaryDefense &&
          primaryActionType != Type.MOVEMENT
            ? 50
            : 0;
        context.font = '49px Arial';
        function placeSecondary(inset) {
          const adjustedInset = hasSecondaryAttack ? inset - 209 + 20 : inset;
          const attackInset = inset + 20;
          function addSecondaryAttack(atInset) {
            addImage(context, 'attack', 35, atInset - 25);
            addSecondaryValue(
              context,
              secondaryAttackValue + attackBonus,
              143,
              atInset + 121,
              attackBonus,
            );
          }
          if (!hasSecondaryMovement) {
            if (primaryActionType != Type.DEFENSE && primaryActionType != Type.DEFENSE_SKILL) {
              addImage(context, 'defense', 70, adjustedInset);
              addSecondaryValue(
                context,
                secondaryDefenseValue + defenseBonus,
                143,
                adjustedInset + 131,
                defenseBonus,
              );
            }
            if (hasSecondaryAttack) {
              addSecondaryAttack(attackInset);
            }
            return;
          }
          if (primaryActionType == Type.DEFENSE || primaryActionType == Type.DEFENSE_SKILL) {
            addImage(context, 'movement', 64, adjustedInset);
            addSecondaryValue(
              context,
              secondaryMovementValue + movementBonus,
              143,
              adjustedInset + 121,
              movementBonus,
            );
            if (hasSecondaryAttack) {
              addSecondaryAttack(attackInset);
            }
          } else if (primaryActionType == Type.MOVEMENT) {
            addImage(context, 'defense', 70, adjustedInset);
            addSecondaryValue(
              context,
              secondaryDefenseValue + defenseBonus,
              143,
              adjustedInset + 131,
              defenseBonus,
            );
            if (hasSecondaryAttack) {
              addSecondaryAttack(attackInset);
            }
          } else {
            addImage(context, 'movement', 64, adjustedInset);
            addImage(context, 'defense', 70, adjustedInset - 209);
            addSecondaryValue(
              context,
              secondaryMovementValue + movementBonus,
              143,
              adjustedInset + 121,
              movementBonus,
            );
            addSecondaryValue(
              context,
              secondaryDefenseValue + defenseBonus,
              143,
              adjustedInset - 79,
              defenseBonus,
            );
            if (hasSecondaryAttack) {
              addSecondaryAttack(attackInset);
            }
          }
        }
        function placeSecondaryOnSilver(inset) {
          const hasSecondaryAttack = secondaryAttackValue !== null;
          const adjustedInset = hasSecondaryAttack ? inset - 209 + 20 : inset;
          const attackInset = inset + 20;
          if (primaryActionType != Type.DEFENSE && primaryActionType != Type.DEFENSE_SKILL) {
            addImage(context, 'defense', 70, adjustedInset);
            addSecondaryValue(
              context,
              secondaryDefenseValue + defenseBonus,
              143,
              adjustedInset + 131,
              defenseBonus,
            );
          }
          if (hasSecondaryAttack) {
            addImage(context, 'attack', 35, attackInset - 25);
            addSecondaryValue(
              context,
              secondaryAttackValue + attackBonus,
              143,
              attackInset + 121,
              attackBonus,
            );
          }
        }
        switch (color) {
          case Color.GOLD:
            switch (descriptionHeight) {
              case 1:
              case 2:
              case 3:
              case 4:
              case 5:
              case 6:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_gold_bottom', 50, 278);
                addImage(context, 'banner_gold_bottom', 50, 278 + secondaryBannerOffset);
                addImage(context, 'banner_gold_top', 50, 0);
                placeSecondary(645 + secondaryBannerOffset);
                break;
              case 7:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_gold_bottom', 50, 219);
                addImage(context, 'banner_gold_bottom', 50, 219 + secondaryBannerOffset);
                addImage(context, 'banner_gold_top', 50, 0);
                placeSecondary(586 + secondaryBannerOffset);
                break;
              default:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_gold_bottom', 50, 158);
                addImage(context, 'banner_gold_bottom', 50, 158 + secondaryBannerOffset);
                addImage(context, 'banner_gold_top', 50, 0);
                placeSecondary(525 + secondaryBannerOffset);
                break;
            }
            break;
          case Color.SILVER:
            switch (descriptionHeight) {
              case 1:
              case 2:
              case 3:
              case 4:
              case 5:
              case 6:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_silver_bottom', 50, 318);
                addImage(context, 'banner_silver_bottom', 50, 318 + secondaryBannerOffset);
                addImage(context, 'banner_silver_top', 50, 0);
                placeSecondaryOnSilver(637 + secondaryBannerOffset);
                break;
              case 7:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_silver_bottom', 50, 259);
                addImage(context, 'banner_silver_bottom', 50, 259 + secondaryBannerOffset);
                addImage(context, 'banner_silver_top', 50, 0);
                placeSecondaryOnSilver(578 + secondaryBannerOffset);
                break;
              default:
                if (secondaryBannerOffset > 0) addImage(context, 'banner_silver_bottom', 50, 198);
                addImage(context, 'banner_silver_bottom', 50, 198 + secondaryBannerOffset);
                addImage(context, 'banner_silver_top', 50, 0);
                placeSecondaryOnSilver(517 + secondaryBannerOffset);
                break;
            }
            break;
          case Color.RED:
            if (level == 'ii' || level == 'iii') {
              switch (descriptionHeight) {
                case 1:
                case 2:
                case 3:
                case 4:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 330);
                  addImage(context, 'banner_red_bottom', 50, 330 + secondaryBannerOffset);
                  addImage(context, 'banner_red_top', 50, 0);
                  placeSecondary(645 + secondaryBannerOffset);
                  break;
                case 5:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 271);
                  addImage(context, 'banner_red_bottom', 50, 271 + secondaryBannerOffset);
                  addImage(context, 'banner_red_top', 50, 0);
                  placeSecondary(586 + secondaryBannerOffset);
                  break;
                case 6:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 210);
                  addImage(context, 'banner_red_bottom', 50, 210 + secondaryBannerOffset);
                  addImage(context, 'banner_red_top', 50, 0);
                  placeSecondary(525 + secondaryBannerOffset);
                  break;
                default:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 150);
                  addImage(context, 'banner_red_bottom', 50, 150 + secondaryBannerOffset);
                  addImage(context, 'banner_red_top', 50, 0);
                  placeSecondary(465 + secondaryBannerOffset);
                  break;
              }
            } else {
              switch (descriptionHeight) {
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 330);
                  addImage(context, 'banner_red_bottom', 50, 330 + secondaryBannerOffset);
                  addImage(context, 'banner_red_top', 50, 0);
                  placeSecondary(645 + secondaryBannerOffset);
                  break;
                case 7:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 271);
                  addImage(context, 'banner_red_bottom', 50, 271 + secondaryBannerOffset);
                  addImage(context, 'banner_red_top', 50, 0);
                  placeSecondary(586 + secondaryBannerOffset);
                  break;
                default:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_red_bottom', 50, 210);
                  addImage(context, 'banner_red_bottom', 50, 210 + secondaryBannerOffset);
                  addImage(context, 'banner_red_top', 50, 0);
                  placeSecondary(525 + secondaryBannerOffset);
                  break;
              }
            }
            break;
          case Color.BLUE:
            if (level == 'ii' || level == 'iii') {
              switch (descriptionHeight) {
                case 1:
                case 2:
                case 3:
                case 4:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 318);
                  addImage(context, 'banner_blue_bottom', 50, 318 + secondaryBannerOffset);
                  addImage(context, 'banner_blue_top', 50, 0);
                  placeSecondary(645 + secondaryBannerOffset);
                  break;
                case 5:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 259);
                  addImage(context, 'banner_blue_bottom', 50, 259 + secondaryBannerOffset);
                  addImage(context, 'banner_blue_top', 50, 0);
                  placeSecondary(586 + secondaryBannerOffset);
                  break;
                case 6:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 198);
                  addImage(context, 'banner_blue_bottom', 50, 198 + secondaryBannerOffset);
                  addImage(context, 'banner_blue_top', 50, 0);
                  placeSecondary(525 + secondaryBannerOffset);
                  break;
                default:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 138);
                  addImage(context, 'banner_blue_bottom', 50, 138 + secondaryBannerOffset);
                  addImage(context, 'banner_blue_top', 50, 0);
                  placeSecondary(465 + secondaryBannerOffset);
                  break;
              }
            } else {
              switch (descriptionHeight) {
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 318);
                  addImage(context, 'banner_blue_bottom', 50, 318 + secondaryBannerOffset);
                  addImage(context, 'banner_blue_top', 50, 0);
                  placeSecondary(645 + secondaryBannerOffset);
                  break;
                case 7:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 259);
                  addImage(context, 'banner_blue_bottom', 50, 259 + secondaryBannerOffset);
                  addImage(context, 'banner_blue_top', 50, 0);
                  placeSecondary(586 + secondaryBannerOffset);
                  break;
                default:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_blue_bottom', 50, 198);
                  addImage(context, 'banner_blue_bottom', 50, 198 + secondaryBannerOffset);
                  addImage(context, 'banner_blue_top', 50, 0);
                  placeSecondary(525 + secondaryBannerOffset);
                  break;
              }
            }
            break;
          case Color.GREEN:
            if (level == 'ii' || level == 'iii') {
              switch (descriptionHeight) {
                case 1:
                case 2:
                case 3:
                case 4:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 325);
                  addImage(context, 'banner_green_bottom', 50, 325 + secondaryBannerOffset);
                  addImage(context, 'banner_green_top', 50, 0);
                  placeSecondary(645 + secondaryBannerOffset);
                  break;
                case 5:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 266);
                  addImage(context, 'banner_green_bottom', 50, 266 + secondaryBannerOffset);
                  addImage(context, 'banner_green_top', 50, 0);
                  placeSecondary(586 + secondaryBannerOffset);
                  break;
                case 6:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 205);
                  addImage(context, 'banner_green_bottom', 50, 205 + secondaryBannerOffset);
                  addImage(context, 'banner_green_top', 50, 0);
                  placeSecondary(525 + secondaryBannerOffset);
                  break;
                default:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 145);
                  addImage(context, 'banner_green_bottom', 50, 145 + secondaryBannerOffset);
                  addImage(context, 'banner_green_top', 50, 0);
                  placeSecondary(465 + secondaryBannerOffset);
                  break;
              }
            } else {
              switch (descriptionHeight) {
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 325);
                  addImage(context, 'banner_green_bottom', 50, 325 + secondaryBannerOffset);
                  addImage(context, 'banner_green_top', 50, 0);
                  placeSecondary(645 + secondaryBannerOffset);
                  break;
                case 7:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 266);
                  addImage(context, 'banner_green_bottom', 50, 266 + secondaryBannerOffset);
                  addImage(context, 'banner_green_top', 50, 0);
                  placeSecondary(586 + secondaryBannerOffset);
                  break;
                default:
                  if (secondaryBannerOffset > 0) addImage(context, 'banner_green_bottom', 50, 205);
                  addImage(context, 'banner_green_bottom', 50, 205 + secondaryBannerOffset);
                  addImage(context, 'banner_green_top', 50, 0);
                  placeSecondary(525 + secondaryBannerOffset);
                  break;
              }
            }
            break;
        }
        if (color != Color.PURPLE) {
          addImage(context, 'initiative', 26, 13);
          addInitiative(context, initiative + initiativeBonus, 143, 192, initiativeBonus);
        }
        let cardType = '';
        cardType += color == Color.GOLD || color == Color.SILVER ? 'Basic ' : '';
        if (color == Color.PURPLE) {
          cardType += 'Ultimate';
        } else {
          switch (primaryActionType) {
            case Type.SKILL:
              cardType += 'Skill';
              break;
            case Type.ATTACK:
              cardType += 'Attack';
              break;
            case Type.MOVEMENT:
              cardType += 'Movement';
              break;
            case Type.DEFENSE:
              cardType += 'Defense';
              break;
            case Type.DEFENSE_SKILL:
              if ((color == Color.GOLD || color == Color.SILVER) && modifier != Modifier.NONE)
                cardType += 'Defense/Skill';
              else cardType += 'Defense / Skill';
              break;
          }
        }
        switch (modifier) {
          case Modifier.RANGE:
            if ([Type.SKILL, Type.DEFENSE_SKILL, Type.ATTACK].includes(primaryActionType))
              cardType += ' - Ranged';
            break;
        }
        let primaryActionHeight;
        const lowerColor = color.toLowerCase();
        if (
          (level == 'ii' || level == 'iii') &&
          (color == Color.RED || color == Color.BLUE || color == Color.GREEN)
        ) {
          addImage(context, 'bottom_long', 0, 1412);
          switch (descriptionHeight) {
            case 1:
              addImage(context, 'frame_empty_bottom', 56, 1415);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
              addImage(context, 'frame_' + lowerColor + '_top', 56, 1137);
              addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
              addCardDescription(context, customEmoji, description, 596, 1358);
              addCardType(context, cardType, 596, 1200);
              primaryActionHeight = 1137;
              break;
            case 2:
              addImage(context, 'frame_empty_bottom', 56, 1415);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
              addImage(context, 'frame_' + lowerColor + '_top', 56, 1098);
              addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
              addCardDescription(context, customEmoji, descriptionLines[0], 596, 1311);
              addCardDescription(context, customEmoji, descriptionLines[1], 596, 1372);
              addCardType(context, cardType, 596, 1161);
              primaryActionHeight = 1098;
              break;
            case 3:
              addImage(context, 'frame_empty_bottom', 56, 1415);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1216);
              addImage(context, 'frame_' + lowerColor + '_top', 56, 1065);
              addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
              addCardDescription(context, customEmoji, descriptionLines[0], 596, 1262);
              addCardDescription(context, customEmoji, descriptionLines[1], 596, 1323);
              addCardDescription(context, customEmoji, descriptionLines[2], 596, 1387);
              addCardType(context, cardType, 596, 1128);
              primaryActionHeight = 1065;
              break;
            case 4:
              addImage(context, 'frame_empty_bottom', 56, 1415);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1083);
              addImage(context, 'frame_' + lowerColor + '_top', 56, 1002);
              addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
              addCardDescription(context, customEmoji, descriptionLines[0], 596, 1198);
              addCardDescription(context, customEmoji, descriptionLines[1], 596, 1259);
              addCardDescription(context, customEmoji, descriptionLines[2], 596, 1323);
              addCardDescription(context, customEmoji, descriptionLines[3], 596, 1387);
              addCardType(context, cardType, 596, 1065);
              primaryActionHeight = 1002;
              break;
            case 5:
              addImage(context, 'frame_empty_bottom', 56, 1415);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1083);
              addImage(context, 'frame_' + lowerColor + '_top', 56, 937);
              addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
              addCardDescription(context, customEmoji, descriptionLines[0], 596, 1134);
              addCardDescription(context, customEmoji, descriptionLines[1], 596, 1198);
              addCardDescription(context, customEmoji, descriptionLines[2], 596, 1259);
              addCardDescription(context, customEmoji, descriptionLines[3], 596, 1323);
              addCardDescription(context, customEmoji, descriptionLines[4], 596, 1387);
              addCardType(context, cardType, 596, 1000);
              primaryActionHeight = 937;
              break;
            case 6:
              addImage(context, 'frame_empty_bottom', 56, 1415);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1083);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1015);
              addImage(context, 'frame_' + lowerColor + '_top', 56, 864);
              addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
              addCardDescription(context, customEmoji, descriptionLines[0], 596, 1064);
              addCardDescription(context, customEmoji, descriptionLines[1], 596, 1128);
              addCardDescription(context, customEmoji, descriptionLines[2], 596, 1189);
              addCardDescription(context, customEmoji, descriptionLines[3], 596, 1253);
              addCardDescription(context, customEmoji, descriptionLines[4], 596, 1314);
              addCardDescription(context, customEmoji, descriptionLines[5], 596, 1378);
              addCardType(context, cardType, 596, 927);
              primaryActionHeight = 864;
              break;
            default:
              addImage(context, 'frame_empty_bottom', 56, 1415);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1249);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1083);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1015);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 987);
              addImage(context, 'frame_' + lowerColor + '_top', 56, 836);
              addImage(context, 'frame_' + lowerColor + '_middle_cut', 56, 1340);
              addCardDescription(context, customEmoji, descriptionLines[0], 596, 1019);
              addCardDescription(context, customEmoji, descriptionLines[1], 596, 1083);
              addCardDescription(context, customEmoji, descriptionLines[2], 596, 1144);
              addCardDescription(context, customEmoji, descriptionLines[3], 596, 1208);
              addCardDescription(context, customEmoji, descriptionLines[4], 596, 1269);
              addCardDescription(context, customEmoji, descriptionLines[5], 596, 1333);
              addCardDescription(context, customEmoji, descriptionLines[6], 596, 1397);
              addCardType(context, cardType, 596, 899);
              primaryActionHeight = 836;
              break;
          }
        } else {
          addImage(context, 'bottom_short', 0, 1413);
          switch (descriptionHeight) {
            case 1:
              addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
              addImage(context, 'frame_' + lowerColor + '_top', 56, 1244);
              addCardDescription(context, customEmoji, description, 596, 1465);
              addCardType(context, cardType, 596, 1307);
              primaryActionHeight = 1244;
              break;
            case 2:
              addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
              addImage(context, 'frame_' + lowerColor + '_top', 56, 1205);
              addCardDescription(context, customEmoji, descriptionLines[0], 596, 1418);
              addCardDescription(context, customEmoji, descriptionLines[1], 596, 1479);
              addCardType(context, cardType, 596, 1268);
              primaryActionHeight = 1205;
              break;
            case 3:
              addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1323);
              addImage(context, 'frame_' + lowerColor + '_top', 56, 1172);
              addCardDescription(context, customEmoji, descriptionLines[0], 596, 1369);
              addCardDescription(context, customEmoji, descriptionLines[1], 596, 1430);
              addCardDescription(context, customEmoji, descriptionLines[2], 596, 1494);
              addCardType(context, cardType, 596, 1235);
              primaryActionHeight = 1172;
              break;
            case 4:
              addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1190);
              addImage(context, 'frame_' + lowerColor + '_top', 56, 1109);
              addCardDescription(context, customEmoji, descriptionLines[0], 596, 1305);
              addCardDescription(context, customEmoji, descriptionLines[1], 596, 1366);
              addCardDescription(context, customEmoji, descriptionLines[2], 596, 1430);
              addCardDescription(context, customEmoji, descriptionLines[3], 596, 1494);
              addCardType(context, cardType, 596, 1172);
              primaryActionHeight = 1109;
              break;
            case 5:
              addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1190);
              addImage(context, 'frame_' + lowerColor + '_top', 56, 1044);
              addCardDescription(context, customEmoji, descriptionLines[0], 596, 1241);
              addCardDescription(context, customEmoji, descriptionLines[1], 596, 1305);
              addCardDescription(context, customEmoji, descriptionLines[2], 596, 1366);
              addCardDescription(context, customEmoji, descriptionLines[3], 596, 1430);
              addCardDescription(context, customEmoji, descriptionLines[4], 596, 1494);
              addCardType(context, cardType, 596, 1107);
              primaryActionHeight = 1044;
              break;
            case 6:
              addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1190);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1122);
              addImage(context, 'frame_' + lowerColor + '_top', 56, 971);
              addCardDescription(context, customEmoji, descriptionLines[0], 596, 1171);
              addCardDescription(context, customEmoji, descriptionLines[1], 596, 1235);
              addCardDescription(context, customEmoji, descriptionLines[2], 596, 1296);
              addCardDescription(context, customEmoji, descriptionLines[3], 596, 1360);
              addCardDescription(context, customEmoji, descriptionLines[4], 596, 1421);
              addCardDescription(context, customEmoji, descriptionLines[5], 596, 1485);
              addCardType(context, cardType, 596, 1034);
              primaryActionHeight = 971;
              break;
            case 7:
              addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1522);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1356);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1190);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1122);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1094);
              addImage(context, 'frame_' + lowerColor + '_top', 56, 943);
              addCardDescription(context, customEmoji, descriptionLines[0], 596, 1126);
              addCardDescription(context, customEmoji, descriptionLines[1], 596, 1190);
              addCardDescription(context, customEmoji, descriptionLines[2], 596, 1251);
              addCardDescription(context, customEmoji, descriptionLines[3], 596, 1315);
              addCardDescription(context, customEmoji, descriptionLines[4], 596, 1376);
              addCardDescription(context, customEmoji, descriptionLines[5], 596, 1440);
              addCardDescription(context, customEmoji, descriptionLines[6], 596, 1504);
              addCardType(context, cardType, 596, 1006);
              primaryActionHeight = 943;
              break;
            default:
              addImage(context, 'frame_' + lowerColor + '_bottom', 56, 1552);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1386);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1326);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1190);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1122);
              addImage(context, 'frame_' + lowerColor + '_middle', 56, 1074);
              addImage(context, 'frame_' + lowerColor + '_top', 56, 923);
              addCardDescription(context, customEmoji, descriptionLines[0], 596, 1098);
              addCardDescription(context, customEmoji, descriptionLines[1], 596, 1159);
              addCardDescription(context, customEmoji, descriptionLines[2], 596, 1222);
              addCardDescription(context, customEmoji, descriptionLines[3], 596, 1286);
              addCardDescription(context, customEmoji, descriptionLines[4], 596, 1347);
              addCardDescription(context, customEmoji, descriptionLines[5], 596, 1411);
              addCardDescription(context, customEmoji, descriptionLines[6], 596, 1472);
              addCardDescription(context, customEmoji, descriptionLines[7], 596, 1536);
              addCardType(context, cardType, 596, 986);
              primaryActionHeight = 923;
              break;
          }
        }
        let modifierValueWidth = 0;
        switch (modifier) {
          case Modifier.AREA:
            addImage(context, `area_${lowerColor}`, 921, primaryActionHeight - 20);
            modifierValueWidth = addModifierValue(
              context,
              modifierValue + areaBonus,
              1052,
              primaryActionHeight + 82,
              areaBonus,
            );
            break;
          case Modifier.RANGE:
            addImage(context, `range_${lowerColor}`, 936, primaryActionHeight - 77);
            modifierValueWidth = addModifierValue(
              context,
              modifierValue + rangeBonus,
              1052,
              primaryActionHeight + 82,
              rangeBonus,
            );
            break;
        }
        if (
          (modifier == Modifier.AREA || modifier == Modifier.RANGE) &&
          (modifierValueSign == ValueSign.PLUS || modifierValueSign == ValueSign.MINUS)
        ) {
          addSign(
            context,
            modifierValueSign == ValueSign.PLUS ? '+' : '-',
            1052 + modifierValueWidth / 2,
            primaryActionHeight + 82,
          );
        }
        addImage(context, `colorblind_${lowerColor}`, 1116, 46);
        if (color == Color.RED || color == Color.BLUE || color == Color.GREEN) {
          addImage(context, `level_${level}`, 1006, 85);
          if (level == 'ii' || level == 'iii')
            addImage(context, `item_${item.toLowerCase()}`, 476, 1484);
        }
        if (color == Color.GOLD || color == Color.SILVER) {
          if (extra) {
            addExtraMarker(context);
          } else if (handicap) {
            addImage(context, 'level_h', 1008, 85);
          }
        }
        if (color == Color.PURPLE) {
          addImage(context, 'level_iv', 1008, 85);
        } else {
          let primaryValueWidth = 0;
          switch (primaryActionType) {
            case Type.SKILL:
              addImage(context, `skill_${lowerColor}`, 22, primaryActionHeight - 79);
              break;
            case Type.ATTACK:
              addImage(context, `attack_${lowerColor}`, 19, primaryActionHeight - 82);
              if (primaryActionValueSign != ValueSign.EXCLAMATION)
                primaryValueWidth = addPrimaryValue(
                  context,
                  primaryActionValue + attackBonus,
                  142,
                  primaryActionHeight + 82,
                  attackBonus,
                );
              break;
            case Type.MOVEMENT:
              addImage(context, `movement_${lowerColor}`, 43, primaryActionHeight - 68);
              if (primaryActionValueSign != ValueSign.EXCLAMATION)
                primaryValueWidth = addPrimaryValue(
                  context,
                  primaryActionValue + movementBonus,
                  142,
                  primaryActionHeight + 82,
                  movementBonus,
                );
              break;
            case Type.DEFENSE:
              addImage(context, `defense_${lowerColor}`, 51, primaryActionHeight - 74);
              if (primaryActionValueSign != ValueSign.EXCLAMATION)
                primaryValueWidth = addPrimaryValue(
                  context,
                  primaryActionValue + defenseBonus,
                  142,
                  primaryActionHeight + 82,
                  defenseBonus,
                );
              break;
            case Type.DEFENSE_SKILL:
              addImage(context, `defense_skill_${lowerColor}`, 51, primaryActionHeight - 74);
              if (primaryActionValueSign != ValueSign.EXCLAMATION)
                primaryValueWidth = addPrimaryValue(
                  context,
                  primaryActionValue + defenseBonus,
                  142,
                  primaryActionHeight + 82,
                  defenseBonus,
                );
              break;
          }
          if (primaryActionType != Type.SKILL && primaryActionValueSign != ValueSign.NONE) {
            if (primaryActionValueSign == ValueSign.EXCLAMATION)
              addBlockValue(context, '!', 142, primaryActionHeight + 82);
            else
              addSign(
                context,
                primaryActionValueSign == ValueSign.PLUS ? '+' : '-',
                142 + primaryValueWidth / 2,
                primaryActionHeight + 82,
              );
          }
        }
      }

      const { Color, defaultEmoji, imageNames, Item, Modifier, Type, ValueSign } = m3;
      // Shared loaded sprites are reused across every card instead of fetched per paint.
      const images = new Map();
      let cardDescriptionIndent = 490;
      let descriptionFontSizeAdjustment = 0;
      // Resolve only after the image is drawable; callers can await all assets together.
      function loadImage(url) {
        return new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(`Failed to load ${url}`));
          image.src = url;
        });
      }
      // Load standard sprites and inline effect symbols into the shared image map.
      function preloadImages() {
        return Promise.all(
          imageNames.map(async (imageName) => {
            try {
              const image = await loadImage(`/cards/sheets/${imageName}.png`);
              images.set(imageName, image);
            } catch {}
          }),
        );
      }
      async function importCardImage(hero, card) {
        try {
          return await loadImage(`/cards/backgrounds/${hero}/${card}.webp`);
        } catch {
          return undefined;
        }
      }
      function clear(canvas, context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
      function addImage(context, name, x, y) {
        context.drawImage(images.get(name), x, y);
      }
      function addEmoji(context, name, x, y) {
        const img = images.get(name);
        context.drawImage(img, x, y, (64 * img.width) / img.height, 64);
      }
      function addCustomEmoji(context, customEmoji, name, x, y) {
        const img = customEmoji.find((item) => item[0] == name)[1];
        context.drawImage(img, x, y, (64 * img.width) / img.height, 64);
      }
      // Render one description line, including separators and inline symbol markup.
      function addCardDescription(context, customEmoji, text, x, y) {
        if (text == '---') {
          context.beginPath();
          context.moveTo(x - 381, y - 11);
          context.lineTo(x + 381, y - 11);
          context.lineWidth = 2;
          context.stroke();
        } else if (text.startsWith('>>')) {
          addTextWithBold(
            context,
            customEmoji,
            '•  ' + text.substring(2),
            x - cardDescriptionIndent,
            y,
            true,
          );
        } else if (text.startsWith('>')) {
          addTextWithBold(
            context,
            customEmoji,
            text.substring(1),
            x - (cardDescriptionIndent - 45),
            y,
            true,
          );
        } else addTextWithBold(context, customEmoji, text, x, y);
      }
      // Use the same rich-text metrics for measuring and drawing to avoid overflow.
      function getDescriptionMaxLineWidth(context, descriptionLines, fontSizeAdjustment) {
        let longestLineWidth = 0;
        descriptionLines.forEach((line) => {
          if (line.startsWith('>>')) {
            longestLineWidth = Math.max(
              longestLineWidth,
              getRichTextWidth(context, '•  ' + line.substring(2), fontSizeAdjustment),
            );
          } else if (line.startsWith('>')) {
            longestLineWidth = Math.max(
              longestLineWidth,
              getRichTextWidth(context, line.substring(1), fontSizeAdjustment) + 45,
            );
          }
        });
        return longestLineWidth;
      }
      // Break long lines at word boundaries while retaining explicit source line breaks.
      function wrapDescriptionLines(context, lines, maxWidth) {
        const out = [];
        for (const raw of lines) {
          if (raw === '---' || raw === '') {
            out.push(raw);
            continue;
          }
          let prefix = '';
          let body = raw;
          if (raw.startsWith('>>')) {
            prefix = '>>';
            body = raw.substring(2);
          } else if (raw.startsWith('>')) {
            prefix = '>';
            body = raw.substring(1);
          }
          const measure = (s) => getRichTextWidth(context, s, 0);
          if (measure(prefix + body) <= maxWidth) {
            out.push(raw);
            continue;
          }
          const words = body.split(/(\s+)/);
          let current = '';
          let firstChunk = true;
          for (const token of words) {
            if (token === '') continue;
            const candidate = current + token;
            const candidateForMeasure = firstChunk ? prefix + candidate : candidate;
            if (measure(candidateForMeasure) <= maxWidth || current === '') {
              current = candidate;
            } else {
              out.push(firstChunk ? prefix + current.trimEnd() : current.trimEnd());
              firstChunk = false;
              current = /^\s+$/.test(token) ? '' : token;
            }
          }
          if (current.length > 0) {
            out.push(firstChunk ? prefix + current.trimEnd() : current.trimEnd());
          }
        }
        return out;
      }
      // Choose description sizing and indentation from the measured text width.
      function getCardDescriptionLayout(context, descriptionLines) {
        const longestLineWidth = getDescriptionMaxLineWidth(context, descriptionLines, 0);
        const usesSmallDescriptionFont = longestLineWidth >= 1000;
        const indentationWidth = usesSmallDescriptionFont
          ? getDescriptionMaxLineWidth(context, descriptionLines, -2)
          : longestLineWidth;
        return {
          indent: indentationWidth > 980 ? indentationWidth / 2 : 490,
          longestLineWidth,
        };
      }
      // Split formatting markers into styled text segments before measuring or painting.
      function parseRichTextSegments(text) {
        const segments = [];
        let isBold = false;
        let isItalic = false;
        let index = 0;
        let buffer = '';
        const flushBuffer = () => {
          if (buffer.length > 0) {
            segments.push({
              type: 'text',
              value: buffer,
              bold: isBold,
              italic: isItalic,
            });
            buffer = '';
          }
        };
        while (index < text.length) {
          if (text.startsWith('**', index)) {
            flushBuffer();
            isBold = !isBold;
            index += 2;
            continue;
          }
          if (text[index] == '~') {
            flushBuffer();
            isItalic = !isItalic;
            index += 1;
            continue;
          }
          if (text.startsWith('::', index)) {
            const closingIndex = text.indexOf('::', index + 2);
            if (closingIndex != -1) {
              flushBuffer();
              segments.push({
                type: 'emoji',
                value: text.slice(index + 2, closingIndex),
              });
              index = closingIndex + 2;
              continue;
            }
          }
          buffer += text[index];
          index += 1;
        }
        flushBuffer();
        return segments;
      }
      // Central font selection keeps bold/italic measurement consistent with rendering.
      function getRichTextSegmentFont(
        bold,
        italic,
        fontSizeAdjustment = descriptionFontSizeAdjustment,
      ) {
        const baseSize = Math.max(1, 49 + fontSizeAdjustment);
        const italicSize = Math.max(1, 36 + fontSizeAdjustment);
        if (bold && italic) return `italic bold ${italicSize}px Arial`;
        if (bold) return `bold ${baseSize}px Arial`;
        if (italic) return `italic ${italicSize}px Arial`;
        return `${baseSize}px Arial`;
      }
      // Sum segment widths rather than measuring the raw formatting markup.
      function getRichTextWidth(context, text, fontSizeAdjustment = descriptionFontSizeAdjustment) {
        const segments = parseRichTextSegments(text);
        return segments.reduce((sum, segment) => {
          if (segment.type == 'emoji') return sum + 64;
          context.font = getRichTextSegmentFont(segment.bold, segment.italic, fontSizeAdjustment);
          return sum + context.measureText(segment.value).width;
        }, 0);
      }
      // Draw styled segments and embedded symbols in sequence using their measured widths.
      function addTextWithBold(context, customEmoji, text, x, y, left = false) {
        context.textAlign = 'left';
        const segments = parseRichTextSegments(text);
        const fullTextWidth = segments.reduce((sum, segment) => {
          if (segment.type == 'emoji') return sum + 64;
          context.font = getRichTextSegmentFont(segment.bold, segment.italic);
          return sum + context.measureText(segment.value).width;
        }, 0);
        let indent = 0;
        segments.forEach((segment) => {
          if (segment.type == 'emoji') {
            if (defaultEmoji.includes(segment.value))
              addEmoji(context, segment.value, x - (left ? 0 : fullTextWidth / 2) + indent, y - 50);
            if (customEmoji.find((item) => item[0] == segment.value))
              addCustomEmoji(
                context,
                customEmoji,
                segment.value,
                x - (left ? 0 : fullTextWidth / 2) + indent,
                y - 50,
              );
            indent += 64;
          } else {
            context.font = getRichTextSegmentFont(segment.bold, segment.italic);
            const partWidth = context.measureText(segment.value).width;
            context.fillText(segment.value, x - (left ? 0 : fullTextWidth / 2) + indent, y);
            indent += partWidth;
          }
        });
        context.textAlign = 'center';
      }
      function addCardType(context, text, x, y) {
        addOutlinedText(context, text, x, y, 54, 6, 604);
      }
      // A dark outline keeps numbers and labels legible over detailed artwork.
      function addOutlinedText(context, text, x, y, fontSize, outlineSize, widthLimit) {
        context.font = `${fontSize}px Modesto Poster`;
        context.lineWidth = outlineSize;
        context.strokeText(text, x, y, widthLimit);
        context.fillStyle = 'white';
        context.fillText(text, x, y, widthLimit);
        context.fillStyle = 'black';
      }
      function addExtraMarker(context) {
        const previousAlign = context.textAlign;
        context.textAlign = 'center';
        addOutlinedText(context, '>', 1060, 150, 90, 8);
        context.textAlign = previousAlign;
      }
      function addTitle(context, text, x, y, widthLimit) {
        context.textAlign = 'center';
        context.font = '66px Modesto Poster';
        context.fillText(text, x, y, widthLimit);
      }
      function addInitiative(context, value, x, y, bonus) {
        addSquishedOutlinedText(context, value.toString(), x, y, 197, 14, 0.92, false, bonus);
      }
      function addModifierValue(context, value, x, y, bonus = 0) {
        return addSquishedOutlinedText(
          context,
          value.toString(),
          x,
          y,
          156,
          14,
          0.875,
          false,
          bonus,
        );
      }
      function addBlockValue(context, value, x, y, bonus = 0) {
        return addSquishedOutlinedText(context, value, x, y, 156, 14, 0.875, false, bonus);
      }
      function addPrimaryValue(context, value, x, y, bonus = 0) {
        return addSquishedOutlinedText(
          context,
          value.toString(),
          x,
          y,
          156,
          14,
          0.875,
          false,
          bonus,
        );
      }
      function addSign(context, text, x, y) {
        addSquishedOutlinedText(context, text, x, y, 156, 14, 0.875, true);
      }
      function addSecondaryValue(context, value, x, y, bonus = 0) {
        addSquishedOutlinedText(context, value.toString(), x, y, 136, 14, 0.875, false, bonus);
      }
      // Render to a temporary canvas, then compress horizontally to fit a narrow slot.
      // This preserves the intended text height when a value is wider than its icon.
      function addSquishedOutlinedText(
        context,
        text,
        x,
        y,
        fontSize,
        outlineSize,
        squishness,
        left = false,
        bonus = 0,
      ) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 400;
        tempCanvas.height = 400;
        const tempContext = tempCanvas.getContext('2d');
        tempContext.textAlign = left ? 'left' : 'center';
        tempContext.font = `${fontSize}px Modesto Poster`;
        tempContext.lineWidth = outlineSize;
        tempContext.strokeText(text, 200, 200);
        switch (bonus) {
          case 0:
            tempContext.fillStyle = 'white';
            break;
          case 1:
            tempContext.fillStyle = 'palegreen';
            break;
          case 2:
            tempContext.fillStyle = 'powderblue';
            break;
          case 3:
            tempContext.fillStyle = 'plum';
            break;
        }
        tempContext.fillText(text, 200, 200);
        tempContext.fillStyle = 'black';
        context.drawImage(
          tempCanvas,
          0,
          0,
          400,
          400,
          x - 200 * squishness,
          y - 200,
          400 * squishness,
          400,
        );
        return tempContext.measureText(text).width * squishness;
      }

      return { updateCanvas, images, preloadImages, importCardImage };
    })();
    // Map effect-text icon names to site assets and color-specific painter sprites.
    const m1 = (() => {
      // Some action sprites have no purple variant; use the silver artwork for those.
      const ABSENT_PURPLE = {
        purple: 'silver',
      };
      function withColor(base, color, fallbacks = {}) {
        return `${base}_${fallbacks[color] ?? color}`;
      }
      const CARD_ICONS = {
        attack: {
          iconPath: '/icons/attack.png',
          painterSprite: (c) => withColor('attack', c, ABSENT_PURPLE),
        },
        defense: {
          iconPath: '/icons/defense.png',
          painterSprite: (c) => withColor('defense', c, ABSENT_PURPLE),
        },
        movement: {
          iconPath: '/icons/movement.png',
          painterSprite: (c) => withColor('movement', c, ABSENT_PURPLE),
        },
        range: {
          iconPath: '/icons/range.png',
          painterSprite: (c) => withColor('range', c),
        },
        radius: {
          iconPath: '/icons/radius.png',
          painterSprite: (c) => withColor('area', c),
        },
        initiative: {
          iconPath: '/icons/initiative.png',
          painterSprite: () => 'initiative',
        },
        poison_marker: {
          iconPath: '/icons/marker_poison.png',
          painterSprite: () => 'marker_poison',
        },
        bounty_marker: {
          iconPath: '/icons/marker_bounty.png',
          painterSprite: () => 'marker_bounty',
        },
        life_counter: {
          iconPath: '/icons/life_counters.png',
          painterSprite: () => 'life_counters',
        },
        smoke_bomb_token: {
          iconPath: '/icons/token_smoke_bomb.png',
          painterSprite: () => 'token_smoke_bomb',
        },
        grenade_token: {
          iconPath: '/icons/token_grenade.png',
          painterSprite: () => 'token_grenade',
        },
        blast_token: {
          iconPath: '/icons/token_blast.png',
          painterSprite: () => 'token_blast',
        },
        dud_token: {
          iconPath: '/icons/token_dud.png',
          painterSprite: () => 'token_dud',
        },
        zombie_token: {
          iconPath: '/icons/token_zombie.png',
          painterSprite: () => 'token_zombie',
        },
      };

      return { CARD_ICONS };
    })();
    // Public painter adapter: normalize a website card object into drawing arguments.
    const m0 = (() => {
      const { CARD_ICONS } = m1;
      const { importCardImage, preloadImages, updateCanvas } = m2;
      const { Color, Item, Modifier, Type, ValueSign } = m3;
      const CARD_W = 1192;
      const CARD_H = 1664;
      let assetsReadyPromise = null;
      // Share one in-flight promise so simultaneous Deck cards wait on the same assets.
      function ensureCardAssetsReady() {
        if (assetsReadyPromise) return assetsReadyPromise;
        assetsReadyPromise = Promise.all([
          preloadImages(),
          document.fonts
            .load(`16px "Modesto Poster"`)
            .then(() => document.fonts.ready)
            .then(() => undefined),
        ]).then(() => undefined);
        return assetsReadyPromise;
      }
      // Cache promises as well as completed backgrounds to avoid duplicate requests.
      const bgCache = new Map();
      function loadCardBackground(heroSlug, imageId) {
        const key = `${heroSlug}/${imageId}`;
        const existing = bgCache.get(key);
        if (existing) return existing;
        const p = importCardImage(heroSlug, imageId);
        bgCache.set(key, p);
        return p;
      }
      const TIER_TO_LEVEL = {
        I: 'i',
        II: 'ii',
        III: 'iii',
        IV: 'iv',
        UNTIERED: 'i',
      };
      const VALID_COLORS = new Set(Object.values(Color));
      const VALID_TYPES = new Set(Object.values(Type));
      const VALID_ITEMS = new Set(Object.values(Item));
      function tierToLevel(tier) {
        return TIER_TO_LEVEL[tier] ?? 'i';
      }
      function asColor(c) {
        return c && VALID_COLORS.has(c) ? c : Color.GOLD;
      }
      function asType(t) {
        return t && VALID_TYPES.has(t) ? t : Type.ATTACK;
      }
      function asItem(i) {
        return i && VALID_ITEMS.has(i) ? i : Item.ATTACK;
      }
      function valueSign(v) {
        return v < 0 ? ValueSign.MINUS : ValueSign.NONE;
      }
      // Convert website :icon: tokens to the painter’s ::sprite:: notation.
      // Unknown tokens are left untouched rather than silently deleted.
      function translateEffectIcons(text, color) {
        const colorLower = color.toLowerCase();
        return text.replace(/(?<!:):([a-z_]+):(?!:)/g, (match, name) => {
          const def = CARD_ICONS[name];
          if (!def) return match;
          return `::${def.painterSprite(colorLower)}::`;
        });
      }
      // Read printed stats only. Hero upgrades are applied by text/list renderers, not Deck.
      function paintCard(canvas, ctx, card, background) {
        const color = asColor(card.color);
        const primaryType = asType(card.primary_action);
        const primaryValue = card.primary_action_value ?? 0;
        const secondary = card.secondary_actions ?? {};
        const secondaryMovement = secondary.MOVEMENT ?? 0;
        const secondaryDefense = secondary.DEFENSE ?? 0;
        const secondaryAttack = 'ATTACK' in secondary ? secondary.ATTACK : null;
        let modifier = Modifier.NONE;
        let modifierValue = 0;
        if (card.radius_value != null) {
          modifier = Modifier.AREA;
          modifierValue = card.radius_value;
        } else if (card.range_value != null) {
          modifier = Modifier.RANGE;
          modifierValue = card.range_value;
        }
        updateCanvas(
          canvas,
          ctx,
          [],
          background,
          color,
          false,
          false,
          card.name ?? '',
          translateEffectIcons(card.effect_text ?? '', color),
          tierToLevel(card.tier),
          asItem(card.item),
          card.initiative ?? 0,
          primaryType,
          Math.abs(primaryValue),
          valueSign(primaryValue),
          modifier,
          modifierValue,
          ValueSign.NONE,
          secondaryMovement,
          secondaryDefense,
          secondaryAttack,
        );
      }

      return { CARD_W, CARD_H, ensureCardAssetsReady, loadCardBackground, paintCard };
    })();
    return m0;
  })();
  // 5. Shared card presentation and upgrade values
  // All text cards, compact rows, dots, and accents share this color vocabulary.
  const cardColors = {
    RED: '#de6262',
    BLUE: '#67b1ef',
    GREEN: '#6abd7d',
    GOLD: '#e9c956',
    SILVER: '#c4c8ce',
    PURPLE: '#b799de',
  };
  const actionNames = {
    SKILL: 'Skill',
    DEFENSE_SKILL: 'Skill / Defense',
    ATTACK: 'Attack',
    DEFENSE: 'Defense',
    MOVEMENT: 'Movement',
    HOLD: 'Hold',
    FAST_TRAVEL: 'Fast travel',
    CLEAR: 'Clear',
  };
  // Build an icon with an optional overlaid value. Undefined/null means icon only;
  // zero is still a value here. Callers decide whether a stat is relevant.
  function cardSymbol(key, value) {
    const el = document.createElement('span');
    el.className = 'm2-symbol';
    el.title = actionNames[key] || key.toLowerCase();
    const img = document.createElement('img');
    img.src = '/icons/' + key.toLowerCase().replaceAll('_', '-') + '.png';
    img.alt = el.title;
    el.append(img);
    if (value !== undefined && value !== null) {
      const number = document.createElement('span');
      number.className = 'm2-symbol-value';
      number.textContent = String(value);
      el.append(number);
    }
    return el;
  }
  // Use the same coin drawing in full hero dashboards and compact Board summaries.
  function goldSymbol(value) {
    const el = document.createElement('span');
    el.className = 'm2-gold';
    el.title = 'Gold';
    el.setAttribute('aria-label', 'Gold ' + value);
    el.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="6"/><path d="M14.5 8.5a6 6 0 1 1-6 6M9 6v6"/></svg>';
    el.append(document.createTextNode(String(value)));
    return el;
  }
  // Suppress placeholder zeros, but preserve open-ended values and zeros explicitly
  // mentioned in rules text. This is presentation filtering, not rules evaluation.
  function relevantStat(card, key, value) {
    if (value == null) return false;
    if (String(value).endsWith('+')) return true;
    if (Number(value) > 0) return true;
    if (Number(value) !== 0) return false;
    const word = key.toLowerCase();
    return new RegExp('(?:' + word + '[^.\\n]{0,16}\\b0\\b|\\b0\\s+' + word + ')', 'i').test(
      card.effect_text || '',
    );
  }
  // Prefer the owning component’s hero. Otherwise match card identity against known
  // hero card collections; do not infer ownership merely from a card’s name or color.
  function cardUpgrades(card, source) {
    const direct = source && componentProp(source, 'hero');
    if (direct?.items) return direct.items;
    for (const box of document.querySelectorAll('[data-m2="hero"]')) {
      const hero = componentProp(box, 'hero');
      if (!hero) continue;
      const cards = [
        hero.current_turn_card,
        hero.ultimate_card,
        ...['hand', 'played_cards', 'discard_pile', 'deck', 'cast_spells'].flatMap((key) =>
          Array.isArray(hero[key]) ? hero[key] : [],
        ),
      ];
      if (
        cards.some(
          (candidate) => candidate && (candidate === card || (card.id && candidate.id === card.id)),
        )
      )
        return hero.items || {};
    }
    return {};
  }
  // Return null when a value cannot safely be adjusted. Only unsigned integer values
  // with an optional trailing + are supported; other printed notation stays intact.
  function upgradeValue(key, value, items) {
    const stat = key === 'DEFENSE_SKILL' ? 'DEFENSE' : key;
    const bonus = items[stat] ?? (stat === 'RADIUS' ? items.AREA : 0);
    if (typeof bonus !== 'number' || !Number.isFinite(bonus) || !bonus || value == null)
      return null;
    const match = String(value).match(/^(\d+)(\+?)$/);
    if (!match) return null;
    return String(Number(match[1]) + bonus) + match[2];
  }
  // Only modified numbers get the purple class; the tooltip explains base plus bonus.
  function upgradedSymbol(items, key, value) {
    const modified = upgradeValue(key, value, items);
    const symbol = cardSymbol(key, modified === null ? value : undefined);
    if (modified !== null) {
      const number = document.createElement('span');
      number.className = 'm2-symbol-value m2-upgraded-value';
      number.textContent = modified;
      number.title =
        'Base ' + value + '; upgrade ' + (Number.parseFloat(modified) - Number.parseFloat(value));
      symbol.append(number);
    }
    return symbol;
  }

  // Shared readable card renderer. Deck shows printed values; Hand and Heroes apply known upgrades.
  // Hand actions proxy native controls so the website remains responsible for game rules.
  function textCard(card, context, tip) {
    const items = context === 'deck' ? {} : cardUpgrades(card);
    const symbol = (key, value) => upgradedSymbol(items, key, value);
    const ultimate = card.tier === 'IV' || card.color === 'PURPLE';
    const box = document.createElement('article');
    box.className = 'm2-text-card';
    box.style.setProperty('--card-color', cardColors[card.color] || '#bfc7d2');
    const top = document.createElement('header');
    top.className = 'm2-card-top';
    const name = document.createElement('b');
    name.textContent = card.name;
    const tier = document.createElement('span');
    tier.textContent = ['I', 'II', 'III', 'IV'].includes(card.tier) ? card.tier : '';
    top.append(
      ultimate ? document.createElement('span') : symbol('INITIATIVE', card.initiative),
      name,
      tier,
    );
    const body = document.createElement('div');
    body.className = 'm2-card-body';
    const side = document.createElement('aside');
    const sec = card.secondary_actions || {};
    for (const key of ['MOVEMENT', 'DEFENSE', 'ATTACK'])
      if (key !== card.primary_action && relevantStat(card, key, sec[key]))
        side.append(symbol(key, sec[key]));
    const main = document.createElement('div'),
      head = document.createElement('div');
    head.className = 'm2-card-type';
    const basic =
      ['GOLD', 'SILVER'].includes(card.color) && ['ATTACK', 'SKILL'].includes(card.primary_action);
    let label =
      (basic ? 'Basic ' : '') + (actionNames[card.primary_action] || card.primary_action || '');
    if (
      ['SKILL', 'DEFENSE_SKILL', 'ATTACK'].includes(card.primary_action) &&
      (card.is_ranged || relevantStat(card, 'RANGE', card.range_value))
    )
      label += ' • Ranged';
    if (ultimate) label = 'Ultimate';
    const val = card.primary_action_value;
    const primary = symbol(
      card.primary_action || 'SKILL',
      val != null && String(val) !== '0' && String(val) !== '!' ? val : undefined,
    );
    const title = document.createElement('b');
    title.textContent = label;
    head.append(ultimate ? document.createElement('span') : primary, title);
    if (relevantStat(card, 'RANGE', card.range_value))
      head.append(symbol('RANGE', card.range_value));
    else if (relevantStat(card, 'RADIUS', card.radius_value))
      head.append(symbol('RADIUS', card.radius_value));
    const effect = document.createElement('div');
    effect.className = 'm2-card-effect';
    const parts = String(card.effect_text || '').split(/(:[a-z_]+:)/g);
    for (const part of parts) {
      if (/^:(attack|defense|movement|range|radius|initiative):$/.test(part))
        effect.append(symbol(part.slice(1, -1).toUpperCase()));
      else effect.append(document.createTextNode(part));
    }
    main.append(head, effect);
    body.append(side, main);
    const foot = document.createElement('footer');
    foot.className = 'm2-card-foot';
    if (context === 'deck' || context === 'hero') {
      if (card.item) {
        foot.append(symbol(card.item === 'AREA' ? 'RADIUS' : card.item));
      }
    } else {
      const original = tip
        ? Array.from(tip.querySelectorAll('button')).filter((b) => !b.closest('.m2-text-card'))
        : [];
      if (original.length) {
        for (const src of original) {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = src.textContent;
          b.disabled = src.disabled;
          const key = Object.keys(actionNames).find((k) =>
            b.textContent.toLowerCase().includes(actionNames[k].toLowerCase()),
          );
          b.dataset.action = key || '';
          if (key) {
            const raw = b.textContent.match(/\d+\+?/);
            const value = raw && upgradeValue(key, raw[0], items);
            if (value !== null && value !== false) {
              if (raw) {
                const parts = b.textContent.split(raw[0]);
                b.textContent = parts[0];
                const num = document.createElement('span');
                num.className = 'm2-upgraded-value';
                num.textContent = value;
                b.append(num, document.createTextNode(parts.slice(1).join(raw[0])));
              }
            }
          }
          on(b, 'click', (e) => {
            e.stopPropagation();
            src.click();
          });
          foot.append(b);
        }
      } else
        for (const [key, value] of Object.entries(sec)) {
          if (['MOVEMENT', 'DEFENSE', 'ATTACK'].includes(key) && !relevantStat(card, key, value))
            continue;
          const badge = document.createElement('span');
          badge.className = 'm2-action';
          badge.dataset.action = key;
          badge.textContent =
            (actionNames[key] || key) +
            (!['HOLD', 'CLEAR', 'FAST_TRAVEL'].includes(key) ? ' ' + value : '');
          const changed = upgradeValue(key, value, items);
          if (changed !== null && ['MOVEMENT', 'DEFENSE', 'ATTACK'].includes(key)) {
            badge.textContent = (actionNames[key] || key) + ' ';
            const num = document.createElement('span');
            num.className = 'm2-upgraded-value';
            num.textContent = changed;
            badge.append(num);
          }
          foot.append(badge);
        }
    }
    box.append(top, body, foot);
    if (context === 'hand') {
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'm2-card-dismiss';
      x.textContent = '×';
      x.setAttribute('aria-label', 'Hide card details');
      on(x, 'click', (e) => {
        e.stopPropagation();
        hiddenCardKey = JSON.stringify(card);
        dismiss();
        detailsPanel.replaceChildren();
      });
      foot.append(x);
      foot.classList.add('m2-has-dismiss');
    }
    return box;
  }
  // 6. Deck browser and canvas synchronization
  // Read view/sort before rendering so opening Deck does not flash the wrong layout.
  function loadDeckPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(deckPreferencesKey) || '{}');
      if (['grid', 'list', 'large'].includes(saved.view)) deckView = saved.view;
      if (['tier', 'color'].includes(saved.sort)) deckSort = saved.sort;
    } catch {}
  }
  // Persist only presentation choices; this does not change cards or game state.
  function selectDeckOption(value) {
    if (value === 'sort') deckSort = deckSort === 'tier' ? 'color' : 'tier';
    else deckView = value;
    try {
      localStorage.setItem(deckPreferencesKey, JSON.stringify({ view: deckView, sort: deckSort }));
    } catch {}
    deckUpdate();
  }
  loadDeckPreferences();
  // Single entry point for card props on a rendered native component.
  function renderedCard(element) {
    const card = componentProp(element, 'card');
    return card && typeof card.name === 'string' ? card : null;
  }
  // Native Deck omits basic cards in some layouts. Cache locally painted canvases
  // for the known own-hero basic cards and prune entries that are no longer needed.
  const basicCanvases = new Map();
  function deckBasics(modal) {
    const candidate = componentProp(modal, 'hero'),
      hero = Array.isArray(candidate?.deck) ? candidate : null;
    if (!hero) return [];
    const wanted = new Set(
      hero.deck
        .filter((card) => ['GOLD', 'SILVER'].includes(card.color))
        .map((card) => JSON.stringify([hero.id, card])),
    );
    for (const key of basicCanvases.keys()) if (!wanted.has(key)) basicCanvases.delete(key);
    return hero.deck
      .filter((card) => ['GOLD', 'SILVER'].includes(card.color))
      .map((card) => {
        const cacheKey = JSON.stringify([hero.id, card]);
        let canvas = basicCanvases.get(cacheKey);
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.width = 1192;
          canvas.height = 1664;
          basicCanvases.set(cacheKey, canvas);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#202631';
            ctx.fillRect(0, 0, 1192, 1664);
            ctx.fillStyle = '#fff';
            ctx.font = '48px sans-serif';
            ctx.fillText(card.name, 50, 100);
          }
          (async () => {
            try {
              await m2Painter.ensureCardAssetsReady();
              const slug = hero.id.toLowerCase().replace(/^hero_/, '');
              const bg = card.image_id
                ? await m2Painter.loadCardBackground(slug, card.image_id)
                : undefined;
              if (!dead && ctx)
                m2Painter.paintCard(canvas, ctx, { ...card, is_facedown: false }, bg);
            } catch (error) {
              console.warn('GoA mobile: basic card artwork unavailable', error);
            }
          })();
        }
        return { canvas, card };
      });
  }
  // Reconcile the native Deck modal with the custom browser. If source cards are
  // not ready, retain the native fallback instead of displaying an empty replacement.
  function deckUpdate() {
    const modal = q('[data-m2="deck"]');
    if (!modal || !root.hasAttribute('data-m2-active')) {
      if (deckState) {
        deckState.watchers?.forEach((stop) => stop());
        deckState.host.remove();
        deckState.zoom.remove();
        deckState.modal.removeAttribute('data-m2-deck-ready');
        deckState = null;
      }
      return;
    }
    const sources = Array.from(modal.querySelectorAll(c('cardGrid') + ' canvas'));
    if (!sources.length) return;
    const entries = sources.map((canvas) => ({ canvas, card: renderedCard(canvas) }));
    for (const entry of deckBasics(modal)) {
      if (!entries.some((e) => e.card?.id === entry.card.id && e.card?.color === entry.card.color))
        entries.push(entry);
    }
    if (entries.some((e) => !e.card)) {
      if (deckState) {
        deckState.watchers?.forEach((stop) => stop());
        deckState.host.remove();
        deckState.zoom.remove();
        deckState.modal.removeAttribute('data-m2-deck-ready');
        deckState = null;
      }
      return;
    } // Retain native deck if framework changes.
    if (!deckState || deckState.modal !== modal) {
      deckState?.watchers?.forEach((stop) => stop());
      deckState?.host.remove();
      deckState?.zoom.remove();
      const host = document.createElement('section');
      host.className = 'm2-deck-browser';
      const zoom = document.createElement('div');
      zoom.className = 'm2-deck-zoom';
      zoom.hidden = true;
      modal.append(host, zoom);
      modal.setAttribute('data-m2-deck-ready', '');
      deckState = { modal, host, zoom, key: '', copies: [], dirty: true, watchers: [] };
    }
    const state = deckState;
    const key = JSON.stringify([deckView, deckSort, entries.map((e) => e.card)]);
    if (state.key === key && state.sources?.every((v, i) => v === sources[i])) return;
    state.watchers?.forEach((stop) => stop());
    state.watchers = [];
    state.key = key;
    state.sources = sources;
    state.copies = [];
    state.dirty = true;
    for (const source of entries.map((e) => e.canvas)) watchDeckCanvas(state, source);
    state.zoom.hidden = true;
    state.zoom.replaceChildren();
    state.host.replaceChildren();
    const titleBar = document.createElement('div');
    titleBar.className = 'm2-deck-title';
    titleBar.textContent = 'Deck';
    state.host.append(titleBar);
    const controls = document.createElement('div');
    controls.className = 'm2-deck-controls';
    for (const [value, label] of [
      ['grid', 'Grid'],
      ['list', 'List'],
      ['large', 'Large'],
      ['sort', deckSort === 'tier' ? 'By tier' : 'By color'],
    ]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.setAttribute(
        'aria-pressed',
        String(value === 'sort' ? deckSort === 'color' : deckView === value),
      );
      if (value === 'sort') {
        b.className = 'm2-sort-switch';
        b.setAttribute('role', 'switch');
        b.setAttribute('aria-label', 'Sort by color instead of tier');
        b.setAttribute('aria-checked', String(deckSort === 'color'));
        b.textContent = '';
        const labels = document.createElement('span');
        labels.innerHTML = '<span>Tier</span><span>Color</span>';
        const track = document.createElement('i');
        b.append(labels, track);
      }
      on(b, 'click', () => selectDeckOption(value));
      controls.append(b);
    }
    state.host.append(controls);
    const colors = ['RED', 'BLUE', 'GREEN', 'PURPLE', 'GOLD', 'SILVER'];
    const tierRank = (v) =>
      ({ I: 1, II: 2, III: 3, IV: 4, 1: 1, 2: 2, 3: 3, 4: 4 })[String(v).toUpperCase()] ?? 4;
    const colorRank = (c) => {
      const r = colors.indexOf(String(c || '').toUpperCase());
      return r < 0 ? 99 : r;
    };
    entries.sort((a, b) =>
      deckSort === 'tier'
        ? tierRank(a.card.tier) - tierRank(b.card.tier) ||
          colorRank(a.card.color) - colorRank(b.card.color)
        : colorRank(a.card.color) - colorRank(b.card.color) ||
          tierRank(a.card.tier) - tierRank(b.card.tier),
    );
    const groups = new Map();
    for (const entry of entries) {
      const title =
        deckSort === 'tier'
          ? tierRank(entry.card.tier) === 4
            ? 'Ultimate & basics'
            : 'Tier ' + tierRank(entry.card.tier)
          : String(entry.card.color || 'Other').toLowerCase();
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title).push(entry);
    }
    // Register each displayed copy with its source so later source draws can refresh it.
    function image(entry, large = false) {
      const canvas = document.createElement('canvas');
      canvas.width = large
        ? entry.canvas.width
        : Math.min(entry.canvas.width, deckView === 'large' ? 720 : 360);
      canvas.height = Math.round((canvas.width * entry.canvas.height) / entry.canvas.width);
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', entry.card.name);
      state.copies.push([entry.canvas, canvas]);
      return canvas;
    }
    // Keep the enlarged canvas in the same copy registry, replacing the prior zoom view.
    function enlarge(entry) {
      state.copies = state.copies.filter(([, canvas]) => !state.zoom.contains(canvas));
      state.zoom.replaceChildren();
      state.dirty = true;
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = 'Close ×';
      on(close, 'click', () => {
        state.zoom.hidden = true;
      });
      const canvas = image(entry, true);
      state.zoom.append(close, canvas);
      state.zoom.hidden = false;
      deckPaint();
    }
    for (const [title, cards] of groups) {
      const heading = document.createElement('h3');
      heading.textContent = title;
      const group = document.createElement('div');
      group.className = 'm2-deck-cards m2-deck-' + deckView;
      state.host.append(heading, group);
      for (const entry of cards) {
        const card = entry.card,
          b = document.createElement('button');
        b.type = 'button';
        b.className = 'm2-deck-card';
        b.setAttribute('aria-label', 'Enlarge ' + card.name);
        on(b, 'click', () => enlarge(entry));
        if (deckView === 'list') {
          b.append(textCard(card, 'deck'));
        } else b.append(image(entry));
        group.append(b);
      }
    }
    deckPaint();
  }

  // Observe drawing on this source canvas only. Repaint copies when dirty instead of polling.
  // Teardown restores the original context methods, including inherited ones.
  function watchDeckCanvas(state, canvas) {
    let ctx;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;
    for (const method of [
      'drawImage',
      'clearRect',
      'fillRect',
      'fillText',
      'strokeText',
      'putImageData',
      'fill',
      'stroke',
      'reset',
    ]) {
      const original = ctx[method];
      if (typeof original !== 'function') continue;
      const own = Object.hasOwn(ctx, method);
      function wrapped(...args) {
        const result = original.apply(this, args);
        state.dirty = true;
        schedule();
        return result;
      }
      try {
        ctx[method] = wrapped;
        state.watchers.push(() => {
          if (ctx[method] === wrapped) {
            if (own) ctx[method] = original;
            else delete ctx[method];
          }
        });
      } catch {}
    }
  }
  // Copy pixels only for dirty sources while Deck is open; idle frames do no work.
  function deckPaint() {
    if (!deckState || !deckOpen || !deckState.dirty) return;
    const state = deckState;
    state.dirty = false;
    state.copies = state.copies.filter(([, dst]) => dst.isConnected);
    for (const [src, dst] of state.copies) {
      try {
        dst.getContext('2d').drawImage(src, 0, 0, dst.width, dst.height);
      } catch {}
    }
  }

  // 7. Header, settings, compact Board summaries, and gestures
  // Derive a compact HUD from native labels and controls without changing the phase.
  function updateMobileHeader(header) {
    if (!header) return;
    let hud = q('.m2-hud', header);
    if (!hud) {
      hud = document.createElement('div');
      hud.className = 'm2-hud';
      hud.innerHTML =
        '<div class="m2-hud-top"><div class="m2-life red"><img src="/icons/life_counter_red_front.png" alt="Orange lives"><b></b></div><div class="m2-round"><span></span><span></span></div><div class="m2-coin"><img alt="Tie breaker"><small></small></div><div class="m2-waves"><img src="/icons/wave_counter.png" alt="Waves"><b></b></div><div class="m2-life blue"><b></b><img src="/icons/life_counter_blue_front.png" alt="Blue lives"></div></div><div class="m2-hud-bottom"><div class="m2-phase"></div><div class="m2-status"></div></div>';
      header.append(hud);
      extras.add(hud);
    }
    const put = (sel, text) => {
      const e = q(sel, hud);
      if (e.textContent !== text) e.textContent = text;
    };
    for (const [team, cls] of [
      ['Red', 'red'],
      ['Blue', 'blue'],
    ])
      put(
        '.' + cls + ' b',
        q('[aria-label^="' + team + ' team"] [data-m2-fraction]', header)?.dataset.m2Fraction ||
          '—',
      );
    const meta = q(c('matchMeta'), header);
    put('.m2-round span:first-child', meta?.children[0]?.textContent || '');
    put('.m2-round span:last-child', meta?.children[2]?.textContent || '');
    const coin = q(c('tieBreaker'), header),
      img = q('.m2-coin img', hud);
    if (coin && img.getAttribute('src') !== coin.getAttribute('src'))
      img.src = coin.getAttribute('src');
    put('.m2-coin small', coin?.getAttribute('src')?.includes('orange') ? 'Orange' : 'Blue');
    const lanes = Array.from(header.querySelectorAll(c('waveLane')));
    put(
      '.m2-waves b',
      lanes
        .map((e) => e.getAttribute('aria-label')?.match(/(\d+) Wave/i)?.[1] || '0')
        .join(' / ') || '0',
    );
    put('.m2-phase', q(c('phase'), header)?.textContent || '');
    const status = q(c('statusCopy'), header);
    const title = q('strong', status || header)?.textContent || '';
    const rawDetail = q(c('statusDetail'), status || header)?.textContent || '';
    const detail =
      /locked in$/i.test(title) && rawDetail.includes(' · ')
        ? rawDetail.slice(rawDetail.lastIndexOf(' · ') + 3)
        : rawDetail;
    put('.m2-status', title + (detail ? '\n' + detail : ''));
    const height = Math.ceil(hud.getBoundingClientRect().height) + 10;
    if (height > 10 && root.style.getPropertyValue('--m2-head') !== height + 'px')
      root.style.setProperty('--m2-head', height + 'px');
  }
  let cursorsVisible = true;
  try {
    cursorsVisible = localStorage.getItem('goa2:remote-pointers-visible') !== 'hidden';
  } catch {}
  // Expose cursor visibility in the mobile settings and remember it on this device.
  function updateCursorSetting() {
    root.toggleAttribute('data-m2-hide-cursors', !cursorsVisible);
    const menu = q('[data-m2="tools"]');
    if (menu && !q('.m2-cursors', menu)) {
      const b = document.createElement('button');
      b.className = 'm2-cursors';
      b.type = 'button';
      b.setAttribute('role', 'switch');
      const sync = () => {
        b.textContent = 'Player cursors: ' + (cursorsVisible ? 'On' : 'Off');
        b.setAttribute('aria-checked', String(cursorsVisible));
      };
      on(b, 'click', () => {
        cursorsVisible = !cursorsVisible;
        try {
          localStorage.setItem('goa2:remote-pointers-visible', cursorsVisible ? 'shown' : 'hidden');
        } catch {}
        sync();
        updateCursorSetting();
        location.reload();
      });
      b.title = 'Changing this setting reloads the game view';
      sync();
      menu.append(b);
      extras.add(b);
    }
  }
  let summaryView = 'turn';
  try {
    const saved = localStorage.getItem('goa2-mobile-summary');
    if (['turn', 'stats', 'cards'].includes(saved))
      summaryView = saved === 'cards' ? 'turn' : saved;
  } catch {}
  // Shared slim/normal row structure: initiative, colored primary/name/range band,
  // then secondary stats. Adapt the contents while preserving native row click handlers.
  function updateCardRow(row, card, knownItems) {
    const items = knownItems || cardUpgrades(card, row);
    const symbol = (key, value) => upgradedSymbol(items, key, value);
    const key = JSON.stringify([card, items]);
    let view = q(':scope>.m2-list-card', row);
    // React replaces className when selection changes, even if card props are unchanged.
    if (!row.classList.contains('m2-adapted-row')) row.classList.add('m2-adapted-row');
    if (view?.dataset.key === key) return;
    if (!view) {
      view = document.createElement('span');
      view.className = 'm2-list-card';
      row.append(view);
      extras.add(view);
    }
    view.dataset.key = key;
    view.replaceChildren();
    row.classList.add('m2-adapted-row');
    const ultimate = card.tier === 'IV' || card.color === 'PURPLE';
    const initiative = ultimate
      ? document.createElement('span')
      : symbol('INITIATIVE', card.initiative);
    const band = document.createElement('span');
    band.className = 'm2-list-band';
    band.style.setProperty('--card-color', cardColors[card.color] || '#bbc3cf');
    const value = card.primary_action_value;
    if (!ultimate && card.primary_action)
      band.append(
        symbol(
          card.primary_action,
          value != null && String(value) !== '0' && String(value) !== '!' ? value : undefined,
        ),
      );
    const name = document.createElement('span');
    name.className = 'm2-list-name';
    name.textContent = card.name;
    band.append(name);
    if (relevantStat(card, 'RANGE', card.range_value))
      band.append(symbol('RANGE', card.range_value));
    else if (relevantStat(card, 'RADIUS', card.radius_value))
      band.append(symbol('RADIUS', card.radius_value));
    const secondary = document.createElement('span');
    secondary.className = 'm2-list-secondary';
    for (const stat of ['MOVEMENT', 'DEFENSE', 'ATTACK']) {
      const v = card.secondary_actions?.[stat];
      if (stat !== card.primary_action && relevantStat(card, stat, v))
        secondary.append(symbol(stat, v));
    }
    view.append(initiative, band, secondary);
    band.title = card.name;
  }
  // Synthesize the own-hero hand dots from visible hand cards to match other heroes.
  function updateOwnColors(sidebar) {
    const own = q('[data-m2="hero"]:not([data-m2-other])', sidebar),
      details = own && q(c('details'), own);
    if (!details) return;
    const hand = q('[data-m2="hand-list"]', sidebar);
    if (!hand) return;
    const colors = Array.from(hand.querySelectorAll(c('row')))
      .map(renderedCard)
      .filter(Boolean)
      .map((card) => card.color);
    let dots = q('.m2-own-colors', details);
    if (!dots) {
      dots = document.createElement('span');
      dots.className = 'm2-own-colors';
      details.prepend(dots);
      extras.add(dots);
    }
    const key = JSON.stringify(colors);
    if (dots.dataset.key === key) return;
    dots.dataset.key = key;
    dots.replaceChildren(
      ...['SILVER', 'GOLD', 'RED', 'BLUE', 'GREEN', 'PURPLE']
        .filter((color) => colors.includes(color))
        .map((color) => {
          const dot = document.createElement('i');
          dot.style.backgroundColor = cardColors[color];
          dot.title = color;
          return dot;
        }),
    );
  }
  // Board’s compact hero list shares full-dashboard card colors and active-effect
  // markers. Its two modes show turn/cards or level/gold/upgrades.
  function renderSummary(heroes) {
    const key = JSON.stringify([summaryView, heroes]);
    if (summary.dataset.key === key) return;
    summary.dataset.key = key;
    summary.replaceChildren();
    const controls = document.createElement('div');
    controls.className = 'm2-summary-controls';
    controls.setAttribute('aria-label', 'Hero overview information');
    for (const [value, label] of [
      ['turn', 'Turn / Cards'],
      ['stats', 'Level / Gold'],
    ]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.setAttribute('aria-pressed', String(summaryView === value));
      on(b, 'click', () => {
        summaryView = value;
        try {
          localStorage.setItem('goa2-mobile-summary', value);
        } catch {}
        refresh();
      });
      controls.append(b);
    }
    summary.append(controls);
    for (const h of heroes) {
      const a = document.createElement('article'),
        name = document.createElement('strong'),
        content = document.createElement('small');
      name.textContent = h.name;
      name.style.color = h.color;
      if (h.resolution?.current) a.classList.add('m2-current-hero');
      if (h.done) a.classList.add('m2-done-hero');
      content.className = 'm2-summary-content';
      if (summaryView === 'stats') {
        const stats = document.createElement('span');
        if (h.level != null)
          stats.append(document.createTextNode('Lv ' + h.level + ' • '), goldSymbol(h.gold));
        else stats.textContent = h.detail;
        content.append(stats);
        // Item icons occupy the dashboard’s upper-right slot; they are not extra card rows.
    const upgrades = document.createElement('span');
        upgrades.className = 'm2-summary-upgrades';
        for (const [stat, value] of Object.entries(h.upgrades || {}))
          if (
            ['ATTACK', 'DEFENSE', 'INITIATIVE', 'RANGE', 'MOVEMENT', 'RADIUS'].includes(stat) &&
            typeof value === 'number' &&
            value > 0
          )
            upgrades.append(cardSymbol(stat, '+' + value));
        content.append(upgrades);
      } else {
        const turn = document.createElement('span');
        turn.className = 'm2-summary-turn';
        if (h.resolution) {
          turn.append(
            document.createTextNode((h.resolution.current ? 'NOW' : h.resolution.order) + ' '),
            cardSymbol('INITIATIVE', h.resolution.initiative),
          );
          turn.title = h.resolution.card;
        } else if (h.planning) {
          turn.textContent = h.committed ? '✓ Selected' : 'Selecting';
          if (!h.committed) {
            const dots = document.createElement('span');
            dots.className = 'm2-selecting-dots';
            dots.textContent = '...';
            dots.setAttribute('aria-hidden', 'true');
            turn.append(dots);
          }
        } else turn.textContent = h.done ? '✓ Done' : '—';
        const piles = document.createElement('span');
        piles.className = 'm2-summary-piles';
        const add = (label, cards) => {
          const group = document.createElement('span');
          group.append(document.createTextNode(label + ' '));
          for (const card of cards) {
            const dot = document.createElement('i');
            dot.style.backgroundColor = card.color;
            dot.style.setProperty('--effect-color', card.color);
            dot.title = card.name || label;
            if (card.active) dot.classList.add('m2-effect-active');
            group.append(dot);
          }
          if (!cards.length) group.append(document.createTextNode('—'));
          piles.append(group);
        };
        add(
          'H',
          h.dots.map((color) => ({ color })),
        );
        for (const pile of h.cardPiles) add(pile.label, pile.cards);
        content.append(piles);
        if (h.currentCard) {
          const mini = document.createElement('span');
          mini.className = 'm2-mini-current';
          const card = h.currentCard;
          mini.title = card.is_facedown ? 'Current card (hidden)' : card.name;
          mini.setAttribute('aria-label', mini.title);
          mini.style.setProperty('--card-color', cardColors[card.color] || '#858c98');
          if (card.is_facedown) mini.textContent = '?';
          else mini.append(cardSymbol(card.primary_action || 'SKILL'));
          content.append(mini);
        }
        content.append(turn);
      }
      a.append(name, content);
      summary.append(a);
    }
  }
  // Keep rotation inside the native screen-space pan/zoom transform.
  let boardRotation = null;
  // Detach gesture listeners and restore the board’s native inline transform.
  function clearBoardRotation() {
    if (!boardRotation) return;
    const state = boardRotation;
    state.observer.disconnect();
    state.resize?.disconnect();
    state.gestures.abort();
    state.controls.remove();
    state.svg.removeAttribute('data-m2-rotate');
    state.host.removeAttribute('data-m2-rotation-host');
    for (const key of ['--m2-native-transform', '--m2-angle', '--m2-rotation-fit'])
      state.host.style.removeProperty(key);
    boardRotation = null;
  }
  // Track the angle between two touch pointers. Rotation is composed with native
  // pan/zoom rather than replacing their handlers; reset restores both transforms.
  function updateBoardRotation() {
    const svg = q('[data-m2="board"] svg' + c('svg'));
    if (!svg) {
      clearBoardRotation();
      return;
    }
    if (boardRotation?.svg === svg) {
      boardRotation.sync();
      return;
    }
    clearBoardRotation();
    const host = svg.parentElement,
      controls = document.createElement('div');
    controls.className = 'm2-board-controls';
    controls.setAttribute('aria-label', 'Board orientation');
    const state = {
      svg,
      host,
      controls,
      angle: 0,
      observer: null,
      resize: null,
      sync: null,
      gestures: new AbortController(),
    };
    boardRotation = state;
    svg.setAttribute('data-m2-rotate', '');
    host.setAttribute('data-m2-rotation-host', '');
    const put = (key, value) => {
      if (host.style.getPropertyValue(key) !== value) host.style.setProperty(key, value);
    };
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.setAttribute('aria-label', 'Reset board zoom, pan and rotation');
    state.sync = () => {
      const native = svg.style.transform || 'translate(0px,0px) scale(1)';
      put('--m2-native-transform', native);
      put('--m2-angle', state.angle + 'deg');
      // Twisting must not change magnification; pinch owns the zoom scale.
      put('--m2-rotation-fit', '1');
      const nativeReset = q(c('zoomReset'), host),
        zoom = nativeReset?.textContent.match(/\d+%/)?.[0] || '100%';
      const label = zoom + ' · Reset';
      if (reset.textContent !== label) reset.textContent = label;
    };
    // Native pan/zoom uses Pointer Events too. Observe without consuming its events.
    const touches = new Map();
    let previousAngle = null;
    const pairAngle = () => {
      const [a, b] = Array.from(touches.values());
      return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    };
    const listen = (event, fn) =>
      host.addEventListener(event, fn, { capture: true, signal: state.gestures.signal });
    listen('pointerdown', (e) => {
      if (
        e.pointerType !== 'touch' ||
        controls.contains(e.target) ||
        !root.hasAttribute('data-m2-active')
      )
        return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      previousAngle = touches.size === 2 ? pairAngle() : null;
    });
    listen('pointermove', (e) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size !== 2) return;
      const next = pairAngle();
      if (previousAngle !== null) {
        const delta = ((next - previousAngle + 540) % 360) - 180;
        state.angle = (state.angle + delta + 360) % 360;
        state.sync();
      }
      previousAngle = next;
    });
    const end = (e) => {
      touches.delete(e.pointerId);
      previousAngle = touches.size === 2 ? pairAngle() : null;
    };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(event, end);
    on(reset, 'click', () => {
      touches.clear();
      previousAngle = null;
      state.angle = 0;
      q(c('zoomReset'), host)?.click();
      state.sync();
    });
    controls.append(reset);
    for (const event of [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'dblclick',
      'click',
    ])
      on(controls, event, (e) => e.stopPropagation());
    host.append(controls);
    state.observer = new MutationObserver(state.sync);
    state.observer.observe(svg, { attributes: true, attributeFilter: ['style', 'viewBox'] });
    if (typeof ResizeObserver !== 'undefined') {
      state.resize = new ResizeObserver(state.sync);
      state.resize.observe(svg);
    }
    state.sync();
  }
  let planningActions = null;
  // Create compact proxies for native take-back/finish controls. Their original click
  // handlers still validate actions, while the proxies can fit the mobile layout.
  function updatePlanningActions() {
    const sources = Array.from(
      document.querySelectorAll(c('takeBackBtn') + ',' + c('finishPlanningBtn')),
    );
    const host = mode === 'board' ? q('[data-m2="board"]') : q('[data-m2="hand-list"]');
    if (!sources.length || !host) {
      planningActions?.element.remove();
      planningActions = null;
      return;
    }
    if (!planningActions) {
      const element = document.createElement('div');
      element.className = 'm2-planning-actions';
      planningActions = { element, sources: [] };
      extras.add(element);
    }
    const state = planningActions;
    state.element.classList.toggle('m2-on-board', mode === 'board');
    if (state.element.parentElement !== host) host.append(state.element);
    if (
      sources.length !== state.sources.length ||
      sources.some((source, i) => source !== state.sources[i])
    ) {
      state.sources = sources;
      state.element.replaceChildren(
        ...sources.map((source) => {
          const button = document.createElement('button');
          button.type = 'button';
          on(button, 'click', () => source.click());
          return button;
        }),
      );
    }
    sources.forEach((source, i) => {
      const button = state.element.children[i];
      if (button.textContent !== source.textContent) button.textContent = source.textContent;
      button.disabled = source.disabled;
    });
  }

  // Read only props already supplied to the rendered hero/sidebar components.
  // 8. Public component props and hero dashboards
  // The cache lasts only until the next refresh; retaining a React tree across updates
  // would produce stale selections, item values, and event arrays.
  let committedFiberCache = new Map();

  // React may leave an alternate fiber on a DOM node. Read the committed tree, not stale props.
  // This private integration is isolated here because a website update may change it.
  function currentFiber(element) {
    const key = element && Object.keys(element).find((k) => k.startsWith('__reactFiber$'));
    const original = key ? element[key] : null;
    if (!original) return null;
    let top = original;
    while (top.return) top = top.return;
    const rootState = top.stateNode,
      current = rootState?.current;
    if (!current) return original;
    let cache = committedFiberCache.get(rootState);
    if (!cache || cache.current !== current) {
      const hosts = new WeakMap(),
        stack = [current];
      while (stack.length) {
        const node = stack.pop();
        if (node.stateNode && typeof node.stateNode === 'object') hosts.set(node.stateNode, node);
        for (let child = node.child; child; child = child.sibling) stack.push(child);
      }
      cache = { current, hosts };
      committedFiberCache.set(rootState, cache);
    }
    return cache.hosts.get(element) || null;
  }
  // Walk up a bounded number of component ancestors to find a supplied prop.
  // Missing props are normal during mounting/navigation; callers must tolerate null.
  function componentProp(element, key) {
    let fiber = currentFiber(element);
    for (let i = 0; fiber && i < 32; i++, fiber = fiber.return) {
      const value = fiber.memoizedProps?.[key];
      if (value !== undefined && value !== null) return value;
    }
    return null;
  }
  // Exclude injected item/stat nodes when recovering the native hero/player label.
  function heroDisplayName(name) {
    if (!name) return '';
    const copy = name.cloneNode(true);
    copy.querySelectorAll(c('items')).forEach((e) => e.remove());
    return copy.textContent.trim();
  }
  // Recognize the own-player committed UI while public hero props catch up.
  function hasLocalSelection(box) {
    return (
      !box.hasAttribute('data-m2-other') && !!q('[data-m2="hand-list"] ' + c('row') + c('selected'))
    );
  }
  // Build portrait, piles, status, upgrades, effects, and optional expanded rows.
  // The serialized render key prevents replacing buttons and animations on every refresh.
  function updateHeroDashboard(box, view) {
    const hero = componentProp(box, 'hero');
    if (!hero || !Array.isArray(hero.played_cards)) return;
    // An absent location means off board only when a location map is actually available.
    // Missing board data alone must not be treated as a death/off-board signal.
    const locations = view?.board?.entity_locations;
    const offboard =
      locations && typeof locations === 'object' ? !Object.hasOwn(locations, hero.id) : null;
    const effects = view?.effects || [];
    const cards = [
      ...hero.played_cards,
      ...(hero.discard_pile || []),
      hero.current_turn_card,
      ...(hero.cast_spells || []),
    ].filter((card) => card && !card.is_facedown);
    // Effects can mark their source card active even if the card flag is not set.
    // Deduplicate by card ID because the same card can appear in multiple collections.
    const active = [
      ...new Map(
        cards
          .filter(
            (card) =>
              card.is_active ||
              effects.some((effect) => effect.is_active && effect.source_card_id === card.id),
          )
          .map((card) => [card.id, card]),
      ).values(),
    ];
    const handDots = Array.from(box.querySelectorAll(c('handColorDot') + ',.m2-own-colors i')).map(
      (dot) => ({ color: dot.style.backgroundColor, label: dot.title }),
    );
    const locallySelected = hasLocalSelection(box);
    const expanded = expandedHeroId === hero.id;
    box.classList.toggle('m2-hero-expanded', expanded);
    const heading = q(':scope>' + c('name'), box);
    if (heading) {
      managedAttribute(heading, 'role', 'button');
      managedAttribute(heading, 'tabindex', '0');
      managedAttribute(heading, 'aria-expanded', String(expanded));
    }
    const key = JSON.stringify([
      expanded,
      hero.hand,
      locallySelected,
      hero.level,
      hero.gold,
      handDots,
      hero.current_turn_card,
      hero.can_commit_second_card,
      hero.played_cards,
      hero.discard_pile,
      hero.rune_slots,
      hero.items,
      hero.cast_spells?.length,
      active,
      offboard,
      view?.turn,
      view?.phase,
    ]);
    let dashboard = q('.m2-hero-dashboard', box);
    if (dashboard?.dataset.key === key) return;
    if (!dashboard) {
      dashboard = document.createElement('div');
      dashboard.className = 'm2-hero-dashboard';
      box.append(dashboard);
      extras.add(dashboard);
    }
    dashboard.dataset.key = key;
    dashboard.replaceChildren();
    // Store identities instead of a card snapshot: the separate display re-resolves
    // the latest visible card and its upgrades on every refresh.
    function inspect(card) {
      if (!expanded) {
        expandedHeroId = hero.id;
        updateHeroDashboard(box, view);
      }
      selectedHeroCard = { heroId: hero.id, cardId: card.id };
      updateHeroCardDisplay();
    }

    const portrait = document.createElement('span');
    portrait.className = 'm2-hero-portrait';
    portrait.style.borderColor = String(hero.team).toUpperCase() === 'BLUE' ? '#64a6e8' : '#e56d6d';
    const portraitImage = document.createElement('img');
    portraitImage.src =
      '/hero-images/' +
      encodeURIComponent((hero.name || hero.id.replace(/^hero_/i, '')).toLowerCase()) +
      '.webp';
    portraitImage.alt = hero.name || hero.id;
    if (offboard) portrait.style.filter = 'grayscale(1)';
    portrait.append(portraitImage);
    dashboard.append(portrait);
    if (offboard) {
      const label = document.createElement('span');
      label.className = 'm2-offboard-label';
      label.textContent = '☠';
      label.title = 'Off board';
      label.setAttribute('aria-label', 'Off board');
      portrait.append(label);
    }
    const history = document.createElement('div');
    history.className = 'm2-hero-history';
    history.setAttribute('aria-label', 'Level, gold, hand, played and discarded cards');
    const stats = document.createElement('span');
    stats.append(
      document.createTextNode('Lv ' + hero.level + ' • '),
      goldSymbol(hero.gold),
      document.createTextNode(' • Hand:'),
    );
    history.append(stats);
    for (const dot of handDots) {
      const marker = document.createElement('span');
      marker.className = 'm2-history-marker';
      marker.style.setProperty('--effect-color', dot.color);
      marker.title = dot.label || 'Hand card';
      history.append(marker);
    }
    if (!handDots.length) history.append(document.createTextNode('—'));
    // Each pile dot can inspect a known card. Facedown cards remain non-interactive;
    // active source cards receive the breathing class, and rune markers remain attached.
    function slot(card, label, rune) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'm2-history-slot';
      const marker = document.createElement('span');
      marker.className = 'm2-history-marker';
      if (card?.color) marker.style.setProperty('--effect-color', cardColors[card.color] || '#888');
      button.append(marker);
      button.disabled = !card || card.is_facedown;
      button.title = label + ': ' + (card?.is_facedown ? 'Hidden card' : card?.name || 'Empty');
      button.setAttribute('aria-label', button.title);
      if (card && !card.is_facedown) {
        button.onclick = () => inspect(card);
        if (active.some((a) => a.id === card.id)) marker.classList.add('m2-effect-active');
      }
      if (rune) {
        const img = document.createElement('img');
        img.src = '/cards/sheets/rune_' + encodeURIComponent(rune) + '.png';
        img.alt = 'Rune ' + rune;
        button.append(img);
      }
      history.append(button);
    }
    const playedLabel = document.createElement('span');
    playedLabel.textContent = 'Played:';
    history.append(playedLabel);
    hero.played_cards.forEach((card, i) => {
      if (card) slot(card, 'Turn ' + (i + 1), hero.rune_slots?.[String(i + 1)]);
    });
    if (!hero.played_cards.some(Boolean)) history.append(document.createTextNode('—'));
    const discardLabel = document.createElement('span');
    discardLabel.textContent = 'Discard:';
    history.append(discardLabel);
    if (!hero.discard_pile?.length) history.append(document.createTextNode('—'));
    (hero.discard_pile || []).forEach((card, i) => slot(card, 'D' + (i + 1)));
    dashboard.append(history);
    if (
      /^PLANNING$/i.test(view?.phase || '') &&
      !locallySelected &&
      !(hero.current_turn_card && !box.hasAttribute('data-m2-other'))
    ) {
      const status = document.createElement('span');
      status.className = 'm2-selection-status';
      const selected = !!hero.current_turn_card;
      status.textContent = selected
        ? hero.can_commit_second_card
          ? 'Selected · choosing second'
          : '✓ Selected'
        : 'Selecting…';
      if (!selected) {
        status.textContent = 'Selecting';
        status.setAttribute('aria-label', 'Selecting');
        const dots = document.createElement('span');
        dots.className = 'm2-selecting-dots';
        dots.textContent = '...';
        dots.setAttribute('aria-hidden', 'true');
        status.append(dots);
      }
      status.title = selected ? 'A card has been committed' : 'Waiting for a card to be committed';
      dashboard.append(status);
    }

    const upgrades = document.createElement('div');
    upgrades.className = 'm2-hero-upgrades';
    upgrades.setAttribute('aria-label', 'Upgrades');
    for (const stat of ['ATTACK', 'DEFENSE', 'INITIATIVE', 'RANGE', 'MOVEMENT', 'RADIUS']) {
      const value = hero.items?.[stat];
      if (typeof value === 'number' && value > 0) {
        const symbol = cardSymbol(stat, '+' + value);
        symbol.title = 'Upgrade: ' + stat.toLowerCase() + ' +' + value;
        upgrades.append(symbol);
      }
    }
    if (upgrades.children.length) dashboard.append(upgrades);
    const badges = document.createElement('div');
    badges.className = 'm2-hero-effects';
    if (hero.spellbook != null) {
      const count = document.createElement('span');
      count.textContent = 'Cast ' + (hero.cast_spells?.length || 0);
      badges.append(count);
    }
    for (const card of active) {
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'm2-effect-active';
      badge.style.setProperty('--effect-color', cardColors[card.color] || '#bbab73');
      badge.textContent = card.name;
      badge.title = 'Active effect: ' + (card.effect_text || card.name);
      badge.setAttribute('aria-label', card.name + ' · active effect');
      badge.onclick = () => inspect(card);
      badges.append(badge);
    }
    if (badges.children.length) dashboard.append(badges);
    // Expansion stays inside the hero list. Only clicking an individual card opens
    // the larger display; opponents’ hands remain represented by their public dots.
    if (expanded) {
      const board = document.createElement('div');
      board.className = 'm2-expanded-board';
      function cardRow(card, label) {
        const line = document.createElement('div');
        line.className = 'm2-hero-slot';
        if (label) {
          const title = document.createElement('span');
          title.className = 'm2-slot-label';
          title.textContent = label;
          line.append(title);
        }
        if (!card) {
          const empty = document.createElement('span');
          empty.className = 'm2-slot-empty';
          empty.textContent = '—';
          line.append(empty);
        } else if (card.is_facedown) {
          const hidden = document.createElement('span');
          hidden.className = 'm2-slot-hidden';
          hidden.textContent = 'Hidden card';
          line.append(hidden);
        } else {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'm2-expanded-card';
          row.setAttribute('aria-label', card.name);
          updateCardRow(row, card, hero.items || {});
          if (active.some((a) => a.id === card.id)) {
            row.classList.add('m2-effect-active');
            row.style.setProperty('--effect-color', cardColors[card.color] || '#bbab73');
          }
          row.onclick = () => inspect(card);
          line.append(row);
        }
        return line;
      }
      function section(title) {
        const el = document.createElement('section'),
          heading = document.createElement('h4');
        heading.textContent = title;
        el.append(heading);
        board.append(el);
        return el;
      }
      section('Current:').append(cardRow(hero.current_turn_card));
      if (!box.hasAttribute('data-m2-other')) {
        const hand = section('Hand:');
        const cards = Array.isArray(hero.hand)
          ? hero.hand
          : Array.from(document.querySelectorAll('[data-m2="hand-list"] ' + c('row')))
              .map(renderedCard)
              .filter(Boolean);
        if (cards.length) cards.forEach((card) => hand.append(cardRow(card)));
        else hand.append(cardRow(null));
      }
      const played = section('');
      for (let i = 0; i < Math.max(4, hero.played_cards.length); i++)
        played.append(cardRow(hero.played_cards[i], 'Turn ' + (i + 1) + ':'));
      if (hero.discard_pile?.length) {
        const discard = section('Discard:');
        hero.discard_pile.forEach((card) => discard.append(cardRow(card)));
      }
      dashboard.append(board);
    }
  }

  // Resolve the selected card by identity each refresh so upgrades and visibility stay current.
  function updateHeroCardDisplay() {
    if (!selectedHeroCard) return;
    const box = Array.from(document.querySelectorAll('[data-m2="hero"]')).find(
      (box) => componentProp(box, 'hero')?.id === selectedHeroCard.heroId,
    );
    const hero = box && componentProp(box, 'hero');
    if (!hero) {
      clearHeroCard();
      return;
    }
    const cards = [
      hero.current_turn_card,
      hero.extra_turn_card,
      hero.ultimate_card,
      ...['hand', 'played_cards', 'discard_pile', 'cast_spells'].flatMap((key) =>
        Array.isArray(hero[key]) ? hero[key] : [],
      ),
    ];
    const card = cards.find((card) => card?.id === selectedHeroCard.cardId && !card.is_facedown);
    if (!card) {
      clearHeroCard();
      return;
    }
    const key = JSON.stringify([card, hero.items]);
    if (heroPanel.dataset.key === key) return;
    const display = textCard(card, 'hero'),
      close = document.createElement('button');
    close.type = 'button';
    close.className = 'm2-card-dismiss';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close card details');
    close.onclick = clearHeroCard;
    const foot = q('.m2-card-foot', display);
    foot.classList.add('m2-has-dismiss');
    foot.append(close);
    heroPanel.replaceChildren(display);
    heroPanel.dataset.key = key;
  }
  // Keep native upgrade buttons and their selection handlers; replace only presentation.
  // Use the Deck text-card presentation inside native upgrade option buttons.
  // The awarded item belongs to the paired card, so derive it from the option pair.
  function updateUpgradeCards() {
    for (const button of document.querySelectorAll('button' + c('upgradeCard'))) {
      const request = componentProp(button, 'inputRequest'),
        heroId = componentProp(button, 'myHeroId');
      if (request?.type !== 'UPGRADE_PHASE' || !heroId) continue;
      const options = request.players?.[heroId]?.options || [];
      const name = q(c('cardName'), button)?.textContent.trim();
      const matches = options
        .flatMap((option) =>
          (option.card_details || []).map((card, index) => ({
            card,
            item: option.card_details[index === 0 ? 1 : 0]?.item,
          })),
        )
        .filter((entry) => entry.card.name === name);
      if (matches.length !== 1) continue;
      const { card, item } = matches[0],
        key = JSON.stringify([card, item]);
      if (button.dataset.m2UpgradeKey === key && q(':scope>.m2-text-card', button)) continue;
      button.dataset.m2UpgradeKey = key;
      q(':scope>.m2-text-card', button)?.remove();
      // The discarded alternative grants the item, not the chosen card itself.
      const display = textCard({ ...card, item }, 'deck');
      if (item) {
        const foot = q('.m2-card-foot', display);
        foot.title = 'Choosing this gains ' + item.toLowerCase();
        foot.setAttribute('aria-label', foot.title);
      }
      button.append(display);
      extras.add(display);
    }
  }
  // Read the native resolution queue as the authority for order and initiative.
  // The queue overlay is hidden by CSS, but its rendered data still drives hero badges.
  function resolutionEntries() {
    const rows = Array.from(document.querySelectorAll(c('entry'))).filter(
      (e) => q(c('initiative'), e) && q(c('heroName'), e) && q(c('cardName'), e),
    );
    for (const row of rows) {
      const container = row.closest(c('container'));
      if (container) tag(container, 'resolution-queue');
    }
    return rows.map((e, i) => ({
      name: q(c('heroName'), e).textContent.trim(),
      initiative: q(c('initiative'), e).textContent.trim(),
      card: q(c('cardName'), e).textContent.trim(),
      color: q(c('cardName'), e).style.color,
      order: i + 1,
      current: e.matches(c('nextEntry')),
    }));
  }
  // Persist only the events already delivered to the rendered EventLog component.
  // 9. Received-event history
  // This archive contains only events delivered to this browser. It cannot backfill
  // events missed while offline. Storage is per game pathname and capped at 2,000 entries.
  const EVENT_LIMIT = 2000;
  let eventHistoryKey = '',
    savedEvents = [],
    seenEvents = new Set(),
    historyDirty = false,
    historyError = '',
    historyRevision = 0,
    lastLogArrays = new Set(),
    blockedLogArrays = new WeakSet();
  const pendingHistoryWrites = new Map();
  // Event IDs can restart after refresh; include timestamp and payload for deduplication.
  function eventKey(entry) {
    return JSON.stringify([entry.timestamp, entry.id, entry.event]);
  }

  // Keep failed writes queued per game; a temporary storage failure must not discard received events.
  function flushEventHistory() {
    if (historyDirty && eventHistoryKey) {
      pendingHistoryWrites.set(eventHistoryKey, JSON.stringify(savedEvents));
      historyDirty = false;
    }
    if (!pendingHistoryWrites.size) return;
    historyError = '';
    for (const [key, data] of pendingHistoryWrites) {
      try {
        localStorage.setItem(key, data);
        pendingHistoryWrites.delete(key);
      } catch {
        historyError = 'Event history could not be saved on this device. Retrying…';
      }
    }
  }

  // SPA navigation can leave old components mounted briefly. Quarantine their event arrays.
  function changeEventGame() {
    const key = 'goa2-mobile-events:' + location.pathname;
    if (key === eventHistoryKey) return false;
    flushEventHistory();
    if (eventHistoryKey) blockedLogArrays = new WeakSet(lastLogArrays);
    lastLogArrays = new Set();
    eventHistoryKey = key;
    savedEvents = [];
    seenEvents.clear();
    historyDirty = false;
    historyError = '';
    historyRevision++;
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(value))
        savedEvents = value
          .filter((x) => x?.event && typeof x.event === 'object' && typeof x.timestamp === 'number')
          .slice(-EVENT_LIMIT);
    } catch {
      historyError = 'Saved event history could not be read on this device.';
    }
    seenEvents = new Set(savedEvents.map(eventKey));
    for (const el of document.querySelectorAll('.m2-saved-events')) el.remove();
    expandedHeroId = null;
    clearHeroCard();
    return true;
  }
  // Prefer supplied text, then common event summaries. Unknown event types still get
  // a readable fallback; expandable raw metadata preserves details not summarized here.
  function savedEventText(entry) {
    const event = entry.event,
      meta = event.metadata || {},
      names = entry.names || {};
    const name = (id) => {
      const record = names[id];
      return typeof record === 'string' ? record : record?.name || id || '';
    };
    const actor = name(event.actor_id),
      target = name(event.target_id),
      type = String(event.event_type || event.type || 'Event');
    if (entry.text) return String(entry.text);
    switch (type) {
      case 'MOVE':
      case 'UNIT_MOVED':
        return (actor || target || 'A unit') + ' moved';
      case 'ATTACK':
        return (
          (actor || 'A unit') +
          ' attacked ' +
          (target || 'a target') +
          (meta.damage != null ? ' for ' + meta.damage + ' damage' : '')
        );
      case 'CARD_PLAYED':
        return (
          (actor || 'A hero') + ' played ' + (meta.card_name || name(meta.card_id) || 'a card')
        );
      case 'GOLD_GAINED':
        return (actor || target || 'A hero') + ' gained ' + (meta.amount ?? '') + ' gold';
      case 'DEATH':
      case 'KNOCKOUT':
      case 'UNIT_DEFEATED':
        return (target || actor || 'A unit') + ' was defeated';
      case 'TURN_ENDED':
      case 'TURN_END':
        return 'Turn ended';
      default:
        return [actor, type.toLowerCase().replaceAll('_', ' '), target && '→ ' + target]
          .filter(Boolean)
          .join(' ');
    }
  }
  // Merge current delivered entries with the local archive, then show only archived
  // entries absent from the native log. The native log remains responsible for live rows.
  function updateEventHistory() {
    if (dead) return;
    committedFiberCache.clear();
    changeEventGame();
    for (const toggle of document.querySelectorAll('button' + c('toggle'))) {
      const events = componentProp(toggle, 'eventLog');
      if (!Array.isArray(events) || blockedLogArrays.has(events)) continue;
      lastLogArrays.add(events);
      if (lastLogArrays.size > 4) lastLogArrays.delete(lastLogArrays.values().next().value);
      // Do not collect an old, still-mounted game component after SPA navigation.
      const gameId = componentProp(toggle, 'gameId');
      if (
        gameId &&
        decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '') !==
          String(gameId)
      )
        continue;
      let changed = false;
      for (const entry of events) {
        if (!entry?.event || typeof entry.timestamp !== 'number') continue;
        const key = eventKey(entry);
        if (seenEvents.has(key)) continue;
        seenEvents.add(key);
        savedEvents.push(entry);
        changed = true;
      }
      if (changed) {
        savedEvents = savedEvents.slice(-EVENT_LIMIT);
        seenEvents = new Set(savedEvents.map(eventKey));
        historyDirty = true;
        historyRevision++;
      }
      flushEventHistory();
      if (!root.hasAttribute('data-m2-active')) continue;
      const container = toggle.parentElement,
        log = q(c('log'), container);
      if (!log) continue;
      const liveKeys = new Set(events.map(eventKey)),
        earlier = savedEvents.filter((entry) => !liveKeys.has(eventKey(entry)));
      let history = q('.m2-saved-events', log);
      const renderKey = JSON.stringify([historyRevision, earlier.map(eventKey), historyError]);
      const empty = q(c('empty'), log);
      if (empty) {
        empty.hidden = earlier.length > 0;
        empty.dataset.m2HistoryEmpty = 'true';
      }
      if (!earlier.length && !historyError) {
        history?.remove();
        continue;
      }
      if (history?.dataset.key === renderKey) continue;
      if (!history) {
        history = document.createElement('div');
        history.className = 'm2-saved-events';
        log.prepend(history);
        extras.add(history);
      }
      const open = new Set(
        Array.from(history.querySelectorAll('details[open]')).map((el) => el.dataset.key),
      );
      history.dataset.key = renderKey;
      history.replaceChildren();
      const label = document.createElement('small');
      label.textContent = historyError || 'Saved on this device · earlier events';
      history.append(label);
      for (const entry of earlier) {
        const row = document.createElement('details'),
          title = document.createElement('summary'),
          data = document.createElement('pre');
        row.dataset.key = eventKey(entry);
        row.open = open.has(row.dataset.key);
        title.textContent = savedEventText(entry);
        data.textContent = JSON.stringify(entry.event, null, 2);
        row.append(title, data);
        history.append(row);
      }
    }
    flushEventHistory();
  }
  on(window, 'pagehide', updateEventHistory);
  // Periodic collection also runs when no relevant DOM mutation occurs; pagehide
  // attempts a final collection/write before the document is unloaded.
  const eventHistoryTimer = setInterval(updateEventHistory, 1500);

  // Reconcile with the live DOM in one animation-frame batch. Reuse generated nodes where possible.
  // On desktop or outside 2D, restore the native layout rather than continuing to adapt it.
  // 10. DOM reconciliation and teardown
  // Order matters: discover/tag native containers, adapt shared components, update
  // hero order and summaries, then reconcile card details and navigation.
  function refresh() {
    frame = 0;
    if (dead) return;
    committedFiberCache.clear();
    const sidebar = q(c('sidebar')),
      header = q('header' + c('bar')),
      layout = header?.parentElement;
    const active =
      media.matches && !!sidebar && new URLSearchParams(location.search).get('3d') === '0';
    if (root.hasAttribute('data-m2-active') !== active)
      root.toggleAttribute('data-m2-active', active);
    root.dataset.m2Mode = deckOpen ? 'split' : mode;
    root.dataset.m2Panel = panel;
    updateEventHistory();
    if (!active) {
      for (const [el, attrs] of changedAttributes)
        for (const [key, value] of attrs) {
          if (value === null) el.removeAttribute(key);
          else el.setAttribute(key, value);
        }
      changedAttributes.clear();
      clearBoardRotation();
      deckUpdate();
      for (const box of document.querySelectorAll('[data-m2="hero"]'))
        box.style.removeProperty('order');
      return;
    }
    if (header) {
      for (const team of header.querySelectorAll('[aria-label*="life remaining"]')) {
        const m = (team.getAttribute('aria-label') || '').match(
          /(Red|Blue) team has (\d+) life remaining/i,
        );
        if (!m) continue;
        const current = Number(m[2]);
        const score = q(c('lifeScore'), team);
        if (score) {
          tag(score, 'life-fraction');
          const v = String(current);
          if (score.getAttribute('data-m2-fraction') !== v)
            score.setAttribute('data-m2-fraction', v);
        }
      }
    }
    if (header) {
      const meta = q(c('matchMeta'), header),
        coin = q(c('tieBreaker'), header);
      if (meta && coin) {
        const color = (coin.getAttribute('src') || '').includes('orange') ? 'Orange' : 'Blue';
        if (meta.dataset.m2Coin !== color) meta.dataset.m2Coin = color;
      }
      for (const lane of header.querySelectorAll(c('waveLane'))) {
        const count = lane.getAttribute('aria-label')?.match(/(\d+) Wave/i)?.[1];
        if (count !== undefined && lane.dataset.m2Waves !== count) lane.dataset.m2Waves = count;
      }
    }
    updateMobileHeader(header);
    tag(layout, 'layout');
    tag(header, 'header');
    tag(q(c('main'), layout || document), 'main');
    tag(q(c('boardArea')), 'board');
    tag(sidebar, 'sidebar');
    if (sidebar) {
      for (const box of sidebar.querySelectorAll(':scope>div'))
        if (q(c('name'), box) && q(c('label'), box) && !q(':scope>' + c('name'), box))
          tag(box, 'own-wrapper');
      for (const name of sidebar.querySelectorAll(c('name'))) {
        const box = name.parentElement;
        if (q(c('details'), box)) {
          tag(box, 'hero');
          const other = !name.textContent.includes('(You)');
          if (box.hasAttribute('data-m2-other') !== other)
            box.toggleAttribute('data-m2-other', other);
        }
      }
      for (const dots of sidebar.querySelectorAll(c('dots'))) {
        const box = dots.parentElement;
        if (!dots.children.length) tag(box, 'empty-pile');
        else if (box.getAttribute('data-m2') === 'empty-pile') box.removeAttribute('data-m2');
      }
    }
    // Use the visual viewport so browser chrome/keyboard changes do not push the
    // bottom controls off screen. Write only changed values to avoid needless layout work.
    const vh = Math.round(window.visualViewport?.height || innerHeight);
    const offset = Math.max(
      0,
      Math.round(innerHeight - vh - (window.visualViewport?.offsetTop || 0)),
    );
    if (root.style.getPropertyValue('--m2-vh') !== vh + 'px')
      root.style.setProperty('--m2-vh', vh + 'px');
    if (root.style.getPropertyValue('--m2-offset') !== offset + 'px')
      root.style.setProperty('--m2-offset', offset + 'px');
    tag(q(c('modal') + ':has(' + c('cardGrid') + ')'), 'deck');
    deckUpdate();
    deckPaint();
    tag(q('[aria-label="Starting position"]'), 'setup');
    tag(q(c('gameToolsRow')), 'tools');
    updateCursorSetting();
    updateBoardRotation();
    updateUpgradeCards();
    const queue = resolutionEntries();
    const resolving = /^RESOLUTION$/i.test(
      q(c('phase'), header || document)?.textContent.trim() || '',
    );
    if (sidebar) {
      for (const label of sidebar.querySelectorAll(c('label'))) {
        if (/^Hand(?:\s|$)/i.test(label.textContent.trim())) tag(label.parentElement, 'hand-list');
      }
      updateOwnColors(sidebar);
      const publicView = componentProp(sidebar, 'view');
      const heroes = Array.from(sidebar.querySelectorAll('[data-m2="hero"]')).map((box) => {
        updateHeroDashboard(box, publicView);
        const name = q(c('name'), box),
          details = q(c('details'), box),
          hero = componentProp(box, 'hero');
        const entry = queue.find(
          (e) =>
            heroDisplayName(name)
              .split('·')[0]
              .replace(/\(You\)/g, '')
              .trim() === e.name,
        );
        const offboard = !!q('.m2-offboard-label', box);
        // Queue membership takes precedence over off-board status. A resolved played slot
        // marks completion; absence from the queue alone does not prove a turn was taken.
        const playedThisTurn = !!hero?.played_cards?.[Number(publicView?.turn) - 1];
        const done = resolving && !entry && (hero ? playedThisTurn : !q(c('currentCard'), box));
        box.style.order = String(entry ? entry.order : 99);
        box.classList.toggle('m2-current-hero', !!entry?.current);
        box.classList.toggle('m2-pending-hero', resolving && !!entry);
        box.classList.toggle('m2-done-hero', done);
        let info = q('.m2-resolution-info', box);
        const marker = entry
          ? entry.current
            ? 'NOW'
            : String(entry.order)
          : resolving && !offboard
            ? done
              ? '✓'
              : '—'
            : null;
        if (marker !== null) {
          if (!info) {
            info = document.createElement('div');
            info.className = 'm2-resolution-info';
            extras.add(info);
          }
          const portrait = q('.m2-hero-portrait', box),
            host = portrait || box;
          if (info.parentElement !== host) host.append(info);
          const key = JSON.stringify([marker, entry?.initiative, entry?.card]);
          if (info.dataset.key !== key) {
            info.dataset.key = key;
            const order = document.createElement('span');
            order.className = 'm2-turn-number';
            order.textContent = marker;
            info.replaceChildren(order);
            if (entry) info.append(cardSymbol('INITIATIVE', entry.initiative));
            info.title = entry?.card || (done ? 'Turn completed' : 'No card played this turn');
            info.setAttribute(
              'aria-label',
              entry ? 'Turn ' + marker + ', initiative ' + entry.initiative : info.title,
            );
          }
        } else info?.remove();
        const cardPiles = hero
          ? ['played_cards', 'discard_pile'].map((field, i) => ({
              label: i ? 'D' : 'P',
              cards: (hero[field] || [])
                .filter(Boolean)
                .map((card) => ({
                  color: cardColors[card.color] || '#888',
                  name: card.is_facedown ? 'Hidden card' : card.name,
                  active:
                    !card.is_facedown &&
                    (card.is_active ||
                      (publicView?.effects || []).some(
                        (effect) => effect.is_active && effect.source_card_id === card.id,
                      )),
                })),
            }))
          : Array.from(box.querySelectorAll(c('dots'))).map((e) => ({
              label: q(c('label'), e.parentElement)?.textContent.startsWith('Played') ? 'P' : 'D',
              cards: Array.from(e.children).map((dot) => ({ color: dot.style.backgroundColor })),
            }));
        return {
          level: hero?.level,
          gold: hero?.gold,
          currentCard: hero?.current_turn_card || null,
          planning: /^PLANNING$/i.test(publicView?.phase || ''),
          committed: !!hero?.current_turn_card || hasLocalSelection(box),
          upgrades: hero?.items || {},
          cardPiles,
          done,
          resolution: entry || null,
          name: heroDisplayName(name),
          detail: (details?.textContent.trim() || '').match(/Lv\s*\d+.*$/)?.[0] || '',
          color: q('span[style]', name || box)?.style.color || '',
          piles: Array.from(box.querySelectorAll(c('dots'))).map((e) => ({
            label: q(c('label'), e.parentElement)?.textContent.trim() || '',
            colors: Array.from(e.children).map((d) => d.style.backgroundColor),
          })),
          dots: Array.from(box.querySelectorAll(c('handColorDot') + ',.m2-own-colors i')).map(
            (e) => e.style.backgroundColor,
          ),
        };
      });
      heroes.sort((a, b) => (a.resolution?.order ?? 99) - (b.resolution?.order ?? 99));
      const sh = heroes.length * 26 + 38 + 'px';
      if (root.style.getPropertyValue('--m2-summary-h') !== sh)
        root.style.setProperty('--m2-summary-h', sh);
      renderSummary(heroes);
    }
    const commit =
      sidebar &&
      Array.from(sidebar.querySelectorAll('button')).find((b) =>
        /^Commit\b/.test(b.textContent.trim()),
      );
    tag(commit?.parentElement, 'commit');
    // Current card tooltips are portalled, inline-positioned boxes; inspect only
    // rendered tooltip elements; card props come from visible card components.
    for (const e of document.querySelectorAll('div[style]')) {
      if (
        e.style.position === 'fixed' &&
        e.style.zIndex === '9999' &&
        e.textContent.includes('Initiative:') &&
        e.textContent.includes('Primary Action:')
      )
        tag(e, 'tip');
    }
    const handList = q('[data-m2="hand-list"]');
    if (sidebar && detailsPanel.parentElement !== sidebar.parentElement)
      sidebar.before(detailsPanel);
    // All overlays the inspected card on the board; Heroes places it above the list.
    // Move the same display root rather than maintaining duplicate selected-card views.
    const heroHost = mode === 'split' ? q('[data-m2="board"]') : sidebar?.parentElement;
    if (heroHost && heroPanel.parentElement !== heroHost) {
      if (mode === 'split') heroHost.append(heroPanel);
      else sidebar.before(heroPanel);
    }
    if (!expandedHeroId) clearHeroCard();
    else updateHeroCardDisplay();
    const tip = q('[data-m2="tip"]');
    const selected = q('[data-m2="hand-list"] ' + c('row') + c('selected'));
    for (const row of sidebar?.querySelectorAll(c('row')) || []) {
      const rc = renderedCard(row);
      if (rc) {
        row.style.setProperty('--m2-card-accent', cardColors[rc.color] || '#c4c8ce');
        updateCardRow(row, rc);
      }
    }
    let card = selected ? renderedCard(selected) : null;
    if (commit) {
      commit.style.setProperty('--m2-card-accent', cardColors[card?.color] || '#4caf50');
    }
    if (!card && tip) {
      for (const node of [tip, ...tip.querySelectorAll('*')]) {
        card = renderedCard(node);
        if (card) break;
      }
    }
    // Include upgrades in the render key so item changes refresh visible values.
    // A dismissed card stays closed until a different selection or tooltip replaces it.
    const detailKey =
      card && JSON.stringify(card) !== hiddenCardKey && (!tip || tip !== dismissedTip)
        ? JSON.stringify([card, cardUpgrades(card)])
        : '';
    if (detailsPanel.dataset.key !== detailKey) {
      detailsPanel.dataset.key = detailKey;
      detailsPanel.replaceChildren();
      if (detailKey) detailsPanel.append(textCard(card, 'hand', tip));
    }
    if (tip && card && tip.dataset.m2CardKey !== detailKey) {
      tip.dataset.m2CardKey = detailKey;
      tip.querySelector(':scope>.m2-text-card')?.remove();
      const unified = textCard(card, 'hand', tip);
      tip.append(unified);
      extras.add(unified);
    }
    if (tip !== dismissedTip && tip?.hasAttribute('data-m2-dismissed'))
      tip.removeAttribute('data-m2-dismissed');
    close.hidden = !active || !tip || tip === dismissedTip;
    close.style.display = close.hidden ? 'none' : '';
    updatePlanningActions();
    syncNavigation();
    // Drop detached nodes from bookkeeping after React replaces native subtrees.
    // Otherwise repeated turns/navigation could retain old DOM and associated listeners.
    for (const element of extras) if (!element.isConnected) extras.delete(element);
    for (const element of tagged) if (!element.isConnected) tagged.delete(element);
    for (const element of changedAttributes.keys())
      if (!element.isConnected) changedAttributes.delete(element);
  }
  // Many mutations can occur in one React update; collapse them into one refresh.
  function schedule() {
    if (!frame) frame = requestAnimationFrame(refresh);
  }
  // Watch only structural and relevant native class/label changes. Our own data-m2
  // attributes are intentionally excluded to avoid a self-triggering observer loop.
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'aria-label'],
  });
  on(window, 'resize', schedule);
  if (window.visualViewport) {
    on(window.visualViewport, 'resize', schedule);
    on(window.visualViewport, 'scroll', schedule);
  }
  on(media, 'change', schedule);

  // Public teardown for console installs and upgrades: release observers, timers, and DOM changes.
  window.GOA2Mobile2D = {
    version: '0.14.5',
    destroy() {
      flushEventHistory();
      dead = true;
      for (const [el, attrs] of changedAttributes)
        for (const [key, value] of attrs) {
          if (value === null) el.removeAttribute(key);
          else el.setAttribute(key, value);
        }
      changedAttributes.clear();
      clearBoardRotation();
      ac.abort();
      observer.disconnect();
      cancelAnimationFrame(frame);
      basicCanvases.clear();
      deckState?.watchers?.forEach((stop) => stop());
      deckState?.host.remove();
      deckState?.zoom.remove();
      deckState?.modal.removeAttribute('data-m2-deck-ready');
      for (const e of document.querySelectorAll('.m2-current-hero,[data-m2="hero"]')) {
        e.classList.remove(
          'm2-current-hero',
          'm2-done-hero',
          'm2-pending-hero',
          'm2-hero-expanded',
        );
        e.style.removeProperty('order');
      }
      for (const e of document.querySelectorAll('.m2-adapted-row')) {
        e.classList.remove('m2-adapted-row');
      }
      for (const e of document.querySelectorAll('[style]'))
        e.style.removeProperty('--m2-card-accent');
      style.remove();
      nav.remove();
      close.remove();
      summary.remove();
      detailsPanel.remove();
      heroPanel.remove();
      clearInterval(eventHistoryTimer);
      for (const e of extras) e.remove();
      for (const e of tagged) {
        e.removeAttribute('data-m2');
        e.removeAttribute('data-m2-dismissed');
        e.removeAttribute('data-m2-other');
        e.removeAttribute('data-m2-fraction');
      }
      for (const e of document.querySelectorAll('[data-m2-history-empty]')) {
        e.hidden = false;
        e.removeAttribute('data-m2-history-empty');
      }
      for (const e of document.querySelectorAll('[data-m2-upgrade-key]'))
        e.removeAttribute('data-m2-upgrade-key');
      for (const e of document.querySelectorAll(
        '[data-m2-coin],[data-m2-waves],[data-m2-card-key]',
      )) {
        e.removeAttribute('data-m2-coin');
        e.removeAttribute('data-m2-waves');
        e.removeAttribute('data-m2-card-key');
      }
      for (const n of [
        'data-m2-hide-cursors',
        'data-m2-deck-open',
        'data-m2-active',
        'data-m2-mode',
        'data-m2-panel',
      ])
        root.removeAttribute(n);
      root.style.removeProperty('--m2-head');
      root.style.removeProperty('--m2-summary-h');
      root.style.removeProperty('--m2-vh');
      root.style.removeProperty('--m2-offset');
      delete window.GOA2Mobile2D;
    },
  };
  refresh();
})();
