// Deck build planning stays separate from native upgrade selection. Keep plans
// through Deck close/reopen, scoped to both the game and the viewed hero.
const deckTreeBuilds = new Map();
function deckCardIdentity(card) {
  return card?.id || JSON.stringify([card?.color, card?.tier, card?.name]);
}
function deckTreeTier(card) {
  return { I: 1, II: 2, III: 3, 1: 1, 2: 2, 3: 3 }[String(card?.tier).toUpperCase()] || 0;
}
function deckTreeGroup(card) {
  return String(card.color).toUpperCase() + ':' + deckTreeTier(card);
}
function deckTreePool(hero) {
  return [
    ...(hero?.hand || []),
    ...(hero?.discard_pile || []),
    ...(hero?.played_cards || []),
    ...(hero?.cast_spells || []),
    hero?.current_turn_card,
    hero?.extra_turn_card,
    Number(hero?.level) >= 8 ? hero?.ultimate_card : null,
  ].filter((card) => card && (!card.is_facedown || card.primary_action));
}
function deckTreeBuild(hero, cards = []) {
  const owner = hero?.id || hero?.name || cards.map(deckCardIdentity).join('|');
  const key = JSON.stringify([location.pathname, owner]);
  let build = deckTreeBuilds.get(key);
  if (!build) {
    build = {
      planned: new Map(),
      chosen: new Map(),
      level: hero?.level,
      storageKey: 'goa2-mobile-build:' + key,
      saved: '',
    };
    try {
      const saved = JSON.parse(localStorage.getItem(build.storageKey) || '{}');
      const valid = (entries) =>
        Array.isArray(entries)
          ? entries
              .slice(0, 64)
              .filter(
                (entry) =>
                  Array.isArray(entry) &&
                  entry.length === 2 &&
                  /^[A-Z]+:[23]$/.test(entry[0]) &&
                  ['string', 'number'].includes(typeof entry[1]),
              )
          : [];
      build.planned = new Map(valid(saved.planned));
      build.chosen = new Map(valid(saved.chosen));
      if (typeof saved.level === 'number') build.level = saved.level;
    } catch {}
    deckTreeBuilds.set(key, build);
    if (deckTreeBuilds.size > 32) deckTreeBuilds.delete(deckTreeBuilds.keys().next().value);
  }
  // A rollback to a lower level must not retain observations from the future.
  if (hero?.level != null && build.level != null && hero.level < build.level) build.chosen.clear();
  build.level = hero?.level;
  return build;
}
function saveDeckTreeBuild(build) {
  const saved = JSON.stringify({
    planned: [...build.planned],
    chosen: [...build.chosen],
    level: build.level,
  });
  if (saved === build.saved) return;
  try {
    localStorage.setItem(build.storageKey, saved);
    build.saved = saved;
  } catch {}
}
function rememberDeckTreeChoices(hero, cards = hero?.deck || []) {
  if (!hero || !Array.isArray(cards)) return;
  const build = deckTreeBuild(hero, cards);
  const catalog = new Map(cards.map((card) => [deckCardIdentity(card), card]));
  const owned = deckTreePool(hero);
  const choices = new Map();
  for (const card of owned) {
    // Deck details are public, but a hidden hand placeholder is not evidence of
    // which upgrade was taken. Observe only identities supplied with real details.
    if (card.is_facedown && !card.primary_action) continue;
    const known = catalog.get(deckCardIdentity(card));
    if (!known || deckTreeTier(known) < 2) continue;
    const group = deckTreeGroup(known);
    if (!choices.has(group)) choices.set(group, new Set());
    choices.get(group).add(deckCardIdentity(known));
  }
  for (const [group, ids] of choices) {
    if (ids.size !== 1) continue;
    build.chosen.set(group, [...ids][0]);
    build.planned.delete(group);
  }
  // Previously observed choices remain known when a later-tier card replaces
  // them. A native option becoming eligible again is evidence of an undo.
  for (const option of currentUpgradeRequest()?.players?.[hero.id]?.options || []) {
    const group =
      String(option.color).toUpperCase() +
      ':' +
      ({ II: 2, III: 3, 2: 2, 3: 3 }[String(option.tier).toUpperCase()] || 0);
    if (!choices.has(group)) build.chosen.delete(group);
  }
  saveDeckTreeBuild(build);
}
function renderDeckTree(host, entries, hero, selectCard) {
  const cards = entries.map((entry) => entry.card);
  const build = deckTreeBuild(hero, cards);
  const catalog = new Map(cards.map((card) => [deckCardIdentity(card), card]));
  for (const map of [build.planned, build.chosen])
    for (const [group, id] of map)
      if (!catalog.has(id) || deckTreeGroup(catalog.get(id)) !== group) map.delete(group);
  const order = new Map(
    (hero?.deck || cards).map((card, index) => [deckCardIdentity(card), index]),
  );
  const colors = ['RED', 'BLUE', 'GREEN', 'GOLD', 'SILVER', 'PURPLE'];
  const paths = new Map(),
    basics = [];
  for (const card of cards) {
    if (!deckTreeTier(card) || ['GOLD', 'SILVER', 'PURPLE'].includes(card.color)) {
      basics.push(card);
      continue;
    }
    const color = String(card.color || 'Other').toUpperCase();
    if (!paths.has(color)) paths.set(color, new Map());
    const tiers = paths.get(color),
      tier = deckTreeTier(card);
    if (!tiers.has(tier)) tiers.set(tier, []);
    tiers.get(tier).push(card);
  }
  const tree = document.createElement('div');
  tree.className = 'm2-deck-tree';
  tree.setAttribute('aria-label', 'Deck upgrade paths');
  const headings = document.createElement('div');
  headings.className = 'm2-tree-headings';
  for (const tier of ['Tier 1', 'Tier 2', 'Tier 3']) {
    const label = document.createElement('b');
    label.textContent = tier;
    headings.append(label);
  }
  host.append(tree);
  tree.append(headings);
  const buttons = [];
  function makeButton(card) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'm2-deck-card m2-tree-card';
    button.dataset.cardId = deckCardIdentity(card);
    button.append(extendedMicroCard(card, cardGrantedItem(card, cards)));
    buttons.push({ card, button });
    on(button, 'click', () => {
      const group = deckTreeGroup(card);
      if (deckTreeTier(card) >= 2 && !build.chosen.has(group))
        build.planned.set(group, deckCardIdentity(card));
      selectCard(card);
      updateBuild();
    });
    return button;
  }
  for (const [color, tiers] of [...paths].sort(([a], [b]) => {
    const rank = (c) => (colors.indexOf(c) < 0 ? 99 : colors.indexOf(c));
    return rank(a) - rank(b) || a.localeCompare(b);
  })) {
    const section = document.createElement('section');
    section.className = 'm2-tree-color';
    section.style.setProperty('--path-color', cardColors[color] || '#858c98');
    section.setAttribute('aria-label', color.toLowerCase() + ' upgrade path');
    const path = document.createElement('div');
    path.className = 'm2-tree-path';
    const rows = Math.max(2, ...[...tiers.values()].map((choices) => choices.length));
    path.style.gridTemplateRows = `repeat(${rows}, 28px)`;
    for (const [tier, choices] of tiers) {
      choices.sort(
        (a, b) => (order.get(deckCardIdentity(a)) ?? 999) - (order.get(deckCardIdentity(b)) ?? 999),
      );
      choices.forEach((card, index) => {
        const button = makeButton(card);
        button.dataset.tier = String(tier);
        button.dataset.variant = index ? 'alternate' : 'standard';
        button.style.gridColumn = String(tier);
        button.style.gridRow =
          tier === 1 && choices.length === 1 ? `1 / span ${rows}` : String(index + 1);
        path.append(button);
      });
    }
    // A subtle fork links the two choices without adding pointer targets.
    if (rows === 2) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 358 64');
      svg.setAttribute('aria-hidden', 'true');
      const lines = document.createElementNS(svg.namespaceURI, 'path');
      lines.setAttribute('d', 'M114 32H118V14H122 M118 32V50H122 M236 14H244 M236 50H244');
      svg.append(lines);
      path.prepend(svg);
    }
    section.append(path);
    tree.append(section);
  }
  if (basics.length) {
    const group = document.createElement('div');
    group.className = 'm2-tree-basics';
    group.setAttribute('aria-label', 'Ultimate and basic cards');
    const rank = (card) => ({ GOLD: 0, SILVER: 1, PURPLE: 2 })[card.color] ?? 3;
    basics.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (order.get(deckCardIdentity(a)) ?? 999) - (order.get(deckCardIdentity(b)) ?? 999),
    );
    const firstRow = [];
    for (const color of ['GOLD', 'SILVER', 'PURPLE']) {
      const index = basics.findIndex((card) => card.color === color);
      if (index >= 0) firstRow.push(...basics.splice(index, 1));
    }
    for (const card of [...firstRow, ...basics]) group.append(makeButton(card));
    tree.append(group);
  }
  const summary = document.createElement('section');
  summary.className = 'm2-tree-build';
  summary.setAttribute('aria-label', 'Projected item upgrade totals');
  const title = document.createElement('div');
  title.className = 'm2-tree-build-title';
  const heading = document.createElement('b');
  heading.textContent = 'Preview';
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.textContent = 'Reset';
  on(clear, 'click', () => {
    build.planned.clear();
    updateBuild();
  });
  title.append(heading, clear);
  const choices = document.createElement('div');
  choices.className = 'm2-tree-build-choices';
  choices.setAttribute('aria-live', 'polite');
  summary.append(title, choices);
  host.parentElement.append(summary);
  function updateBuild() {
    saveDeckTreeBuild(build);
    const pool = new Set(deckTreePool(hero).map(deckCardIdentity));
    const itemCards = new Set();
    for (const [group, id] of build.chosen) {
      const alternatives = cards.filter(
        (card) => deckTreeGroup(card) === group && deckCardIdentity(card) !== id,
      );
      if (alternatives.length === 1 && alternatives[0].item)
        itemCards.add(deckCardIdentity(alternatives[0]));
    }
    for (const { card, button } of buttons) {
      const group = deckTreeGroup(card),
        id = deckCardIdentity(card);
      const chosen = build.chosen.get(group),
        planned = build.planned.get(group);
      const lowerTier =
        deckTreeTier(card) > 0 &&
        [...build.chosen.keys()].some(
          (key) =>
            key.split(':')[0] === String(card.color).toUpperCase() &&
            Number(key.split(':')[1]) > deckTreeTier(card),
        );
      const state = pool.has(id)
        ? 'current'
        : itemCards.has(id)
          ? 'item'
          : !chosen && planned === id
            ? 'planned'
            : chosen || planned || lowerTier
              ? 'unavailable'
              : 'standard';
      const selected = state === 'current' || state === 'planned';
      button.dataset.state = state;
      button.classList.toggle('m2-tree-chosen', state === 'current');
      button.classList.toggle('m2-tree-planned', state === 'planned');
      button.classList.toggle('m2-tree-item', state === 'item');
      button.classList.toggle('m2-tree-unavailable', state === 'unavailable');
      button.setAttribute('aria-pressed', String(selected));
      const status = {
        current: 'In current card pool',
        item: 'Contributes an item',
        planned: 'Planned',
        unavailable: 'Not chosen',
        standard: '',
      }[state];
      button.setAttribute('aria-label', 'View ' + card.name + (status ? '. ' + status : ''));
      button.title = card.name + (status ? ' · ' + status : '');
    }
    clear.disabled = build.planned.size === 0;
    // Native item totals already include all acquired upgrades, including choices
    // observed before this script was installed. Add only uncommitted plans.
    const actual = { ...hero?.items },
      future = {};
    if (!hero?.items) {
      for (const id of build.chosen.values()) {
        const item = cardGrantedItem(catalog.get(id), cards);
        const stat = item === 'AREA' ? 'RADIUS' : item;
        if (stat) actual[stat] = (Number(actual[stat]) || 0) + 1;
      }
    }
    for (const [group, id] of build.planned) {
      if (build.chosen.has(group)) continue;
      const item = cardGrantedItem(catalog.get(id), cards);
      const stat = item === 'AREA' ? 'RADIUS' : item;
      if (stat) future[stat] = (future[stat] || 0) + 1;
    }
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
    choices.replaceChildren(totals);
  }
  updateBuild();
}
