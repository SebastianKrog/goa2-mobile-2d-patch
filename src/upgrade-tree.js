import { highlightViewedCard, trackCardSource } from './card-highlight.js';
import { cardGrantedItem, textCard } from './cards.js';
import { deckTreeBuild, saveDeckTreeBuild } from './deck-tree.js';
import { componentProp } from './react.js';
import { c, managedAttribute, q, root, uiState } from './runtime.js';
import { deckTreeGroup, deckTreePool, deckTreeTier } from './tree-model.js';
import { appendTreePath, createTreeCard, createTreeView, deckTreeItemTotals } from './tree-view.js';
import { addExtra, extras, on } from './ui.js';

// Stage a complete level-up batch without changing the game. On Commit, use the
// native picker callback once per acknowledged request; never send our own API input.
let upgradeTreeState = null;
const upgradeColors = ['RED', 'BLUE', 'GREEN'];
function clearUpgradeTree() {
  highlightViewedCard('upgrade');
  const state = upgradeTreeState;
  if (!state) return;
  clearTimeout(state.timer);
  state.picker.removeAttribute('data-m2-upgrade-tree');
  state.host.remove();
  extras.delete(state.host);
  upgradeTreeState = null;
}
function upgradeSource() {
  for (const picker of document.querySelectorAll(c('pickerUpgrade'))) {
    const anchor = q('button' + c('upgradeCard'), picker) || picker,
      request = componentProp(anchor, 'inputRequest'), heroId = componentProp(anchor, 'myHeroId'),
      view = componentProp(anchor, 'view'), onSelect = componentProp(anchor, 'onSelect');
    const player = request?.type === 'UPGRADE_PHASE' && request.players?.[heroId];
    const hero = Object.values(view?.teams || {}).flatMap(team => team.heroes || [])
      .find(candidate => candidate.id === heroId);
    if (!hero || typeof onSelect !== 'function' || !Number.isInteger(player?.remaining) ||
        player.remaining < 1 || player.remaining > 6 || !Array.isArray(player.options)) continue;
    const options = player.options.filter(option => Array.isArray(option.card_details));
    const cards = [...new Map([...(hero.deck || []), ...deckTreePool(hero),
      ...options.flatMap(option => option.card_details)]
      .filter(card => card && typeof card.id === 'string' && typeof card.name === 'string' &&
        card.primary_action && upgradeColors.includes(card.color) && deckTreeTier(card) > 0)
      // These are the player's known printed upgrade cards, not hidden draws.
      // Match the native picker without mutating live cards or unmasking unknowns.
      .map(card => [card.id, { ...card, is_facedown: false, is_active: false }])).values()];
    const tiers = {};
    for (const color of upgradeColors) {
      const owned = [...new Map(deckTreePool(hero).filter(card => card.color === color)
        .map(card => [card.id, card])).values()];
      // Ambiguous pools stay native rather than inventing an ability-specific rule.
      tiers[color] = owned.length === 1 ? deckTreeTier(owned[0]) : 0;
    }
    if (upgradeColors.some(color => tiers[color] < 1)) continue;
    const eligible = new Set(options.flatMap(option => option.card_details.map(card => card.id)));
    const required2 = Math.min(player.remaining, upgradeColors.filter(color => tiers[color] === 1).length),
      required3 = player.remaining - required2;
    if (required3 > upgradeColors.filter(color => tiers[color] < 3).length) continue;
    // Incomplete catalogs retain the existing native menu.
    if (upgradeColors.some(color => tiers[color] < 3 && [2, 3].some(tier =>
      (tier === 2 ? tiers[color] === 1 : required3 > 0) &&
      cards.filter(card => card.color === color && deckTreeTier(card) === tier).length !== 2))) continue;
    const owner = JSON.stringify([location.pathname, new URLSearchParams(location.search).get('token'),
      heroId, view?.round]);
    const signature = JSON.stringify([player.remaining, options, upgradeColors.map(color => tiers[color]),
      deckTreePool(hero).map(card => card.id)]);
    return { picker, request, heroId, hero, onSelect, player, cards, tiers, eligible,
      required2, required3, owner, signature };
  }
  return null;
}
function upgradeSelectionValid(state) {
  const source = state.source, tiers = { ...source.tiers }, choices = [...state.selected.values()]
    .map(id => state.catalog.get(id)).sort((a, b) => deckTreeTier(a) - deckTreeTier(b));
  if (choices.length !== source.player.remaining) return false;
  for (const card of choices) {
    if (!card) return false;
    const tier = deckTreeTier(card), lowest = Math.min(...Object.values(tiers));
    if (tier !== lowest + 1 || tiers[card.color] !== tier - 1) return false;
    // Only later stages of this batch may project choices not offered yet.
    if (tier === Math.min(...Object.values(source.tiers)) + 1 && !source.eligible.has(card.id)) return false;
    tiers[card.color] = tier;
  }
  return true;
}
function upgradeSelectable(state, card) {
  if (state.busy || state.uncertain) return false;
  const source = state.source, tier = deckTreeTier(card);
  if (tier === 2) return source.required2 > 0 && source.tiers[card.color] === 1 && source.eligible.has(card.id);
  const all2 = [...state.selected.keys()].filter(key => key.endsWith(':2')).length === source.required2;
  return tier === 3 && source.required3 > 0 && all2 && source.tiers[card.color] < 3 &&
    (source.tiers[card.color] === 2 || state.selected.has(card.color + ':2')) &&
    (source.required2 > 0 || source.eligible.has(card.id));
}
function pauseUpgradeCommit(state, message, uncertain = false) {
  clearTimeout(state.timer);
  state.busy = false;
  state.uncertain = uncertain;
  if (!uncertain) state.pending = null;
  state.message = message;
  renderUpgradeTreeState(state);
}
function sendNextUpgrade(state) {
  if (state !== upgradeTreeState || !state.busy || state.pending || uiState.dead ||
      !root.hasAttribute('data-m2-active') || document.visibilityState === 'hidden') return;
  const source = upgradeSource();
  if (!source || source.owner !== state.source.owner || source.signature !== state.source.signature ||
      !upgradeSelectionValid(state)) {
    pauseUpgradeCommit(state, 'Upgrade choices changed. Review the remaining selections.');
    return;
  }
  const card = [...state.selected.values()].map(id => state.catalog.get(id))
    .sort((a, b) => deckTreeTier(a) - deckTreeTier(b) ||
      upgradeColors.indexOf(a.color) - upgradeColors.indexOf(b.color))[0];
  if (!card || !source.eligible.has(card.id)) {
    pauseUpgradeCommit(state, 'This upgrade is not currently allowed. Review your choices.');
    return;
  }
  state.pending = { id: card.id, group: deckTreeGroup(card), before: source.player.remaining };
  state.message = 'Committing ' + card.name + '…';
  state.timer = setTimeout(() => {
    if (state === upgradeTreeState && state.pending)
      pauseUpgradeCommit(state, 'Waiting for acknowledgement. No more upgrades will be sent until this choice is confirmed.', true);
  }, 15000);
  renderUpgradeTreeState(state);
  try {
    const result = source.onSelect({ hero_id: source.heroId, card_id: card.id });
    Promise.resolve(result).catch(() => {
      if (state === upgradeTreeState && state.pending?.id === card.id)
        pauseUpgradeCommit(state, 'The upgrade could not be confirmed. Waiting for the game to update.', true);
    });
  } catch {
    pauseUpgradeCommit(state, 'The upgrade could not be confirmed. Waiting for the game to update.', true);
  }
}
function selectUpgradeTreeCard(state, card) {
  if (state.busy || state.uncertain) return;
  const group = deckTreeGroup(card), id = card.id;
  state.message = '';
  if (state.previewMode) {
    if (deckTreeTier(card) >= 2 && !state.acquired.has(group)) {
      if (state.preview.get(group) === id) state.preview.delete(group);
      else state.preview.set(group, id);
    }
  } else if (upgradeSelectable(state, card)) {
    if (deckTreeTier(card) === 2)
      for (const key of state.selected.keys()) if (key.endsWith(':3')) state.selected.delete(key);
    if (state.selected.get(group) === id) state.selected.delete(group);
    else {
      const tier = deckTreeTier(card), required = tier === 2 ? state.source.required2 : state.source.required3,
        sameTier = [...state.selected.keys()].filter(key => key.endsWith(':' + tier));
      if (!state.selected.has(group) && sameTier.length >= required) state.selected.delete(sameTier.at(-1));
      state.selected.set(group, id);
    }
  } else state.message = deckTreeTier(card) === 3 && state.source.required2
    ? 'Select all required Tier 2 upgrades first, or enable Preview to plan ahead.'
    : 'This card is not an available upgrade for this level-up.';
  state.detailCard = id;
  showUpgradeDetails(state);
  renderUpgradeTreeState(state);
}
function showUpgradeDetails(state) {
  state.details.replaceChildren();
  const card = state.catalog.get(state.detailCard);
  highlightViewedCard('upgrade', card, state.source.heroId);
  if (!card) return;
  const display = textCard(card, 'deck', null, state.source.heroId,
    cardGrantedItem(card, [...state.catalog.values()])), close = document.createElement('button');
  close.type = 'button';
  close.className = 'm2-card-dismiss';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close card details');
  on(close, 'click', () => { state.detailCard = null; showUpgradeDetails(state); });
  const foot = q('.m2-card-foot', display);
  foot.classList.add('m2-has-dismiss');
  foot.append(close);
  state.details.append(display);
}
function buildUpgradeTree(state) {
  const host = state.host;
  host.replaceChildren();
  host.innerHTML = '<h2 class="m2-upgrade-heading">Upgrades</h2>';
  state.details = document.createElement('section');
  state.details.className = 'm2-deck-preview m2-upgrade-details';
  state.details.setAttribute('aria-label', 'Selected upgrade card');
  const scroll = document.createElement('div');
  scroll.className = 'm2-deck-row-list';
  state.content = document.createElement('div');
  state.content.className = 'm2-upgrade-content';
  state.content.append(state.details, scroll);
  const { tree, headings } = createTreeView('Level-up upgrade paths');
  headings.children[1].dataset.upgradeTier = '2';
  headings.children[2].dataset.upgradeTier = '3';
  scroll.append(tree);
  state.buttons = [];
  const catalog = [...state.catalog.values()];
  for (const color of upgradeColors) {
    const tiers = new Map([1, 2, 3].map(tier => [tier,
      catalog.filter(card => card.color === color && deckTreeTier(card) === tier)]));
    appendTreePath(tree, color, tiers, card => {
      const button = createTreeCard(card, catalog, () => selectUpgradeTreeCard(state, card));
      trackCardSource(button, card, 'upgrade', state.source.heroId);
      state.buttons.push({ card, button });
      return button;
    });
  }
  state.totals = document.createElement('div');
  state.totals.className = 'm2-tree-build-stats m2-upgrade-totals';
  state.totals.setAttribute('aria-label', 'Item totals after selected upgrades');
  const controls = document.createElement('div');
  controls.className = 'm2-upgrade-controls';
  controls.innerHTML = '<button type="button" class="m2-upgrade-preview-toggle" role="switch">Preview</button><button type="button" class="m2-upgrade-reset">Reset</button>';
  controls.insertBefore(state.totals, controls.lastElementChild);
  state.status = document.createElement('p');
  state.status.className = 'm2-upgrade-status';
  state.status.setAttribute('role', 'status');
  const actions = document.createElement('div');
  actions.className = 'm2-upgrade-actions';
  actions.innerHTML = '<button type="button" class="m2-upgrade-commit">Commit upgrades</button>';
  host.append(state.content, state.status, controls, actions);
  on(q('.m2-upgrade-preview-toggle', host), 'click', () => {
    if (state.busy || state.uncertain) return;
    state.previewMode = !state.previewMode;
    state.preview.clear();
    state.message = '';
    renderUpgradeTreeState(state);
  });
  on(q('.m2-upgrade-reset', host), 'click', () => {
    if (state.busy || state.uncertain) return;
    state.selected.clear();
    state.preview.clear();
    state.previewMode = false;
    state.message = '';
    renderUpgradeTreeState(state);
  });
  on(q('.m2-upgrade-commit', host), 'click', () => {
    if (state.busy || state.uncertain || state.previewMode || state.preview.size || !upgradeSelectionValid(state)) return;
    state.busy = true;
    sendNextUpgrade(state);
  });
  showUpgradeDetails(state);
}
function renderUpgradeTreeState(state) {
  const source = state.source, pool = new Set(deckTreePool(source.hero).map(card => card.id));
  state.acquired = new Map(state.observed);
  for (const card of deckTreePool(source.hero))
    if (deckTreeTier(card) >= 2) {
      state.acquired.set(deckTreeGroup(card), card.id);
      state.observed.set(deckTreeGroup(card), card.id);
    }
  for (const tier of [2, 3]) {
    const required = tier === 2 ? source.required2 : source.required3,
      selected = [...state.selected.keys()].filter(key => key.endsWith(':' + tier)).length;
    for (const label of state.host.querySelectorAll('[data-upgrade-tier="' + tier + '"]'))
      label.textContent = 'Tier ' + tier + ' · ' + selected + '/' + required;
  }
  for (const { card, button } of state.buttons) {
    const group = deckTreeGroup(card), picked = state.selected.get(group), planned = state.preview.get(group),
      selected = picked === card.id || planned === card.id, eligible = upgradeSelectable(state, card),
      pair = state.acquired.get(group), isItem = pair && pair !== card.id && !pool.has(pair) && !!card.item;
    const unavailable = !selected && !pool.has(card.id) && !isItem &&
      (!!picked || !!planned || !!pair || deckTreeTier(card) < source.tiers[card.color] ||
        (!state.previewMode && !eligible));
    button.dataset.state = pool.has(card.id) ? 'current' : selected ? 'planned' : isItem ? 'item' : unavailable ? 'unavailable' : 'standard';
    button.dataset.eligible = String(eligible);
    button.classList.toggle('m2-tree-chosen', pool.has(card.id));
    button.classList.toggle('m2-tree-planned', planned === card.id);
    button.classList.toggle('m2-upgrade-selected', picked === card.id);
    button.classList.toggle('m2-tree-item', !!isItem);
    button.classList.toggle('m2-tree-unavailable', unavailable);
    button.setAttribute('aria-pressed', String(selected));
    button.disabled = state.busy || state.uncertain;
    button.title = card.name + (planned === card.id ? ' · Preview only' : picked === card.id ? ' · Selected upgrade' :
      eligible ? ' · Available upgrade' : ' · View card');
    button.setAttribute('aria-label', button.title);
  }
  const future = {}, planned = new Map(state.selected);
  for (const [group, id] of state.preview) planned.set(group, id);
  for (const id of planned.values()) {
    const item = cardGrantedItem(state.catalog.get(id), [...state.catalog.values()]), stat = item === 'AREA' ? 'RADIUS' : item;
    if (stat) future[stat] = (future[stat] || 0) + 1;
  }
  state.totals.replaceChildren(deckTreeItemTotals(source.hero.items || {}, future));
  state.host.dataset.preview = String(state.previewMode);
  const complete = upgradeSelectionValid(state), locked = state.busy || state.uncertain;
  state.status.textContent = state.message || (state.previewMode ? 'Preview only. Turn Preview off before committing.' :
    complete ? 'All upgrades selected. Ready to commit.' : 'Select all ' + source.player.remaining + ' upgrades before committing.');
  const toggle = q('.m2-upgrade-preview-toggle', state.host);
  toggle.setAttribute('aria-checked', String(state.previewMode));
  toggle.disabled = locked;
  q('.m2-upgrade-reset', state.host).disabled = locked || (!state.selected.size && !state.preview.size);
  const commit = q('.m2-upgrade-commit', state.host);
  commit.disabled = locked || state.previewMode || state.preview.size > 0 || !complete;
  commit.textContent = state.busy ? 'Committing…' : 'Commit ' + source.player.remaining + (source.player.remaining === 1 ? ' upgrade' : ' upgrades');
}
function updateUpgradeTree() {
  if (!root.hasAttribute('data-m2-active') || uiState.dead) { clearUpgradeTree(); return; }
  const source = upgradeSource();
  if (!source) { clearUpgradeTree(); return; }
  if (upgradeTreeState?.source.owner !== source.owner) clearUpgradeTree();
  let state = upgradeTreeState;
  if (!state) {
    const host = document.createElement('section');
    host.className = 'm2-upgrade-browser';
    host.setAttribute('aria-label', 'Choose level-up upgrades');
    addExtra(host);
    state = upgradeTreeState = { host, picker: source.picker, source, catalog: new Map(source.cards.map(card => [card.id, card])),
      selected: new Map(), preview: new Map(), acquired: new Map(), observed: new Map(), previewMode: false, busy: false,
      uncertain: false, pending: null, message: '', timer: null, detailCard: null };
    buildUpgradeTree(state);
  }
  const oldSource = state.source;
  if (state.pending && source.player.remaining !== state.pending.before) {
    const acknowledged = source.player.remaining === state.pending.before - 1 &&
      deckTreePool(source.hero).some(card => card.id === state.pending.id);
    if (acknowledged) {
      clearTimeout(state.timer);
      const build = deckTreeBuild(source.hero, [...state.catalog.values()]);
      build.chosen.set(state.pending.group, state.pending.id);
      build.planned.delete(state.pending.group);
      saveDeckTreeBuild(build);
      state.selected.delete(state.pending.group);
      state.pending = null;
      state.uncertain = false;
      state.message = '';
    } else {
      state.observed.clear();
      state.selected.clear();
      pauseUpgradeCommit(state, 'Upgrade state changed. Review the remaining choices.');
    }
  } else if (source.signature !== oldSource.signature) {
    state.observed.clear();
    state.selected.clear();
    state.preview.clear();
    state.previewMode = false;
    pauseUpgradeCommit(state, 'Upgrade choices changed. Select the remaining upgrades again.');
  }
  state.source = source;
  if (state.picker !== source.picker) {
    state.picker.removeAttribute('data-m2-upgrade-tree');
    state.picker = source.picker;
  }
  if (!source.picker.contains(state.host)) source.picker.append(state.host);
  managedAttribute(source.picker, 'data-m2-upgrade-tree', '');
  renderUpgradeTreeState(state);
  if (state.busy && !state.pending) sendNextUpgrade(state);
}
on(document, 'visibilitychange', () => {
  if (document.visibilityState === 'hidden' && upgradeTreeState?.busy)
    pauseUpgradeCommit(upgradeTreeState, 'Commit paused. Review the remaining upgrades when you return.', !!upgradeTreeState.pending);
});

export { clearUpgradeTree, updateUpgradeTree };
