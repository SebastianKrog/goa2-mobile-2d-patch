import { renderedCard, retryBasicArtwork } from './deck.js';
import { componentProp } from './react.js';
import { refresh, schedule } from './main.js';
import { c, q, root, uiState } from './runtime.js';
import { clearHeroCard, close, detailsPanel, heroPanel, nav, on } from './ui.js';

// Hide the current native tooltip without changing the website’s selected card.
function dismiss() {
  if (closeNestedCard()) return;
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
let nestedCard = null;
let nestedHistoryClosing = false;
function restoreNestedCard() {
  if (!nestedCard) return;
  const { parent, frame, source, scroll, blocked } = nestedCard;
  nestedCard = null;
  parent.classList.remove('m2-nested-open');
  frame.remove();
  for (const [element, inert] of blocked) {
    if (inert === null) element.removeAttribute('inert');
    else element.setAttribute('inert', inert);
  }
  if (parent.isConnected) {
    if (source?.isConnected) source.focus({ preventScroll: true });
    for (const [element, top, left] of scroll) {
      element.scrollTop = top;
      element.scrollLeft = left;
    }
  }
}
function closeNestedCard() {
  if (!nestedCard) return false;
  const token = nestedCard.token;
  restoreNestedCard();
  if (window.history.state?.goa2Mobile2DCard === token) {
    nestedHistoryClosing = true;
    window.history.back();
  }
  return true;
}
function openNestedCard(parent, display, source) {
  if (!parent.isConnected || nestedCard || nestedHistoryClosing) return;
  syncMenuHistory();
  const token = menuHistoryToken + '-spell';
  const scroll = [];
  for (let element = parent.parentElement; element; element = element.parentElement)
    scroll.push([element, element.scrollTop, element.scrollLeft]);
  const frame = document.createElement('div');
  frame.className = 'm2-nested-spell-frame';
  frame.append(display);
  const blocked = Array.from(parent.children).filter(element =>
    element.matches('.m2-card-top,.m2-card-body,.m2-card-foot'))
    .map(element => [element, element.getAttribute('inert')]);
  for (const [element] of blocked) element.setAttribute('inert', '');
  nestedCard = { parent, display, frame, source, token, scroll, blocked };
  display.classList.add('m2-nested-spell');
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'm2-card-dismiss';
  back.textContent = '×';
  back.setAttribute('aria-label', 'Back to card');
  back.onclick = event => { event.preventDefault(); event.stopPropagation(); closeNestedCard(); };
  const foot = q('.m2-card-foot', display);
  foot.classList.add('m2-has-dismiss');
  foot.append(back);
  parent.classList.add('m2-nested-open');
  parent.append(frame);
  try {
    window.history.pushState({ ...window.history.state, goa2Mobile2DCard: token }, '', window.location.href);
  } catch { /* The explicit close control still returns to the parent card. */ }
  back.focus({ preventScroll: true });
}
const menuSelection = () => uiState.selectedHeroCard?.spells ? 'spells' : uiState.deckOpen ? 'deck' : uiState.panel || uiState.mode;
function openDecisionDialog() {
  return q(c('picker') + ',' + c('pickerUpgrade') + ',[data-m2="report-dialog"],[data-m2="fix-dialog"]');
}
function openCardView() {
  const tip = q('[data-m2="tip"]');
  return !!uiState.selectedHeroCard || !!heroPanel.firstChild ||
    (uiState.mode === 'hand' && !!detailsPanel.firstChild) ||
    (!!tip && tip !== uiState.dismissedTip);
}
function dismissViews() {
  const selected = q('[data-m2="hand-list"] ' + c('row') + c('selected'));
  const tip = q('[data-m2="tip"]');
  const card = selected && renderedCard(selected) || tip && componentProp(tip, 'card');
  if (card) uiState.hiddenCardKey = JSON.stringify(card);
  clearHeroCard();
  detailsPanel.replaceChildren();
  delete detailsPanel.dataset.key;
  const dialog = openDecisionDialog();
  // Board peek dismisses presentation while leaving the pending decision intact.
  // Never use Undo/Skip/Confirm to close a decision dialog.
  const closeDialog = dialog && (q(c('peekBtn') + ',' + c('closeBtn') + ',button[aria-label="Close"]', dialog) ||
    Array.from(dialog.querySelectorAll('button')).find(button =>
      /^(Board|Close|Cancel|×|✕|X)$/i.test(button.textContent.trim())));
  if (closeDialog && !closeDialog.disabled) closeDialog.click();
  if (tip) {
    uiState.dismissedTip = tip;
    tip.setAttribute('data-m2-dismissed', '');
  }
}
function syncMenuHistory() {
  if (nestedCard && (!nestedCard.display.isConnected || !root.hasAttribute('data-m2-active')))
    closeNestedCard();
  if (nestedHistoryClosing) return;
  if (navigating || menuHistoryClosing || uiState.dead) return;
  const open = root.hasAttribute('data-m2-active') &&
    (menuSelection() !== 'board' || openCardView() || !!openDecisionDialog());
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
  if (nestedHistoryClosing) {
    nestedHistoryClosing = false;
    syncMenuHistory();
    return;
  }
  if (nestedCard) {
    restoreNestedCard();
    syncMenuHistory();
    return;
  }
  if (menuHistoryClosing) {
    menuHistoryClosing = false;
    // A menu reopened while the asynchronous Back was pending gets one fresh entry.
    syncMenuHistory();
    return;
  }
  if (!menuHistoryActive) return;
  menuHistoryActive = false;
  navigating = true;
  dismissViews();
  navigating = false;
  const selected = menuSelection();
  if (selected !== 'board') navigate(selected);
  else refresh();
});
function clearMenuHistory() {
  if (nestedCard) {
    const owned = window.history.state?.goa2Mobile2DCard === nestedCard.token;
    restoreNestedCard();
    if (owned) {
      window.history.go(menuHistoryActive ? -2 : -1);
      menuHistoryActive = false;
      return;
    }
  }
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
  closeNestedCard();
  navigating = true;
  const selected = uiState.selectedHeroCard?.spells ? 'spells' : uiState.deckOpen ? 'deck' : uiState.panel || uiState.mode;
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
// Reflect the actual open panel; starting-position controls use the Board launcher.
let setupWasChoosing = false;
function syncNavigation() {
  const setup = q('[aria-label="Starting position"]');
  const setupAvailable = !!setup;
  const suppliedChoosing = componentProp(setup, 'choosing');
  const choosing = typeof suppliedChoosing === 'boolean' ? suppliedChoosing
    : !!setup && /^Done/i.test(q(':scope > button', setup)?.textContent.trim() || '');
  if (uiState.panel === 'setup' && setupWasChoosing && !choosing) {
    uiState.panel = '';
    root.dataset.m2Panel = '';
  }
  setupWasChoosing = choosing;
  nav.style.gridTemplateColumns = 'repeat(5,minmax(0,1fr))';
  if (!setupAvailable && uiState.panel === 'setup') {
    uiState.panel = '';
    root.dataset.m2Panel = '';
  }
  const selected = uiState.selectedHeroCard?.spells ? 'spells' : uiState.deckOpen ? 'deck' : uiState.panel || uiState.mode;
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
    if (closeNestedCard()) return;
    uiState.focusedHeroId = null;
    uiState.panel = '';
    clearHeroCard();
    dismiss();
    return;
  }
});

export { openNestedCard, syncMenuHistory, clearMenuHistory, dismiss, navigate, navigationShortcut, setDeckOpen, syncDeckMount, syncNavigation };
