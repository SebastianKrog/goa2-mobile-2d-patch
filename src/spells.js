import { trackCardSource } from './card-highlight.js';
import { cardColors, cardSymbol, primaryCardValue, modifierCardValue, relevantStat } from './cards.js';
// Spell faces are finished landscape cards, not ordinary initiative/stat cards.
// Prepared cards are readable only when the server supplies the owner's array.
function isSpellCard(card) {
  return card?.spell_rank != null || ['SPELLBOOK', 'OUTSIDE_SPELLBOOK'].includes(card?.state);
}
function spellColorName(card) {
  if (/^Ultimate$/i.test(card?.image_id || '')) return 'PURPLE';
  return card?.color || String(card?.image_id || '').match(/^(Gold|Silver|Red|Blue|Green|Purple)/i)?.[1].toUpperCase() || 'SILVER';
}
function spellRankLabel(card) {
  const rank = Number(card.spell_rank ?? 0);
  return rank === 0 ? 'Cantrip' : 'Rank ' + (['', 'I', 'II', 'III', 'IV'][rank] || rank);
}
function knownSpells(cards, prepared = false) {
  return (Array.isArray(cards) ? cards : []).filter(card => card?.id && card.name &&
    (!card.is_facedown || prepared && isSpellCard(card) && card.image_id))
    .map(card => ({ ...card, is_facedown: false }));
}
function spellFace(card) {
  const box = document.createElement('article');
  box.className = 'm2-text-card m2-spell-card';
  const face = document.createElement('div');
  face.className = 'm2-spell-face';
  const fallback = document.createElement('div');
  fallback.className = 'm2-spell-fallback';
  const name = document.createElement('b'), rank = document.createElement('span');
  name.textContent = card.name;
  rank.textContent = spellRankLabel(card);
  fallback.append(name, rank);
  if (card.effect_text) {
    const rules = document.createElement('p');
    rules.textContent = card.effect_text;
    fallback.append(rules);
  }
  face.append(fallback);
  if (!card.is_facedown && /^[a-zA-Z0-9_-]+$/.test(card.image_id || '')) {
    const img = document.createElement('img');
    img.alt = card.name + ' — ' + spellRankLabel(card);
    img.src = '/cards/spells/' + card.image_id + '.webp';
    img.decoding = 'async';
    img.onload = () => face.classList.add('m2-spell-loaded');
    img.onerror = () => { face.classList.remove('m2-spell-loaded'); img.remove(); };
    face.append(img);
  }
  const foot = document.createElement('footer');
  foot.className = 'm2-card-foot';
  box.append(face, foot);
  return box;
}
// Presentation-only preferences, independent of Deck's sort and upgrade plans.
const spellPreferences = { sort: 'tier', view: 'large' };
try {
  const saved = JSON.parse(localStorage.getItem('goa2-mobile-spells') || '{}');
  if (['tier', 'color'].includes(saved?.sort)) spellPreferences.sort = saved.sort;
  if (['large', 'image'].includes(saved?.view)) spellPreferences.view = saved.view;
} catch {}
function setSpellPreference(key, value) {
  if (!(key === 'sort' && ['tier', 'color'].includes(value) ||
      key === 'view' && ['large', 'image'].includes(value))) return;
  spellPreferences[key] = value;
  try { localStorage.setItem('goa2-mobile-spells', JSON.stringify(spellPreferences)); } catch {}
}
function spellTinyCard(card) {
  const row = document.createElement('span');
  row.className = 'm2-list-card m2-mini-card m2-spell-tiny';
  row.dataset.spellRank = String(card.spell_rank ?? 0);
  const band = document.createElement('span');
  band.className = 'm2-list-band';
  band.style.setProperty('--card-color', cardColors[spellColorName(card)] || '#c4c8ce');
  band.style.setProperty('--m2-tier-lines', String(Math.max(1, Math.min(3, Number(card.spell_rank) || 1))));
  if (card.primary_action) {
    const primary = cardSymbol(card.primary_action, primaryCardValue(card));
    primary.classList.add('m2-list-primary');
    band.append(primary);
  }
  const name = document.createElement('span');
  name.className = 'm2-list-name';
  name.textContent = card.name;
  band.append(name);
  for (const key of ['RANGE', 'RADIUS']) {
    const value = modifierCardValue(card, key);
    if (relevantStat(card, key, value)) band.append(cardSymbol(key, value));
  }
  row.append(band);
  return row;
}
function spellRow(card, inspect, grid = false, source = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'm2-spell-row';
  button.dataset.spellId = card.id;
  button.dataset.color = spellColorName(card);
  button.setAttribute('aria-label', 'View ' + card.name + ' — ' + spellRankLabel(card));
  button.append(grid ? spellFace(card) : spellTinyCard(card));
  if (source.viewer) trackCardSource(button, card, source.viewer, source.owner || '');
  button.onclick = () => inspect(card);
  return button;
}
// The same Tiny rows serve the public cast list and the owner's Deck.
function appendSpellGroup(host, title, cards, inspect, grid = false, source = {}) {
  const group = document.createElement('section');
  group.className = 'm2-spell-group';
  const heading = document.createElement(source.heading || 'h3');
  heading.textContent = title;
  const list = document.createElement('div');
  list.className = 'm2-spell-list' + (grid ? ' m2-spell-grid' : '');
  for (const card of cards) list.append(spellRow(card, inspect, grid, source));
  if (title) group.append(heading);
  group.append(list);
  if (!cards.length) {
    const empty = document.createElement('p');
    empty.className = 'm2-spells-empty';
    empty.textContent = source.emptyText || 'No spells cast.';
    group.append(empty);
  }
  host.append(group);
}
function sortSpells(cards, sort) {
  const colors = ['GOLD', 'RED', 'BLUE', 'GREEN', 'PURPLE', 'SILVER'];
  const colorRank = card => { const rank = colors.indexOf(spellColorName(card)); return rank < 0 ? 99 : rank; };
  return [...cards].sort((a, b) => sort === 'tier'
    ? Number(a.spell_rank || 0) - Number(b.spell_rank || 0) || colorRank(a) - colorRank(b)
    : colorRank(a) - colorRank(b) || Number(a.spell_rank || 0) - Number(b.spell_rank || 0));
}
function appendCastSpellGroups(host, cards, inspect, options = {}) {
  const sort = options.sort || spellPreferences.sort;
  const sorted = sortSpells(cards, sort);
  if (options.flat) {
    appendSpellGroup(host, '', sorted, inspect, !!options.grid, options);
    return;
  }
  const groups = new Map();
  for (const card of sorted) {
    const title = sort === 'color' ? spellColorName(card).toLowerCase()
      : Number(card.spell_rank || 0) === 0 ? 'Cantrips' : spellRankLabel(card).replace('Rank', options.rankLabels ? 'Rank' : 'Tier');
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push(card);
  }
  if (!sorted.length) appendSpellGroup(host, '', [], inspect, !!options.grid, options);
  else for (const [title, group] of groups) appendSpellGroup(host, title, group, inspect, !!options.grid, options);
}
export { spellTinyCard, spellRow, sortSpells, appendSpellGroup, appendCastSpellGroups, isSpellCard, knownSpells, spellColorName,
  spellFace, spellRankLabel, spellPreferences, setSpellPreference };
