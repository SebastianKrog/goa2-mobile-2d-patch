import { updateCardRow } from './card-rows.js';
import { textCard } from './cards.js';
import { componentProp } from './react.js';
import { managedAttribute } from './runtime.js';
import { addExtra, extras, on } from './ui.js';

let state = null;
function clearDiscardChoices() {
  if (!state) return;
  for (const button of state.sources) managedAttribute(button, 'data-m2-discard-source', null);
  managedAttribute(state.picker, 'data-m2-discard-picker', null);
  managedAttribute(state.overlay, 'data-m2-discard-overlay', null);
  for (const element of [...extras])
    if (element === state.root || state.root.contains(element)) extras.delete(element);
  state.root.remove();
  state = null;
}
function requestKey(request) {
  return JSON.stringify([request?.request_id, request?.type, request?.player_id,
    request?.prompt, request?.valid_options]);
}
function updateDiscardChoices(picker, request, hero) {
  const ids = request?.valid_options;
  const cards = Array.isArray(hero?.hand) ? hero.hand : [];
  const buttons = picker ? Array.from(picker.children).filter(el => el.tagName === 'BUTTON') : [];
  const sources = Array.isArray(ids) ? ids.map(id => buttons.find(button =>
    componentProp(button, 'onClick') && cards.some(card => card.id === id &&
      button.textContent.trim() === card.name))) : [];
  // Adapt only complete, visible discard offers. Unknown cards keep native controls.
  const valid = picker && request?.type === 'SELECT_CARD' && /discard/i.test(request.prompt || '') &&
    (!request.player_id || request.player_id === hero?.id) && ids?.length &&
    sources.every(Boolean) && ids.every(id => cards.some(card => card.id === id && !card.is_facedown));
  if (!valid) { clearDiscardChoices(); return false; }
  const key = requestKey(request);
  if (state && (state.picker !== picker || state.key !== key ||
      state.sources.some((source, i) => source !== sources[i]))) clearDiscardChoices();
  if (!state) {
    const root = document.createElement('section');
    root.className = 'm2-discard-choices';
    root.setAttribute('aria-label', 'Choose a card to discard');
    const detail = document.createElement('div');
    const list = document.createElement('div');
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'm2-discard-confirm';
    confirm.textContent = 'Confirm discard';
    confirm.disabled = true;
    root.append(detail, list, confirm);
    addExtra(root);
    state = { root, detail, list, confirm, picker, overlay: picker.parentElement,
      key, sources, selected: null, submitted: false };
    const offer = state;
    on(confirm, 'click', () => {
      const current = componentProp(picker, 'inputRequest');
      const index = ids.indexOf(offer.selected);
      const source = offer.sources[index];
      if (state !== offer || offer.submitted || requestKey(current) !== key ||
          !source?.isConnected || source.disabled) return;
      offer.submitted = true;
      confirm.disabled = true;
      source.click();
    });
    ids.forEach((id, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'm2-discard-row';
      button.setAttribute('aria-pressed', 'false');
      list.append(button);
      on(button, 'click', () => {
        if (state !== offer || offer.submitted || sources[index].disabled ||
            requestKey(componentProp(picker, 'inputRequest')) !== key) return;
        offer.selected = id;
        offer.detailKey = null;
        renderOffer(offer, cards, hero);
      });
    });
    picker.append(root);
  }
  managedAttribute(picker, 'data-m2-discard-picker', 'true');
  managedAttribute(picker.parentElement, 'data-m2-discard-overlay', 'true');
  sources.forEach(button => managedAttribute(button, 'data-m2-discard-source', 'true'));
  renderOffer(state, cards, hero);
  return true;
}
function renderOffer(offer, cards, hero) {
  const ids = JSON.parse(offer.key)[4];
  [...offer.list.children].forEach((button, index) => {
    const card = cards.find(card => card.id === ids[index]);
    button.disabled = offer.submitted || offer.sources[index].disabled;
    button.setAttribute('aria-label', card.name);
    button.setAttribute('aria-pressed', String(card.id === offer.selected));
    updateCardRow(button, card, hero.items || {});
  });
  const selected = cards.find(card => card.id === offer.selected);
  const key = JSON.stringify([selected, hero.items]);
  if (key !== offer.detailKey) {
    offer.detail.replaceChildren(...(selected ? [textCard(selected, 'hero', null, hero.id)] : []));
    offer.detailKey = key;
  }
  offer.confirm.disabled = offer.submitted || !selected || offer.sources[ids.indexOf(offer.selected)]?.disabled;
}

export { clearDiscardChoices, updateDiscardChoices };
