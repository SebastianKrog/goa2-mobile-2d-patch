const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function setup(t) {
  const f = browserFixture({
    html: `<header class="_bar_test"><span class="_phase_test">PLANNING</span></header>
      <div class="_boardArea_test"></div><aside class="_sidebar_test">
      <section id="own"><div class="_name_test">Emmitt (You)</div><div class="_details_test">Lv 3</div></section>
      <section id="other"><div class="_name_test">Emmitt · Opponent</div><div class="_details_test">Lv 3</div></section></aside>`,
    hooks: ['refresh', 'heroCommittedCards'],
  });
  t.after(() => f.close());
  const card = (id) => ({
    id,
    name: id,
    color: id === 'First' ? 'BLUE' : 'RED',
    tier: 'II',
    initiative: 9,
    primary_action: 'ATTACK',
    primary_action_value: 4,
    secondary_actions: { MOVEMENT: 2, DEFENSE: 3 },
    effect_text: id + ' rules',
    is_facedown: false,
  });
  const first = card('First'),
    second = card('Second');
  const hero = {
    id: 'hero_emmitt',
    name: 'Emmitt',
    team: 'BLUE',
    level: 3,
    gold: 0,
    current_turn_card: null,
    extra_turn_card: null,
    can_commit_second_card: true,
    hand: [first, second],
    deck: [first, second],
    played_cards: [],
    discard_pile: [],
    items: { ATTACK: 1, DEFENSE: 2 },
  };
  const other = { ...hero, id: 'other_emmitt', hand: [], deck: { count: 9 }, items: {} };
  const view = {
    phase: 'PLANNING',
    turn: 1,
    effects: [],
    teams: { BLUE: { heroes: [hero, other] } },
  };
  f.d.querySelector('#own').__reactFiber$t = { memoizedProps: { hero } };
  f.d.querySelector('#other').__reactFiber$t = { memoizedProps: { hero: other } };
  f.d.querySelector('aside').__reactFiber$t = { memoizedProps: { view, myHeroId: hero.id } };
  f.install();
  return { ...f, hero, other, view, first, second };
}
const ownRow = (d) =>
  [...d.querySelectorAll('#goa2-m2-summary article')].find((row) =>
    row.querySelector('.m2-summary-identity')?.textContent.includes('(You)'),
  );

