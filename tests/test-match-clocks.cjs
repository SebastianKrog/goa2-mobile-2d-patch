const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

test('Hero clocks mirror native pools by identity and update without a second timer', (t) => {
  const f = browserFixture({
    html: `<header class="_bar_test"><span class="_phase_test">PLANNING</span>
      <div class="_list_test"><div class="_clock_test"><span class="_hero_test">Arien</span>
      <span class="_pools_test"><span><small>Plan</small><strong>7:38</strong></span>
      <span class="_bank_test"><small>Bank</small><strong>20:00</strong></span></span></div>
      <div class="_clock_test"><span class="_hero_test">Dodger</span>
      <span class="_pools_test"><span><small>Plan</small><strong>Locked</strong></span>
      <span class="_bank_test"><small>Bank</small><strong>20:00</strong></span></span></div></div></header>
      <div class="_sidebar_test"><section id="dodger"><div class="_name_test">Dodger · B</div>
      <div class="_details_test">Lv 1</div></section><section id="arien"><div class="_name_test">Arien · A (You)</div>
      <div class="_details_test">Lv 1</div></section></div>`,
    hooks: ['refresh', 'heroDisplayName'],
  });
  t.after(() => f.close());
  const { w, d } = f;
  const heroes = ['arien', 'dodger'].map((id) => ({
    id,
    name: id,
    played_cards: [],
    hand: [],
    items: {},
  }));
  const clock = {
    status: 'RUNNING',
    players: { arien: { running: true }, dodger: { running: false } },
  };
  const view = { phase: 'PLANNING', turn: 1 };
  for (const hero of heroes)
    d.getElementById(hero.id).__reactFiber$test = { memoizedProps: { hero } };
  for (const node of d.querySelectorAll('._clock_test'))
    node.__reactFiber$test = { memoizedProps: { heroes, clock } };
  d.querySelector('._sidebar_test').__reactFiber$test = { memoizedProps: { view } };
  f.install();
  const arien = () => d.querySelector('#arien .m2-hero-clock');
  assert.equal(arien().textContent, '7:38/20:00');
  assert.equal(arien().dataset.running, 'true');
  assert.equal(d.querySelector('#dodger .m2-hero-clock').textContent, '-/20:00');
  assert.equal(w.testUI.heroDisplayName(d.querySelector('#arien ._name_test')), 'Arien · A (You)');
  assert(
    d.querySelector('#goa2-m2-summary').textContent.includes('7:38'),
    'compact layout shows the timer in the status slot',
  );
  assert.equal(d.querySelector('#goa2-m2-summary article .m2-summary-clock').textContent, '✓');
  const first = arien();
  w.testUI.refresh();
  assert.equal(arien(), first, 'unchanged clocks retain their nodes');
  d.querySelector('._clock_test strong').textContent = '7:37';
  w.testUI.refresh();
  assert.equal(arien().textContent, '7:37/20:00');
  Object.assign(clock.players.arien, { planning_allowance_ms: 0, time_bank_ms: 1199000 });
  w.testUI.refresh();
  assert.equal(
    [...d.querySelectorAll('.m2-summary-clock')][1].textContent,
    '19:59',
    'exhausted phase allowance falls through to bank',
  );
  clock.active = { kind: 'RESPONSE', hero_ids: ['arien'] };
  Object.assign(clock.players.arien, { response_time_ms: 2500, resolution_allowance_ms: 30000 });
  w.testUI.refresh();
  assert.equal([...d.querySelectorAll('.m2-summary-clock')][1].textContent, '2.5s');
  clock.players.arien.response_time_ms = 0;
  w.testUI.refresh();
  assert.equal([...d.querySelectorAll('.m2-summary-clock')][1].textContent, '0:30');
  clock.status = 'PAUSED';
  w.testUI.refresh();
  assert.equal(arien().dataset.running, 'false');
  assert(arien().getAttribute('aria-label').includes('Paused'));
  d.querySelector('[data-mode="heroes"]').click();
  assert.equal(arien().parentElement.className, '_name_test');
  d.querySelector('._list_test').remove();
  w.testUI.refresh();
  assert(!d.querySelector('.m2-hero-clock'), 'untimed matches add no clock UI');
  w.GOA2Mobile2D.destroy();
  assert(!d.querySelector('.m2-hero-clock'));
});

test('Resolution preserves order and completion except for currently running clocks', (t) => {
  const f = browserFixture({ hooks: ['renderSummary'] });
  t.after(() => f.close());
  f.install();
  const hero = (id, running, resolution, done = false) => ({
    id,
    name: id,
    resolving: true,
    done,
    resolution,
    dots: [],
    piles: [],
    cardPiles: [],
    upgrades: {},
    detail: '',
    clock: { text: '0:48', label: 'Clock 0:48', running, tone: '' },
  });
  const heroes = [
    hero('acting', true, { current: true, order: 1, initiative: 9 }),
    hero('waiting', false, { current: false, order: 2, initiative: 7 }),
    hero('finished', false, null, true),
  ];
  f.w.testUI.renderSummary(heroes);
  const statuses = () => [...f.d.querySelectorAll('.m2-summary-turn')];
  assert(statuses()[0].classList.contains('m2-summary-clock'));
  assert.equal(statuses()[1].querySelector('b').textContent, '2.');
  assert.equal(statuses()[2].textContent, '✓');
  heroes[0].clock.running = false;
  heroes[1].clock.running = true;
  f.w.testUI.renderSummary(heroes);
  assert.equal(statuses()[0].querySelector('b').textContent, 'NOW');
  assert(
    statuses()[1].classList.contains('m2-summary-clock'),
    'response clock replaces waiting order',
  );
  heroes[1].clock.running = false;
  f.w.testUI.renderSummary(heroes);
  assert.equal(
    f.d.querySelectorAll('.m2-summary-clock').length,
    0,
    'paused clocks retain turn order',
  );
});
