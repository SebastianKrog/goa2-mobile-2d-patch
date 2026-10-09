// Exercise the roadmap interactions using public React props, including Razzle's
// multi-figure ownership and transitions from current to resolved cards.
const { JSDOM } = require('jsdom');
const fs = require('fs'),
  assert = require('assert');
const dom = new JSDOM(
  '<div><header class="_bar_x"><span class="_phase_x">RESOLUTION</span></header><div class="_boardArea_x"></div><div class="_sidebar_x"></div></div><div class="_container_x"><div class="_entry_x"><span class="_initiative_x">8</span><span class="_heroName_x">Razzle</span><span class="_cardName_x">Glitch</span></div><div class="_entry_x"><span class="_initiative_x">7</span><span class="_heroName_x">Emmitt</span><span class="_cardName_x">Time</span></div></div>',
  {
    url: 'https://goa2.frontend.pedroliv.dev/game/fixture?3d=0',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  },
);
const w = dom.window,
  d = w.document;
w.matchMedia = () => ({ matches: true, addEventListener() {} });
const card = {
  id: 'glitch',
  name: 'Glitch',
  color: 'SILVER',
  primary_action: 'DEFENSE',
  primary_action_value: 2,
  initiative: 8,
  secondary_actions: { MOVEMENT: 1, DEFENSE: 2 },
  effect_text: 'Place a :glitch_token: and a :poison_marker:. Keep :unknown_token:.',
};
const discard = {
  ...card,
  id: 'discard',
  name: 'Discarded',
  primary_action: 'SKILL',
  is_active: true,
};
const hero = {
  id: 'hero_razzle',
  name: 'Razzle',
  level: 1,
  gold: 0,
  team: 'BLUE',
  items: { DEFENSE: 1 },
  played_cards: [null, null, null, null],
  current_turn_card: card,
  discard_pile: [],
  hand: [],
};
const view = {
  phase: 'RESOLUTION',
  turn: 1,
  board: { entity_locations: { razzle_piece_2: {} } },
  hero_pieces: {
    razzle_piece_1: { owner_hero_id: 'hero_razzle' },
    razzle_piece_2: { owner_hero_id: 'hero_razzle' },
  },
  effects: [],
};
const sidebar = d.querySelector('._sidebar_x');
sidebar.__reactFiber$test = { memoizedProps: { view } };
const box = d.createElement('section');
box.innerHTML =
  '<div class="_name_x"><span style="color:blue">Razzle</span> · Player</div><div class="_details_x">Lv 1<i class="_handColorDot_x" style="background-color:green"></i></div>';
