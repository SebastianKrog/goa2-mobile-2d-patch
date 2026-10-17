import { knownSpells, spellTinyCard } from './spells.js';
import { clearRuneChoices, updateRuneChoices } from './rune-choices.js';
import { updateCardRow } from './card-rows.js';
import { cardSymbol, textCard } from './cards.js';
import { clearDiscardChoices, updateDiscardChoices } from './discard-choices.js';
import { heroTurnCard } from './heroes.js';
import { componentProp } from './react.js';
import { c, managedAttribute, q } from './runtime.js';
import { addExtra, extras } from './ui.js';

const boardInputs = new Set(['SELECT_HEX', 'SELECT_UNIT', 'SELECT_UNIT_OR_TOKEN', 'CHOOSE_RESPAWN_HEX']);
const adapted = new Set();
let viewer = null;
const choiceLabels = new Map();

function clearChoiceLabel(button) {
  const state = choiceLabels.get(button);
  if (!state) return;
  state.label.remove();
  extras.delete(state.label);
  managedAttribute(button, 'data-m2-action-choice', null);
  managedAttribute(button, 'aria-label', state.ariaLabel);
  choiceLabels.delete(button);
}
function updateChoiceLabels(picker, request) {
  const live = new Set();
  if (request?.type === 'CHOOSE_ACTION' && picker) {
    for (const button of picker.querySelectorAll('button')) {
      const previous = choiceLabels.get(button);
      const text = Array.from(button.childNodes)
        .filter(node => node !== previous?.label).map(node => node.textContent).join('').trim();
      const match = text.match(/^(?:(Primary|Secondary):\s*)?(ATTACK|MOVEMENT|DEFENSE|DEFENSE_SKILL|SKILL|FAST_TRAVEL|HOLD|HELD|CLEAR)\s*(?:\((\d+\+?|[-–!])\))?$/i);
      if (!match) continue;
      const [, kind, action, value] = match;
      const key = action.toUpperCase();
      const symbol = ['ATTACK', 'MOVEMENT', 'SKILL', 'DEFENSE_SKILL', 'DEFENSE'].includes(key);
      if (!symbol && value !== undefined && value !== '0') continue;
      if (['ATTACK', 'MOVEMENT'].includes(key) && (value === undefined || /[-–]/.test(value))) continue;
      const shownValue = value && !/[-–]/.test(value) ? value : undefined;
      const actionLabel = key === 'FAST_TRAVEL' ? 'FAST TRAVEL' : action;
      live.add(button);
      let state = previous;
      if (!state) {
        const label = document.createElement('span');
        label.className = 'm2-action-choice-label';
        label.setAttribute('aria-hidden', 'true');
        addExtra(label);
        state = { label, ariaLabel: button.getAttribute('aria-label'), text: null };
        choiceLabels.set(button, state);
      }
      if (state.text !== text) {
        state.label.replaceChildren();
        if (kind) state.label.append(document.createTextNode(kind + ': '));
        state.label.append(symbol ? cardSymbol(key, shownValue) : document.createTextNode(actionLabel));
        state.text = text;
      }
      if (state.label.parentElement !== button) button.append(state.label);
      managedAttribute(button, 'data-m2-action-choice', 'true');
      managedAttribute(button, 'aria-label', (kind ? kind + ': ' : '') + actionLabel + (symbol && shownValue !== undefined ? ' ' + shownValue : ''));
    }
  }
  for (const button of choiceLabels.keys())
    if (!live.has(button)) clearChoiceLabel(button);
}

// Catalog choices retain native handlers; only complete own gold offers get rows.
const goldChoices = new Map();
function clearGoldChoice(button) {
  const previous = goldChoices.get(button);
  if (!previous) return;
  const row = q(':scope > .m2-list-card', button);
  if (row) { extras.delete(row); row.remove(); }
  if (!previous.adapted) button.classList.remove('m2-adapted-row');
  managedAttribute(button, 'data-m2-gold-choice', null);
  managedAttribute(button, 'aria-label', previous.ariaLabel);
  goldChoices.delete(button);
}
function updateGoldChoices(picker, request, hero) {
  const live = new Set();
  if (picker && request?.type === 'SELECT_CARD' && /gold/i.test(request.prompt || '') &&
      (!request.player_id || request.player_id === hero?.id) && Array.isArray(hero?.deck) &&
      Array.isArray(request.valid_options) && request.valid_options.length) {
    const buttons = Array.from(picker.children).filter(node => node.tagName === 'BUTTON');
    const offers = request.valid_options.map(id => {
      const card = hero.deck.find(card => card.id === id && card.color === 'GOLD' && card.name && card.primary_action);
      const button = card && buttons.find(button => Array.from(button.childNodes)
        .filter(node => !node.classList?.contains('m2-list-card'))
        .map(node => node.textContent).join('').trim() === card.name);
      return { card, button };
    });
    if (offers.every(offer => offer.button)) for (const {card, button} of offers) {
      live.add(button);
      if (!goldChoices.has(button)) goldChoices.set(button, {
        adapted: button.classList.contains('m2-adapted-row'), ariaLabel: button.getAttribute('aria-label'),
      });
      managedAttribute(button, 'data-m2-gold-choice', 'true');
      managedAttribute(button, 'aria-label', card.name);
      updateCardRow(button, { ...card, is_facedown: false }, {}, 'small');
    }
  }
  for (const button of goldChoices.keys()) if (!live.has(button)) clearGoldChoice(button);
}

