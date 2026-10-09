import { dismiss } from './navigation.js';
import { componentProp } from './react.js';
import { q, uiState } from './runtime.js';
import { detailsPanel, on } from './ui.js';

// 5. Shared card presentation and upgrade values
// All text cards, compact rows, dots, and accents share this color vocabulary.
const cardColors = {
  RED: '#de6262',
  BLUE: '#67b1ef',
  GREEN: '#6abd7d',
  GOLD: '#e9c956',
  SILVER: '#c4c8ce',
  PURPLE: '#b799de',
};
const actionNames = {
  SKILL: 'Skill',
  DEFENSE_SKILL: 'Skill / Defense',
  ATTACK: 'Attack',
  DEFENSE: 'Defense',
  MOVEMENT: 'Movement',
  HOLD: 'Hold',
  FAST_TRAVEL: 'Fast travel',
  CLEAR: 'Clear',
};
// Build an icon with an optional overlaid value. Undefined/null means icon only;
// zero is still a value here. Callers decide whether a stat is relevant.
function cardSymbol(key, value) {
  const el = document.createElement('span');
  el.className = 'm2-symbol';
  el.title = actionNames[key] || key.toLowerCase();
  const img = document.createElement('img');
  img.src = '/icons/' + key.toLowerCase().replaceAll('_', '-') + '.png';
  img.alt = el.title;
  el.append(img);
  if (value !== undefined && value !== null) {
    const number = document.createElement('span');
    number.className = 'm2-symbol-value';
    number.textContent = String(value);
    el.append(number);
  }
  return el;
}
// Empty slots retain icon geometry without painting or announcing a fake stat.
function cardSymbolPlaceholder() {
  const slot = document.createElement('span');
  slot.className = 'm2-symbol m2-symbol-placeholder';
  slot.setAttribute('aria-hidden', 'true');
  return slot;
}
// Use the same coin drawing in full hero dashboards and compact Board summaries.
function goldSymbol(value) {
  const el = document.createElement('span');
  el.className = 'm2-gold';
  el.title = 'Gold';
  el.setAttribute('aria-label', 'Gold ' + value);
  el.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="6"/><path d="M14.5 8.5a6 6 0 1 1-6 6M9 6v6"/></svg>';
  const number = document.createElement('span');
  number.className = 'm2-gold-value';
  number.textContent = String(value);
  el.append(number);
  return el;
}
// Reserve attack, defense, initiative, and a three-icon utility stack everywhere.
// Utility items are boolean +1 upgrades; their icons intentionally have no numbers.
function itemUpgradeSymbols(items = {}, className = '') {
  const group = document.createElement('span');
  group.className = 'm2-item-upgrades ' + className;
  group.setAttribute('aria-label', 'Item upgrades');
  for (const stat of ['ATTACK', 'DEFENSE', 'INITIATIVE']) {
    const value = Number(items?.[stat]) || 0;
    const icon = cardSymbol(stat, value > 0 ? '+' + value : undefined);
    icon.dataset.stat = stat;
    icon.classList.toggle('m2-upgrade-empty', value <= 0);
    icon.title = stat.toLowerCase() + (value > 0 ? ' +' + value : ': no upgrade');
    group.append(icon);
  }
  const rest = document.createElement('span');
  rest.className = 'm2-upgrade-rest';
  for (const stat of ['MOVEMENT', 'RANGE', 'RADIUS']) {
    const value = Number(items?.[stat] ?? (stat === 'RADIUS' ? items?.AREA : 0)) || 0;
    const icon = cardSymbol(stat);
    icon.dataset.stat = stat;
    icon.classList.toggle('m2-upgrade-empty', value <= 0);
    icon.title = stat.toLowerCase() + (value > 0 ? ' +1' : ': no upgrade');
    rest.append(icon);
  }
  group.append(rest);
  return group;
}
function ultimateIndicator(hero, dot = false) {
  const unlocked = Number(hero?.level) >= 8;
  const marker = document.createElement('span');
  marker.className = 'm2-ultimate-indicator ' + (dot ? 'm2-ultimate-dot' : 'm2-nano-card');
  marker.classList.toggle('m2-ultimate-unlocked', unlocked);
  marker.title = unlocked ? 'Ultimate unlocked' : 'Ultimate unlocks at level 8';
  marker.setAttribute('aria-label', marker.title);
  marker.style.setProperty('--effect-color', cardColors.PURPLE);
  if (!dot) marker.textContent = 'U';
  return marker;
}
// Keep all tier cues consistent. Facedown/unknown cards use the basic edge so
// these decorative marks cannot reveal a tier from hidden component props.
function cardTierLines(card) {
  if (card?.is_facedown) return 1;
  return ({ II: 2, III: 3, 2: 2, 3: 3 })[String(card?.tier ?? '').toUpperCase()] || 1;
}
// Explicit translucent fills avoid context-dependent native button colors.
function setMicroColor(element, card) {
  const color = cardColors[String(card?.color || '').toUpperCase()] || '#858c98';
  element.style.setProperty('--card-color', color);
  element.style.setProperty('--m2-card-fill', color + '55');
  element.style.setProperty('--m2-card-muted', color + '22');
  element.dataset.tierLines = String(cardTierLines(card));
}
// Three fixed cells keep the miniature recognizable without a title or initiative.
// Facedown cards show only a colored back, never stats read from hidden props.
function miniatureCard(card, items = {}, includeDefense = false) {
  const mini = document.createElement('span');
  mini.className = 'm2-mini-current ' + (includeDefense ? 'm2-micro-hero' : 'm2-micro-board');
  mini.title = !card ? 'No current card' : card.is_facedown ? 'Current card (hidden)' : card.name;
  mini.setAttribute('aria-label', mini.title);
  setMicroColor(mini, card);
  if (!card || card.is_facedown) {
    mini.classList.add('m2-micro-hidden');
    mini.textContent = card ? '?' : '—';
    return mini;
  }
  const value = card.primary_action_value;
  const primary = card.primary_action
    ? upgradedSymbol(items, card.primary_action, value != null && String(value) !== '0' && String(value) !== '!' ? value : undefined)
    : document.createElement('span');
  const range = relevantStat(card, 'RANGE', card.range_value)
    ? upgradedSymbol(items, 'RANGE', card.range_value)
    : relevantStat(card, 'RADIUS', card.radius_value)
      ? upgradedSymbol(items, 'RADIUS', card.radius_value)
      : document.createElement('span');
  mini.append(primary, range);
  for (const stat of includeDefense ? ['MOVEMENT', 'DEFENSE'] : ['MOVEMENT']) {
    const value = card.secondary_actions?.[stat];
    mini.append(stat !== card.primary_action && relevantStat(card, stat, value)
      ? upgradedSymbol(items, stat, value) : document.createElement('span'));
  }
  return mini;
}
// Choosing a T2/T3 card earns the item printed on its same-color, same-tier
// alternative. Missing or ambiguous pairs must not invent an awarded item.
function cardGrantedItem(card, cards = []) {
  // Other heroes' masked decks contain only a count, not a known card catalog.
  if (!Array.isArray(cards)) return null;
  const tier = String(card?.tier).toUpperCase();
  if (card?.is_facedown || !['II', 'III', '2', '3'].includes(tier)) return null;
  const pair = cards.filter(candidate =>
    String(candidate.color).toUpperCase() === String(card.color).toUpperCase() &&
    String(candidate.tier).toUpperCase() === tier);
  const same = candidate => candidate === card ||
    (card.id != null && candidate.id === card.id);
  if (pair.length !== 2 || !pair.some(same)) return null;
  const alternative = pair.find(candidate => !same(candidate));
  return alternative && !alternative.is_facedown ? alternative.item || null : null;
}
// Six printed-stat slots: clear initiative/item caps around four colored stats.
// Ultimates use a compact three-cell Micro with a centered U instead.
function extendedMicroCard(card, grantedItem) {
  if (card && (card.color === 'PURPLE' || card.tier === 'IV')) {
    const mini = miniatureCard(card);
    mini.classList.add('m2-micro-ultimate');
    if (!card.is_facedown) {
      const marker = document.createElement('b');
      marker.className = 'm2-micro-ultimate-label';
      marker.textContent = 'U';
      mini.replaceChildren(document.createElement('span'), marker, document.createElement('span'));
    }
    return mini;
  }
  const extended = document.createElement('span');
  extended.className = 'm2-micro-extended';
  const visible = card && !card.is_facedown;
  extended.title = visible ? card.name : 'Hidden card';
  const initiative = document.createElement('span');
  initiative.className = 'm2-micro-cap';
  if (visible && card.initiative != null)
    initiative.append(cardSymbol('INITIATIVE', card.initiative));
  const upgrade = document.createElement('span');
  upgrade.className = 'm2-micro-cap m2-micro-grant';
  if (visible && grantedItem) {
    const stat = grantedItem === 'AREA' ? 'RADIUS' : grantedItem;
    upgrade.append(cardSymbol(stat, '+'));
    upgrade.title = 'Gives ' + stat.toLowerCase() + ' +1';
    upgrade.setAttribute('aria-label', upgrade.title);
  }
  const micro = miniatureCard(card, {}, true);
  micro.classList.add('m2-micro-tree');
  extended.append(initiative, micro, upgrade);
  return extended;
}
// Discards need only their defense stat. Hidden cards never expose icon values.
function nanoCard(card, items = {}) {
  const nano = document.createElement('span');
  nano.className = 'm2-nano-card';
  setMicroColor(nano, card);
  nano.title = card?.is_facedown ? 'Hidden card' : card?.name || 'Discard';
  if (card?.is_facedown) nano.textContent = '?';
  else {
    const value = card?.primary_action === 'DEFENSE'
      ? card.primary_action_value : card?.secondary_actions?.DEFENSE;
    if (relevantStat(card || {}, 'DEFENSE', value))
      nano.append(upgradedSymbol(items, 'DEFENSE', value));
  }
  return nano;
}
// The deployed renderer's vocabulary uses token_NAME and marker_NAME asset paths.
// Keep an allowlist: unknown markup stays readable instead of producing broken images.
const inlineRuleIcons = {
  life_counter: '/icons/life_counters.png',
  ...Object.fromEntries(['smoke_bomb', 'grenade', 'blast', 'dud', 'zombie', 'ice',
    'totem', 'barrier', 'tree', 'glitch', 'illusion', 'magma', 'rock', 'familiar']
    .map(name => [name + '_token', '/icons/token_' + name + '.png'])),
  ...Object.fromEntries(['poison', 'bounty']
    .map(name => [name + '_marker', '/icons/marker_' + name + '.png'])),
  ...Object.fromEntries(['axe', 'bird', 'anvil', 'horn'].flatMap(name => [
    ['rune_' + name, '/icons/rune_' + name + '.png'],
    ['rune_' + name + '_marker', '/cards/sheets/rune_' + name + '_marker.png'],
  ])),
};
function appendRulesText(effect, text, symbol) {
  for (const part of String(text || '').split(/(:[a-z_]+:)/g)) {
    const key = /^:([a-z_]+):$/.exec(part)?.[1];
    if (key && /^(attack|defense|movement|range|radius|initiative)$/.test(key))
      effect.append(symbol(key.toUpperCase()));
    else if (inlineRuleIcons[key]) {
      const img = document.createElement('img');
      img.className = 'm2-rule-icon';
      img.src = inlineRuleIcons[key];
      img.alt = key.replaceAll('_', ' ');
      img.title = img.alt;
      effect.append(img);
    } else effect.append(document.createTextNode(part));
  }
}
// Suppress placeholder zeros, but preserve open-ended values and zeros explicitly
// mentioned in rules text. This is presentation filtering, not rules evaluation.
function relevantStat(card, key, value) {
  if (value == null) return false;
  if (String(value).endsWith('+')) return true;
  if (Number(value) > 0) return true;
  if (Number(value) !== 0) return false;
  const word = key.toLowerCase();
  return new RegExp('(?:' + word + '[^.\\n]{0,16}\\b0\\b|\\b0\\s+' + word + ')', 'i').test(
    card.effect_text || '',
  );
}
// Prefer the owning component’s hero. Otherwise match card identity against known
// hero card collections; do not infer ownership merely from a card’s name or color.
function cardHero(card, source) {
  const direct = source && componentProp(source, 'hero');
  if (direct?.id || direct?.items) return direct;
  for (const box of document.querySelectorAll('[data-m2="hero"]')) {
    const hero = componentProp(box, 'hero');
    if (!hero) continue;
    const cards = [
      hero.current_turn_card,
      hero.ultimate_card,
      ...['hand', 'played_cards', 'discard_pile', 'deck', 'cast_spells'].flatMap((key) =>
        Array.isArray(hero[key]) ? hero[key] : [],
      ),
    ];
    if (
      cards.some(
        (candidate) => candidate && (candidate === card || (card.id && candidate.id === card.id)),
      )
    )
      return hero;
  }
  return null;
}
// Ownership is shared with the artwork lookup; printed card props stay unchanged.
function cardUpgrades(card, source) {
  return cardHero(card, source)?.items || {};
}
// Use the original artwork layer that the site's card painter reads, rather than
// rasterizing its printed text/icons. CSS crops this image for every Large shape.
// Explicit ownership also covers upgrade choices not yet present in a hero's deck.
function appendCardArtwork(box, card, source, heroId) {
  if (card.is_facedown || !card.image_id) return;
  const id = heroId || cardHero(card, source)?.id;
  if (typeof id !== 'string') return;
  const slug = id.toLowerCase().replace(/^hero_/, '');
  const imageId = String(card.image_id);
  // Only asset path segments are accepted: never infer an external image URL.
  if (!/^[a-z0-9_-]+$/.test(slug) || !/^[a-zA-Z0-9_-]+$/.test(imageId)) return;
  const art = document.createElement('div');
  art.className = 'm2-card-art';
  art.setAttribute('aria-hidden', 'true');
  const image = document.createElement('img');
  image.alt = '';
  image.decoding = 'async';
  image.loading = 'lazy';
  // Plain cards remain the fallback while loading or when artwork is unavailable.
  image.onload = () => { if (!uiState.dead) box.classList.add('m2-has-art'); };
  image.onerror = () => {
    box.classList.remove('m2-has-art');
    art.remove();
  };
  const url = '/cards/backgrounds/' + slug + '/' + imageId + '.webp';
  // One crop spans the complete card. Bars blur this layer in place rather
  // than drawing their own copy, so artwork stays aligned across each seam.
  image.src = url;
  art.append(image);
  box.append(art);
}
// Return null when a value cannot safely be adjusted. Only unsigned integer values
// with an optional trailing + are supported; other printed notation stays intact.
function upgradeValue(key, value, items) {
  const stat = key === 'DEFENSE_SKILL' ? 'DEFENSE' : key;
  const bonus = items[stat] ?? (stat === 'RADIUS' ? items.AREA : 0);
  if (typeof bonus !== 'number' || !Number.isFinite(bonus) || !bonus || value == null)
    return null;
  const match = String(value).match(/^(\d+)(\+?)$/);
  if (!match) return null;
  return String(Number(match[1]) + bonus) + match[2];
}
// Only modified numbers get the purple class; the tooltip explains base plus bonus.
function upgradedSymbol(items, key, value) {
  const modified = upgradeValue(key, value, items);
  const symbol = cardSymbol(key, modified === null ? value : undefined);
  if (modified !== null) {
    const number = document.createElement('span');
    number.className = 'm2-symbol-value m2-upgraded-value';
    number.textContent = modified;
    number.title =
      'Base ' + value + '; upgrade ' + (Number.parseFloat(modified) - Number.parseFloat(value));
    symbol.append(number);
  }
  return symbol;
}

