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
    clearHeroCard();
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
    if (e.target.closest?.('[data-m2="hand-list"] ' + c('row'))) clearHeroCard();
    const box = e.target.closest?.('[data-m2="hero"]');
    if (!box) return;
    if (e.target.closest('button,a,input,' + c('row') + ',.m2-hero-effects,.m2-hero-history'))
      return;
    const hero = componentProp(box, 'hero');
    if (!hero) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    // Planning shows only the commitment/current card. Hand keeps our board open
    // in other phases; clicking it must not fight that automatic expansion.
    const view = componentProp(q('[data-m2="sidebar"]'), 'view');
    if (isCardSelection(view) || (mode === 'hand' && !box.hasAttribute('data-m2-other'))) return;
    if (expandedHeroIds.has(hero.id)) expandedHeroIds.delete(hero.id);
    else expandedHeroIds.add(hero.id);
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