// Prepared-spell choices retain the original buttons and native cast handlers.
const spellChoices = new Map();
function clearSpellChoice(button) {
  const state = spellChoices.get(button);
  if (!state) return;
  state.row.remove();
  extras.delete(state.row);
  managedAttribute(button, 'data-m2-spell-choice', null);
  managedAttribute(button, 'aria-label', state.ariaLabel);
  spellChoices.delete(button);
}
function updateSpellChoices(picker, request, hero) {
  const live = new Set();
  if (picker && ['SELECT_CARD', 'SELECT_OPTION'].includes(request?.type) && /spell.*cast|cast.*spell/i.test(request.prompt || '') &&
      (!request.player_id || request.player_id === hero?.id) && Array.isArray(hero?.spellbook)) {
    const cards = knownSpells(hero.spellbook, true);
    const normalize = text => String(text || '').toLowerCase().replace(/[_-]/g, ' ').trim();
    const buttons = Array.from(picker.children).filter(node => node.tagName === 'BUTTON');
    const offers = request.type === 'SELECT_CARD' && Array.isArray(request.valid_options)
      ? request.valid_options : Array.isArray(request.options) ? request.options : [];
    for (const option of offers) {
      const id = typeof option === 'string' ? option : option.id;
      const label = typeof option === 'string' ? option : option.text;
      const card = cards.find(card => normalize(card.id) === normalize(id) || normalize(card.name) === normalize(label));
      if (!card) continue;
      const button = buttons.find(button => {
        const text = Array.from(button.childNodes).filter(node => node !== spellChoices.get(button)?.row)
          .map(node => node.textContent).join('').trim();
        return [id, label, card.id, card.name].some(value => normalize(value) === normalize(text));
      });
      if (!button) continue;
      live.add(button);
      let state = spellChoices.get(button);
      const key = JSON.stringify(card);
      if (state?.key === key) continue;
      if (state) clearSpellChoice(button);
      const row = spellTinyCard(card);
      state = { row, key, ariaLabel: button.getAttribute('aria-label') };
      spellChoices.set(button, state);
      button.append(row);
      addExtra(row);
      managedAttribute(button, 'data-m2-spell-choice', 'true');
      managedAttribute(button, 'aria-label', card.name);
    }
  }
  for (const button of spellChoices.keys()) if (!live.has(button)) clearSpellChoice(button);
}

// Only presentation is added. Native buttons stay under React's ownership and
// keep their click, preview and board-peek handlers.
function mark(element, attribute, value = 'true') {
  managedAttribute(element, attribute, value);
  adapted.add(element);
}
function clearActionChoices() {
  clearDiscardChoices();
  clearRuneChoices();
  for (const button of spellChoices.keys()) clearSpellChoice(button);
  for (const button of goldChoices.keys()) clearGoldChoice(button);
  for (const button of choiceLabels.keys()) clearChoiceLabel(button);
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
  const discarding = updateDiscardChoices(picker, request, hero);
  updateGoldChoices(picker, request, hero);
  updateSpellChoices(picker, request, hero);
  updateRuneChoices(picker, request, hero, view);
  const ownAction = request && hero && /^RESOLUTION$/i.test(view?.phase || '') &&
    request.type !== 'UPGRADE_PHASE' && request.type !== 'SELECT_CARD_OR_PASS' &&
    (!request.player_id || request.player_id === hero.id) &&
    (view.current_actor_id ? view.current_actor_id === hero.id :
      ['CHOOSE_ACTION', 'SELECT_OPTION'].includes(request.type));
  const actionTarget = request?.type === 'CHOOSE_ACTION' &&
    String(request.prompt || '').match(/^Choose an? action (?:to perform on|for(?: card)?)\s+["“]?(.+?)["”]?[.!]?$/i)?.[1];
  const spellTarget = actionTarget && [...knownSpells(hero?.spellbook, true), ...knownSpells(hero?.cast_spells)]
    .find(spell => [spell.name, spell.id].some(name => name?.toLowerCase() === actionTarget.toLowerCase()));
  const candidate = ownAction && !discarding ? spellTarget || heroTurnCard(ownBox, hero, view) : null;
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
  updateChoiceLabels(card ? picker : null, request);
  return { prompt, controls: prompt ? controls : [], card, heroId: card ? hero.id : null };
}

export { clearActionChoices, updateActionChoices };
