import { highlightViewedCard, trackCardSource } from './card-highlight.js';
import { updateCardRow } from './card-rows.js';
import { cardGrantedItem, textCard } from './cards.js';
import { deckTreeBuild, rememberDeckTreeChoices, renderDeckTree } from './deck-tree.js';
import { currentUpgradeRequest } from './game-input.js';
import { schedule } from './main.js';
import { m2Painter } from './painter.js';
import { componentProp } from './react.js';
import { c, deckPreferencesKey, q, root, uiState } from './runtime.js';
import { deckCardIdentity, deckTreePool } from './tree-model.js';
import { addExtra, on } from './ui.js';

// 6. Deck browser and canvas synchronization
// Read view/sort before rendering so opening Deck does not flash the wrong layout.
function loadDeckPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(deckPreferencesKey) || '{}');
    if (['tree', 'compact', 'grid'].includes(saved.view)) uiState.deckView = saved.view;
    else if (['list', 'large'].includes(saved.view)) uiState.deckView = 'compact';
    if (['tier', 'color'].includes(saved.sort)) uiState.deckSort = saved.sort;
  } catch {}
}
// Persist only presentation choices; this does not change cards or game state.
function selectDeckOption(value) {
  if (value === 'sort') uiState.deckSort = uiState.deckSort === 'tier' ? 'color' : 'tier';
  else uiState.deckView = value;
  try {
    localStorage.setItem(deckPreferencesKey, JSON.stringify({ view: uiState.deckView, sort: uiState.deckSort }));
  } catch {}
  deckUpdate();
}
loadDeckPreferences();
// Single entry point for card props on a rendered native component.
function renderedCard(element) {
  const card = componentProp(element, 'card');
  return card && typeof card.name === 'string' ? card : null;
}
// Native Deck omits basic cards in some layouts. Cache locally painted canvases
// for the known own-hero basic cards and prune entries that are no longer needed.
const basicCanvases = new Map();
const basicPaintStates = new WeakMap();
function retryBasicArtwork() {
  for (const canvas of basicCanvases.values()) {
    const state = basicPaintStates.get(canvas);
    if (state && !state.painted) {
      state.retryAt = 0;
      if (state.pending) state.retryRequested = true;
    }
  }
}
function paintBasicArtwork(canvas, card, hero, cacheKey) {
  const state = basicPaintStates.get(canvas);
  if (state.pending || state.painted || Date.now() < state.retryAt || navigator.onLine === false) return;
  state.pending = true;
  (async () => {
    try {
      await m2Painter.ensureCardAssetsReady();
      const slug = hero.id.toLowerCase().replace(/^hero_/, '');
      const background = card.image_id
        ? await m2Painter.loadCardBackground(slug, card.image_id) : undefined;
      if (uiState.dead || basicCanvases.get(cacheKey) !== canvas) return;
      // Paint offscreen first. A missing sprite or other drawing error must
      // leave the readable fallback on the displayed source canvas intact.
      const staging = document.createElement('canvas');
      staging.width = canvas.width;
      staging.height = canvas.height;
      const ctx = staging.getContext('2d'), target = canvas.getContext('2d');
      if (!ctx || !target) return;
      m2Painter.paintCard(staging, ctx, { ...card, is_facedown: false }, background);
      target.drawImage(staging, 0, 0);
      state.painted = !card.image_id || !!background;
    } catch (error) {
      if (!uiState.dead) console.warn('GoA mobile: basic card artwork unavailable', error);
    } finally {
      state.pending = false;
      state.retryAt = Date.now() + 5000;
      if (state.retryRequested) {
        state.retryRequested = false;
        state.retryAt = 0;
        if (!uiState.dead && !state.painted) schedule();
      }
    }
  })();
}
function deckBasics(modal) {
  const candidate = componentProp(modal, 'hero'),
    hero = Array.isArray(candidate?.deck) ? candidate : null;
  if (!hero) return [];
  const wanted = new Set(
    hero.deck
      .filter((card) => ['GOLD', 'SILVER'].includes(card.color))
      .map((card) => JSON.stringify([hero.id, card])),
  );
  for (const key of basicCanvases.keys()) if (!wanted.has(key)) basicCanvases.delete(key);
  return hero.deck
    .filter((card) => ['GOLD', 'SILVER'].includes(card.color))
    .map((card) => {
      const cacheKey = JSON.stringify([hero.id, card]);
      let canvas = basicCanvases.get(cacheKey);
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = 1192;
        canvas.height = 1664;
        basicCanvases.set(cacheKey, canvas);
        basicPaintStates.set(canvas, { pending: false, painted: false, retryAt: 0, retryRequested: false });
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#202631';
          ctx.fillRect(0, 0, 1192, 1664);
          ctx.fillStyle = '#fff';
          ctx.font = '48px sans-serif';
          ctx.fillText(card.name, 50, 100);
        }
      }
      paintBasicArtwork(canvas, card, hero, cacheKey);
      return { canvas, card };
    });
}
// Reconcile the native Deck modal with the custom browser. If source cards are
// not ready, retain the native fallback instead of displaying an empty replacement.
function clearDeckState() {
  highlightViewedCard('deck');
  if (!uiState.deckState) return;
  uiState.deckState.watchers?.forEach(stop => stop());
  uiState.deckState.host.remove();
  uiState.deckState.zoom.remove();
  uiState.deckState.modal.removeAttribute('data-m2-deck-ready');
  uiState.deckState = null;
}
function deckUpdate(upgradeRequest) {
  const modal = q('[data-m2="deck"]');
  if (!modal || !root.hasAttribute('data-m2-active')) {
    clearDeckState();
    return;
  }
  const sources = Array.from(modal.querySelectorAll(c('cardGrid') + ' canvas'));
  if (!sources.length) { clearDeckState(); return; }
  const entries = sources.map((canvas) => ({ canvas, card: renderedCard(canvas) }));
  for (const entry of deckBasics(modal)) {
    if (!entries.some((e) => e.card?.id === entry.card.id && e.card?.color === entry.card.color))
      entries.push(entry);
  }
  if (entries.some((e) => !e.card)) {
    clearDeckState();
    return;
  } // Retain native deck if framework changes.
  if (!uiState.deckState || uiState.deckState.modal !== modal) {
    clearDeckState();
    const host = document.createElement('section');
    host.className = 'm2-deck-browser';
    const zoom = document.createElement('div');
    zoom.className = 'm2-deck-zoom';
    zoom.hidden = true;
    modal.append(host, zoom);
    addExtra(host);
    addExtra(zoom);
    modal.setAttribute('data-m2-deck-ready', '');
    uiState.deckState = { modal, host, zoom, key: '', copies: [], dirty: true, watchers: [] };
  }
  const state = uiState.deckState;
  const hero = componentProp(modal, 'hero');
  const ownerKey = JSON.stringify([location.pathname, hero?.id || hero?.name ||
    entries.map(e => deckCardIdentity(e.card))]);
  if (state.ownerKey !== ownerKey) state.selectedCard = null;
  state.ownerKey = ownerKey;
  // Footer view/sort changes may update Deck outside refresh(). Read once for
  // those calls; an explicit null from refresh means no upgrade request exists.
  if (upgradeRequest === undefined) upgradeRequest = currentUpgradeRequest();
  rememberDeckTreeChoices(hero, entries.map(e => e.card), upgradeRequest);
  const build = uiState.deckView === 'tree' ? deckTreeBuild(hero, entries.map(e => e.card)) : null;
  const key = JSON.stringify([uiState.deckView, uiState.deckSort, entries.map((e) => e.card),
    ownerKey, uiState.deckView === 'tree' ? [hero?.level, hero?.items, [...build.chosen],
      deckTreePool(hero).map(deckCardIdentity)] : null]);
  if (state.key === key && state.sources?.every((v, i) => v === sources[i])) return;
  state.watchers?.forEach((stop) => stop());
  state.watchers = [];
  state.key = key;
  state.sources = sources;
  state.copies = [];
  state.dirty = true;
  for (const source of entries.map((e) => e.canvas)) watchDeckCanvas(state, source);
  state.zoom.hidden = true;
  highlightViewedCard('deck');
  state.zoom.replaceChildren();
  state.host.replaceChildren();
  state.host.dataset.view = uiState.deckView;
  const controls = document.createElement('div');
  controls.className = 'm2-deck-controls';
  for (const [value, label] of [
    ['tree', 'Tree'],
    ['compact', 'List'],
    ['grid', 'Grid'],
    ['sort', uiState.deckSort === 'tier' ? 'By tier' : 'By color'],
  ]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute(
      'aria-pressed',
      String(value === 'sort' ? uiState.deckSort === 'color' : uiState.deckView === value),
    );
    if (value === 'sort') {
      b.className = 'm2-sort-switch';
      b.setAttribute('role', 'switch');
      b.setAttribute('aria-label', 'Sort by color instead of tier');
      b.setAttribute('aria-checked', String(uiState.deckSort === 'color'));
      b.textContent = '';
      const labels = document.createElement('span');
      labels.innerHTML = '<span>Tier</span><span>Color</span>';
      const track = document.createElement('i');
      b.append(labels, track);
    }
    on(b, 'click', () => selectDeckOption(value));
    controls.append(b);
  }
  state.host.append(controls);
  // List (stored as compact for compatibility) and Tree share the Large Deck viewer.
  const hasPreview = uiState.deckView === 'compact' || uiState.deckView === 'tree';
  let preview;
  if (hasPreview) {
    preview = document.createElement('section');
    preview.className = 'm2-deck-preview';
    preview.setAttribute('aria-label', 'Selected deck card');
    state.host.append(preview);
  }
  function selectPreview(card) {
    state.selectedCard = card;
    highlightViewedCard('deck', card, hero?.id || '');
    preview.replaceChildren();
    if (card) {
      const display = textCard(card, 'deck', null, hero?.id,
        cardGrantedItem(card, entries.map(entry => entry.card)));
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'm2-card-dismiss';
      close.textContent = '×';
      close.setAttribute('aria-label', 'Close card details');
      close.onclick = () => selectPreview(null);
      const foot = q('.m2-card-foot', display);
      foot.classList.add('m2-has-dismiss');
      foot.append(close);
      preview.append(display);
    }
    for (const row of state.host.querySelectorAll('.m2-deck-compact .m2-deck-card'))
      row.setAttribute('aria-pressed', String(row.dataset.cardKey === JSON.stringify(card)));
  }

  // All modes have an independently scrollable card area. Landscape places it
  // beside the viewer, including Grid's existing enlarged image surface.
  const listHost = document.createElement('div');
  listHost.className = 'm2-deck-row-list';
  state.host.append(listHost);
  if (uiState.deckView === 'tree') {
    renderDeckTree(listHost, entries, hero, selectPreview);
    const selected = entries.find(e => state.selectedCard &&
      deckCardIdentity(e.card) === deckCardIdentity(state.selectedCard));
    selectPreview(selected?.card || null);
    deckPaint();
    return;
  }
  const colors = ['RED', 'BLUE', 'GREEN', 'PURPLE', 'GOLD', 'SILVER'];
  const tierRank = (v) =>
    ({ I: 1, II: 2, III: 3, IV: 4, 1: 1, 2: 2, 3: 3, 4: 4 })[String(v).toUpperCase()] ?? 4;
  const colorRank = (c) => {
    const r = colors.indexOf(String(c || '').toUpperCase());
    return r < 0 ? 99 : r;
  };
  entries.sort((a, b) =>
    uiState.deckSort === 'tier'
      ? tierRank(a.card.tier) - tierRank(b.card.tier) ||
        colorRank(a.card.color) - colorRank(b.card.color)
      : colorRank(a.card.color) - colorRank(b.card.color) ||
        tierRank(a.card.tier) - tierRank(b.card.tier),
  );
  const groups = new Map();
  for (const entry of entries) {
    const title =
      uiState.deckSort === 'tier'
        ? tierRank(entry.card.tier) === 4
          ? 'Ultimate & basics'
          : 'Tier ' + tierRank(entry.card.tier)
        : String(entry.card.color || 'Other').toLowerCase();
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(entry);
  }
  // Register each displayed copy with its source so later source draws can refresh it.
  function image(entry, large = false) {
    const canvas = document.createElement('canvas');
    canvas.width = large
      ? entry.canvas.width
      : Math.min(entry.canvas.width, 360);
    canvas.height = Math.round((canvas.width * entry.canvas.height) / entry.canvas.width);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', entry.card.name);
    state.copies.push([entry.canvas, canvas]);
    return canvas;
  }
  // Keep the enlarged canvas in the same copy registry, replacing the prior zoom view.
  function enlarge(entry) {
    state.copies = state.copies.filter(([, canvas]) => !state.zoom.contains(canvas));
    state.zoom.replaceChildren();
    state.dirty = true;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close ×';
    on(close, 'click', () => {
      state.zoom.hidden = true;
      highlightViewedCard('deck');
    });
    const canvas = image(entry, true);
    state.zoom.append(close, canvas);
    state.zoom.hidden = false;
    highlightViewedCard('deck', entry.card, hero?.id || '');
    deckPaint();
  }
  for (const [title, cards] of groups) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    const group = document.createElement('div');
    group.className = 'm2-deck-cards m2-deck-' + uiState.deckView;
    listHost.append(heading, group);
    for (const entry of cards) {
      const card = entry.card,
        b = document.createElement('button');
      b.type = 'button';
      b.className = 'm2-deck-card';
      trackCardSource(b, card, 'deck', hero?.id || '');
      b.setAttribute('aria-label', (uiState.deckView === 'compact' ? 'View ' : 'Enlarge ') + card.name);
      if (uiState.deckView === 'compact') {
        b.dataset.cardKey = JSON.stringify(card);
        b.setAttribute('aria-pressed', 'false');
        on(b, 'click', () => selectPreview(card));
        updateCardRow(b, card, {});
      } else b.append(image(entry));
      if (uiState.deckView !== 'compact') on(b, 'click', () => enlarge(entry));
      group.append(b);
    }
  }
  if (preview) {
    const selected = entries.find(e => state.selectedCard && (
      e.card.id ? e.card.id === state.selectedCard.id : e.card.name === state.selectedCard.name
    ));
    selectPreview(selected?.card || null);
  }
  deckPaint();
}