// Native controls can change while the card and its artwork stay unchanged.
// Reconcile their labels, availability and identity independently of card rendering.
function syncHandActions(foot, card, tip, items) {
  const sec = card.secondary_actions || {};
  const original = tip
    ? Array.from(tip.querySelectorAll('button')).filter((b) => !b.closest('.m2-text-card'))
    : [];
  const key = JSON.stringify([items, sec, card.effect_text,
    original.map(source => [source.textContent, source.disabled])]);
  if (foot._actionKey === key && foot._actionSources?.length === original.length &&
      foot._actionSources.every((source, i) => source === original[i])) return;
  foot._actionKey = key;
  foot._actionSources = original;
  const dismissButton = q('.m2-card-dismiss', foot);
  foot.replaceChildren();
  if (original.length) {
    for (const src of original) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = src.textContent;
      b.disabled = src.disabled;
      const key = Object.keys(actionNames).find((k) =>
        b.textContent.toLowerCase().includes(actionNames[k].toLowerCase()),
      );
      b.dataset.action = key || '';
      if (key) {
        const raw = b.textContent.match(/\d+\+?/);
        const value = raw && upgradeValue(key, raw[0], items);
        if (value !== null && value !== false) {
          if (raw) {
            const parts = b.textContent.split(raw[0]);
            b.textContent = parts[0];
            const num = document.createElement('span');
            num.className = 'm2-upgraded-value';
            num.textContent = value;
            b.append(num, document.createTextNode(parts.slice(1).join(raw[0])));
          }
        }
      }
      on(b, 'click', (e) => {
        e.stopPropagation();
        if (src.isConnected && !src.disabled) src.click();
      });
      foot.append(b);
    }
  } else
    for (const [key, value] of Object.entries(sec)) {
      if (['MOVEMENT', 'DEFENSE', 'ATTACK'].includes(key) && !relevantStat(card, key, value))
        continue;
      const badge = document.createElement('span');
      badge.className = 'm2-action';
      badge.dataset.action = key;
      badge.textContent =
        (actionNames[key] || key) +
        (!['HOLD', 'CLEAR', 'FAST_TRAVEL'].includes(key) ? ' ' + value : '');
      const changed = upgradeValue(key, value, items);
      if (changed !== null && ['MOVEMENT', 'DEFENSE', 'ATTACK'].includes(key)) {
        badge.textContent = (actionNames[key] || key) + ' ';
        const num = document.createElement('span');
        num.className = 'm2-upgraded-value';
        num.textContent = changed;
        badge.append(num);
      }
      foot.append(badge);
    }
  if (dismissButton) foot.append(dismissButton);
}

