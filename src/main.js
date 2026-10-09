import { clearBoardTexture, updateBoardTexture } from './board-texture.js';
import { clearCardHighlights, highlightViewedCard } from './card-highlight.js';
import { clearActionChoices, updateActionChoices } from './action-choices.js';
import { renderSummary } from './board.js';
import { clearBoardRotation, updateBoardRotation } from './camera.js';
import { updateCardRow, updateOwnColors } from './card-rows.js';
import { cardColors, cardUpgrades, syncHandActions, textCard } from './cards.js';
import { updateChoiceLaunchers, updatePlanningActions } from './controls.js';
import { deckTreeBuilds } from './deck-tree.js';
import { basicCanvases, deckPaint, deckUpdate, renderedCard, retryBasicArtwork } from './deck.js';
import { currentUpgradeRequest, remainingUpgrades } from './game-input.js';
import { clearMobileStatus, updateMobileHeader } from './header.js';
import {
  cardIsActive,
  hasLocalSelection,
  heroDisplayName,
  heroTurnCard,
  resolutionEntries,
  updateHeroCardDisplay,
  updateHeroDashboard,
  updateTurnPortrait,
  updateUpgradeCards,
} from './heroes.js';
import { eventHistoryTimer, flushEventHistory, updateEventHistory } from './history.js';
import { cancelDecisionHistory } from './log.js';
import { syncDeckMount, syncNavigation } from './navigation.js';
import { committedFiberCache, componentProp } from './react.js';
import {
  ac,
  c,
  changedAttributes,
  media,
  q,
  root,
  uiState,
  style,
  tag,
  tagged,
} from './runtime.js';
import { updateSettings } from './settings.js';
import {
  addExtra,
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
} from './ui.js';
import { clearUpgradeTree, updateUpgradeTree } from './upgrade-tree.js';