// Observe drawing on this source canvas only. Repaint copies when dirty instead of polling.
// Teardown restores the original context methods, including inherited ones.
function watchDeckCanvas(state, canvas) {
  let ctx;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return;
  }
  if (!ctx) return;
  for (const method of [
    'drawImage',
    'clearRect',
    'fillRect',
    'fillText',
    'strokeText',
    'putImageData',
    'fill',
    'stroke',
    'reset',
  ]) {
    const original = ctx[method];
    if (typeof original !== 'function') continue;
    const own = Object.hasOwn(ctx, method);
    function wrapped(...args) {
      const result = original.apply(this, args);
      state.dirty = true;
      schedule();
      return result;
    }
    try {
      ctx[method] = wrapped;
      state.watchers.push(() => {
        if (ctx[method] === wrapped) {
          if (own) ctx[method] = original;
          else delete ctx[method];
        }
      });
    } catch {}
  }
}
// Copy pixels only for dirty sources while Deck is open; idle frames do no work.
function deckPaint() {
  if (!uiState.deckState || !uiState.deckOpen || !uiState.deckState.dirty) return;
  const state = uiState.deckState;
  state.dirty = false;
  state.copies = state.copies.filter(([, dst]) => dst.isConnected);
  for (const [src, dst] of state.copies) {
    try {
      dst.getContext('2d').drawImage(src, 0, 0, dst.width, dst.height);
    } catch {}
  }
}

export { basicCanvases, deckPaint, deckUpdate, renderedCard, retryBasicArtwork };