test('Emmitt transitions from highlighted Hand to one and two commitments, then back to one', (t) => {
  const { d, w, hero, first, second, view } = setup(t);
  const refresh = () => w.testUI.refresh();
  const current = () => d.querySelector('#own .m2-hero-current-mini');
  assert.equal(current().querySelector('.m2-current-card-pair'), null);
  assert.equal(
    current().querySelector('.m2-current-card-mini'),
    null,
    'available Hand cards are never treated as committed',
  );
  hero.extra_turn_card = { id: first.id, is_facedown: true };
  refresh();
  assert.equal(
    current().querySelector('.m2-current-card-mini').getAttribute('aria-label'),
    'First',
  );
  assert.equal(current().querySelector('.m2-current-card-pair'), null);
  hero.current_turn_card = { ...second, is_facedown: true };
  hero.can_commit_second_card = false;
  refresh();
  const pair = current().querySelector('.m2-current-card-pair');
  assert(pair);
  assert.equal(pair.querySelectorAll('.m2-mini-current.m2-micro-hero').length, 2);
  assert.equal(current().querySelector('.m2-current-card-mini'), null);
  assert.equal(pair.querySelectorAll('.m2-micro-no-grant').length, 2);
  assert.equal(pair.querySelector('.m2-micro-cap .m2-symbol-value').textContent, '9');
  assert.equal(pair.querySelector('.m2-micro-grant'), null);
  assert.deepEqual(
    [...pair.children].map((b) => b.getAttribute('aria-label')),
    ['Second', 'First'],
  );
  assert.equal(
    pair.querySelector('.m2-mini-current .m2-symbol-value').textContent,
    '5',
    'Micro applies Attack upgrade',
  );
  assert.equal(
    pair.firstElementChild.querySelector('.m2-symbol[title="Defense"]').textContent,
    '5',
  );
  assert.equal(w.getComputedStyle(pair).display, 'grid');
  assert.match(w.getComputedStyle(pair).gridTemplateColumns, /repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.equal(w.getComputedStyle(pair).justifyItems, 'center');
  assert.equal(w.getComputedStyle(current()).height, '26px');
  const boardPair = ownRow(d).querySelector('.m2-summary-current-slot .m2-current-card-pair');
  assert.equal(boardPair.querySelectorAll('.m2-nano-card').length, 2);
  assert.equal(boardPair.querySelector('.m2-symbol-value').textContent, '5');
  assert.equal(w.getComputedStyle(boardPair.parentElement).width, '70px');
  assert.equal(w.getComputedStyle(boardPair).justifyItems, 'center');
  assert.equal(hero.extra_turn_card.is_facedown, true, 'recovery never changes native visibility');
  assert.equal(hero.current_turn_card.is_facedown, true);
  d.querySelector('[data-mode="heroes"]').click();
  current().querySelectorAll('.m2-current-card-pair button')[1].click();
  assert.match(d.querySelector('#goa2-m2-hero-display').textContent, /First rules/);
  assert.match(d.querySelector('#goa2-m2-hero-display .m2-card-type').textContent, /5/);
  assert.match(d.querySelector('#goa2-m2-hero-display .m2-card-type').textContent, /5/);
  hero.extra_turn_card = null;
  refresh();
  assert.equal(current().querySelector('.m2-current-card-pair'), null);
  assert.equal(
    current().querySelector('.m2-current-card-mini').getAttribute('aria-label'),
    'Second',
  );
  hero.extra_turn_card = first;
  refresh();
  assert.equal(
    current().querySelectorAll('.m2-current-card-pair button').length,
    2,
    'an extra-only update rebuilds the cached dashboard',
  );
  view.phase = 'RESOLUTION';
  hero.current_turn_card = second;
  hero.hand = [];
  refresh();
  assert.equal(current().querySelectorAll('.m2-current-card-pair button').length, 2);
  // Selecting which committed card to retrieve can leave either slot populated.
  hero.current_turn_card = null;
  refresh();
  assert.equal(
    current().querySelector('.m2-current-card-mini').getAttribute('aria-label'),
    'First',
  );
  hero.extra_turn_card = null;
  hero.played_cards = [second];
  refresh();
  assert.equal(current().querySelector('.m2-current-card-pair'), null);
  assert.equal(current().querySelector('.m2-current-card-mini'), null);
});

test('both Nano cards inspect independently, glow independently, and survive focused Board navigation', (t) => {
  const { d, w, hero, first, second, view } = setup(t);
  hero.current_turn_card = second;
  hero.extra_turn_card = first;
  hero.hand = [];
  hero.deck = [];
  view.effects = [{ is_active: true, source_card_id: first.id }];
  w.testUI.refresh();
  let pair = ownRow(d).querySelector('.m2-current-card-pair');
  assert(!pair.children[0].classList.contains('m2-effect-active'));
  assert(pair.children[1].classList.contains('m2-effect-active'));
  pair.children[1].click();
  assert.match(d.querySelector('#goa2-m2-hero-display').textContent, /First rules/);
  assert.match(d.querySelector('#goa2-m2-hero-display .m2-card-type').textContent, /5/);
  pair = ownRow(d).querySelector('.m2-current-card-pair');
  pair.children[0].click();
  assert.match(d.querySelector('#goa2-m2-hero-display').textContent, /Second rules/);
  ownRow(d).querySelector('.m2-summary-identity').click();
  const focusPair = d.querySelector('.m2-focused-hero .m2-current-card-pair');
  assert.equal(focusPair.querySelectorAll('.m2-micro-hero').length, 2);
  focusPair.children[1].click();
  assert.match(d.querySelector('#goa2-m2-hero-display').textContent, /First rules/);
  assert.match(d.querySelector('#goa2-m2-hero-display .m2-card-type').textContent, /5/);
});

test('opponent commitments stay masked until reveal, including identical anonymous IDs', (t) => {
  const { d, w, other, view } = setup(t);
  other.current_turn_card = {
    id: 'hidden',
    name: 'Secret A',
    color: 'RED',
    primary_action: 'ATTACK',
    primary_action_value: 99,
    is_facedown: true,
  };
  other.extra_turn_card = { ...other.current_turn_card, name: 'Secret B' };
  w.testUI.refresh();
  let pair = d.querySelector('#other .m2-current-card-pair');
  assert.equal(pair.querySelectorAll('button').length, 2);
  assert(
    [...pair.children].every((b) => b.disabled && b.getAttribute('aria-label') === 'Hidden card'),
  );
  assert.equal(pair.querySelectorAll('.m2-symbol-value').length, 0);
  assert(!pair.textContent.includes('Secret'));
  const row = [...d.querySelectorAll('#goa2-m2-summary article')].find((row) =>
    row.textContent.includes('Opponent'),
  );
  assert.equal(row.querySelectorAll('.m2-current-card-pair .m2-nano-card').length, 2);
  assert([...row.querySelectorAll('.m2-current-card-pair button')].every((b) => b.disabled));
  view.phase = 'RESOLUTION';
  other.current_turn_card = { ...other.current_turn_card, id: 'A', is_facedown: false };
  other.extra_turn_card = { ...other.extra_turn_card, id: 'B', is_facedown: false };
  w.testUI.refresh();
  pair = d.querySelector('#other .m2-current-card-pair');
  assert([...pair.children].every((b) => !b.disabled));
  pair.children[1].click();
  assert.match(d.querySelector('#goa2-m2-hero-display').textContent, /Secret B/);
});
