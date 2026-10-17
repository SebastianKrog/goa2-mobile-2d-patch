import { cardColors } from './cards.js';
import { spellColorName } from './spells.js';

// Marker targets can name a hero or an owned piece. Rune state is deliberately
// excluded here until Snorri receives his own presentation.
function heroIndicators(hero, view) {
  if (!hero) return [];
  const indicators = [];
  if (hero.spellbook != null || /^(?:hero_)?gydion$/i.test(hero.id || hero.name || ''))
    indicators.push({ type: 'spells', count: hero.cast_spells?.length || 0,
      colors: (hero.cast_spells || []).map(spell => cardColors[spellColorName(spell)] || '#c4c8ce') });
  for (const [type, marker] of Object.entries(view?.markers || {})) {
    if (!['bounty', 'poison'].includes(type.toLowerCase()) || !marker) continue;
    const piece = view?.hero_pieces?.[marker.target_id] ||
      Object.values(view?.hero_pieces || {}).find(piece => piece.id === marker.target_id);
    if (marker.target_id !== hero.id && piece?.owner_hero_id !== hero.id) continue;
    indicators.push({ type: type.toLowerCase() });
  }
  return indicators;
}
const dicePips = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8], [0, 2, 3, 4, 5, 6, 8], [0, 1, 2, 3, 5, 6, 7, 8], [0, 1, 2, 3, 4, 5, 6, 7, 8]];
function indicatorLabel(indicator) {
  return indicator.type === 'spells' ? 'Spells cast: ' + indicator.count
    : indicator.type === 'bounty' ? 'Bounty' : 'Poison';
}
function renderHeroIndicators(indicators, compact, openSpells) {
  const host = document.createElement('span');
  host.className = compact ? 'm2-summary-indicators' : 'm2-hero-indicators';
  if (compact && indicators.length > 1) {
    const count = document.createElement('span');
    count.className = 'm2-indicator-total';
    count.textContent = String(indicators.length);
    count.title = indicators.map(indicatorLabel).join(' · ');
    count.setAttribute('aria-label', count.title);
    host.append(count);
    return host;
  }
  for (const indicator of indicators) {
    const spells = indicator.type === 'spells';
    const node = document.createElement(spells ? 'button' : 'span');
    node.className = 'm2-hero-indicator m2-indicator-' + indicator.type;
    node.title = indicatorLabel(indicator);
    node.setAttribute('aria-label', node.title);
    if (spells) {
      node.type = 'button';
      node.onclick = event => { event.stopPropagation(); openSpells(); };
      const img = document.createElement('img');
      img.src = '/hero-images/gydion.webp';
      img.alt = '';
      node.append(img);
      if (compact || indicator.count === 0 || indicator.count > 9) {
        const number = document.createElement('b');
        number.textContent = String(indicator.count);
        node.append(number);
      } else {
        const pips = document.createElement('span');
        pips.className = 'm2-spell-pips';
        pips.setAttribute('aria-hidden', 'true');
        indicator.colors.forEach((color, index) => {
          const dot = document.createElement('i');
          const cell = dicePips[indicator.count][index];
          dot.style.gridColumn = String(cell % 3 + 1);
          dot.style.gridRow = String(Math.floor(cell / 3) + 1);
          dot.style.backgroundColor = color;
          pips.append(dot);
        });
        node.append(pips);
      }
    } else node.textContent = compact ? indicator.type[0].toUpperCase() : indicatorLabel(indicator);
    host.append(node);
  }
  return host;
}
export { heroIndicators, renderHeroIndicators };
