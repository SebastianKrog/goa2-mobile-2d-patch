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
//   9. Received-event history, footer Log and appearance/game settings
//   10. DOM reconciliation and teardown
//
// Data flows from rendered DOM/component props into presentation helpers, then back
// into generated DOM. Actions use native buttons or the supplied upgrade callback;
// the adapter does not implement its own game-input API.
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
let mode = 'board',
  panel = '',
  deckOpen = false;
// Dismissal remembers the current card/tooltip, so a refresh does not reopen it.
// Expanded hero identities and selected card identity are separate: opening a hero
// reveals its rows; selecting one row opens just that card in the detail display.
let hiddenCardKey = '',
  dismissedTip = null;
// Each hero retains its own expansion state when another hero is opened.
const expandedHeroIds = new Set();
let frame = 0,
  dead = false;
let selectedHeroCard = null;
// Board focus has its own identity and never reparents React-owned hero nodes.
let focusedHeroId = null;
const changedAttributes = new Map();

// Remember native attributes so destroy() can restore keyboard and ARIA behavior.
function managedAttribute(el, key, value) {
  let before = changedAttributes.get(el);
  if (!before) {
    before = new Map();
    changedAttributes.set(el, before);
  }
  if (!before.has(key)) before.set(key, el.getAttribute(key));
  if (value === null) el.removeAttribute(key);
  else if (el.getAttribute(key) !== String(value)) el.setAttribute(key, value);
}
function clearHeroCard() {
  selectedHeroCard = null;
  heroPanel.replaceChildren();
  delete heroPanel.dataset.key;
}
// Deck preferences persist independently of the active navigation tab.
let deckView = 'tree',
  deckSort = 'tier',
  deckState = null;
const deckPreferencesKey = 'goa2-mobile-deck';
const style = document.createElement('style');
style.id = 'goa2-m2-style';
// 2. Mobile stylesheet
// The ampersand is a placeholder replaced with html[data-m2-active] below.
// Component definitions are grouped in styles.css. Edit the owning block instead
// of appending overrides; shared card geometry must remain independent of its pane.
/* BUILD:STYLES */
const inactiveCss = 'html:not([data-m2-active]) :is(#goa2-m2-nav,#goa2-m2-close,#goa2-m2-summary,#goa2-m2-details,#goa2-m2-hero-display,#goa2-m2-settings,#goa2-m2-log,.m2-list-card,.m2-text-card,.m2-hero-dashboard,.m2-resolution-info,.m2-hud,.m2-hud-bottom,.m2-planning-actions,.m2-deck-browser,.m2-deck-zoom,.m2-upgrade-browser,.m2-own-colors,.m2-saved-events){display:none!important}';
style.textContent = inactiveCss + css.replaceAll('&', 'html[data-m2-active]');
document.head.append(style);