// Shared readable card renderer. Deck shows printed values; Hand and Heroes apply known upgrades.
// Hand actions proxy native controls so the website remains responsible for game rules.
function textCard(card, context, tip, heroId, grantedItem) {
  const items = context === 'deck' ? {} : cardUpgrades(card);
  const symbol = (key, value) => upgradedSymbol(items, key, value);
  const ultimate = card.tier === 'IV' || card.color === 'PURPLE';
  const box = document.createElement('article');
  box.className = 'm2-text-card';
  appendCardArtwork(box, card, tip, heroId);
  box.style.setProperty('--card-color', cardColors[card.color] || '#bfc7d2');
  const top = document.createElement('header');
  top.className = 'm2-card-top';
  const name = document.createElement('b');
  name.textContent = card.name;
  const tier = document.createElement('span');
  tier.textContent = ['I', 'II', 'III', 'IV'].includes(card.tier) ? card.tier : '';
  top.append(
    ultimate ? cardSymbolPlaceholder() : symbol('INITIATIVE', card.initiative),
    name,
    tier,
  );
  const body = document.createElement('div');
  body.className = 'm2-card-body';
  const side = document.createElement('aside');
  const sec = card.secondary_actions || {};
  for (const key of ['MOVEMENT', 'DEFENSE', 'ATTACK'])
    if (key !== card.primary_action && relevantStat(card, key, sec[key]))
      side.append(symbol(key, sec[key]));
  const main = document.createElement('div'),
    head = document.createElement('div');
  head.className = 'm2-card-type';
  const basic =
    ['GOLD', 'SILVER'].includes(card.color) && ['ATTACK', 'SKILL'].includes(card.primary_action);
  let label =
    (basic ? 'Basic ' : '') + (actionNames[card.primary_action] || card.primary_action || '');
  if (
    ['SKILL', 'DEFENSE_SKILL', 'ATTACK'].includes(card.primary_action) &&
    (card.is_ranged || relevantStat(card, 'RANGE', card.range_value))
  )
    label += ' • Ranged';
  if (ultimate) label = 'Ultimate';
  const val = card.primary_action_value;
  const primary = symbol(
    card.primary_action || 'SKILL',
    val != null && String(val) !== '0' && String(val) !== '!' ? val : undefined,
  );
  const title = document.createElement('b');
  title.textContent = label;
  head.append(ultimate ? document.createElement('span') : primary, title);
  if (relevantStat(card, 'RANGE', card.range_value))
    head.append(symbol('RANGE', card.range_value));
  else if (relevantStat(card, 'RADIUS', card.radius_value))
    head.append(symbol('RADIUS', card.radius_value));
  const effect = document.createElement('div');
  effect.className = 'm2-card-effect';
  appendRulesText(effect, card.effect_text, symbol);
  main.append(head, effect);
  body.append(side, main);
  const foot = document.createElement('footer');
  foot.className = 'm2-card-foot';
  if (context === 'deck' || context === 'hero') {
    foot.append(card.item
      ? symbol(card.item === 'AREA' ? 'RADIUS' : card.item)
      : cardSymbolPlaceholder());
    if (grantedItem === undefined)
      grantedItem = cardGrantedItem(card, cardHero(card, tip)?.deck || []);
    if (grantedItem && !card.is_facedown) {
      foot.classList.add('m2-upgrade-footer');
      const gain = document.createElement('span');
      gain.className = 'm2-upgrade-gain';
      gain.append(document.createTextNode('Gives '),
        cardSymbol(grantedItem === 'AREA' ? 'RADIUS' : grantedItem, '+'));
      foot.append(gain);
      foot.title = 'Choosing this gains ' + grantedItem.toLowerCase() + ' +1';
      foot.setAttribute('aria-label', foot.title);
    }
  } else syncHandActions(foot, card, tip, items);
  box.append(top, body, foot);
  if (context === 'hand') {
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'm2-card-dismiss';
    x.textContent = '×';
    x.setAttribute('aria-label', 'Hide card details');
    on(x, 'click', (e) => {
      e.stopPropagation();
      uiState.hiddenCardKey = JSON.stringify(card);
      dismiss();
      detailsPanel.replaceChildren();
    });
    foot.append(x);
    foot.classList.add('m2-has-dismiss');
  }
  return box;
}

export {
  appendCardArtwork,
  cardColors,
  cardGrantedItem,
  cardHero,
  cardSymbol,
  cardTierLines,
  cardUpgrades,
  extendedMicroCard,
  goldSymbol,
  itemUpgradeSymbols,
  miniatureCard,
  nanoCard,
  relevantStat,
  syncHandActions,
  textCard,
  ultimateIndicator,
  upgradedSymbol,
};
