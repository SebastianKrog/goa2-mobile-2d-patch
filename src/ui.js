import { highlightViewedCard } from './card-highlight.js';
import { ac, uiState } from './runtime.js';

// 3. Navigation and generated containers
// These roots sit outside React ownership; native elements are tagged rather than replaced.
const nav = document.createElement('nav');
nav.id = 'goa2-m2-nav';
nav.setAttribute('aria-label', 'Mobile 2D controls');
for (const [key, label] of [
  ['heroes', 'Heroes'],
  ['hand', 'Hand'],
  ['deck', 'Deck'],
  ['setup', 'Setup'],
  ['log', 'Log'],
  ['tools', 'Settings'],
]) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.mode = key;
  b.textContent = label;
  if (key === 'tools') b.setAttribute('aria-label', 'Settings');
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
const settingsPanel = document.createElement('section');
settingsPanel.id = 'goa2-m2-settings';
settingsPanel.className = 'm2-utility-panel';
settingsPanel.setAttribute('aria-label', 'Settings');
const logPanel = document.createElement('section');
logPanel.id = 'goa2-m2-log';
logPanel.className = 'm2-utility-panel';
logPanel.setAttribute('aria-label', 'Match log');
document.body.append(settingsPanel, logPanel);
// Keep weak ownership markers after removal, so queued mutation records can
// distinguish generated UI from native changes without retaining detached DOM.
const generatedRoots = new WeakSet([nav, close, summary, detailsPanel, heroPanel, settingsPanel, logPanel]);
function addExtra(element) {
  extras.add(element);
  generatedRoots.add(element);
}

// Global listeners share teardown; detached generated nodes retain no global listener registry.
const on = (e, n, f, options = {}) =>
  e.addEventListener(
    n,
    f,
    e instanceof Node && e !== document ? options : { ...options, signal: ac.signal },
  );

// Card inspection owns a separate generated panel from playable Hand details.
function clearHeroCard() {
  uiState.selectedHeroCard = null;
  highlightViewedCard('hero');
  heroPanel.replaceChildren();
  delete heroPanel.dataset.key;
}

export {
  addExtra,
  clearHeroCard,
  close,
  detailsPanel,
  extras,
  generatedRoots,
  heroPanel,
  logPanel,
  nav,
  on,
  settingsPanel,
  summary,
};
