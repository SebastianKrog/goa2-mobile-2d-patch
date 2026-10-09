import { cardColors, cardGrantedItem, extendedMicroCard, itemUpgradeSymbols } from './cards.js';
import { compareDeckTreeCards, deckCardIdentity } from './tree-model.js';
import { on } from './ui.js';

// Shared tree presentation. Callers retain their own selection policies.
function createTreeView(label) {
  const tree = document.createElement('div');
  tree.className = 'm2-deck-tree';
  tree.setAttribute('aria-label', label);
  const headings = document.createElement('div');
  headings.className = 'm2-tree-headings';
  for (const tier of [1, 2, 3]) {
    const heading = document.createElement('b');
    heading.textContent = 'Tier ' + tier;
    headings.append(heading);
  }
  tree.append(headings);
  return { tree, headings };
}

function createTreeCard(card, catalog, selectCard) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'm2-deck-card m2-tree-card';
  button.dataset.cardId = deckCardIdentity(card);
  button.classList.toggle('m2-tree-ultimate', card.color === 'PURPLE' || card.tier === 'IV');
  button.append(extendedMicroCard(card, cardGrantedItem(card, catalog)));
  on(button, 'click', () => selectCard(card));
  return button;
}

// Own only printed geometry. A/B order and click/selection rules come from callers.
function appendTreePath(tree, color, tiers, makeButton, compareCards = compareDeckTreeCards) {
  const section = document.createElement('section');
  section.className = 'm2-tree-color';
  section.style.setProperty('--path-color', cardColors[color] || '#858c98');
  section.setAttribute('aria-label', color.toLowerCase() + ' upgrade path');
  const path = document.createElement('div');
  path.className = 'm2-tree-path';
  const starts = tiers.get(1)?.length || 0;
  const rows = Math.max(2, ...[...tiers].filter(([tier]) => tier !== 1).map(([, choices]) => choices.length));
  const firstPair = starts + 1;
  path.style.gridTemplateRows = `repeat(${starts + rows}, 28px)`;
  for (const [tier, choices] of tiers) {
    [...choices].sort(compareCards).forEach((card, index) => {
      const button = makeButton(card);
      button.dataset.tier = String(tier);
      button.dataset.variant = index ? 'alternate' : 'standard';
      button.style.gridColumn = tier === 3 ? '3' : tier === 2 ? '1 / span 2' : '1';
      button.style.justifySelf = tier === 2 ? 'end' : 'start';
      button.style.gridRow = String(tier === 1 ? index + 1 : firstPair + index);
      path.append(button);
    });
  }
  // Connect only the exposed space between cards, including faded alternatives.
  const pairs = Math.min(tiers.get(2)?.length || 0, tiers.get(3)?.length || 0);
  const rowCenter = index => (firstPair + index - 1) * 32 + 14;
  const addLine = (className, top) => {
    const line = document.createElement('span');
    line.className = className;
    line.setAttribute('aria-hidden', 'true');
    if (top != null) line.style.top = top + 'px';
    path.append(line);
    return line;
  };
  for (let index = 0; index < pairs; index++)
    addLine('m2-tree-link', rowCenter(index));
  const branches = tiers.get(2)?.length || 0;
  if (starts === 1 && branches) {
    // The responsive branch rises straight into Tier 1's bottom edge.
    // Its horizontal position stays within Tier 1 and outside the Tier 2 cards.
    const fork = addLine('m2-tree-fork');
    fork.style.height = rowCenter(branches - 1) - 28 + 'px';
    for (let index = 0; index < branches; index++)
      addLine('m2-tree-branch-link', rowCenter(index));
  }
  section.append(path);
  tree.append(section);
}

function deckTreeItemTotals(actual, future) {
  const totals = itemUpgradeSymbols(actual, 'm2-tree-build-stats');
  for (const icon of totals.querySelectorAll('[data-stat]')) {
    const stat = icon.dataset.stat;
    const current = Number(actual[stat] ?? (stat === 'RADIUS' ? actual.AREA : 0)) || 0;
    const planned = future[stat] || 0,
      total = current + planned;
    icon.dataset.current = String(current);
    icon.dataset.planned = String(planned);
    icon.dataset.total = String(total);
    icon.classList.toggle('m2-upgrade-empty', total === 0);
    icon.classList.toggle('m2-build-current', current > 0 && planned === 0);
    icon.classList.toggle('m2-build-future', planned > 0);
    if (['ATTACK', 'DEFENSE', 'INITIATIVE'].includes(stat) && total > 0) {
      let value = icon.querySelector('.m2-symbol-value');
      if (!value) {
        value = document.createElement('span');
        value.className = 'm2-symbol-value';
        icon.append(value);
      }
      value.textContent = '+' + total;
    }
    icon.title = `${stat.toLowerCase()}: +${total} total (${current} acquired, ${planned} planned)`;
    icon.setAttribute('aria-label', icon.title);
  }
  return totals;
}

export { appendTreePath, createTreeCard, createTreeView, deckTreeItemTotals };
