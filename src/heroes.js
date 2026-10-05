// Read only props already supplied to the rendered hero/sidebar components.
// 8. Public component props and hero dashboards
// The cache lasts only until the next refresh; retaining a React tree across updates
// would produce stale selections, item values, and event arrays.
let committedFiberCache = new Map();

// React may leave an alternate fiber on a DOM node. Read the committed tree, not stale props.
// This private integration is isolated here because a website update may change it.
function currentFiber(element) {
  const key = element && Object.keys(element).find((k) => k.startsWith('__reactFiber$'));
  const original = key ? element[key] : null;
  if (!original) return null;
  let top = original;
  while (top.return) top = top.return;
  const rootState = top.stateNode,
    current = rootState?.current;
  if (!current) return original;
  let cache = committedFiberCache.get(rootState);
  if (!cache || cache.current !== current) {
    const hosts = new WeakMap(),
      stack = [current];
    while (stack.length) {
      const node = stack.pop();
      if (node.stateNode && typeof node.stateNode === 'object') hosts.set(node.stateNode, node);
      for (let child = node.child; child; child = child.sibling) stack.push(child);
    }
    cache = { current, hosts };
    committedFiberCache.set(rootState, cache);
  }
  return cache.hosts.get(element) || null;
}
// Walk up a bounded number of component ancestors to find a supplied prop.
// Missing props are normal during mounting/navigation; callers must tolerate null.
function componentProp(element, key) {
  let fiber = currentFiber(element);
  for (let i = 0; fiber && i < 32; i++, fiber = fiber.return) {
    const value = fiber.memoizedProps?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return null;
}
// Exclude injected item/stat nodes when recovering the native hero/player label.
function heroDisplayName(name) {
  if (!name) return '';
  const copy = name.cloneNode(true);
  copy.querySelectorAll(c('items')).forEach((e) => e.remove());
  return copy.textContent.trim();
}
// Recognize the own-player committed UI while public hero props catch up.
function hasLocalSelection(box) {
  return (
    !box.hasAttribute('data-m2-other') && !!q('[data-m2="hand-list"] ' + c('row') + c('selected'))
  );
}
// Build portrait, piles, status, upgrades, effects, and optional expanded rows.
// The serialized render key prevents replacing buttons and animations on every refresh.
function updateHeroDashboard(box, view) {
  const hero = componentProp(box, 'hero');
  if (!hero || !Array.isArray(hero.played_cards)) return;
  // An absent location means off board only when a location map is actually available.
  // Missing board data alone must not be treated as a death/off-board signal.
  const locations = view?.board?.entity_locations;
  const offboard =
    locations && typeof locations === 'object' ? !Object.hasOwn(locations, hero.id) : null;
  const effects = view?.effects || [];
  const cards = [
    ...hero.played_cards,
    ...(hero.discard_pile || []),
    hero.current_turn_card,
    ...(hero.cast_spells || []),
  ].filter((card) => card && !card.is_facedown);
  // Effects can mark their source card active even if the card flag is not set.
  // Deduplicate by card ID because the same card can appear in multiple collections.
  const active = [
    ...new Map(
      cards
        .filter(
          (card) =>
            card.is_active ||
            effects.some((effect) => effect.is_active && effect.source_card_id === card.id),
        )
        .map((card) => [card.id, card]),
    ).values(),
  ];
  const handDots = Array.from(box.querySelectorAll(c('handColorDot') + ',.m2-own-colors i')).map(
    (dot) => ({ color: dot.style.backgroundColor, label: dot.title }),
  );
  const locallySelected = hasLocalSelection(box);
  const expanded = expandedHeroId === hero.id;
  box.classList.toggle('m2-hero-expanded', expanded);
  const heading = q(':scope>' + c('name'), box);
  if (heading) {
    managedAttribute(heading, 'role', 'button');
    managedAttribute(heading, 'tabindex', '0');
    managedAttribute(heading, 'aria-expanded', String(expanded));
  }
  const key = JSON.stringify([
    expanded,
    hero.hand,
    locallySelected,
    hero.level,
    hero.gold,
    handDots,
    hero.current_turn_card,
    hero.can_commit_second_card,
    hero.played_cards,
    hero.discard_pile,
    hero.rune_slots,
    hero.items,
    hero.cast_spells?.length,
    active,
    offboard,
    view?.turn,
    view?.phase,
  ]);
  let dashboard = q('.m2-hero-dashboard', box);
  if (dashboard?.dataset.key === key) return;
  if (!dashboard) {
    dashboard = document.createElement('div');
    dashboard.className = 'm2-hero-dashboard';
    box.append(dashboard);
    extras.add(dashboard);
  }
  dashboard.dataset.key = key;
  dashboard.replaceChildren();
  // Store identities instead of a card snapshot: the separate display re-resolves
  // the latest visible card and its upgrades on every refresh.
  function inspect(card) {
    if (!expanded) {
      expandedHeroId = hero.id;
      updateHeroDashboard(box, view);
    }
    selectedHeroCard = { heroId: hero.id, cardId: card.id };
    updateHeroCardDisplay();
  }

  const portrait = document.createElement('span');
  portrait.className = 'm2-hero-portrait';
  portrait.style.borderColor = String(hero.team).toUpperCase() === 'BLUE' ? '#64a6e8' : '#e56d6d';
  const portraitImage = document.createElement('img');
  portraitImage.src =
    '/hero-images/' +
    encodeURIComponent((hero.name || hero.id.replace(/^hero_/i, '')).toLowerCase()) +
    '.webp';
  portraitImage.alt = hero.name || hero.id;
  if (offboard) portrait.style.filter = 'grayscale(1)';
  portrait.append(portraitImage);
  dashboard.append(portrait);
  if (offboard) {
    const label = document.createElement('span');
    label.className = 'm2-offboard-label';
    label.textContent = '☠';
    label.title = 'Off board';
    label.setAttribute('aria-label', 'Off board');
    portrait.append(label);
  }
  const history = document.createElement('div');
  history.className = 'm2-hero-history';
  history.setAttribute('aria-label', 'Level, gold, hand, played and discarded cards');
  const stats = document.createElement('span');
  stats.append(
    document.createTextNode('Lv ' + hero.level + ' • '),
    goldSymbol(hero.gold),
    document.createTextNode(' • Hand:'),
  );
  history.append(stats);
  for (const dot of handDots) {
    const marker = document.createElement('span');
    marker.className = 'm2-history-marker';
    marker.style.setProperty('--effect-color', dot.color);
    marker.title = dot.label || 'Hand card';
    history.append(marker);
  }
  if (!handDots.length) history.append(document.createTextNode('—'));
  // Each pile dot can inspect a known card. Facedown cards remain non-interactive;
  // active source cards receive the breathing class, and rune markers remain attached.
  function slot(card, label, rune) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'm2-history-slot';
    const marker = document.createElement('span');
    marker.className = 'm2-history-marker';
    if (card?.color) marker.style.setProperty('--effect-color', cardColors[card.color] || '#888');
    button.append(marker);
    button.disabled = !card || card.is_facedown;
    button.title = label + ': ' + (card?.is_facedown ? 'Hidden card' : card?.name || 'Empty');
    button.setAttribute('aria-label', button.title);
    if (card && !card.is_facedown) {
      button.onclick = () => inspect(card);
      if (active.some((a) => a.id === card.id)) marker.classList.add('m2-effect-active');
    }
    if (rune) {
      const img = document.createElement('img');
      img.src = '/cards/sheets/rune_' + encodeURIComponent(rune) + '.png';
      img.alt = 'Rune ' + rune;
      button.append(img);
    }
    history.append(button);
  }
  const playedLabel = document.createElement('span');
  playedLabel.textContent = 'Played:';
  history.append(playedLabel);
  hero.played_cards.forEach((card, i) => {
    if (card) slot(card, 'Turn ' + (i + 1), hero.rune_slots?.[String(i + 1)]);
  });
  if (!hero.played_cards.some(Boolean)) history.append(document.createTextNode('—'));
  const discardLabel = document.createElement('span');
  discardLabel.textContent = 'Discard:';
  history.append(discardLabel);
  if (!hero.discard_pile?.length) history.append(document.createTextNode('—'));
  (hero.discard_pile || []).forEach((card, i) => slot(card, 'D' + (i + 1)));
  dashboard.append(history);
  if (
    /^PLANNING$/i.test(view?.phase || '') &&
    !locallySelected &&
    !(hero.current_turn_card && !box.hasAttribute('data-m2-other'))
  ) {
    const status = document.createElement('span');
    status.className = 'm2-selection-status';
    const selected = !!hero.current_turn_card;
    status.textContent = selected
      ? hero.can_commit_second_card
        ? 'Selected · choosing second'
        : '✓ Selected'
      : 'Selecting…';
    if (!selected) {
      status.textContent = 'Selecting';
      status.setAttribute('aria-label', 'Selecting');
      const dots = document.createElement('span');
      dots.className = 'm2-selecting-dots';
      dots.textContent = '...';
      dots.setAttribute('aria-hidden', 'true');
      status.append(dots);
    }
    status.title = selected ? 'A card has been committed' : 'Waiting for a card to be committed';
    dashboard.append(status);
  }

  const upgrades = document.createElement('div');
  upgrades.className = 'm2-hero-upgrades';
  upgrades.setAttribute('aria-label', 'Upgrades');
  for (const stat of ['ATTACK', 'DEFENSE', 'INITIATIVE', 'RANGE', 'MOVEMENT', 'RADIUS']) {
    const value = hero.items?.[stat];
    if (typeof value === 'number' && value > 0) {
      const symbol = cardSymbol(stat, '+' + value);
      symbol.title = 'Upgrade: ' + stat.toLowerCase() + ' +' + value;
      upgrades.append(symbol);
    }
  }
  if (upgrades.children.length) dashboard.append(upgrades);
  const badges = document.createElement('div');
  badges.className = 'm2-hero-effects';
  if (hero.spellbook != null) {
    const count = document.createElement('span');
    count.textContent = 'Cast ' + (hero.cast_spells?.length || 0);
    badges.append(count);
  }
  for (const card of active) {
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'm2-effect-active';
    badge.style.setProperty('--effect-color', cardColors[card.color] || '#bbab73');
    badge.textContent = card.name;
    badge.title = 'Active effect: ' + (card.effect_text || card.name);
    badge.setAttribute('aria-label', card.name + ' · active effect');
    badge.onclick = () => inspect(card);
    badges.append(badge);
  }
  if (badges.children.length) dashboard.append(badges);
  // Expansion stays inside the hero list. Only clicking an individual card opens
  // the larger display; opponents’ hands remain represented by their public dots.
  if (expanded) {
    const board = document.createElement('div');
    board.className = 'm2-expanded-board';
    function cardRow(card, label) {
      const line = document.createElement('div');
      line.className = 'm2-hero-slot';
      if (label) {
        const title = document.createElement('span');
        title.className = 'm2-slot-label';
        title.textContent = label;
        line.append(title);
      }
      if (!card) {
        const empty = document.createElement('span');
        empty.className = 'm2-slot-empty';
        empty.textContent = '—';
        line.append(empty);
      } else if (card.is_facedown) {
        const hidden = document.createElement('span');
        hidden.className = 'm2-slot-hidden';
        hidden.textContent = 'Hidden card';
        line.append(hidden);
      } else {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'm2-expanded-card';
        row.setAttribute('aria-label', card.name);
        updateCardRow(row, card, hero.items || {});
        if (active.some((a) => a.id === card.id)) {
          row.classList.add('m2-effect-active');
          row.style.setProperty('--effect-color', cardColors[card.color] || '#bbab73');
        }
        row.onclick = () => inspect(card);
        line.append(row);
      }
      return line;
    }
    function section(title) {
      const el = document.createElement('section'),
        heading = document.createElement('h4');
      heading.textContent = title;
      el.append(heading);
      board.append(el);
      return el;
    }
    section('Current:').append(cardRow(hero.current_turn_card));
    if (!box.hasAttribute('data-m2-other')) {
      const hand = section('Hand:');
      const cards = Array.isArray(hero.hand)
        ? hero.hand
        : Array.from(document.querySelectorAll('[data-m2="hand-list"] ' + c('row')))
            .map(renderedCard)
            .filter(Boolean);
      if (cards.length) cards.forEach((card) => hand.append(cardRow(card)));
      else hand.append(cardRow(null));
    }
    const played = section('');
    for (let i = 0; i < Math.max(4, hero.played_cards.length); i++)
      played.append(cardRow(hero.played_cards[i], 'Turn ' + (i + 1) + ':'));
    if (hero.discard_pile?.length) {
      const discard = section('Discard:');
      hero.discard_pile.forEach((card) => discard.append(cardRow(card)));
    }
    dashboard.append(board);
  }
}

