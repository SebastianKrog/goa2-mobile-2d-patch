import css from './styles.css';

// The root carries layout flags. These registries retain only nodes/attributes we
// need to clean up when the adapter is disabled or reinstalled.
const root = document.documentElement,
  ac = new AbortController(),
  tagged = new Set();
// Wider phones remain adapted when rotated. Coarse-pointer/short-height bounds
// keep full-size desktop and tablet layouts outside this additional activation.
const media = matchMedia('(max-width:900px), (orientation:landscape) and (max-width:1200px) and (max-height:600px) and (pointer:coarse)');

// Match the stable portion of the website’s generated CSS-module class names.
const c = (n) => `[class*="_${n}_"]`,
  q = (s, e = document) => e.querySelector(s);
const tag = (e, n) => {
  if (e && e.getAttribute('data-m2') !== n) {
    e.setAttribute('data-m2', n);
    tagged.add(e);
  }
};
// Cross-module writes use this explicit state object. Other module state stays local.
const uiState = {
  mode: 'board', panel: '', deckOpen: false, hiddenCardKey: '', dismissedTip: null,
  frame: 0, dead: false, selectedHeroCard: null, focusedHeroId: null,
  deckView: 'tree', deckSort: 'tier', deckState: null,
};
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
const deckPreferencesKey = 'goa2-mobile-deck';
const style = document.createElement('style');
style.id = 'goa2-m2-style';
// 2. Mobile stylesheet
// The ampersand is a placeholder replaced with html[data-m2-active] below.
// Component definitions are grouped in styles.css. Edit the owning block instead
// of appending overrides; shared card geometry must remain independent of its pane.
const inactiveCss = 'html:not([data-m2-active]) :is(#goa2-m2-nav,#goa2-m2-close,#goa2-m2-summary,#goa2-m2-details,#goa2-m2-hero-display,#goa2-m2-settings,#goa2-m2-log,.m2-list-card,.m2-text-card,.m2-hero-dashboard,.m2-resolution-info,.m2-hud,.m2-hud-bottom,.m2-planning-actions,.m2-deck-browser,.m2-deck-zoom,.m2-upgrade-browser,.m2-own-colors,.m2-saved-events){display:none!important}';
style.textContent = inactiveCss + css.replaceAll('&', 'html[data-m2-active]');
document.head.append(style);

export {
  ac,
  c,
  changedAttributes,
  css,
  deckPreferencesKey,
  inactiveCss,
  managedAttribute,
  media,
  q,
  root,
  uiState,
  style,
  tag,
  tagged,
};
