import { trackCardSource } from './card-highlight.js';
import {
  appendCardArtwork,
  cardColors,
  cardHero,
  cardTierLines,
  cardUpgrades,
  relevantStat,
  upgradedSymbol,
} from './cards.js';
import { renderedCard } from './deck.js';
import { c, q } from './runtime.js';
import { addExtra } from './ui.js';

function updateCardRow(row, card, knownItems) {
  const items = knownItems || cardUpgrades(card, row);
  const symbol = (key, value) => upgradedSymbol(items, key, value);
  // Only Hand's Small rows get this artwork treatment. Hero/Deck Mini rows
  // share the renderer but keep their existing compact presentation.
  const small = !!row.closest('[data-m2="hand-list"]');
  if (small) trackCardSource(row, card, 'hand');
  const owner = small ? cardHero(card, row)?.id : null;
  const key = JSON.stringify([card, items, small, owner]);
  let view = q(':scope>.m2-list-card', row);
  // React replaces className when selection changes, even if card props are unchanged.
  if (!row.classList.contains('m2-adapted-row')) row.classList.add('m2-adapted-row');
  if (view?.dataset.key === key) return;
  if (!view) {
    view = document.createElement('span');
    view.className = 'm2-list-card';
    row.append(view);
    addExtra(view);
  }
  view.dataset.key = key;
  view.classList.toggle('m2-small-card', small);
  view.classList.toggle('m2-mini-card', !small);
  view.replaceChildren();
  row.classList.add('m2-adapted-row');
  const ultimate = card.tier === 'IV' || card.color === 'PURPLE';
  const initiative = ultimate
    ? document.createElement('span')
    : symbol('INITIATIVE', card.initiative);
  if (ultimate || card.initiative == null) {
    initiative.replaceChildren();
    initiative.classList.add('m2-symbol');
    initiative.setAttribute('aria-hidden', 'true');
  }
  const band = document.createElement('span');
  band.className = 'm2-list-band';
  band.style.setProperty('--card-color', cardColors[card.color] || '#bbc3cf');
  // Small and Mini rows share stripe counts. Each size reserves its own
  // three-stripe gutter so basic and tiered cards keep their icons aligned.
  band.style.setProperty('--m2-tier-lines', String(cardTierLines(card)));
  const value = card.primary_action_value;
  if (!ultimate && card.primary_action) {
    const primary = symbol(
      card.primary_action,
      value != null && String(value) !== '0' && String(value) !== '!' ? value : undefined,
    );
    primary.classList.add('m2-list-primary');
    band.append(primary);
  }
  const name = document.createElement('span');
  name.className = 'm2-list-name';
  name.textContent = card.name;
  band.append(name);
  const utility = relevantStat(card, 'RANGE', card.range_value)
    ? symbol('RANGE', card.range_value)
    : relevantStat(card, 'RADIUS', card.radius_value) ? symbol('RADIUS', card.radius_value) : null;
  if (utility) {
    utility.classList.add('m2-list-utility');
    band.append(utility);
  }
  const secondary = document.createElement('span');
  secondary.className = 'm2-list-secondary';
  for (const stat of ['MOVEMENT', 'DEFENSE', 'ATTACK']) {
    const v = card.secondary_actions?.[stat];
    if (stat !== card.primary_action && relevantStat(card, stat, v))
      secondary.append(symbol(stat, v));
  }
  view.append(initiative, band, secondary);
  // Art lives inside the central band, leaving initiative and secondary stats
  // untouched. The owning hero must be known; hidden cards keep the plain fill.
  if (small) appendCardArtwork(band, card, row, owner);
  band.title = card.name;
}
// Synthesize the own-hero hand dots from visible hand cards to match other heroes.
function updateOwnColors(sidebar) {
  const own = q('[data-m2="hero"]:not([data-m2-other])', sidebar),
    details = own && q(c('details'), own);
  if (!details) return;
  const hand = q('[data-m2="hand-list"]', sidebar);
  if (!hand) return;
  const colors = Array.from(hand.querySelectorAll(c('row')))
    .map(renderedCard)
    .filter(Boolean)
    .map((card) => card.color);
  let dots = q('.m2-own-colors', details);
  if (!dots) {
    dots = document.createElement('span');
    dots.className = 'm2-own-colors';
    details.prepend(dots);
    addExtra(dots);
  }
  const key = JSON.stringify(colors);
  if (dots.dataset.key === key) return;
  dots.dataset.key = key;
  dots.replaceChildren(
    ...['SILVER', 'GOLD', 'RED', 'BLUE', 'GREEN', 'PURPLE']
      .filter((color) => colors.includes(color))
      .map((color) => {
        const dot = document.createElement('i');
        dot.style.backgroundColor = cardColors[color];
        dot.title = color;
        return dot;
      }),
  );
}
// One overview row contains status, identity, resources, piles, current card, and
// upgrades. Full labels remain available to assistive technology and on hover.
// Render a separate focus entry so React retains ownership of its original hero.

export { updateCardRow, updateOwnColors };
