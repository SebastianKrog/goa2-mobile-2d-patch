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
  return rank === 0 ? 'Cantrip' : 'Rank ' + (['', 'I', 'II', 'III'][rank] || rank);
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
// The same readable spell rows serve the public cast list and the owner's Deck.
function appendSpellGroup(host, title, cards, inspect, grid = false) {
  const group = document.createElement('section');
  group.className = 'm2-spell-group';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const list = document.createElement('div');
  list.className = 'm2-spell-list' + (grid ? ' m2-spell-grid' : '');
  for (const card of cards) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'm2-spell-row';
    button.dataset.color = spellColorName(card);
    button.setAttribute('aria-label', 'View ' + card.name + ' — ' + spellRankLabel(card));
    if (grid) button.append(spellFace(card));
    else {
      const name = document.createElement('b'), rank = document.createElement('span');
      name.textContent = card.name;
      rank.textContent = spellRankLabel(card);
      button.append(name, rank);
    }
    button.onclick = () => inspect(card);
    list.append(button);
  }
  group.append(heading, list);
  if (!cards.length) {
    const empty = document.createElement('p');
    empty.className = 'm2-spells-empty';
    empty.textContent = 'No spells cast.';
    group.append(empty);
  }
  host.append(group);
}
export { appendSpellGroup, isSpellCard, knownSpells, spellColorName, spellFace, spellRankLabel };
