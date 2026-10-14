const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');
const settle = () => new Promise((resolve) => setTimeout(resolve, 40));
function setup(t) {
  const f = browserFixture({
    html: '<header class="_bar_test"></header><div class="_boardArea_test"><button class="_takeBackBtn_test">Take back card</button></div><aside class="_sidebar_test"><section id="own"><div class="_name_test">Hanu (You)</div><div class="_details_test">Lv 1</div></section><section id="hand"><div class="_label_test">Hand</div><div class="_row_test _selected_test"><span class="_cardName_test">Card</span></div><div class="_waiting_test"><span class="_waitingKicker_test">Card committed</span><span>Waiting for another player</span></div><div class="_actions_test"><button id="confirm">Commit</button></div></section></aside>',
    hooks: ['refresh', 'inspectHeroCard'],
  });
  t.after(() => f.close());
  const card = {
    id: 'card',
    name: 'Test Card',
    color: 'BLUE',
    initiative: 7,
    tier: 'I',
    primary_action: 'SKILL',
    secondary_actions: { MOVEMENT: 2, DEFENSE: 3 },
  };
  const hero = {
    id: 'hero',
    name: 'Hanu',
    level: 1,
    gold: 0,
    hand: [card],
    current_turn_card: card,
    played_cards: [],
    discard_pile: [],
    items: {},
  };
  f.d.querySelector('#own').__reactFiber$t = { memoizedProps: { hero } };
  f.d.querySelector('._sidebar_test').__reactFiber$t = {
    memoizedProps: { view: { phase: 'PLANNING', turn: 1 } },
  };
  f.d.querySelector('._row_test').__reactFiber$t = { memoizedProps: { card } };
  f.install();
  return { ...f, card };
}
test('Hand size switches immediately and persists; Take back shares committed box without moving Commit', (t) => {
  const { w, d } = setup(t);
  d.querySelector('[data-mode="hand"]').click();
  const row = d.querySelector('._row_test'),
    view = row.querySelector('.m2-list-card');
  assert(view.classList.contains('m2-small-card'));
  assert.equal(w.getComputedStyle(d.querySelector('#hand > ._label_test')).display, 'none');
  const actions = d.querySelector('._waiting_test > .m2-planning-actions');
  assert(actions);
  assert.equal(
    w.getComputedStyle(d.querySelector('._waiting_test')).gridTemplateColumns,
    'minmax(0, 1fr) minmax(0, 1fr)',
  );
  assert.equal(d.querySelector('#confirm').parentElement.className, '_actions_test');
  let taken = 0;
  d.querySelector('._takeBackBtn_test').onclick = () => taken++;
  actions.querySelector('button').click();
  assert.equal(taken, 1);
  const select = d.querySelector('[data-setting="hand-cards"]');
  select.value = 'tiny';
  select.dispatchEvent(new w.Event('change'));
  w.testUI.refresh();
  const tiny = row.querySelector('.m2-tiny-hand-card');
  assert(tiny);
  assert.equal(w.getComputedStyle(tiny).minHeight, '28px');
  assert.equal(w.getComputedStyle(row).minHeight, '30px');
  assert.equal(JSON.parse(w.localStorage.getItem('goa2-mobile-display')).handCards, 'tiny');
  select.value = 'small';
  select.dispatchEvent(new w.Event('change'));
  w.testUI.refresh();
  assert(row.querySelector('.m2-small-card'));
});
test('Back dismisses Board card inspection and a native decision via Board peek without choosing an action', async (t) => {
  const { w, d, card } = setup(t);
  w.testUI.inspectHeroCard('hero', card);
  w.testUI.refresh();
  assert(d.querySelector('#goa2-m2-hero-display').firstChild);
  w.history.back();
  await settle();
  assert(!d.querySelector('#goa2-m2-hero-display').firstChild);
  assert.equal(d.documentElement.dataset.m2Mode, 'board');
  const picker = d.createElement('div');
  picker.className = '_picker_test';
  picker.innerHTML =
    '<button class="_peekBtn_test">Board</button><button>Undo</button><button>Choose target</button>';
  let decisions = 0;
  picker.querySelector('._peekBtn_test').onclick = () => picker.remove();
  picker.querySelectorAll('button')[1].onclick = () => decisions++;
  picker.querySelectorAll('button')[2].onclick = () => decisions++;
  d.querySelector('[data-m2="board"]').append(picker);
  w.testUI.refresh();
  w.history.back();
  await settle();
  assert(!picker.isConnected);
  assert.equal(decisions, 0);
  assert(!w.history.state?.goa2Mobile2DMenu);
  d.querySelector('[data-mode="hand"]').click();
  d.querySelector('._row_test').dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
  w.testUI.refresh();
  assert(d.querySelector('#goa2-m2-details').firstChild);
  w.history.back();
  await settle();
  assert.equal(d.documentElement.dataset.m2Mode, 'board');
  assert(!d.querySelector('#goa2-m2-details').firstChild);
});
