// 7. Header, settings, compact Board summaries, and gestures
// Derive a compact HUD from native labels and controls without changing the phase.
// Team rosters can retain defeated minions. Count unique roster IDs that still
// have a board location, rather than counting token artwork or minion values.
function remainingMinions(view, teamColor) {
  const team = view?.teams?.[teamColor],
    locations = view?.board?.entity_locations;
  if (!Array.isArray(team?.minions) || !locations) return null;
  return new Set(
    team.minions.filter((minion) => minion?.id &&
      Object.hasOwn(locations, minion.id) && locations[minion.id] != null)
      .map((minion) => minion.id),
  ).size;
}
// Read current native labels on every refresh, so recovery restores the latest
// game phase/action rather than a snapshot from before the disconnect.
function mobileHeaderStatus(header) {
  const warning = q(c('disconnected'));
  if (warning) {
    const message = warning.textContent.trim()
      .replace(/^Disconnected\s*(?:[—–:-]\s*)?/i, '').trim();
    return { disconnected: true, phase: 'DISCONNECTED', action: message || 'Reconnecting…' };
  }
  const status = q(c('statusCopy'), header),
    title = q('strong', status || header)?.textContent || '',
    rawDetail = q(c('statusDetail'), status || header)?.textContent || '';
  const detail = /locked in$/i.test(title) && rawDetail.includes(' · ')
    ? rawDetail.slice(rawDetail.lastIndexOf(' · ') + 3) : rawDetail;
  return {
    disconnected: false,
    phase: q(c('phase'), header)?.textContent || '',
    action: title + (detail ? ' · ' + detail : ''),
  };
}
let mobileStatusStrip = null;
function updateMobileHeader(header) {
  if (!header) return;
  let hud = q('.m2-hud', header);
  if (!hud) {
    hud = document.createElement('div');
    hud.className = 'm2-hud';
    hud.innerHTML =
      '<div class="m2-hud-top"><div class="m2-life red"><img src="/icons/life_counter_red_front.png" alt="Orange lives"><b></b></div><div class="m2-minions red"><img src="/hero-images/minion_melee_red.png" alt=""><b></b></div><div class="m2-round"><span></span><span></span></div><div class="m2-coin"><img alt="Tie breaker"><small></small></div><div class="m2-waves"><img src="/icons/wave_counter.png" alt="Waves"><b></b></div><div class="m2-minions blue"><img src="/hero-images/minion_melee_blue.png" alt=""><b></b></div><div class="m2-life blue"><b></b><img src="/icons/life_counter_blue_front.png" alt="Blue lives"></div></div>';
    header.append(hud);
    extras.add(hud);
  }
  // Only generated nodes are moved; native React elements remain in place.
  if (!mobileStatusStrip) {
    mobileStatusStrip = document.createElement('div');
    mobileStatusStrip.className = 'm2-hud-bottom';
    mobileStatusStrip.innerHTML =
      '<div class="m2-phase"></div><span class="m2-action-dot" aria-hidden="true"></span><div class="m2-status"></div>';
  }
  if (mobileStatusStrip.parentElement !== header.parentElement ||
      header.nextElementSibling !== mobileStatusStrip)
    header.after(mobileStatusStrip);
  extras.add(mobileStatusStrip);
  const put = (sel, text) => {
    const e = q(sel, hud) || q(sel, mobileStatusStrip);
    if (e.textContent !== text) e.textContent = text;
  };
  for (const [team, cls] of [
    ['Red', 'red'],
    ['Blue', 'blue'],
  ])
    put(
      '.m2-life.' + cls + ' b',
      q('[aria-label^="' + team + ' team"] [data-m2-fraction]', header)?.dataset.m2Fraction ||
        '—',
    );
  // Both native PhaseBar and Sidebar receive the public view. The Sidebar
  // fallback also covers header variants whose own props only contain labels.
  const view = componentProp(header, 'view') || componentProp(q(c('sidebar')), 'view');
  for (const team of ['RED', 'BLUE']) {
    const cls = team.toLowerCase(), count = remainingMinions(view, team),
      counter = q('.m2-minions.' + cls, hud),
      label = team + ' minions remaining: ' + (count ?? 'unavailable');
    put('.m2-minions.' + cls + ' b', count === null ? '—' : String(count));
    if (counter.getAttribute('aria-label') !== label) {
      counter.setAttribute('aria-label', label);
      counter.title = label;
    }
  }
  const meta = q(c('matchMeta'), header);
  put('.m2-round span:first-child', meta?.children[0]?.textContent || '');
  put('.m2-round span:last-child', meta?.children[2]?.textContent || '');
  const coin = q(c('tieBreaker'), header),
    img = q('.m2-coin img', hud);
  if (coin && img.getAttribute('src') !== coin.getAttribute('src'))
    img.src = coin.getAttribute('src');
  put('.m2-coin small', coin?.getAttribute('src')?.includes('orange') ? 'ORANGE' : 'BLUE');
  const lanes = Array.from(header.querySelectorAll(c('waveLane')));
  put(
    '.m2-waves b',
    lanes
      .map((e) => e.getAttribute('aria-label')?.match(/(\d+) Wave/i)?.[1] || '0')
      .join(' / ') || '0',
  );
  const headerStatus = mobileHeaderStatus(header);
  mobileStatusStrip.classList.toggle('m2-disconnected', headerStatus.disconnected);
  put('.m2-phase', headerStatus.phase);
  put('.m2-status', headerStatus.action);
  // Board buttons sit just below the floating strip.
  const statusHeight = Math.ceil(mobileStatusStrip.getBoundingClientRect().height);
  if (statusHeight > 0 && root.style.getPropertyValue('--m2-status-h') !== statusHeight + 'px')
    root.style.setProperty('--m2-status-h', statusHeight + 'px');
  const height = Math.ceil(hud.getBoundingClientRect().height) + 4;
  if (height > 4 && root.style.getPropertyValue('--m2-head') !== height + 'px')
    root.style.setProperty('--m2-head', height + 'px');
}
let cursorsVisible = true;
try {
  cursorsVisible = localStorage.getItem('goa2:remote-pointers-visible') !== 'hidden';
} catch {}
// Expose cursor visibility in the mobile settings and remember it on this device.
function updateCursorSetting() {
  root.toggleAttribute('data-m2-hide-cursors', !cursorsVisible);
  const menu = q('[data-m2="tools"]');
  if (menu && !q('.m2-cursors', menu)) {
    const b = document.createElement('button');
    b.className = 'm2-cursors';
    b.type = 'button';
    b.setAttribute('role', 'switch');
    const sync = () => {
      b.textContent = 'Player cursors: ' + (cursorsVisible ? 'On' : 'Off');
      b.setAttribute('aria-checked', String(cursorsVisible));
    };
    on(b, 'click', () => {
      cursorsVisible = !cursorsVisible;
      try {
        localStorage.setItem('goa2:remote-pointers-visible', cursorsVisible ? 'shown' : 'hidden');
      } catch {}
      sync();
      updateCursorSetting();
      location.reload();
    });
    b.title = 'Changing this setting reloads the game view';
    sync();
    menu.append(b);
    extras.add(b);
  }
}
// Shared slim/normal row structure: initiative, colored primary/name/range band,
// then secondary stats. Adapt the contents while preserving native row click handlers.
function updateCardRow(row, card, knownItems) {
  const items = knownItems || cardUpgrades(card, row);
  const symbol = (key, value) => upgradedSymbol(items, key, value);
  // Only Hand's Small rows get this artwork treatment. Hero/Deck Mini rows
  // share the renderer but keep their existing compact presentation.
  const small = !!row.closest('[data-m2="hand-list"]');
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
    extras.add(view);
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
    extras.add(dots);
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
function renderFocusedHero(h) {
  const source = Array.from(document.querySelectorAll('[data-m2="sidebar"] [data-m2="hero"]'))
    .find(box => componentProp(box, 'hero')?.id === h.id);
  const hero = source && componentProp(source, 'hero');
  if (!hero) { focusedHeroId = null; return false; }
  let box = q('.m2-focused-hero', summary);
  if (!box || box.dataset.heroId !== h.id) {
    summary.replaceChildren();
    box = document.createElement('section');
    box.className = 'm2-focused-hero';
    box.dataset.m2 = 'hero';
    box.dataset.heroId = h.id;
    box.toggleAttribute('data-m2-other', source.hasAttribute('data-m2-other'));
    for (const selector of [c('name'), c('details')]) {
      const native = q(':scope>' + selector, source);
      if (native) box.append(native.cloneNode(true));
    }
    summary.append(box);
  }
  // Native hand dots and player labels can change while this entry stays focused.
  for (const selector of [c('name'), c('details')]) {
    const native = q(':scope>' + selector, source), copy = q(':scope>' + selector, box);
    if (native && copy && native.innerHTML !== copy.innerHTML) copy.innerHTML = native.innerHTML;
  }
  const view = componentProp(q('[data-m2="sidebar"]'), 'view');
  updateHeroDashboard(box, view, hero);
  box.classList.toggle('m2-current-hero', !!h.resolution?.current);
  box.classList.toggle('m2-pending-hero', !!h.resolution);
  box.classList.toggle('m2-done-hero', h.done);
  updateTurnPortrait(box, h.resolution, h.done, h.offboard, /^RESOLUTION$/i.test(view?.phase));
  const portrait = q('.m2-hero-portrait', box);
  if (portrait && !q('.m2-focus-back', portrait)) {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'm2-focus-back';
    back.textContent = '◀';
    back.setAttribute('aria-label', 'Back to hero summaries');
    back.onclick = () => { focusedHeroId = null; clearHeroCard(); delete summary.dataset.key; refresh(); };
    portrait.append(back);
  }
  return true;
}
// Clone only the generated portrait and its current turn/initiative badges.
// Native hero nodes remain in the sidebar; buttons select the focused identity.
function renderFocusPortraits(heroes) {
  let strip = q('.m2-focus-portraits', summary);
  if (!strip) {
    strip = document.createElement('nav');
    strip.className = 'm2-focus-portraits';
    strip.setAttribute('aria-label', 'Heroes in turn order');
    summary.append(strip);
  }
  const sources = Array.from(document.querySelectorAll('[data-m2="sidebar"] [data-m2="hero"]'));
  const entries = heroes.filter(h => h.id).map(h => {
    const source = sources.find(box => componentProp(box, 'hero')?.id === h.id);
    return { h, portrait: source && q('.m2-hero-portrait', source) };
  });
  const key = JSON.stringify(entries.map(({h, portrait}) =>
    [h.id, h.name, h.resolution?.current, h.done, portrait?.outerHTML, h.id === focusedHeroId]));
  if (strip.dataset.key === key) return;
  strip.dataset.key = key;
  const scroll = strip.scrollLeft;
  strip.replaceChildren();
  for (const {h, portrait} of entries) {
    if (!portrait) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'm2-focus-hero-icon';
    button.dataset.m2 = 'hero';
    button.dataset.heroId = h.id;
    button.classList.toggle('m2-current-hero', !!h.resolution?.current);
    button.classList.toggle('m2-done-hero', h.done);
    button.setAttribute('aria-label', 'Show ' + h.name);
    button.setAttribute('aria-pressed', String(h.id === focusedHeroId));
    button.title = h.name;
    button.append(portrait.cloneNode(true));
    button.onclick = () => {
      focusedHeroId = h.id;
      clearHeroCard();
      delete summary.dataset.key;
      refresh();
    };
    strip.append(button);
  }
  strip.scrollLeft = scroll;
}
function renderSummary(heroes) {
  if (summary.classList.contains('m2-summary-focused') !== !!focusedHeroId) {
    summary.classList.toggle('m2-summary-focused', !!focusedHeroId);
    // Do not carry a previous scrolled overview into the replacement hero entry.
    summary.scrollLeft = 0;
    summary.scrollTop = 0;
  }
  if (focusedHeroId) {
    const h = heroes.find(hero => hero.id === focusedHeroId);
    if (h && renderFocusedHero(h)) { renderFocusPortraits(heroes); delete summary.dataset.key; return; }
    focusedHeroId = null;
    summary.classList.remove('m2-summary-focused');
    root.style.setProperty('--m2-summary-h', heroes.length * 32 + 12 + 'px');
  }
  const key = JSON.stringify(heroes);
  if (summary.dataset.key === key) return;
  summary.dataset.key = key;
  summary.replaceChildren();
  const separator = () => {
    const dot = document.createElement('span');
    dot.className = 'm2-summary-separator';
    dot.textContent = '·';
    dot.setAttribute('aria-hidden', 'true');
    return dot;
  };
  for (const h of heroes) {
    const row = document.createElement('article');
    if (h.resolution?.current) row.classList.add('m2-current-hero');
    if (h.done) row.classList.add('m2-done-hero');
    const turn = document.createElement('span');
    turn.className = 'm2-summary-turn';
    let status;
    if (h.resolution) {
      const order = document.createElement('b');
      order.textContent = h.resolution.current ? 'NOW' : h.resolution.order + '.';
      turn.append(order, cardSymbol('INITIATIVE', h.resolution.initiative));
      status = 'Turn ' + order.textContent + ', initiative ' + h.resolution.initiative;
    } else if (h.upgrading || h.planning) {
      const selecting = h.upgrading ? h.upgradeRemaining > 0 : !h.committed;
      const unknown = h.upgrading && h.upgradeRemaining === null;
      status = unknown ? 'Waiting' : selecting ? 'Selecting' : h.upgrading ? 'Done' : 'Selected';
      if (selecting) {
        const dots = document.createElement('span');
        dots.className = 'm2-selecting-dots';
        dots.textContent = '...';
        dots.setAttribute('aria-hidden', 'true');
        turn.append(dots);
      } else turn.textContent = unknown ? '…' : '✓';
    } else {
      turn.textContent = h.offboard ? '☠' : h.done ? '✓' : '—';
      status = h.offboard ? 'Off board' : h.done ? 'Turn completed' : 'No card played';
    }
    turn.title = status;
    turn.setAttribute('aria-label', status);

    const identity = document.createElement('span');
    identity.className = 'm2-summary-identity';
    identity.setAttribute('role', 'button');
    identity.tabIndex = 0;
    identity.setAttribute('aria-label', 'Open ' + h.name);
    const focus = () => { if (h.id) { focusedHeroId = h.id; clearHeroCard(); refresh(); } };
    identity.onclick = focus;
    identity.onkeydown = event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); focus(); }
    };
    identity.title = h.name;
    const [heroName, ...playerParts] = h.name.split(/[·•]/);
    const name = document.createElement('strong');
    name.textContent = heroName.trim();
    name.style.color = h.color;
    identity.append(name);
    if (playerParts.length) {
      const player = document.createElement('span');
      player.className = 'm2-summary-player';
      const playerName = playerParts.join('·').trim();
      player.textContent = playerName.includes('(You)') ? '(You)' : playerName;
      identity.append(separator(), player);
    }
    const level = document.createElement('span');
    level.className = 'm2-summary-level';
    level.textContent = h.level == null ? 'Lv.—' : 'Lv.' + h.level;
    const gold = goldSymbol(h.gold ?? '—');
    gold.classList.add('m2-gold-overlay');
    const piles = document.createElement('span');
    piles.className = 'm2-summary-piles';
    const add = (label, cards) => {
      const group = document.createElement('span');
      group.append(document.createTextNode(label));
      for (const card of cards) {
        const dot = document.createElement('i');
        dot.style.backgroundColor = card.color;
        dot.style.setProperty('--effect-color', card.color);
        dot.title = card.name || 'Hand card';
        if (card.active) dot.classList.add('m2-effect-active');
        group.append(dot);
      }
      if (!cards.length) group.append(document.createTextNode('–'));
      piles.append(group);
    };
    add('H', h.dots.map(color => ({ color })));
    add('P', h.cardPiles.find(p => p.label === 'P')?.cards || []);
    add('D', h.cardPiles.find(p => p.label === 'D')?.cards || []);
    const resources = document.createElement('span');
    resources.className = 'm2-summary-resources';
    resources.append(level, separator(), gold);
    row.append(turn, identity, resources, piles);
    // Keep a just-resolved card in its fixed column, with a subdued appearance.
    const currentSlot = document.createElement('span');
    currentSlot.className = 'm2-summary-current-slot';
    if (h.currentCard) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'm2-micro-button';
      button.disabled = !!h.currentCard.is_facedown;
      button.setAttribute('aria-label', h.currentCard.is_facedown ? 'Hidden card' : h.currentCard.name);
      button.classList.toggle('m2-card-resolved', h.done && !h.resolution);
      if (h.currentActive) {
        button.classList.add('m2-effect-active');
        button.style.setProperty('--effect-color', cardColors[h.currentCard.color] || '#888');
      }
      button.append(miniatureCard(h.currentCard, h.upgrades));
      button.onclick = () => { inspectHeroCard(h.id, h.currentCard); refresh(); };
      currentSlot.append(button);
    }
    row.append(currentSlot, itemUpgradeSymbols(h.upgrades, 'm2-summary-upgrades'));
    summary.append(row);
  }
  // Share one compact pile width across every row. Reserve only what the largest
  // H/P/D group needs, rather than leaving a fixed gap after sparse piles.
  const pileWidth = Math.max(26, ...heroes.map(h => {
    const counts = [h.dots.length, ...['P', 'D'].map(label =>
      h.cardPiles.find(pile => pile.label === label)?.cards.length || 0)];
    return Math.ceil(18 + counts.reduce((width, count) => width + (count ? count * 5.5 : 3.5), 0));
  }));
  summary.style.setProperty('--m2-piles-width', pileWidth + 'px');
  // Hero names never ellipsize. Player names surrender space first; at very narrow
  // widths the row can scroll rather than cropping the hero name or overlapping stats.
  const names = Array.from(summary.querySelectorAll('.m2-summary-identity strong'));
  const nameWidth = Math.max(0, ...names.map(name =>
    name.getBoundingClientRect().width || name.textContent.length * 6.2));
  summary.style.setProperty('--m2-name-min', Math.ceil(nameWidth + 8) + 'px');
}
// Keep rotation inside the native screen-space pan/zoom transform.
let boardRotation = null;
// Detach gesture listeners and restore the board’s native inline transform.
function clearBoardRotation() {
  if (!boardRotation) return;
  const state = boardRotation;
  state.observer.disconnect();
  state.resize?.disconnect();
  state.gestures.abort();
  state.controls.remove();
  state.svg.removeAttribute('data-m2-rotate');
  state.host.removeAttribute('data-m2-rotation-host');
  for (const key of ['--m2-native-transform', '--m2-angle', '--m2-rotation-fit'])
    state.host.style.removeProperty(key);
  boardRotation = null;
}
// Track the angle between two touch pointers. Rotation is composed with native
// pan/zoom rather than replacing their handlers; reset restores both transforms.
function updateBoardRotation() {
  const svg = q('[data-m2="board"] svg' + c('svg'));
  if (!svg) {
    clearBoardRotation();
    return;
  }
  if (boardRotation?.svg === svg) {
    boardRotation.sync();
    return;
  }
  clearBoardRotation();
  const host = svg.parentElement,
    controls = document.createElement('div');
  controls.className = 'm2-board-controls';
  controls.setAttribute('aria-label', 'Board orientation');
  const state = {
    svg,
    host,
    controls,
    angle: 0,
    observer: null,
    resize: null,
    sync: null,
    gestures: new AbortController(),
  };
  boardRotation = state;
  svg.setAttribute('data-m2-rotate', '');
  host.setAttribute('data-m2-rotation-host', '');
  const put = (key, value) => {
    if (host.style.getPropertyValue(key) !== value) host.style.setProperty(key, value);
  };
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.setAttribute('aria-label', 'Reset board zoom, pan and rotation');
  state.sync = () => {
    const native = svg.style.transform || 'translate(0px,0px) scale(1)';
    put('--m2-native-transform', native);
    put('--m2-angle', state.angle + 'deg');
    // Twisting must not change magnification; pinch owns the zoom scale.
    put('--m2-rotation-fit', '1');
    const nativeReset = q(c('zoomReset'), host),
      zoom = nativeReset?.textContent.match(/\d+%/)?.[0] || '100%';
    const label = zoom + ' · Reset';
    if (reset.textContent !== label) reset.textContent = label;
  };
  // Native pan/zoom uses Pointer Events too. Observe without consuming its events.
  const touches = new Map();
  let previousAngle = null;
  const pairAngle = () => {
    const [a, b] = Array.from(touches.values());
    return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  };
  const listen = (event, fn) =>
    host.addEventListener(event, fn, { capture: true, signal: state.gestures.signal });
  listen('pointerdown', (e) => {
    if (
      e.pointerType !== 'touch' ||
      controls.contains(e.target) ||
      !root.hasAttribute('data-m2-active')
    )
      return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    previousAngle = touches.size === 2 ? pairAngle() : null;
  });
  listen('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size !== 2) return;
    const next = pairAngle();
    if (previousAngle !== null) {
      const delta = ((next - previousAngle + 540) % 360) - 180;
      state.angle = (state.angle + delta + 360) % 360;
      state.sync();
    }
    previousAngle = next;
  });
  const end = (e) => {
    touches.delete(e.pointerId);
    previousAngle = touches.size === 2 ? pairAngle() : null;
  };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(event, end);
  on(reset, 'click', () => {
    touches.clear();
    previousAngle = null;
    state.angle = 0;
    q(c('zoomReset'), host)?.click();
    state.sync();
  });
  controls.append(reset);
  for (const event of [
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'dblclick',
    'click',
  ])
    on(controls, event, (e) => e.stopPropagation());
  host.append(controls);
  state.observer = new MutationObserver(state.sync);
  state.observer.observe(svg, { attributes: true, attributeFilter: ['style', 'viewBox'] });
  if (typeof ResizeObserver !== 'undefined') {
    state.resize = new ResizeObserver(state.sync);
    state.resize.observe(svg);
  }
  state.sync();
}
let planningActions = null;
// Create compact proxies for native take-back/finish controls. Their original click
// handlers still validate actions, while the proxies can fit the mobile layout.
function updatePlanningActions() {
  const sources = Array.from(
    document.querySelectorAll(c('takeBackBtn') + ',' + c('finishPlanningBtn')),
  );
  const host = mode === 'board' ? q('[data-m2="board"]') : q('[data-m2="hand-list"]');
  if (!sources.length || !host) {
    planningActions?.element.remove();
    planningActions = null;
    return;
  }
  if (!planningActions) {
    const element = document.createElement('div');
    element.className = 'm2-planning-actions';
    planningActions = { element, sources: [] };
    extras.add(element);
  }
  const state = planningActions;
  state.element.classList.toggle('m2-on-board', mode === 'board');
  if (state.element.parentElement !== host) host.append(state.element);
  if (
    sources.length !== state.sources.length ||
    sources.some((source, i) => source !== state.sources[i])
  ) {
    state.sources = sources;
    state.element.replaceChildren(
      ...sources.map((source) => {
        const button = document.createElement('button');
        button.type = 'button';
        on(button, 'click', () => source.click());
        return button;
      }),
    );
  }
  sources.forEach((source, i) => {
    const button = state.element.children[i];
    if (button.textContent !== source.textContent) button.textContent = source.textContent;
    button.disabled = source.disabled;
  });
}


