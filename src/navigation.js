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
let deckMounted = false;
function setDeckOpen(open) {
  deckOpen = open;
  deckMounted = false;
  root.toggleAttribute('data-m2-deck-open', open);
}
// Board is the resting state. Every footer control toggles a single overlay/pane;
// switching controls replaces the active pane instead of retaining a hidden tab.
function navigate(key) {
  if (!key) return;
  const selected = deckOpen ? 'deck' : panel || mode;
  const closing = selected === key;
  setDeckOpen(false);
  panel = '';
  mode = 'board';
  clearHeroCard();
  dismiss();
  if (!closing) {
    if (key === 'deck') {
      setDeckOpen(true);
      if (!q('[data-m2="deck"]'))
        q('[data-m2="hero"]:not([data-m2-other]) ' + c('viewDeckBtn'))?.click();
    } else if (key === 'setup' || key === 'tools') panel = key;
    else if (key === 'hand' || key === 'heroes') mode = key;
  }
  refresh();
}
// Reflect the actual open panel and show Setup only while starting-position UI exists.
function syncNavigation() {
  const setupButton = q('[data-mode="setup"]', nav);
  const setupAvailable = !!q('[aria-label="Starting position"]');
  setupButton.hidden = !setupAvailable;
  nav.style.gridTemplateColumns = 'repeat(' + (setupAvailable ? 5 : 4) + ',minmax(0,1fr))';
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
    if (deckOpen && e.target.closest?.('[data-m2="deck"] ' + c('closeBtn'))) {
      setDeckOpen(false);
      mode = 'board';
      schedule();
    }
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
