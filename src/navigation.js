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
const menuHistoryToken = Date.now() + '-' + Math.random();
let menuHistoryActive = false;
let menuHistoryClosing = false;
let navigating = false;
const menuSelection = () => uiState.deckOpen ? 'deck' : uiState.panel || uiState.mode;
function syncMenuHistory() {
  if (navigating || menuHistoryClosing || uiState.dead) return;
  const open = menuSelection() !== 'board';
  if (open && !menuHistoryActive) {
    try {
      window.history.pushState({ ...window.history.state, goa2Mobile2DMenu: menuHistoryToken }, '', window.location.href);
      menuHistoryActive = true;
    } catch { /* Navigation still works when browser history is unavailable. */ }
  } else if (!open && menuHistoryActive) {
    menuHistoryActive = false;
    if (window.history.state?.goa2Mobile2DMenu === menuHistoryToken) {
      menuHistoryClosing = true;
      window.history.back();
    }
  }
}
on(window, 'popstate', () => {
  if (menuHistoryClosing) {
    menuHistoryClosing = false;
    // A menu reopened while the asynchronous Back was pending gets one fresh entry.
    syncMenuHistory();
    return;
  }
  if (!menuHistoryActive) return;
  menuHistoryActive = false;
  const selected = menuSelection();
  if (selected !== 'board') navigate(selected);
});
function clearMenuHistory() {
  if (menuHistoryActive && window.history.state?.goa2Mobile2DMenu === menuHistoryToken)
    window.history.back();
  menuHistoryActive = false;
}
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
  navigating = true;
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
  navigating = false;
  refresh();
}
// Reuse footer navigation for compact Board shortcuts, including native Deck opening.
function navigationShortcut(content, key, label) {
  const button = document.createElement('button');
  button.type = 'button';
  content.classList.add('m2-navigation-shortcut');
  button.className = 'm2-shortcut-border';
  button.title = label;
  button.setAttribute('aria-label', label);
  // Leave the original display group untouched; only its hit area is overlaid.
  content.append(button);
  content.onclick = event => { event.stopPropagation(); navigate(key); };
  return content;
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
  syncMenuHistory();
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

export { clearMenuHistory, dismiss, navigate, navigationShortcut, setDeckOpen, syncDeckMount, syncNavigation };