// Resolve the selected card by identity each refresh so upgrades and visibility stay current.
function updateHeroCardDisplay() {
  if (!selectedHeroCard) return;
  const box = Array.from(document.querySelectorAll('[data-m2="hero"]')).find(
    (box) => componentProp(box, 'hero')?.id === selectedHeroCard.heroId,
  );
  const hero = box && componentProp(box, 'hero');
  if (!hero) {
    clearHeroCard();
    return;
  }
  const cards = [
    hero.current_turn_card,
    hero.extra_turn_card,
    hero.ultimate_card,
    ...['hand', 'played_cards', 'discard_pile', 'cast_spells'].flatMap((key) =>
      Array.isArray(hero[key]) ? hero[key] : [],
    ),
  ];
  const card = cards.find((card) => card?.id === selectedHeroCard.cardId && !card.is_facedown);
  if (!card) {
    clearHeroCard();
    return;
  }
  const key = JSON.stringify([card, hero.items]);
  if (heroPanel.dataset.key === key) return;
  const display = textCard(card, 'hero'),
    close = document.createElement('button');
  close.type = 'button';
  close.className = 'm2-card-dismiss';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close card details');
  close.onclick = clearHeroCard;
  const foot = q('.m2-card-foot', display);
  foot.classList.add('m2-has-dismiss');
  foot.append(close);
  heroPanel.replaceChildren(display);
  heroPanel.dataset.key = key;
}
// Keep native upgrade buttons and their selection handlers; replace only presentation.
// Use the Deck text-card presentation inside native upgrade option buttons.
// The awarded item belongs to the paired card, so derive it from the option pair.
function updateUpgradeCards() {
  for (const button of document.querySelectorAll('button' + c('upgradeCard'))) {
    const request = componentProp(button, 'inputRequest'),
      heroId = componentProp(button, 'myHeroId');
    if (request?.type !== 'UPGRADE_PHASE' || !heroId) continue;
    const options = request.players?.[heroId]?.options || [];
    const name = q(c('cardName'), button)?.textContent.trim();
    const matches = options
      .flatMap((option) =>
        (option.card_details || []).map((card, index) => ({
          card,
          item: option.card_details[index === 0 ? 1 : 0]?.item,
        })),
      )
      .filter((entry) => entry.card.name === name);
    if (matches.length !== 1) continue;
    const { card, item } = matches[0],
      key = JSON.stringify([card, item]);
    if (button.dataset.m2UpgradeKey === key && q(':scope>.m2-text-card', button)) continue;
    button.dataset.m2UpgradeKey = key;
    q(':scope>.m2-text-card', button)?.remove();
    // The discarded alternative grants the item, not the chosen card itself.
    const display = textCard({ ...card, item }, 'deck');
    if (item) {
      const foot = q('.m2-card-foot', display);
      foot.title = 'Choosing this gains ' + item.toLowerCase();
      foot.setAttribute('aria-label', foot.title);
    }
    button.append(display);
    extras.add(display);
  }
}
// Read the native resolution queue as the authority for order and initiative.
// The queue overlay is hidden by CSS, but its rendered data still drives hero badges.
function resolutionEntries() {
  const rows = Array.from(document.querySelectorAll(c('entry'))).filter(
    (e) => q(c('initiative'), e) && q(c('heroName'), e) && q(c('cardName'), e),
  );
  for (const row of rows) {
    const container = row.closest(c('container'));
    if (container) tag(container, 'resolution-queue');
  }
  return rows.map((e, i) => ({
    name: q(c('heroName'), e).textContent.trim(),
    initiative: q(c('initiative'), e).textContent.trim(),
    card: q(c('cardName'), e).textContent.trim(),
    color: q(c('cardName'), e).style.color,
    order: i + 1,
    current: e.matches(c('nextEntry')),
  }));
}
