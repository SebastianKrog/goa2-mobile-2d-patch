import { componentProp } from './react.js';
import { c, managedAttribute, q } from './runtime.js';
import { addExtra, extras } from './ui.js';

const runes = ['bird', 'axe', 'anvil', 'horn'];
let state = null;
let progress = null;
const progressKey = 'goa2-mobile-rune-progress';
// The server may publish rune_slots only after inscription finishes. Infer a
// placement only when the next prompt confirms exactly one offered rune left.
function inscriptionProgress(turn, available, hero, view) {
  const context = JSON.stringify([location.pathname, hero.id, view?.round, view?.turn]);
  if (progress?.context !== context) {
    let saved;
    try { saved = JSON.parse(window.sessionStorage.getItem(progressKey) || 'null'); } catch {}
    const valid = saved?.context === context && Number.isInteger(saved.turn) &&
      saved.turn >= 1 && saved.turn <= 5 && Array.isArray(saved.available) &&
      saved.available.every(rune => runes.includes(rune));
    progress = valid ? { ...saved, chosen: Object.fromEntries(Object.entries(saved.chosen || {})
      .filter(([slot, rune]) => /^[1-4]$/.test(slot) && runes.includes(rune))) }
      : { context, turn, available: [...available], chosen: {} };
  }
  const before = JSON.stringify(progress);
  if (turn < progress.turn) {
    for (const slot of Object.keys(progress.chosen))
      if (Number(slot) >= turn) delete progress.chosen[slot];
  }
  if (turn === progress.turn + 1) {
    const removed = progress.available.filter(rune => !available.has(rune));
    const added = [...available].filter(rune => !progress.available.includes(rune));
    if (removed.length === 1 && !added.length) progress.chosen[progress.turn] = removed[0];
  }
  if (turn === 5) {
    for (let slot = 1; slot <= 4; slot++)
      if (runes.includes(hero.rune_slots?.[slot])) progress.chosen[slot] = hero.rune_slots[slot];
  }
  progress.turn = turn;
  progress.available = [...available];
  const after = JSON.stringify(progress);
  try {
    if (before !== after || window.sessionStorage.getItem(progressKey) !== after)
      window.sessionStorage.setItem(progressKey, after);
  } catch {}
  return progress.chosen;
}
function clearRuneProgress() {
  progress = null;
  try { window.sessionStorage.removeItem(progressKey); } catch {}
}
const requestKey = request => JSON.stringify([request?.request_id, request?.type,
  request?.player_id, request?.prompt, request?.options]);
