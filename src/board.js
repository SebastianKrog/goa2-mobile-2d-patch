// 7. Header, settings, compact Board summaries, and gestures
// Derive a compact HUD from native labels and controls without changing the phase.
function updateMobileHeader(header) {
  if (!header) return;
  let hud = q('.m2-hud', header);
  if (!hud) {
    hud = document.createElement('div');
    hud.className = 'm2-hud';
    hud.innerHTML =
      '<div class="m2-hud-top"><div class="m2-life red"><img src="/icons/life_counter_red_front.png" alt="Orange lives"><b></b></div><div class="m2-round"><span></span><span></span></div><div class="m2-coin"><img alt="Tie breaker"><small></small></div><div class="m2-waves"><img src="/icons/wave_counter.png" alt="Waves"><b></b></div><div class="m2-life blue"><b></b><img src="/icons/life_counter_blue_front.png" alt="Blue lives"></div></div><div class="m2-hud-bottom"><div class="m2-phase"></div><div class="m2-status"></div></div>';
    header.append(hud);
    extras.add(hud);
  }
  const put = (sel, text) => {
    const e = q(sel, hud);
    if (e.textContent !== text) e.textContent = text;
  };
  for (const [team, cls] of [
    ['Red', 'red'],
    ['Blue', 'blue'],
  ])
    put(
      '.' + cls + ' b',
      q('[aria-label^="' + team + ' team"] [data-m2-fraction]', header)?.dataset.m2Fraction ||
        '—',
    );
  const meta = q(c('matchMeta'), header);
  put('.m2-round span:first-child', meta?.children[0]?.textContent || '');
  put('.m2-round span:last-child', meta?.children[2]?.textContent || '');
  const coin = q(c('tieBreaker'), header),
    img = q('.m2-coin img', hud);
  if (coin && img.getAttribute('src') !== coin.getAttribute('src'))
    img.src = coin.getAttribute('src');
  put('.m2-coin small', coin?.getAttribute('src')?.includes('orange') ? 'Orange' : 'Blue');
  const lanes = Array.from(header.querySelectorAll(c('waveLane')));
  put(
    '.m2-waves b',
    lanes
      .map((e) => e.getAttribute('aria-label')?.match(/(\d+) Wave/i)?.[1] || '0')
      .join(' / ') || '0',
  );
  put('.m2-phase', q(c('phase'), header)?.textContent || '');
  const status = q(c('statusCopy'), header);
  const title = q('strong', status || header)?.textContent || '';
  const rawDetail = q(c('statusDetail'), status || header)?.textContent || '';
  const detail =
    /locked in$/i.test(title) && rawDetail.includes(' · ')
      ? rawDetail.slice(rawDetail.lastIndexOf(' · ') + 3)
      : rawDetail;
  put('.m2-status', title + (detail ? '\n' + detail : ''));
  const height = Math.ceil(hud.getBoundingClientRect().height) + 10;
  if (height > 10 && root.style.getPropertyValue('--m2-head') !== height + 'px')
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
let summaryView = 'turn';
try {
  const saved = localStorage.getItem('goa2-mobile-summary');
  if (['turn', 'stats', 'cards'].includes(saved))
    summaryView = saved === 'cards' ? 'turn' : saved;
} catch {}
// Shared slim/normal row structure: initiative, colored primary/name/range band,
// then secondary stats. Adapt the contents while preserving native row click handlers.
function updateCardRow(row, card, knownItems) {
  const items = knownItems || cardUpgrades(card, row);
  const symbol = (key, value) => upgradedSymbol(items, key, value);
  const key = JSON.stringify([card, items]);
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
  view.replaceChildren();
  row.classList.add('m2-adapted-row');
  const ultimate = card.tier === 'IV' || card.color === 'PURPLE';
  const initiative = ultimate
    ? document.createElement('span')
    : symbol('INITIATIVE', card.initiative);
  const band = document.createElement('span');
  band.className = 'm2-list-band';
  band.style.setProperty('--card-color', cardColors[card.color] || '#bbc3cf');
  const value = card.primary_action_value;
  if (!ultimate && card.primary_action)
    band.append(
      symbol(
        card.primary_action,
        value != null && String(value) !== '0' && String(value) !== '!' ? value : undefined,
      ),
    );
  const name = document.createElement('span');
  name.className = 'm2-list-name';
  name.textContent = card.name;
  band.append(name);
  if (relevantStat(card, 'RANGE', card.range_value))
    band.append(symbol('RANGE', card.range_value));
  else if (relevantStat(card, 'RADIUS', card.radius_value))
    band.append(symbol('RADIUS', card.radius_value));
  const secondary = document.createElement('span');
  secondary.className = 'm2-list-secondary';
  for (const stat of ['MOVEMENT', 'DEFENSE', 'ATTACK']) {
    const v = card.secondary_actions?.[stat];
    if (stat !== card.primary_action && relevantStat(card, stat, v))
      secondary.append(symbol(stat, v));
  }
  view.append(initiative, band, secondary);
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
// Board’s compact hero list shares full-dashboard card colors and active-effect
// markers. Its two modes show turn/cards or level/gold/upgrades.
function renderSummary(heroes) {
  const key = JSON.stringify([summaryView, heroes]);
  if (summary.dataset.key === key) return;
  summary.dataset.key = key;
  summary.replaceChildren();
  const controls = document.createElement('div');
  controls.className = 'm2-summary-controls';
  controls.setAttribute('aria-label', 'Hero overview information');
  for (const [value, label] of [
    ['turn', 'Turn / Cards'],
    ['stats', 'Level / Gold'],
  ]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(summaryView === value));
    on(b, 'click', () => {
      summaryView = value;
      try {
        localStorage.setItem('goa2-mobile-summary', value);
      } catch {}
      refresh();
    });
    controls.append(b);
  }
  summary.append(controls);
  for (const h of heroes) {
    const a = document.createElement('article'),
      name = document.createElement('strong'),
      content = document.createElement('small');
    name.textContent = h.name;
    name.style.color = h.color;
    if (h.resolution?.current) a.classList.add('m2-current-hero');
    if (h.done) a.classList.add('m2-done-hero');
    content.className = 'm2-summary-content';
    if (summaryView === 'stats') {
      const stats = document.createElement('span');
      if (h.level != null)
        stats.append(document.createTextNode('Lv ' + h.level + ' • '), goldSymbol(h.gold));
      else stats.textContent = h.detail;
      content.append(stats);
      // Item icons occupy the dashboard’s upper-right slot; they are not extra card rows.
  const upgrades = document.createElement('span');
      upgrades.className = 'm2-summary-upgrades';
      for (const [stat, value] of Object.entries(h.upgrades || {}))
        if (
          ['ATTACK', 'DEFENSE', 'INITIATIVE', 'RANGE', 'MOVEMENT', 'RADIUS'].includes(stat) &&
          typeof value === 'number' &&
          value > 0
        )
          upgrades.append(cardSymbol(stat, '+' + value));
      content.append(upgrades);
    } else {
      const turn = document.createElement('span');
      turn.className = 'm2-summary-turn';
      if (h.resolution) {
        turn.append(
          document.createTextNode((h.resolution.current ? 'NOW' : h.resolution.order) + ' '),
          cardSymbol('INITIATIVE', h.resolution.initiative),
        );
        turn.title = h.resolution.card;
      } else if (h.planning) {
        turn.textContent = h.committed ? '✓ Selected' : 'Selecting';
        if (!h.committed) {
          const dots = document.createElement('span');
          dots.className = 'm2-selecting-dots';
          dots.textContent = '...';
          dots.setAttribute('aria-hidden', 'true');
          turn.append(dots);
        }
      } else turn.textContent = h.done ? '✓ Done' : '—';
      const piles = document.createElement('span');
      piles.className = 'm2-summary-piles';
      const add = (label, cards) => {
        const group = document.createElement('span');
        group.append(document.createTextNode(label + ' '));
        for (const card of cards) {
          const dot = document.createElement('i');
          dot.style.backgroundColor = card.color;
          dot.style.setProperty('--effect-color', card.color);
          dot.title = card.name || label;
          if (card.active) dot.classList.add('m2-effect-active');
          group.append(dot);
        }
        if (!cards.length) group.append(document.createTextNode('—'));
        piles.append(group);
      };
      add(
        'H',
        h.dots.map((color) => ({ color })),
      );
      for (const pile of h.cardPiles) add(pile.label, pile.cards);
      content.append(piles);
      if (h.currentCard) {
        const mini = document.createElement('span');
        mini.className = 'm2-mini-current';
        const card = h.currentCard;
        mini.title = card.is_facedown ? 'Current card (hidden)' : card.name;
        mini.setAttribute('aria-label', mini.title);
        mini.style.setProperty('--card-color', cardColors[card.color] || '#858c98');
        if (card.is_facedown) mini.textContent = '?';
        else mini.append(cardSymbol(card.primary_action || 'SKILL'));
        content.append(mini);
      }
      content.append(turn);
    }
    a.append(name, content);
    summary.append(a);
  }
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

