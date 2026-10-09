import { deckCardIdentity } from './tree-model.js';

// Weak ownership keeps removed React rows and rebuilt card buttons collectible.
// Viewer overlays are independent of active effects, Deck plans and upgrade staging.
const sources = new WeakMap();
const viewed = new Map();
function applyHighlight(element, source) {
  const selected = viewed.get(source.viewer);
  element.toggleAttribute('data-m2-viewed', !!selected &&
    selected.owner === source.owner && selected.cardId === source.cardId);
}
function trackCardSource(element, card, viewer, owner = '') {
  const source = { viewer, owner, cardId: deckCardIdentity(card) };
  sources.set(element, source);
  if (!element.classList.contains('m2-card-source')) element.classList.add('m2-card-source');
  applyHighlight(element, source);
}
function highlightViewedCard(viewer, card = null, owner = '') {
  if (card) viewed.set(viewer, { owner, cardId: deckCardIdentity(card) });
  else viewed.delete(viewer);
  for (const element of document.querySelectorAll('.m2-card-source')) {
    const source = sources.get(element);
    if (source?.viewer === viewer) applyHighlight(element, source);
  }
}
function clearCardHighlights() {
  viewed.clear();
  for (const element of document.querySelectorAll('.m2-card-source')) {
    element.classList.remove('m2-card-source');
    element.removeAttribute('data-m2-viewed');
  }
}

export { clearCardHighlights, highlightViewedCard, trackCardSource };
