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
// Use the same coin drawing in full hero dashboards and compact Board summaries.
function goldSymbol(value) {
  const el = document.createElement('span');
  el.className = 'm2-gold';
  el.title = 'Gold';
  el.setAttribute('aria-label', 'Gold ' + value);
  el.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="6"/><path d="M14.5 8.5a6 6 0 1 1-6 6M9 6v6"/></svg>';
  el.append(document.createTextNode(String(value)));
  return el;
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
function cardUpgrades(card, source) {
  const direct = source && componentProp(source, 'hero');
  if (direct?.items) return direct.items;
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
      return hero.items || {};
  }
  return {};
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

// Shared readable card renderer. Deck shows printed values; Hand and Heroes apply known upgrades.
// Hand actions proxy native controls so the website remains responsible for game rules.
function textCard(card, context, tip) {
  const items = context === 'deck' ? {} : cardUpgrades(card);
  const symbol = (key, value) => upgradedSymbol(items, key, value);
  const ultimate = card.tier === 'IV' || card.color === 'PURPLE';
  const box = document.createElement('article');
  box.className = 'm2-text-card';
  box.style.setProperty('--card-color', cardColors[card.color] || '#bfc7d2');
  const top = document.createElement('header');
  top.className = 'm2-card-top';
  const name = document.createElement('b');
  name.textContent = card.name;
  const tier = document.createElement('span');
  tier.textContent = ['I', 'II', 'III', 'IV'].includes(card.tier) ? card.tier : '';
  top.append(
    ultimate ? document.createElement('span') : symbol('INITIATIVE', card.initiative),
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
  const parts = String(card.effect_text || '').split(/(:[a-z_]+:)/g);
  for (const part of parts) {
    if (/^:(attack|defense|movement|range|radius|initiative):$/.test(part))
      effect.append(symbol(part.slice(1, -1).toUpperCase()));
    else effect.append(document.createTextNode(part));
  }
  main.append(head, effect);
  body.append(side, main);
  const foot = document.createElement('footer');
  foot.className = 'm2-card-foot';
  if (context === 'deck' || context === 'hero') {
    if (card.item) {
      foot.append(symbol(card.item === 'AREA' ? 'RADIUS' : card.item));
    }
  } else {
    const original = tip
      ? Array.from(tip.querySelectorAll('button')).filter((b) => !b.closest('.m2-text-card'))
      : [];
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
          src.click();
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
  }
  box.append(top, body, foot);
  if (context === 'hand') {
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'm2-card-dismiss';
    x.textContent = '×';
    x.setAttribute('aria-label', 'Hide card details');
    on(x, 'click', (e) => {
      e.stopPropagation();
      hiddenCardKey = JSON.stringify(card);
      dismiss();
      detailsPanel.replaceChildren();
    });
    foot.append(x);
    foot.classList.add('m2-has-dismiss');
  }
  return box;
}
