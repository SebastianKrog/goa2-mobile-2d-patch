import { textCard } from './cards.js';
import { heroTurnCard } from './heroes.js';
import { componentProp } from './react.js';
import { c, managedAttribute, q } from './runtime.js';
import { addExtra, extras } from './ui.js';

const boardInputs = new Set(['SELECT_HEX', 'SELECT_UNIT', 'SELECT_UNIT_OR_TOKEN', 'CHOOSE_RESPAWN_HEX']);
const adapted = new Set();
let viewer = null;

// Only presentation is added. Native buttons stay under React's ownership and
// keep their click, preview and board-peek handlers.
function mark(element, attribute, value = 'true') {
  managedAttribute(element, attribute, value);
  adapted.add(element);
}
function clearActionChoices() {
  for (const element of adapted)
    for (const attribute of ['data-m2-action-picker', 'data-m2-action-overlay',
      'data-m2-board-peek', 'data-m2-board-label', 'data-m2-board-prompt'])
      if (element.hasAttribute(attribute)) managedAttribute(element, attribute, null);
  adapted.clear();
  if (viewer) {
    viewer.remove();
    extras.delete(viewer);
    viewer = null;
  }
}
function updateActionChoices() {
  const board = q('[data-m2="board"]');
  const banner = board && q(c('banner'), board);
  const bannerRequest = banner && componentProp(banner, 'inputRequest');
  const boardPrompt = banner && boardInputs.has(bannerRequest?.type);
  const prompt = boardPrompt ? String(bannerRequest.prompt || '').trim() : '';
  const controls = boardPrompt ? Array.from(banner.querySelectorAll('button')) : [];
  const picker = board && q(c('picker') + ',' + c('pickerUpgrade'), board);
  const request = picker && componentProp(picker, 'inputRequest');
  const view = picker && (componentProp(picker, 'view') || componentProp(q(c('sidebar')), 'view'));
  const myHeroId = picker && (componentProp(picker, 'myHeroId') || componentProp(q(c('sidebar')), 'myHeroId'));
  const ownBox = Array.from(document.querySelectorAll('[data-m2="sidebar"] [data-m2="hero"]'))
    .find(box => !box.hasAttribute('data-m2-other') &&
      (!myHeroId || componentProp(box, 'hero')?.id === myHeroId));
  const hero = ownBox && componentProp(ownBox, 'hero');
  const ownAction = request && hero && /^RESOLUTION$/i.test(view?.phase || '') &&
    request.type !== 'UPGRADE_PHASE' && request.type !== 'SELECT_CARD_OR_PASS' &&
    (!request.player_id || request.player_id === hero.id) &&
    (view.current_actor_id ? view.current_actor_id === hero.id :
      ['CHOOSE_ACTION', 'SELECT_OPTION'].includes(request.type));
  const candidate = ownAction ? heroTurnCard(ownBox, hero, view) : null;
  const card = candidate && !candidate.is_facedown ? candidate : null;
  const activeElements = new Set();
  const set = (element, attribute, value) => {
    if (!element) return;
    mark(element, attribute, value);
    activeElements.add(element);
  };
  if (prompt) set(banner, 'data-m2-board-prompt');
  if (card) {
    set(picker, 'data-m2-action-picker');
    set(picker.parentElement, 'data-m2-action-overlay');
    const peek = q(c('peekBtn'), picker) || Array.from(picker.querySelectorAll('button'))
      .find(button => /^Board$/i.test(button.textContent.trim()));
    if (peek) {
      set(peek, 'data-m2-board-peek');
      set(peek, 'data-m2-board-label', peek.textContent.trim() ? 'false' : 'true');
    }
    if (!viewer) {
      viewer = document.createElement('section');
      viewer.className = 'm2-action-card-view';
      viewer.setAttribute('aria-label', 'Your played card');
      addExtra(viewer);
    }
    const key = JSON.stringify([hero.id, card, hero.items]);
    if (viewer.dataset.key !== key) {
      viewer.replaceChildren(textCard(card, 'hero', null, hero.id));
      viewer.dataset.key = key;
    }
    if (viewer.parentElement !== picker || picker.firstElementChild !== viewer) picker.prepend(viewer);
  } else if (viewer) {
    viewer.remove();
    extras.delete(viewer);
    viewer = null;
  }
  for (const element of Array.from(adapted)) {
    if (activeElements.has(element)) continue;
    for (const attribute of ['data-m2-action-picker', 'data-m2-action-overlay',
      'data-m2-board-peek', 'data-m2-board-label', 'data-m2-board-prompt'])
      if (element.hasAttribute(attribute)) managedAttribute(element, attribute, null);
    adapted.delete(element);
  }
  return { prompt, controls: prompt ? controls : [], card, heroId: card ? hero.id : null };
}

export { clearActionChoices, updateActionChoices };