const runeName = rune => rune[0].toUpperCase() + rune.slice(1);
function runeLabel(rune) {
  const label = document.createElement('span');
  label.className = 'm2-rune-label';
  const icon = document.createElement('img');
  icon.src = '/icons/rune_' + rune + '.png';
  icon.alt = '';
  label.append(icon, document.createTextNode(runeName(rune)));
  return label;
}
function clearRuneChoices() {
  if (!state) return;
  for (const button of state.sources) managedAttribute(button, 'data-m2-rune-source', null);
  managedAttribute(state.title, 'data-m2-rune-heading', null);
  managedAttribute(state.title, 'aria-label', state.ariaLabel);
  state.root.remove();
  extras.delete(state.root);
  state = null;
}
function updateRuneChoices(picker, request, hero, view) {
  let turn = Number(String(request?.prompt || '').match(/place a rune (?:below turn slot|for turn)\s*([1-4])/i)?.[1]);
  const current = hero?.current_turn_card || hero?.played_cards?.[Number(view?.turn) - 1];
  const context = JSON.stringify([location.pathname, hero?.id, view?.round, view?.turn]);
  let saved = progress;
  if (!saved) { try { saved = JSON.parse(window.sessionStorage.getItem(progressKey) || 'null'); } catch {} }
  const confirming = !turn && ['CHOOSE_ACTION', 'SELECT_OPTION'].includes(request?.type) && /confirm your action/i.test(request.prompt || '') &&
    ((saved?.context === context && saved.turn >= 4) ||
      /inscribe.*runes/i.test((current?.id || '') + ' ' + (current?.name || '')) &&
        [1, 2, 3, 4].every(slot => runes.includes(hero?.rune_slots?.[slot])));
  if (confirming) turn = 5;
  const options = Array.isArray(request?.options) ? request.options : [];
  const buttons = picker ? Array.from(picker.children).filter(el => el.tagName === 'BUTTON') : [];
  const available = new Map();
  for (const option of options) {
    const name = (typeof option === 'string' ? option : option?.text)?.trim().toLowerCase();
    if (!runes.includes(name)) continue;
    const source = buttons.find(button => button.textContent.trim().toLowerCase() === name);
    if (!source) { clearRuneChoices(); return; }
    available.set(name, source);
  }
  const title = picker && (q(c('title'), picker) || q(c('titleRow') + ' > :not(button)', picker));
  if (!turn || !title || !hero || (!confirming && request?.type !== 'SELECT_OPTION') || (!confirming && !available.size) ||
      (request.player_id && request.player_id !== hero.id)) {
    clearRuneChoices();
    // Board peek has no picker/request; keep the confirmed sequence for reopen.
    if (request && !turn) clearRuneProgress();
    return;
  }
  const chosen = inscriptionProgress(turn, new Set(available.keys()), hero, view);
  if (state && (state.picker !== picker || state.title !== title)) clearRuneChoices();
  if (!state) {
    const root = document.createElement('section');
    root.className = 'm2-rune-choices';
    root.setAttribute('aria-label', 'Inscribe runes');
    picker.insertBefore(root, buttons[0]);
    addExtra(root);
    state = { root, picker, title, ariaLabel: title.getAttribute('aria-label'), sources: [], key: '' };
  }
  for (const source of state.sources)
    if (![...available.values()].includes(source)) managedAttribute(source, 'data-m2-rune-source', null);
  const sources = [...available.values()];
  for (const source of sources) managedAttribute(source, 'data-m2-rune-source', 'true');
  const heading = confirming ? null : 'Place a rune for turn ' + turn;
  managedAttribute(title, 'data-m2-rune-heading', heading);
  managedAttribute(title, 'aria-label', heading || state.ariaLabel);
  const key = JSON.stringify([requestKey(request), chosen, sources.map(button => button.disabled)]);
  if (state.key === key && state.sources.every((button, i) => button === sources[i])) return;
  state.sources = sources;
  state.key = key;
  const choices = document.createElement('div'), slots = document.createElement('div');
  choices.className = 'm2-rune-options';
  slots.className = 'm2-rune-slots';
  const offerKey = requestKey(request);
  for (const rune of runes) {
    const cell = document.createElement('div');
    cell.className = 'm2-rune-choice-cell';
    cell.dataset.rune = rune;
    const source = available.get(rune);
    if (source) {
      const button = document.createElement('button');
      button.type = 'button';
      button.disabled = source.disabled;
      button.setAttribute('aria-label', 'Place ' + runeName(rune));
      button.append(runeLabel(rune));
      button.onclick = () => {
        if (source.isConnected && !source.disabled && state?.picker === picker &&
            requestKey(componentProp(picker, 'inputRequest')) === offerKey) source.click();
      };
      cell.append(button);
    } else cell.setAttribute('aria-hidden', 'true');
    choices.append(cell);
  }
  for (let slot = 1; slot <= 4; slot++) {
    const cell = document.createElement('div');
    cell.className = 'm2-rune-slot';
    cell.dataset.turn = String(slot);
    cell.dataset.current = String(slot === turn);
    const rune = slot < turn ? chosen[slot] : null;
    if (runes.includes(rune)) cell.append(runeLabel(rune));
    else cell.textContent = 'Turn ' + slot;
    cell.setAttribute('aria-label', 'Turn ' + slot + (runes.includes(rune) ? ': ' + runeName(rune) : ''));
    if (slot === turn) cell.setAttribute('aria-current', 'step');
    slots.append(cell);
  }
  if (confirming) {
    const labels = document.createElement('div');
    labels.className = 'm2-rune-turn-labels';
    labels.setAttribute('aria-hidden', 'true');
    for (let slot = 1; slot <= 4; slot++) {
      const label = document.createElement('span');
      label.textContent = 'Turn ' + slot;
      labels.append(label);
    }
    state.root.replaceChildren(labels, slots);
  } else state.root.replaceChildren(choices, slots);
}

export { runes, runeLabel, clearRuneChoices, updateRuneChoices };