// Use delivered upgrade counts rather than inferring completion from hero level.
function currentUpgradeRequest() {
  for (const node of document.querySelectorAll('button,[class*="_banner_"],[data-m2="sidebar"]')) {
    const request = componentProp(node, 'inputRequest');
    if (request?.type === 'UPGRADE_PHASE' && request.players) return request;
  }
  return null;
}
function remainingUpgrades(request, heroId) {
  const remaining = request?.players?.[heroId]?.remaining;
  return typeof remaining === 'number' && Number.isFinite(remaining) ? remaining : null;
}

// Proxies live in board coordinates, outside native centered wrappers. They only
// open native choices; the website retains all decision and validation handlers.
function updateChoiceLaunchers() {
  const board = q('[data-m2="board"]');
  if (!board) return;
  let host = q('.m2-choice-launchers', board);
  if (!host) {
    host = document.createElement('div');
    host.className = 'm2-choice-launchers';
    board.append(host);
    extras.add(host);
  }
  const sources = Array.from(board.querySelectorAll('button')).filter(button =>
    !button.closest('.m2-choice-launchers') && /^(Options|Setup|Upgrades?)$/i.test(button.textContent.trim())
  );
  for (const button of new Set([...(host._sources || []), ...document.querySelectorAll('[data-m2-choice-source]')])) {
    if (!sources.includes(button)) button.removeAttribute('data-m2-choice-source');
  }
  for (const source of sources) managedAttribute(source, 'data-m2-choice-source', 'true');
  const setup = !!q('[data-m2="setup"]');
  const key = JSON.stringify([setup, sources.map(button => [button.textContent, button.disabled])]);
  if (host._sources?.length === sources.length && host._sources.every((source, i) => source === sources[i]) && host.dataset.key === key) return;
  host._sources = sources;
  host.dataset.key = key;
  host.replaceChildren();
  for (const source of sources) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = source.textContent.trim();
    button.disabled = source.disabled;
    button.onclick = () => source.click();
    host.append(button);
  }
  if (setup && !sources.some(button => /^Setup$/i.test(button.textContent.trim()))) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Setup';
    button.onclick = () => navigate('setup');
    host.append(button);
  }
  host.hidden = !host.children.length;
}