box.__reactFiber$test = { memoizedProps: { hero } };
sidebar.append(box);
w.eval(
  fs
    .readFileSync('dist/goa2-mobile-2d.user.js', 'utf8')
    .replace(
      /window\.GOA2Mobile2D\s*=\s*\{/,
      'window.__ui={refresh,heroOffboard,ordinalTurn};window.GOA2Mobile2D={',
    ),
);
const refresh = w.__ui.refresh;
try {
  assert.equal(w.__ui.heroOffboard(hero, view), false, 'one Razzle figure remains alive');
  assert(!box.querySelector('.m2-offboard-label'));
  // These are real stylesheet/cascade checks, not merely DOM class assertions.
  // A selector accidentally nested in another rule must fail this fixture.
  const sheet = d.querySelector('#goa2-m2-style').sheet;
  assert(sheet && sheet.cssRules.length > 100, 'entire stylesheet parses');
  const topLevelSelectors = [...sheet.cssRules].map((rule) => rule.selectorText || '');
  assert(
    topLevelSelectors.some((selector) => selector.includes('.m2-hero-current-mini')),
    'Micro layout rules must be top-level',
  );
  const current = box.querySelector('.m2-hero-current-mini');
  assert.equal(w.getComputedStyle(current).gridColumn, '1/-1');
  assert.equal(w.getComputedStyle(current).gridRow, '3');
  assert.equal(current.querySelector('.m2-hero-played-label').textContent, 'Played:');
  assert(current.querySelector('.m2-list-name').textContent === 'Glitch');
  assert.equal(w.getComputedStyle(current.querySelector('button')).height, '26px');
  const microSlots = box.querySelector('.m2-hero-micro-slots');
  assert.equal(w.getComputedStyle(microSlots).gridTemplateColumns, 'repeat(5, 64px)');
  const rowStyle = w.getComputedStyle(d.querySelector('#goa2-m2-summary > article'));
  assert.equal(rowStyle.display, 'grid');
  assert.equal(
    rowStyle.gridTemplateColumns.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')'),
    '23px minmax(var(--m2-name-min, 70px), 1fr) 45px minmax(var(--m2-piles-width, 48px), max-content) 70px 62px',
  );
  assert.equal(w.getComputedStyle(d.querySelector('.m2-summary-identity')).display, 'flex');
  assert.equal(w.getComputedStyle(d.querySelector('.m2-micro-board')).width, '70px');
  assert.equal(w.getComputedStyle(box.querySelector('.m2-hero-history')).gridColumn, '2');
  assert.equal(w.getComputedStyle(box.querySelector('.m2-hero-upgrades')).gridRow, '1/3');
  assert.equal(w.getComputedStyle(current).borderTopWidth, '0px');
  assert.equal(w.getComputedStyle(microSlots).borderTopWidth, '1px', 'one divider above history');
  assert.equal(w.getComputedStyle(microSlots).marginTop, '4px');
  assert.equal(w.getComputedStyle(microSlots).paddingTop, '2px');
  assert.equal(
    box.querySelectorAll('.m2-history-played,.m2-history-discard,.m2-history-slot').length,
    0,
    'duplicate hidden history controls are removed',
  );
  assert.equal(
    box.querySelectorAll('.m2-history-pile:not([hidden])').length,
    1,
    'Hand dots stay visible',
  );
  assert.equal(w.getComputedStyle(d.querySelector('.m2-summary-identity strong')).maxWidth, 'none');
  assert.equal(
    w.getComputedStyle(d.querySelector('.m2-summary-identity strong')).overflow,
    'visible',
  );
  assert.equal(w.getComputedStyle(box.querySelector('.m2-gold-value')).fontSize, '12px');
  assert.equal(w.getComputedStyle(box.querySelector('.m2-hero-history')).fontSize, '10px');
  const itemStyle = w.getComputedStyle(box.querySelector('.m2-hero-upgrades > .m2-symbol'));
  assert.equal(itemStyle.width, '22px');
  assert.equal(w.getComputedStyle(box.querySelector('.m2-hero-upgrades')).gap, '3px');
  assert(box.querySelector('.m2-hero-history .m2-gold-overlay'));
  const emptySlot = box.querySelector('.m2-history-empty');
  assert.equal(w.getComputedStyle(emptySlot).borderTopWidth, '1px');
  assert.equal(
    w.getComputedStyle(box.querySelector('.m2-micro-history-slot:last-child')).borderTopWidth,
    '0px',
    'empty Discard has no outline',
  );
  assert.equal(
    w.getComputedStyle(emptySlot.querySelector('.m2-micro-placeholder')).textAlign,
    'center',
  );

  assert.equal(
    w.__ui.heroOffboard(hero, {
      board: { entity_locations: { unrelated: {} } },
      hero_pieces: view.hero_pieces,
    }),
    true,
  );
  assert.equal(w.__ui.heroOffboard(hero, {}), null, 'missing board data is not death');
  assert.equal(w.__ui.ordinalTurn(2).textContent, '2nd');
  assert.equal(w.__ui.ordinalTurn(13).querySelector('sup').textContent, 'th');
  assert.equal(d.querySelector('.m2-summary-turn b').textContent, '1.');
  d.querySelector('#goa2-m2-summary .m2-micro-button').click();
  let viewer = d.querySelector('#goa2-m2-hero-display');
  assert.equal(viewer.querySelector('.m2-card-top b').textContent, 'Glitch');
  assert(
    d
      .querySelector('#goa2-m2-style')
      .textContent.includes('[data-m2-mode="board"] #goa2-m2-hero-display:not(:empty)'),
    'Board must expose the card viewer in CSS',
  );
  assert.deepEqual(
    [...viewer.querySelectorAll('.m2-rule-icon')].map((img) => img.getAttribute('src')),
    ['/icons/token_glitch.png', '/icons/marker_poison.png'],
  );
  assert(viewer.textContent.includes(':unknown_token:'), 'unrecognized markup remains readable');
  viewer.querySelector('.m2-card-dismiss').click();
  const originalParent = box.parentElement;
  const listHeight = d.documentElement.style.getPropertyValue('--m2-summary-h');
  const summary = d.querySelector('#goa2-m2-summary');
  summary.scrollLeft = 24;
  summary.scrollTop = 12;
  d.querySelector('.m2-summary-identity').click();
  assert.equal(summary.scrollLeft, 0, 'focus must start at the left edge');
  assert.equal(summary.scrollTop, 0);
  const focusStyle = w.getComputedStyle(d.querySelector('.m2-focused-hero'));
  assert.equal(focusStyle.width, '100%');
  assert.equal(focusStyle.boxSizing, 'border-box');
  assert.equal(focusStyle.minWidth, '0px');
  assert.equal(w.getComputedStyle(summary).overflowX, 'hidden');
  assert.equal(
    w.getComputedStyle(summary).height,
    'auto',
    'focused entry floats at its natural height',
  );
  assert(d.querySelector('.m2-summary-focused .m2-focused-hero'));
  assert(!d.querySelector('.m2-focused-hero .m2-expanded-board'), 'focused hero stays compact');
  assert.equal(box.parentElement, originalParent, 'focus never reparents the React-owned hero');
  assert.equal(d.querySelectorAll('.m2-summary-focused .m2-micro-history-slot').length, 5);
  const back = d.querySelector('.m2-focus-back');
  assert.equal(back.textContent, '◀');
  assert.equal(w.getComputedStyle(back).position, 'absolute');
  assert.equal(w.getComputedStyle(back).display, 'grid');
  assert.equal(
    w.getComputedStyle(d.querySelector('.m2-focused-hero .m2-resolution-info')).display,
    'none',
  );

  d.querySelector('.m2-focus-back').click();
  assert(!d.querySelector('.m2-focused-hero'));
  assert.equal(d.documentElement.style.getPropertyValue('--m2-summary-h'), listHeight);
  assert(d.querySelector('.m2-summary-turn'));
  hero.current_turn_card = null;
  hero.played_cards[0] = card;
  hero.discard_pile = [discard];
  d.querySelector('._container_x').remove();
  refresh();
  assert(
    d.querySelector('#goa2-m2-summary .m2-card-resolved .m2-mini-current'),
    'resolved card retained and faded',
  );
  assert(!box.querySelector('.m2-current-card-mini'), 'resolved card belongs in turn history');
  assert(box.querySelector('.m2-current-card-slot'), 'keep the empty Mini slot after resolution');
  assert.equal(w.getComputedStyle(box.querySelector('.m2-hero-current-mini')).height, '26px');
  assert.equal(w.getComputedStyle(box.querySelector('.m2-current-card-slot')).height, '26px');
  assert.equal(box.querySelectorAll('.m2-micro-history-slot').length, 5);
  const slots = box.querySelectorAll('.m2-micro-history-slot');
  assert(slots[0].querySelector('.m2-mini-current'));
  assert.equal(slots[1].textContent, 'Turn 2');
  assert(slots[4].querySelector('.m2-effect-active .m2-nano-card'));
  assert.equal(slots[4].lastElementChild.textContent, 'Discard');
  assert.equal(
    w.getComputedStyle(slots[4].lastElementChild).position,
    'absolute',
    'Nano cards overlay Discard text',
  );
  assert.equal(w.getComputedStyle(slots[4]).height, '24px');
  assert.equal(w.getComputedStyle(slots[4]).borderTopWidth, '0px');
  assert.equal(w.getComputedStyle(box.querySelector('.m2-history-pile')).gap, '3px');
  assert.equal(slots[4].querySelector('.m2-upgraded-value').textContent, '3');
  assert(!box.querySelector('.m2-hero-effects'), 'effects are shown on cards, not separate badges');
  slots[4].querySelector('button').click();
  assert.equal(d.querySelector('#goa2-m2-hero-display .m2-card-top b').textContent, 'Discarded');
  // One/two discards are centered; larger piles overlap equally inside 64px.
  for (const count of [1, 2, 3, 4, 5]) {
    hero.discard_pile = Array.from({ length: count }, (_, i) => ({
      ...discard,
      id: 'discard-' + i,
    }));
    refresh();
    const pile = box.querySelector('.m2-discard-cards');
    const gap = Number.parseFloat(pile.style.getPropertyValue('--m2-discard-gap'));
    const occupied = count * 20 + (count - 1) * gap;
    assert(occupied <= 64.001);
    assert.equal(w.getComputedStyle(pile).justifyContent, 'center');
    assert.equal(w.getComputedStyle(pile.closest('.m2-micro-history-slot')).height, '24px');
    assert.equal(pile.querySelectorAll('.m2-nano-card').length, count);
  }
  hero.discard_pile = [{ ...discard, is_facedown: true }];
  refresh();
  assert(
    !d.querySelector('#goa2-m2-hero-display .m2-text-card'),
    'viewer closes when card becomes hidden',
  );
  assert(slots[4].isConnected === false);
  assert.equal(
    box.querySelectorAll('.m2-nano-card img').length,
    0,
    'hidden discard values stay private',
  );
  view.board.entity_locations = {};
  refresh();
  assert(box.querySelector('.m2-offboard-label'), 'all Razzle figures removed means off board');
  view.phase = 'PLANNING';
  hero.played_cards = [null, null, null, null];
  hero.current_turn_card = { ...card, is_facedown: true };
  refresh();
  assert(box.querySelector('.m2-hero-micro-slots'), 'five history slots remain during planning');
  assert(!box.querySelector('.m2-current-card-mini'));
  assert.equal(
    box.querySelector('.m2-current-card-slot .m2-selection-status').textContent,
    'Selected',
  );
  console.log(
    'PASS: Board focus/back and inspection, five history slots, resolved cards, Nano defense glow, ordinal portraits, Razzle figures, inline tokens and privacy',
  );
} finally {
  w.GOA2Mobile2D.destroy();
  w.close();
}
