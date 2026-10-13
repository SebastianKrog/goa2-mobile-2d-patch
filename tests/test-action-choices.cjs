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
      <button id="attack"><span>Primary: ATTACK (9)</span></button>
      <button id="choose"><span>Secondary: MOVEMENT (2)</span></button>
      <button id="hold"><span>Secondary: HOLD (0)</span></button>
      <button id="clear"><span>Secondary: CLEAR (0)</span></button>
      <button id="undo">Undo</button>
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

test('action labels use native values with symbols, hide zero-only utility values and restore cleanly', (t) => {
  const { d, w, request, media } = setup(t);
  const attack = d.querySelector('#attack'),
    movement = d.querySelector('#choose');
  const original = attack.firstElementChild;
  const label = (button) => button.querySelector('.m2-action-choice-label');
  assert.equal(label(attack).querySelector('img').getAttribute('src'), '/icons/attack.png');
  assert.equal(label(attack).querySelector('.m2-symbol-value').textContent, '9');
  assert.equal(label(movement).querySelector('img').getAttribute('src'), '/icons/movement.png');
  assert.equal(
    label(movement).querySelector('.m2-symbol-value').textContent,
    '2',
    'native action value is not upgraded twice',
  );
  for (const id of ['hold', 'clear']) {
    const button = d.querySelector('#' + id);
    assert(!label(button).textContent.includes('(0)'));
    assert(!label(button).querySelector('.m2-symbol-value'));
  }
  assert.equal(original.textContent, 'Primary: ATTACK (9)', 'React-owned label is preserved');
  assert.equal(attack.getAttribute('aria-label'), 'Primary: ATTACK 9');
  let clicks = 0;
  attack.onclick = () => clicks++;
  label(attack).querySelector('img').click();
  assert.equal(clicks, 1);
  original.textContent = 'Primary: ATTACK (10)';
  w.testUI.refresh();
  assert.equal(attack.firstElementChild, original);
  assert.equal(label(attack).querySelector('.m2-symbol-value').textContent, '10');
  w.testUI.refresh();
  assert.equal(attack.querySelectorAll('.m2-action-choice-label').length, 1);
  request.type = 'SELECT_OPTION';
  w.testUI.refresh();
  assert.equal(label(attack), null, 'ordinary option prompts retain their original labels');
  assert.equal(attack.getAttribute('aria-label'), null);
  request.type = 'CHOOSE_ACTION';
  w.testUI.refresh();
  media.matches = false;
  w.testUI.refresh();
  assert.equal(label(attack), null);
  assert.equal(attack.getAttribute('aria-label'), null);
  media.matches = true;
  w.testUI.refresh();
  w.GOA2Mobile2D.destroy();
  assert(!d.querySelector('.m2-action-choice-label'));
  assert.equal(attack.firstElementChild, original);
  assert(!attack.hasAttribute('data-m2-action-choice'));
});

test('your Board card reopens Options for a pending action choice, including focused Board view', (t) => {
  const { d, w, picker, request, hero, view } = setup(t);
  const overlay = picker.parentElement;
  const svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('_svg_test');
  svg.__reactFiber$t = {
    memoizedProps: { inputRequest: request, myHeroId: hero.id, view, isMyInput: true },
  };
  d.querySelector('._boardArea_test').prepend(svg);
  const options = d.querySelector('#options');
  let opens = 0;
  options.onclick = () => {
    opens++;
    d.querySelector('._boardArea_test').append(overlay);
  };
  overlay.remove();
  w.testUI.refresh();
  const current = [...d.querySelectorAll('#goa2-m2-summary .m2-micro-button')].find(
    (button) => button.getAttribute('aria-label') === 'Time Loop',
  );
  current.click();
  assert.equal(opens, 1);
  assert.equal(picker.parentElement, overlay);
  assert(!d.querySelector('#goa2-m2-hero-display .m2-text-card'), 'no standalone card inspection');
  current.click();
  assert.equal(opens, 1, 'an already open picker is not toggled shut');
  overlay.remove();
  w.testUI.refresh();
  const identity = [...d.querySelectorAll('.m2-summary-identity')].find((el) =>
    el.querySelector('strong')?.textContent.includes('Emmitt'),
  );
  identity.click();
  d.querySelector('.m2-focused-hero .m2-current-card-mini').click();
  assert.equal(opens, 2);
  assert(!d.querySelector('#goa2-m2-hero-display .m2-text-card'));
});

test('Board card falls back to inspection after the choice advances and in Heroes view', (t) => {
  const { d, w, picker, request, hero, view } = setup(t);
  picker.parentElement.remove();
  const svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('_svg_test');
  svg.__reactFiber$t = {
    memoizedProps: { inputRequest: request, myHeroId: hero.id, view, isMyInput: true },
  };
  d.querySelector('._boardArea_test').prepend(svg);
  let opens = 0;
  d.querySelector('#options').onclick = () => opens++;
  w.testUI.refresh();
  const current = [...d.querySelectorAll('#goa2-m2-summary .m2-micro-button')].find(
    (button) => button.getAttribute('aria-label') === 'Time Loop',
  );
  request.type = 'SELECT_HEX';
  current.click();
  assert.equal(opens, 0, 'live request guards a previously rendered Board button');
  assert(d.querySelector('#goa2-m2-hero-display .m2-text-card'));
  request.type = 'CHOOSE_ACTION';
  d.querySelector('[data-mode="heroes"]').click();
  d.querySelector('#own .m2-current-card-mini').click();
  assert.equal(opens, 0, 'Heroes retains card inspection');
  assert(d.querySelector('#goa2-m2-hero-display .m2-text-card'));
});
