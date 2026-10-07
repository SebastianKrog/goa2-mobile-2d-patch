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
// Read the own selection from the native CardList/Sidebar props as well as the
// highlighted row. Hidden panels can stop painting selection classes, but React
// still owns the selected ID. Never apply this fallback to an opponent.
function ownSelectedCard(box, hero) {
  if (box.hasAttribute('data-m2-other')) return null;
  const sidebar = q('[data-m2="sidebar"]');
  if (!isCardSelection(componentProp(sidebar, 'view')) && !hero?.current_turn_card) return null;
  const hand = q('[data-m2="hand-list"]');
  const row = hand && q(c('row') + c('selected'), hand);
  const selectedId = componentProp(hand, 'selectedId') || componentProp(sidebar, 'selectedCardId');
  const card = selectedId
    ? (hero?.hand || []).find(card => card.id === selectedId) ||
      Array.from(hand?.querySelectorAll(c('row')) || []).map(renderedCard).find(card => card?.id === selectedId)
    : row && renderedCard(row);
  return card && !card.is_facedown ? card : null;
}
function hasLocalSelection(box) {
  return !box.hasAttribute('data-m2-other') && (
    !!ownSelectedCard(box, componentProp(box, 'hero')) ||
    !!q('[data-m2="hand-list"] ' + c('row') + c('selected'))
  );
}
// A facedown flag also describes the own player's committed card state. The
// native client clears selectedCardId on commit, so the hand-row fallback alone
// cannot recover it. Use details actually supplied to our player, or an exact ID
// match in their own known deck. Opponent facedown cards remain untouched.
function visibleCurrentCard(box, hero) {
  const current = hero.current_turn_card;
  if (current && !current.is_facedown) return current;
  if (box.hasAttribute('data-m2-other')) return current || null;
  if (current) {
    if (current.color && current.primary_action && current.name)
      return { ...current, is_facedown: false };
    const known = [
      ...(Array.isArray(hero.deck) ? hero.deck : []),
      ...(hero.hand || []),
    ].find(card => card.id === current.id && !card.is_facedown);
    if (known) return { ...known, state: current.state, is_facedown: false };
  }
  return ownSelectedCard(box, hero) || current || null;
}
function isCardSelection(view) {
  return /^PLANNING$/i.test(view?.phase || q('[data-m2="header"] ' + c('phase'))?.textContent || '');
}
// Multi-figure heroes are alive while any owned figure has a board location.
// Use explicit ownership supplied by the game rather than guessing from ID prefixes.
function heroOffboard(hero, view) {
  const locations = view?.board?.entity_locations;
  if (!locations || typeof locations !== 'object') return null;
  if (Object.hasOwn(locations, hero.id)) return false;
  return !Object.entries(view?.hero_pieces || {}).some(([id, piece]) =>
    piece.owner_hero_id === hero.id && Object.hasOwn(locations, piece.id || id));
}
function cardIsActive(card, view) {
  return !!card && !card.is_facedown && (card.is_active ||
    (view?.effects || []).some(effect => effect.is_active && effect.source_card_id === card.id));
}
// The played slot is authoritative for a just-resolved card in this turn.
function heroTurnCard(box, hero, view) {
  return visibleCurrentCard(box, hero) || hero.played_cards?.[Number(view?.turn) - 1] || null;
}
function inspectHeroCard(heroId, card) {
  if (!card || card.is_facedown) return;
  selectedHeroCard = { heroId, cardId: card.id };
  updateHeroCardDisplay();
}
// Build the shared portrait, metadata, current Mini card and fixed history slots.
// The serialized render key prevents replacing buttons and animations on every refresh.
function updateHeroDashboard(box, view, suppliedHero = null) {
  const hero = suppliedHero || componentProp(box, 'hero');
  if (!hero || !Array.isArray(hero.played_cards)) return;
  // An absent location means off board only when a location map is actually available.
  // Missing board data alone must not be treated as a death/off-board signal.
  const offboard = heroOffboard(hero, view);
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
  const planning = isCardSelection(view);
  const currentCard = visibleCurrentCard(box, hero);
  // One compact entry is shared by Heroes, Hand and Board focus in every phase.
  const expanded = false;
  box.classList.remove('m2-hero-expanded');
  const heading = q(':scope>' + c('name'), box);
  if (heading) {
    managedAttribute(heading, 'role', 'button');
    managedAttribute(heading, 'tabindex', '-1');
    managedAttribute(heading, 'aria-disabled', 'true');
    managedAttribute(heading, 'aria-expanded', String(expanded));
  }
  const key = JSON.stringify([
    expanded,
    mode,
    currentCard,
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
    addExtra(dashboard);
  }
  dashboard.dataset.key = key;
  dashboard.replaceChildren();
  // Store identities instead of a card snapshot: the separate display re-resolves
  // the latest visible card and its upgrades on every refresh.
  function inspect(card) {
    inspectHeroCard(hero.id, card);
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
  if (offboard) portraitImage.style.filter = 'grayscale(1)';
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
  history.setAttribute('aria-label', 'Level, gold and hand cards');
  const stats = document.createElement('span');
  stats.className = 'm2-hero-resources';
  const gold = goldSymbol(hero.gold);
  gold.classList.add('m2-gold-overlay');
  stats.append(
    document.createTextNode('Lv ' + hero.level + ' • '),
    gold,
  );
  history.append(stats);
  const handGroup = document.createElement('span');
  handGroup.className = 'm2-history-pile';
  handGroup.append(document.createTextNode('Hand:'));
  history.append(handGroup);
  for (const dot of handDots) {
    const marker = document.createElement('span');
    marker.className = 'm2-history-marker';
    marker.style.setProperty('--effect-color', dot.color);
    marker.title = dot.label || 'Hand card';
    handGroup.append(marker);
  }
  if (!handDots.length) handGroup.append(document.createTextNode('—'));
  // Each pile dot can inspect a known card. Facedown cards remain non-interactive;
  // active source cards receive the breathing class, and rune markers remain attached.
  function slot(card, label, rune, group) {
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
    group.append(button);
  }
  // Keep the complete dot renderers for reuse, but hide duplicate Played/Discard
  // metadata now that the fixed history slots carry this information.
  const playedGroup = document.createElement('span');
  playedGroup.className = 'm2-history-pile m2-history-played';
  playedGroup.hidden = true;
  playedGroup.append(document.createTextNode('Played:'));
  hero.played_cards.forEach((card, i) => {
    if (card) slot(card, 'Turn ' + (i + 1), hero.rune_slots?.[String(i + 1)], playedGroup);
  });
  if (!hero.played_cards.some(Boolean)) playedGroup.append(document.createTextNode('—'));
  const discardGroup = document.createElement('span');
  discardGroup.className = 'm2-history-pile m2-history-discard';
  discardGroup.hidden = true;
  discardGroup.append(document.createTextNode('Discard:'));
  if (!hero.discard_pile?.length) discardGroup.append(document.createTextNode('—'));
  (hero.discard_pile || []).forEach((card, i) => slot(card, 'D' + (i + 1), null, discardGroup));
  history.append(playedGroup, discardGroup);
  dashboard.append(history);
  dashboard.append(itemUpgradeSymbols(hero.items, 'm2-hero-upgrades'));
  // The header card and five history slots replace separate active-effect badges.
  // Only the source card glows, including defense-only discard Nano cards.
  function smallCard(card, nano = false, resolved = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'm2-micro-button';
    button.disabled = !!card.is_facedown;
    button.title = card.is_facedown ? 'Hidden card' : card.name;
    button.setAttribute('aria-label', button.title);
    button.append(nano ? nanoCard(card, hero.items) : miniatureCard(card, hero.items, true));
    button.classList.toggle('m2-card-resolved', resolved);
    if (active.some(a => a.id === card.id)) {
      button.classList.add('m2-effect-active');
      button.style.setProperty('--effect-color', cardColors[card.color] || '#bbab73');
    }
    button.onclick = () => inspect(card);
    return button;
  }
  // Reserve the same Mini height for every hero, regardless of commitment or
  // visibility. Selection status occupies that slot rather than a separate row.
  const current = document.createElement('div');
  current.className = 'm2-hero-current-mini';
  const label = document.createElement('span');
  label.className = 'm2-hero-played-label';
  label.textContent = 'Played:';
  current.append(label);
  if (currentCard && !currentCard.is_facedown) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'm2-current-card-mini';
    card.setAttribute('aria-label', currentCard.name);
    updateCardRow(card, currentCard, hero.items || {});
    if (cardIsActive(currentCard, view)) {
      card.classList.add('m2-effect-active');
      card.style.setProperty('--effect-color', cardColors[currentCard.color] || '#888');
    }
    card.onclick = () => inspect(currentCard);
    current.append(card);
  } else {
    const slot = document.createElement('div');
    slot.className = 'm2-current-card-slot';
    const status = document.createElement('span');
    if (planning) {
      status.className = 'm2-selection-status';
      const selected = !!hero.current_turn_card || locallySelected;
      status.textContent = selected
        ? hero.can_commit_second_card ? 'Selected · choosing second' : 'Selected'
        : 'Selecting';
      status.setAttribute('aria-label', status.textContent);
      if (!selected) {
        const dots = document.createElement('span');
        dots.className = 'm2-selecting-dots';
        dots.textContent = '...';
        dots.setAttribute('aria-hidden', 'true');
        status.append(dots);
      }
    } else {
      status.textContent = '—';
      slot.setAttribute('aria-label', 'No unresolved card');
    }
    slot.append(status);
    current.append(slot);
  }
  dashboard.append(current);
  // History slots remain present during planning and in the Hand view too.
  {
    const slots = document.createElement('div');
    slots.className = 'm2-hero-micro-slots';
    for (let i = 0; i < 5; i++) {
      const slot = document.createElement('div');
      slot.className = 'm2-micro-history-slot';
      const label = i < 4 ? 'Turn ' + (i + 1) : 'Discard';
      slot.setAttribute('aria-label', label);
      const cards = i < 4 ? [hero.played_cards[i]].filter(Boolean) : hero.discard_pile || [];
      slot.classList.toggle('m2-history-empty', !cards.length);
      if (i === 4 && cards.length) {
        // Center one/two discards; fit larger piles symmetrically by overlapping
        // the Nano cards just enough to stay inside their fixed 64px column.
        const pile = document.createElement('span');
        pile.className = 'm2-discard-cards';
        const gap = cards.length > 1 ? Math.min(2, (64 - cards.length * 20) / (cards.length - 1)) : 0;
        pile.style.setProperty('--m2-discard-gap', gap + 'px');
        for (const card of cards) pile.append(smallCard(card, true));
        slot.append(pile);
      } else for (const card of cards) slot.append(smallCard(card));
      // Nano cards overlay the centered Discard label in one fixed-height slot.
      // Empty turn slots keep a subtle outline around their centered label.
      if (!cards.length || i === 4) {
        const placeholder = document.createElement('span');
        placeholder.className = 'm2-micro-placeholder';
        placeholder.textContent = label;
        slot.append(placeholder);
      }
      slots.append(slot);
    }
    dashboard.append(slots);
  }
}

// Only full hero portraits use ordinal suffixes; Board summary order stays dotted.
function ordinalTurn(order) {
  const number = document.createElement('span');
  const n = Number(order), last = n % 10, teen = n % 100;
  number.append(document.createTextNode(String(order)));
  const suffix = document.createElement('sup');
  suffix.textContent = teen >= 11 && teen <= 13 ? 'th'
    : last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th';
  number.append(suffix);
  return number;
}
function updateTurnPortrait(box, entry, done, offboard, resolving) {
  let info = q('.m2-resolution-info', box);
  const marker = entry ? entry.current ? 'NOW' : String(entry.order)
    : resolving && !offboard ? done ? '✓' : '—' : null;
  if (marker === null) { info?.remove(); return; }
  if (!info) {
    info = document.createElement('div');
    info.className = 'm2-resolution-info';
    addExtra(info);
  }
  const portrait = q('.m2-hero-portrait', box), host = portrait || box;
  if (info.parentElement !== host) host.append(info);
  const key = JSON.stringify([marker, entry?.initiative, entry?.card]);
  if (info.dataset.key === key) return;
  info.dataset.key = key;
  const order = document.createElement('span');
  order.className = 'm2-turn-number';
  if (entry && !entry.current) order.append(ordinalTurn(entry.order));
  else order.textContent = marker;
  info.replaceChildren(order);
  if (entry) info.append(cardSymbol('INITIATIVE', entry.initiative));
  info.title = entry?.card || (done ? 'Turn completed' : 'No card played this turn');
  info.setAttribute('aria-label', entry
    ? 'Turn ' + marker + ', initiative ' + entry.initiative : info.title);
}
// Resolve the selected card by identity each refresh so upgrades and visibility stay current.
function updateHeroCardDisplay() {
  if (!selectedHeroCard) return;
  const box = Array.from(document.querySelectorAll('[data-m2="sidebar"] [data-m2="hero"]')).find(
    (box) => componentProp(box, 'hero')?.id === selectedHeroCard.heroId,
  );
  const hero = box && componentProp(box, 'hero');
  if (!hero) {
    clearHeroCard();
    return;
  }
  const cards = [
    visibleCurrentCard(box, hero),
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
  const display = textCard(card, 'hero', null, hero.id),
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
    const display = textCard(card, 'deck', null, heroId);
    if (item) {
      const foot = q('.m2-card-foot', display);
      foot.classList.add('m2-upgrade-footer');
      const gain = document.createElement('span');
      gain.className = 'm2-upgrade-gain';
      gain.append(document.createTextNode('Gives '), cardSymbol(item === 'AREA' ? 'RADIUS' : item));
      foot.append(gain);
      foot.title = 'Choosing this gains ' + item.toLowerCase();
      foot.setAttribute('aria-label', foot.title);
    }
    button.append(display);
    addExtra(display);
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
