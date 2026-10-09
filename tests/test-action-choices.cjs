const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function setup(t) {
  const fixture = browserFixture({
    html: `<div><header class="_bar_test"><span class="_phase_test">RESOLUTION</span>
      <div class="_statusCopy_test"><strong>Your turn</strong></div></header>
      <main class="_main_test"><div class="_boardArea_test"><button id="options">Options</button>
      <div class="_overlay_test"><div class="_picker_test">
      <div class="_titleRow_test"><b>Choose action for card Time Loop</b>
      <button class="_peekBtn_test"><svg></svg></button></div>
      <button id="choose">Secondary: MOVEMENT (2)</button><button id="undo">Undo</button>
      </div></div></div><aside class="_sidebar_test">
      <section id="own"><div class="_name_test">Emmitt (You)</div><div class="_details_test">Lv 2</div></section>
      <section id="other"><div class="_name_test">Swift · Other player</div><div class="_details_test">Lv 2</div></section>
      </aside></main></div>`,
    hooks: ['refresh'],
  });
  t.after(() => fixture.close());
  const { d } = fixture;
  const card = {
    id: 'loop',
    name: 'Time Loop',
    color: 'BLUE',
    tier: 'II',
    initiative: 9,
    primary_action: 'SKILL',
    secondary_actions: { MOVEMENT: 2, DEFENSE: 4 },
    effect_text: 'Played card rules.',
    is_facedown: false,
  };
  const hero = {
    id: 'emmitt',
    name: 'Emmitt',
    level: 2,
    gold: 1,
    current_turn_card: card,
    played_cards: [],
    hand: [],
    deck: [],
    discard_pile: [],
    items: { MOVEMENT: 1 },
  };
  const other = {
    ...hero,
    id: 'swift',
    name: 'Swift',
    current_turn_card: { id: 'secret', is_facedown: true },
  };
  const view = {
    phase: 'RESOLUTION',
    turn: 1,
    current_actor_id: 'emmitt',
    teams: { BLUE: { heroes: [hero, other] } },
    effects: [],
    board: { entity_locations: {} },
  };
  const request = {
    type: 'CHOOSE_ACTION',
    player_id: hero.id,
    prompt: 'Choose action',
    can_rollback: true,
  };
  const picker = d.querySelector('._picker_test');
  picker.__reactFiber$t = { memoizedProps: { inputRequest: request, view, myHeroId: hero.id } };
  d.querySelector('aside').__reactFiber$t = { memoizedProps: { view, myHeroId: hero.id } };
  d.querySelector('#own').__reactFiber$t = { memoizedProps: { hero } };
  d.querySelector('#other').__reactFiber$t = { memoizedProps: { hero: other } };
  fixture.install();
  return { ...fixture, hero, card, other, view, request, picker };
}

test('played-card viewer precedes native choices, stays fresh and preserves native handlers', (t) => {
  const f = setup(t),
    { d, w, picker, hero, card, request, view } = f;
  const viewer = d.querySelector('.m2-action-card-view');
  assert.equal(picker.firstElementChild, viewer);
  assert.match(viewer.textContent, /Time Loop.*Played card rules/s);
  assert.match(viewer.querySelector('.m2-card-body aside').textContent, /3/);
  assert.equal(
    viewer.querySelector('button'),
    null,
    'viewer cannot commit or dismiss the played card',
  );
  const choose = d.querySelector('#choose'),
    undo = d.querySelector('#undo'),
    peek = d.querySelector('._peekBtn_test');
  assert.equal(choose.parentElement, picker);
  assert.equal(peek.dataset.m2BoardLabel, 'true');
  const hits = { choice: 0, undo: 0, peek: 0 };
  choose.onclick = () => hits.choice++;
  undo.onclick = () => hits.undo++;
  peek.onmousedown = () => hits.peek++;
  choose.click();
  undo.click();
  peek.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true }));
  assert.deepEqual(hits, { choice: 1, undo: 1, peek: 1 });
  w.testUI.refresh();
  assert.equal(picker.firstElementChild, viewer);
  const article = viewer.firstElementChild;
  w.testUI.refresh();
  assert.equal(viewer.firstElementChild, article, 'unchanged refresh keeps the viewer stable');
  hero.items.MOVEMENT = 2;
  w.testUI.refresh();
  assert.match(viewer.querySelector('.m2-card-body aside').textContent, /4/);
  hero.current_turn_card = null;
  hero.played_cards = [card];
  request.type = 'SELECT_OPTION';
  request.prompt = 'Confirm your action';
  w.testUI.refresh();
  assert.match(viewer.textContent, /Time Loop/);
  view.current_actor_id = 'swift';
  w.testUI.refresh();
  assert.equal(d.querySelector('.m2-action-card-view'), null);
  assert(!picker.hasAttribute('data-m2-action-picker'));
  assert(!peek.hasAttribute('data-m2-board-peek'));
  view.current_actor_id = hero.id;
  request.type = 'SELECT_CARD_OR_PASS';
  w.testUI.refresh();
  assert.equal(
    d.querySelector('.m2-action-card-view'),
    null,
    'defense keeps its own native context',
  );
});

