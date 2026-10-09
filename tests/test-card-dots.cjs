const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function setup(t) {
  const f = browserFixture({
    html: `<header class="_bar_test"><span class="_phase_test">PLANNING</span></header>
      <aside class="_sidebar_test"><section><div class="_name_test">Test (You)</div>
      <div class="_details_test">Lv 4</div></section></aside>`,
    hooks: ['refresh'],
  });
  t.after(() => f.close());
  const cards = [
    { color: 'RED', tier: 'I' },
    { color: 'GREEN', tier: 'II' },
    { color: 'BLUE', tier: 'III' },
    { color: 'RED', tier: 2 },
    { color: 'GOLD', tier: 'I' },
    { color: 'SILVER', tier: 'I' },
    { color: 'PURPLE', tier: 'III' },
    { color: 'BLUE', tier: 'III', is_facedown: true },
    { color: 'RED' },
  ].map((card, i) => ({ ...card, id: 'card_' + i, name: 'Card ' + i, secondary_actions: {} }));
  const hero = {
    id: 'hero_test',
    name: 'Test',
    team: 'RED',
    level: 4,
    gold: 0,
    items: {},
    played_cards: cards,
    discard_pile: cards,
    hand: cards,
    current_turn_card: null,
  };
  const { d } = f;
  const source = d.querySelector('section');
  for (const card of cards) {
    const dot = d.createElement('i');
    dot.className = '_handColorDot_test';
    dot.style.backgroundColor = card.color === 'GOLD' ? '#dec768' : '#659bc9';
    source.append(dot);
  }
  source.__reactFiber$test = { memoizedProps: { hero } };
  d.querySelector('aside').__reactFiber$test = {
    memoizedProps: {
      view: {
        phase: 'PLANNING',
        turn: 1,
        effects: [],
        board: { entity_locations: { hero_test: {} } },
      },
    },
  };
  f.install();
  return { ...f, cards, source };
}

test('Hand, Played and Discard retain plain colored dots regardless of card tier', (t) => {
  const { w, d, cards, source } = setup(t);
  const groups = [...d.querySelectorAll('.m2-summary-piles > span')];
  assert.equal(groups.length, 3);
  for (const group of groups) {
    const dots = [...group.querySelectorAll('i')];
    assert.equal(dots.length, cards.length);
    for (const dot of dots) {
      assert.equal(dot.childElementCount, 0, 'dots have no decorative children');
      assert.equal(w.getComputedStyle(dot).width, '4px');
      assert.equal(w.getComputedStyle(dot).height, '4px');
      assert.equal(w.getComputedStyle(dot).borderRadius, '50%');
      assert(dot.style.getPropertyValue('--effect-color'), 'dots retain their color');
    }
  }
  for (const marker of source.querySelectorAll('.m2-history-marker')) {
    assert.equal(marker.childElementCount, 0);
    assert.equal(w.getComputedStyle(marker).width, '7px');
    assert.equal(w.getComputedStyle(marker).borderRadius, '50%');
  }
});

test('plain dots retain active-effect glow and inspection; hidden cards clear effects and disable inspection', (t) => {
  const { w, d, cards, source } = setup(t);
  cards[0].is_active = true;
  w.testUI.refresh();
  const marker = d.querySelector('.m2-summary-piles > span:nth-child(2) i');
  assert(marker.classList.contains('m2-effect-active'));
  assert.equal(marker.childElementCount, 0);
  const slot = source.querySelector('.m2-micro-history-slot button');
  d.querySelector('[data-mode="heroes"]').click();
  slot.click();
  assert(d.querySelector('#goa2-m2-hero-display .m2-text-card'));
  cards[0].is_facedown = true;
  w.testUI.refresh();
  d.querySelector('[data-mode="heroes"]').click();
  const hidden = d.querySelector('.m2-summary-piles > span:nth-child(2) i');
  assert.equal(hidden.childElementCount, 0);
  assert(!hidden.classList.contains('m2-effect-active'));
  assert.equal(hidden.title, 'Hidden card');
  assert(source.querySelector('.m2-micro-history-slot button').disabled);
});