// Reconcile with the live DOM in one animation-frame batch. Reuse generated nodes where possible.
// On desktop or outside 2D, restore the native layout rather than continuing to adapt it.
// 10. DOM reconciliation and teardown
// Order matters: discover/tag native containers, adapt shared components, update
// hero order and summaries, then reconcile card details and navigation.
function refresh() {
  uiState.frame = 0;
  if (uiState.dead) return;
  committedFiberCache.clear();
  const sidebar = q(c('sidebar')),
    header = q('header' + c('bar')),
    layout = header?.parentElement;
  const active =
    media.matches && !!sidebar && new URLSearchParams(location.search).get('3d') === '0';
  if (root.hasAttribute('data-m2-active') !== active)
    root.toggleAttribute('data-m2-active', active);
  root.dataset.m2Mode = uiState.mode;
  root.dataset.m2Panel = uiState.panel;
  updateEventHistory();
  if (!active) {
    clearMobileStatus();
    clearActionChoices();
    clearUpgradeTree();
    for (const [el, attrs] of changedAttributes)
      for (const [key, value] of attrs) {
        if (value === null) el.removeAttribute(key);
        else el.setAttribute(key, value);
      }
    changedAttributes.clear();
    clearBoardRotation();
    clearBoardTexture();
    deckUpdate(null);
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
  const viewportTop = Math.max(0, Math.round(window.visualViewport?.offsetTop || 0));
  const offset = Math.max(
    0,
    Math.round(innerHeight - vh - viewportTop),
  );
  if (root.style.getPropertyValue('--m2-vh') !== vh + 'px')
    root.style.setProperty('--m2-vh', vh + 'px');
  if (root.style.getPropertyValue('--m2-offset') !== offset + 'px')
    root.style.setProperty('--m2-offset', offset + 'px');
  if (root.style.getPropertyValue('--m2-viewport-top') !== viewportTop + 'px')
    root.style.setProperty('--m2-viewport-top', viewportTop + 'px');
  // Retain the native report form and handlers, including its success screen.
  // Only this utility dialog uses visible-viewport bounds; Deck has its own layout.
  for (const modal of document.querySelectorAll(c('modal'))) {
    if (q(c('heading'), modal)?.textContent.trim().toLowerCase() !== 'report a bug')
      continue;
    const backdrop = modal.parentElement;
    if (!backdrop?.matches(c('backdrop'))) continue;
    tag(modal, 'report-dialog');
    tag(backdrop, 'report-backdrop');
  }
  for (const dialog of document.querySelectorAll('[role="dialog"][aria-label="Fix game state"]')) {
    const backdrop = dialog.parentElement;
    if (!backdrop?.matches(c('backdrop'))) continue;
    tag(dialog, 'fix-dialog');
    tag(backdrop, 'fix-backdrop');
  }
  // Share one live upgrade request across Deck, hero dashboards and Board focus.
  // Re-read each refresh so acknowledgements and undos cannot leave stale data.
  const upgradeRequest = currentUpgradeRequest();
  const nativeDeck = q(c('modal') + ':has(' + c('cardGrid') + ')');
  tag(nativeDeck, 'deck');
  syncDeckMount(nativeDeck);
  deckUpdate(upgradeRequest);
  deckPaint();
  tag(q('[aria-label="Starting position"]'), 'setup');
  tag(q(c('gameToolsRow')), 'tools');
  updateSettings();
  updateBoardRotation();
  updateBoardTexture();
  updateUpgradeCards();
  updateUpgradeTree();
  const actionChoices = updateActionChoices();
  updateMobileHeader(header, actionChoices.prompt);
  updateChoiceLaunchers(actionChoices.controls);
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
      updateHeroDashboard(box, publicView, null, upgradeRequest);
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
      updateTurnPortrait(box, entry, done, offboard, resolving);
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
        id: hero?.id,
        level: hero?.level,
        gold: hero?.gold,
        currentCard: hero ? heroTurnCard(box, hero, publicView) : null,
        currentActive: hero ? cardIsActive(heroTurnCard(box, hero, publicView), publicView) : false,
        offboard,
        upgrading: /^LEVEL[_ ]UP$/i.test(publicView?.phase || ''),
        upgradeRemaining: remainingUpgrades(upgradeRequest, hero?.id),
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
    const sh = heroes.length * 32 + 12 + 'px';
    if (root.style.getPropertyValue('--m2-summary-h') !== sh)
      root.style.setProperty('--m2-summary-h', sh);
    renderSummary(heroes, upgradeRequest);
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
  // Inspect cards over the board; empty displays never replace the board itself.
  const boardHost = q('[data-m2="board"]');
  const detailHost = boardHost || sidebar?.parentElement;
  for (const display of [detailsPanel, heroPanel])
    if (detailHost && display.parentElement !== detailHost) detailHost.append(display);
  updateHeroCardDisplay();
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
    card && JSON.stringify(card) !== uiState.hiddenCardKey && (!tip || tip !== uiState.dismissedTip)
      ? JSON.stringify([card, cardUpgrades(card)])
      : '';
  // A read-only hero inspection takes precedence over a retained Hand selection.
  const visibleDetailKey = uiState.selectedHeroCard ? '' : detailKey;
  highlightViewedCard('hand', visibleDetailKey && uiState.mode === 'hand' ? card : null);
  if (detailsPanel.dataset.key !== visibleDetailKey) {
    detailsPanel.dataset.key = visibleDetailKey;
    detailsPanel.replaceChildren();
    if (visibleDetailKey) detailsPanel.append(textCard(card, 'hand', tip));
  }
  if (tip && card && tip.dataset.m2CardKey !== detailKey) {
    tip.dataset.m2CardKey = detailKey;
    tip.querySelector(':scope>.m2-text-card')?.remove();
    const unified = textCard(card, 'hand', tip);
    tip.append(unified);
    addExtra(unified);
  }
  if (card) {
    const items = cardUpgrades(card);
    for (const display of [q(':scope>.m2-text-card', detailsPanel), tip && q(':scope>.m2-text-card', tip)]) {
      const foot = display && q('.m2-card-foot', display);
      if (foot) syncHandActions(foot, card, tip, items);
    }
  }
  if (tip !== uiState.dismissedTip && tip?.hasAttribute('data-m2-dismissed'))
    tip.removeAttribute('data-m2-dismissed');
  close.hidden = !active || !tip || tip === uiState.dismissedTip;
  close.style.display = close.hidden ? 'none' : '';
  updatePlanningActions();
  if (actionChoices.card) highlightViewedCard('hero', actionChoices.card, actionChoices.heroId);
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
  if (!uiState.frame) uiState.frame = requestAnimationFrame(refresh);
}
function isGeneratedNode(node) {
  for (let element = node.nodeType === 1 ? node : node.parentElement;
       element; element = element.parentElement)
    if (generatedRoots.has(element)) return true;
  return false;
}
// Native text, artwork and controls can change without mounting new nodes.
// Ignore our generated subtrees and class tokens to avoid feedback refreshes.
const nativeClasses = value => (value || '').split(/\s+/)
  .filter(name => name && !name.startsWith('m2-')).sort().join(' ');
const observer = new MutationObserver(records => {
  if (records.some(record => {
    if (isGeneratedNode(record.target)) return false;
    if (record.type === 'childList')
      return [...record.addedNodes, ...record.removedNodes].some(node => !isGeneratedNode(node));
    if (record.type === 'attributes' && record.attributeName === 'class')
      return nativeClasses(record.oldValue) !== nativeClasses(record.target.getAttribute('class'));
    return true;
  })) schedule();
});
observer.observe(document.body, {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeOldValue: true,
  attributeFilter: ['class', 'aria-label', 'src', 'disabled'],
});
on(window, 'resize', schedule);
on(window, 'online', () => { retryBasicArtwork(); schedule(); });
if (window.visualViewport) {
  on(window.visualViewport, 'resize', schedule);
  on(window.visualViewport, 'scroll', schedule);
}
on(media, 'change', schedule);

// Public teardown for console installs and upgrades: release observers, timers, and DOM changes.
window.GOA2Mobile2D = {
  version: '1.0.1',
  destroy() {
    flushEventHistory();
    uiState.dead = true;
    clearMobileStatus();
    clearActionChoices();
    clearUpgradeTree();
    for (const [el, attrs] of changedAttributes)
      for (const [key, value] of attrs) {
        if (value === null) el.removeAttribute(key);
        else el.setAttribute(key, value);
      }
    changedAttributes.clear();
    clearBoardRotation();
    clearBoardTexture();
    ac.abort();
    observer.disconnect();
    cancelAnimationFrame(uiState.frame);
    basicCanvases.clear();
    deckTreeBuilds.clear();
    uiState.deckState?.watchers?.forEach((stop) => stop());
    uiState.deckState?.host.remove();
    uiState.deckState?.zoom.remove();
    uiState.deckState?.modal.removeAttribute('data-m2-deck-ready');
    for (const e of document.querySelectorAll('.m2-current-hero,[data-m2="hero"]')) {
      e.classList.remove(
        'm2-current-hero',
        'm2-done-hero',
        'm2-pending-hero',
      );
      e.style.removeProperty('order');
    }
    clearCardHighlights();
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
    settingsPanel.remove();
    logPanel.remove();
    cancelDecisionHistory();
    clearInterval(eventHistoryTimer);
    for (const e of extras) e.remove();
    for (const e of tagged) {
      e.removeAttribute('data-m2');
      e.removeAttribute('data-m2-dismissed');
      e.removeAttribute('data-m2-other');
      e.removeAttribute('data-m2-fraction');
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
      'data-m2-no-card-art',
      'data-m2-deck-open',
      'data-m2-active',
      'data-m2-mode',
      'data-m2-panel',
    ])
      root.removeAttribute(n);
    root.style.removeProperty('--m2-head');
    root.style.removeProperty('--m2-status-h');
    root.style.removeProperty('--m2-summary-h');
    root.style.removeProperty('--m2-vh');
    root.style.removeProperty('--m2-offset');
    root.style.removeProperty('--m2-viewport-top');
    delete window.GOA2Mobile2D;
  },
};
refresh();

export { isGeneratedNode, refresh, schedule };
