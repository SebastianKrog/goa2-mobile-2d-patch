import { retryBasicArtwork } from './deck.js';
import { refresh, schedule } from './main.js';
import { c, q, root, uiState } from './runtime.js';
import { clearHeroCard, close, nav, on } from './ui.js';

// Hide the current native tooltip without changing the website’s selected card.
function dismiss() {
  const tip = q('[data-m2="tip"]');
  if (tip) {
    uiState.dismissedTip = tip;
    tip.setAttribute('data-m2-dismissed', '');
  }
  refresh();
}
on(close, 'click', dismiss);
let deckMounted = false;
function setDeckOpen(open) {
  uiState.deckOpen = open;
  deckMounted = false;
  if (open) retryBasicArtwork();
  root.toggleAttribute('data-m2-deck-open', open);
}
// Native X, backdrop, and Escape can unmount Deck independently of our toggle.
function syncDeckMount(nativeDeck) {
  if (uiState.deckOpen && nativeDeck) deckMounted = true;
  else if (uiState.deckOpen && deckMounted) setDeckOpen(false);
}
// Board is the resting state. Every footer control toggles a single overlay/pane;
// switching controls replaces the active pane instead of retaining a hidden tab.
function navigate(key) {
  if (!key) return;
  const selected = uiState.deckOpen ? 'deck' : uiState.panel || uiState.mode;
  const closing = selected === key;
  // Close through React's own handler so a dismissed Deck cannot resurface
  // when mobile styling is removed. Reopening uses the native Deck button.
  if (uiState.deckOpen) q('[data-m2="deck"] ' + c('closeBtn'))?.click();
  setDeckOpen(false);
  uiState.panel = '';
  uiState.focusedHeroId = null;
  uiState.mode = 'board';
  clearHeroCard();
  dismiss();
  if (!closing) {
    if (key === 'deck') {
      setDeckOpen(true);
      if (!q('[data-m2="deck"]'))
        q('[data-m2="hero"]:not([data-m2-other]) ' + c('viewDeckBtn'))?.click();
    } else if (key === 'setup' || key === 'tools' || key === 'log') uiState.panel = key;
    else if (key === 'hand' || key === 'heroes') uiState.mode = key;
  }
  refresh();
}
// Reflect the actual open panel and show Setup only while starting-position UI exists.
function syncNavigation() {
  const setupButton = q('[data-mode="setup"]', nav);
  const setupAvailable = !!q('[aria-label="Starting position"]');
  setupButton.hidden = !setupAvailable;
  nav.style.gridTemplateColumns = 'repeat(' + (setupAvailable ? 6 : 5) + ',minmax(0,1fr))';
  if (!setupAvailable && uiState.panel === 'setup') {
    uiState.panel = '';
    root.dataset.m2Panel = '';
  }
  const selected = uiState.deckOpen ? 'deck' : uiState.panel || uiState.mode;
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
    uiState.dismissedTip?.removeAttribute('data-m2-dismissed');
    uiState.dismissedTip = null;
    uiState.hiddenCardKey = '';
    uiState.panel = '';
    schedule();
  }
});
on(
  document,
  'click',
  (e) => {
    if (!root.hasAttribute('data-m2-active')) return;
    if (uiState.deckOpen && e.target.closest?.('[data-m2="deck"] ' + c('closeBtn'))) {
      setDeckOpen(false);
      uiState.mode = 'board';
      schedule();
    }
    if (e.target.closest?.('[data-m2="hand-list"] ' + c('row'))) clearHeroCard();
  },
  { capture: true },
);
on(document, 'keydown', (e) => {
  if (e.key === 'Escape') {
    uiState.focusedHeroId = null;
    uiState.panel = '';
    clearHeroCard();
    dismiss();
    return;
  }
});

export { dismiss, navigate, setDeckOpen, syncDeckMount, syncNavigation };