test('board instructions replace status; Undo and Skip stay live on the left, then restore', (t) => {
  const { d, w, picker, request, media } = setup(t);
  picker.parentElement.remove();
  const banner = d.createElement('div');
  banner.className = '_banner_test';
  banner.innerHTML =
    'Select Movement Destination (Range 2)<button id="skip">Skip</button><button id="boardUndo">Undo</button>';
  request.type = 'SELECT_HEX';
  request.prompt = 'Select Movement Destination (Range 2)';
  banner.__reactFiber$t = { memoizedProps: { inputRequest: request } };
  d.querySelector('._boardArea_test').append(banner);
  w.testUI.refresh();
  assert.equal(d.querySelector('.m2-status').textContent, request.prompt);
  assert(banner.hasAttribute('data-m2-board-prompt'));
  const sources = [...banner.querySelectorAll('button')];
  let undos = 0,
    skips = 0;
  sources[0].onclick = () => skips++;
  sources[1].onclick = () => undos++;
  const buttons = [...d.querySelectorAll('.m2-choice-launchers button')];
  assert.deepEqual(
    buttons.map((x) => x.textContent),
    ['Undo', 'Skip'],
  );
  buttons[0].click();
  buttons[1].click();
  assert.equal(undos, 1);
  assert.equal(skips, 1);
  w.testUI.refresh();
  assert.equal(d.querySelector('.m2-choice-launchers button'), buttons[0]);
  sources[1].disabled = true;
  w.testUI.refresh();
  assert(d.querySelector('.m2-choice-launchers button').disabled);
  const warning = d.createElement('div');
  warning.className = '_disconnected_test';
  warning.textContent = 'Disconnected — reconnecting...';
  d.body.append(warning);
  w.testUI.refresh();
  assert.equal(d.querySelector('.m2-phase').textContent, 'DISCONNECTED');
  assert.equal(d.querySelector('.m2-status').textContent, 'Reconnecting...');
  warning.remove();
  banner.remove();
  w.testUI.refresh();
  assert.equal(d.querySelector('.m2-status').textContent, 'Your turn');
  assert.equal(d.querySelector('.m2-choice-launchers button').textContent, 'Options');
  assert(!banner.hasAttribute('data-m2-board-prompt'));
  assert(sources.every((source) => !source.hasAttribute('data-m2-choice-source')));
  d.querySelector('._boardArea_test').append(banner);
  w.testUI.refresh();
  media.matches = false;
  w.testUI.refresh();
  assert(!banner.hasAttribute('data-m2-board-prompt'));
  assert(sources.every((source) => !source.hasAttribute('data-m2-choice-source')));
  media.matches = true;
  w.testUI.refresh();
  w.GOA2Mobile2D.destroy();
  assert(!banner.hasAttribute('data-m2-board-prompt'));
  assert(!d.querySelector('.m2-action-card-view'));
  assert(sources.every((source) => !source.hasAttribute('data-m2-choice-source')));
});
