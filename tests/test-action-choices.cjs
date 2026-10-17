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

test('spell cast options use Tiny cards and the next action prompt displays that spell', (t) => {
  const { d, w, hero, request, picker } = setup(t);
  const shield = {
    id: 'shield',
    name: 'Shield',
    spell_rank: 0,
    image_id: 'Silver',
    color: 'SILVER',
    primary_action: 'SKILL',
    secondary_actions: {},
    state: 'SPELLBOOK',
    is_facedown: true,
    effect_text: 'Protect your hero.',
  };
  hero.spellbook = [shield];
  hero.current_turn_card.effect_text = 'Cast the "Shield" spell. (A magic shield.)';
  let casts = 0;
  const native = d.createElement('button');
  native.textContent = 'shield';
  native.onclick = () => casts++;
  picker.insertBefore(native, d.querySelector('#undo'));
  Object.assign(request, {
    type: 'SELECT_OPTION',
    prompt: 'Choose a prepared spell to cast',
    options: [
      { id: 'shield', text: 'shield' },
      { id: 'unknown', text: 'Unknown' },
    ],
  });
  w.testUI.refresh();
  assert(native.querySelector('.m2-spell-tiny'));
  assert.equal(native.getAttribute('aria-label'), 'Shield');
  assert.equal(w.getComputedStyle(native).minHeight, '30px');
  const embedded = picker.querySelector('.m2-inline-spell');
  assert.equal(
    w.getComputedStyle(embedded).minHeight,
    '26px',
    'native action button height does not stretch embedded spells',
  );
  assert.equal(w.getComputedStyle(embedded.querySelector('.m2-symbol img')).height, '19px');
  const stable = native.firstElementChild;
  w.testUI.refresh();
  assert.equal(native.firstElementChild, stable);
  Object.assign(request, { type: 'SELECT_CARD', valid_options: ['shield'] });
  w.testUI.refresh();
  assert.equal(
    native.firstElementChild,
    stable,
    'native SELECT_CARD with ID labels retains its Tiny spell button',
  );
  native.click();
  assert.equal(casts, 1, 'native submission is retained');
  native.disabled = true;
  assert(native.disabled);
  Object.assign(request, {
    type: 'CHOOSE_ACTION',
    prompt: 'Choose an action to perform on Shield',
  });
  w.testUI.refresh();
  assert.equal(native.querySelector('.m2-spell-tiny'), null);
  assert.equal(native.textContent, 'shield');
  assert.equal(native.getAttribute('aria-label'), null);
  const viewer = d.querySelector('.m2-action-card-view');
  assert(viewer.querySelector('.m2-spell-large'));
  assert.match(viewer.textContent, /Shield.*Protect your hero/s);
  assert(!viewer.textContent.includes('Time Loop'));
  request.prompt = 'Choose action for card Time Loop';
  w.testUI.refresh();
  assert(!viewer.querySelector('.m2-spell-large'));
  assert(viewer.textContent.includes('Time Loop'));
  assert(shield.is_facedown, 'presentation never mutates prepared cards');
});

test('rune options use their icons without redundant bullets, preserving ordinary lists', (t) => {
  const { d, card, w } = setup(t);
  card.effect_text =
    'Target a unit.\n• :rune_bird: You may target a minion.\n• :rune_axe: +3 attack.\n• Ordinary option.';
  w.testUI.refresh();
  const viewer = d.querySelector('.m2-action-card-view');
  assert.equal(viewer.querySelectorAll('.m2-rule-icon').length, 2);
  assert.doesNotMatch(viewer.textContent, /•\s*You may|•\s*\+3/);
  assert.match(viewer.textContent, /• Ordinary option/);
});

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
    'Select Movement Destination (Range 2)<button id="skip">Skip</button><button id="boardUndo">Undo <kbd>U</kbd></button>';
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
  assert(
    buttons[0].classList.contains('m2-undo'),
    'Undo retains amber styling with a keyboard hint',
  );
  assert.equal(
    sources[1].querySelector('kbd').textContent,
    'U',
    'native keyboard hint is untouched',
  );
  buttons[0].click();
  buttons[1].click();
  assert.equal(undos, 1);
  assert.equal(skips, 1);
  w.testUI.refresh();
  assert.equal(d.querySelector('.m2-choice-launchers button'), buttons[0]);
  sources[0].remove();
  w.testUI.refresh();
  const undoOnly = d.querySelector('.m2-choice-launchers button');
  assert.equal(d.querySelectorAll('.m2-choice-launchers button').length, 1);
  assert.equal(undoOnly.textContent, 'Undo');
  assert(undoOnly.classList.contains('m2-undo'));
  undoOnly.click();
  assert.equal(undos, 2, 'sole Undo still calls its native handler directly');
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

test('skill choices use icons and Fast Travel hides its placeholder value without replacing handlers', (t) => {
  const { d, w, picker, request, media } = setup(t);
  const entries = [
    ['Primary: SKILL (-)', '/icons/skill.png'],
    ['Primary: DEFENSE_SKILL (-)', '/icons/defense-skill.png'],
    ['Secondary: FAST_TRAVEL (0)', null],
  ];
  const buttons = entries.map(([text]) => {
    const button = d.createElement('button');
    button.innerHTML = '<span></span>';
    button.firstChild.textContent = text;
    picker.append(button);
    return button;
  });
  w.testUI.refresh();
  assert.equal(w.getComputedStyle(picker).borderTopWidth, '1px');
  assert(!w.getComputedStyle(picker).borderTop.includes('phase-resolution'));
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
    const label = button.querySelector('.m2-action-choice-label');
    assert(label);
    assert(!label.querySelector('.m2-symbol-value'));
    if (entries[i][1]) assert.equal(label.querySelector('img').getAttribute('src'), entries[i][1]);
    else assert.equal(label.textContent, 'Secondary: FAST TRAVEL');
    let clicks = 0;
    button.onclick = () => clicks++;
    label.click();
    assert.equal(clicks, 1);
    assert.equal(button.firstChild.textContent, entries[i][0]);
  }
  request.type = 'SELECT_OPTION';
  w.testUI.refresh();
  assert(buttons.every((button) => !button.hasAttribute('data-m2-action-choice')));
  assert(buttons.every((button, i) => button.textContent === entries[i][0]));
  media.matches = false;
  w.testUI.refresh();
  assert(!picker.hasAttribute('data-m2-action-picker'));
});

test('gold-card choices are always Small catalog cards and retain native submission and cleanup', (t) => {
  const { d, w, picker, request, hero, media } = setup(t);
  d.querySelector('[data-mode="tools"]').click();
  const setting = d.querySelector('[data-setting="hand-cards"]');
  setting.value = 'tiny';
  setting.dispatchEvent(new w.Event('change'));
  d.querySelector('[data-mode="tools"]').click();
  hero.deck = ['Bee', 'Tiger'].map((name, i) => ({
    id: name.toLowerCase(),
    name,
    color: 'GOLD',
    tier: 'UNTIERED',
    initiative: 8 + i,
    primary_action: 'ATTACK',
    primary_action_value: 3 + i,
    secondary_actions: { MOVEMENT: 2, DEFENSE: 3 },
    is_facedown: i === 0,
  }));
  request.type = 'SELECT_CARD';
  request.prompt = 'Choose a gold card in your deck';
  request.valid_options = hero.deck.map((card) => card.id);
  let chosen = null;
  const buttons = hero.deck.map((card) => {
    const button = d.createElement('button');
    button.textContent = card.name;
    button.onclick = () => (chosen = card.id);
    picker.append(button);
    return button;
  });
  w.testUI.refresh();
  for (const button of buttons) {
    assert(button.querySelector('.m2-small-card'));
    assert.equal(button.querySelector('.m2-tiny-hand-card'), null);
    assert.equal(button.querySelectorAll('.m2-list-card').length, 1);
  }
  const row = buttons[0].querySelector('.m2-list-card');
  w.testUI.refresh();
  assert.equal(buttons[0].querySelector('.m2-list-card'), row);
  row.querySelector('.m2-list-name').click();
  assert.equal(chosen, 'bee');
  assert.equal(hero.deck[0].is_facedown, true, 'catalog display does not mutate card state');
  request.valid_options.push('missing');
  w.testUI.refresh();
  assert(
    buttons.every((button) => !button.querySelector('.m2-list-card')),
    'incomplete offers retain native choices',
  );
  request.valid_options.pop();
  w.testUI.refresh();
  assert(buttons.every((button) => button.querySelector('.m2-small-card')));
  media.matches = false;
  w.testUI.refresh();
  assert(buttons.every((button) => !button.hasAttribute('data-m2-gold-choice')));
  assert.deepEqual(
    buttons.map((button) => button.textContent),
    ['Bee', 'Tiger'],
  );
  assert(buttons.every((button) => !button.querySelector('.m2-list-card')));
});

test('rune inscription reserves four ordered choices and fills unpublished slots through selection, Undo and reload', (t) => {
  const fixture = setup(t);
  const { d, w, picker, request, hero, media } = fixture;
  request.type = 'SELECT_OPTION';
  request.prompt = 'Place a rune below turn slot 1';
  request.options = ['Axe', 'Bird', 'Anvil', 'Horn'].map((name) => ({
    id: name.toLowerCase(),
    text: name,
  }));
  hero.rune_slots = {};
  d.querySelectorAll('#attack, #choose, #hold, #clear').forEach((button) => button.remove());
  const sources = new Map();
  for (const option of request.options) {
    const source = d.createElement('button');
    source.textContent = option.text;
    source.onclick = () => {
      const turn = Number(request.prompt.match(/(\d)$/)[1]);
      // Real inscription publishes final rune_slots only after all four picks.
      request.options = request.options.filter((candidate) => candidate.id !== option.id);
      source.remove();
      if (turn === 4) {
        request.type = 'CHOOSE_ACTION';
        request.prompt = 'Confirm your action.';
        request.options = [{ id: 'CONFIRM', text: 'Confirm' }];
        const confirm = d.createElement('button');
        confirm.id = 'rune-confirm';
        confirm.textContent = 'Confirm';
        picker.insertBefore(confirm, d.querySelector('#undo'));
      } else request.prompt = 'Place a rune below turn slot ' + (turn + 1);
      w.testUI.refresh();
    };
    picker.insertBefore(source, d.querySelector('#undo'));
    sources.set(option.id, source);
  }
  w.testUI.refresh();
  const root = () => picker.querySelector('.m2-rune-choices');
  const cells = () => [...root().querySelectorAll('.m2-rune-choice-cell')];
  const slots = () => [...root().querySelectorAll('.m2-rune-slot')];
  assert.deepEqual(
    cells().map((cell) => cell.dataset.rune),
    ['bird', 'axe', 'anvil', 'horn'],
  );
  assert.deepEqual(
    cells().map((cell) => cell.textContent),
    ['Bird', 'Axe', 'Anvil', 'Horn'],
  );
  assert.deepEqual(
    slots().map((slot) => slot.textContent),
    ['Turn 1', 'Turn 2', 'Turn 3', 'Turn 4'],
  );
  assert.equal(
    picker.querySelector('[data-m2-rune-heading]').dataset.m2RuneHeading,
    'Place a rune for turn 1',
  );
  assert.equal(slots()[0].getAttribute('aria-current'), 'step');
  assert.equal(w.getComputedStyle(slots()[0]).borderColor, 'rgb(255, 255, 255)');
  assert.equal(
    w.getComputedStyle(root().firstChild).gridTemplateColumns,
    'repeat(4, minmax(0, 1fr))',
  );
  assert(
    root().compareDocumentPosition(d.querySelector('#undo')) & w.Node.DOCUMENT_POSITION_FOLLOWING,
  );
  const bird = cells()[0].querySelector('button');
  assert.equal(bird.querySelector('img').getAttribute('src'), '/icons/rune_bird.png');
  bird.focus();
  w.testUI.refresh();
  assert.equal(cells()[0].querySelector('button'), bird);
  assert.equal(d.activeElement, bird, 'unchanged updates preserve focus');
  bird.querySelector('img').click();
  assert.equal(cells()[0].querySelector('button'), null);
  assert.equal(cells()[0].textContent, '');
  assert.equal(cells().length, 4);
  assert.deepEqual(
    slots().map((slot) => slot.textContent),
    ['Bird', 'Turn 2', 'Turn 3', 'Turn 4'],
  );
  assert.equal(slots()[1].getAttribute('aria-current'), 'step');
  cells()[1].querySelector('button').click();
  assert.deepEqual(
    slots().map((slot) => slot.textContent),
    ['Bird', 'Axe', 'Turn 3', 'Turn 4'],
  );
  assert.equal(cells()[1].querySelector('button'), null);
  assert.equal(slots()[2].getAttribute('aria-current'), 'step');
  assert.deepEqual(hero.rune_slots, {}, 'staged choices are absent from the public hero');
  w.GOA2Mobile2D.destroy();
  fixture.install();
  assert.deepEqual(
    slots().map((slot) => slot.textContent),
    ['Bird', 'Axe', 'Turn 3', 'Turn 4'],
    'confirmed choices survive userscript reload via session storage',
  );
  // Undo is still the native control: simulate its server acknowledgement.
  let undos = 0;
  d.querySelector('#undo').onclick = () => {
    undos++;
    delete hero.rune_slots['2'];
    request.options.push({ id: 'axe', text: 'Axe' });
    picker.insertBefore(sources.get('axe'), d.querySelector('#undo'));
    request.prompt = 'Place a rune below turn slot 2';
    w.testUI.refresh();
  };
  d.querySelector('#undo').click();
  assert.equal(undos, 1);
  assert(cells()[1].querySelector('button'));
  assert.deepEqual(
    slots().map((slot) => slot.textContent),
    ['Bird', 'Turn 2', 'Turn 3', 'Turn 4'],
  );
  cells()[1].querySelector('button').click();
  cells()[2].querySelector('button').click();
  assert.deepEqual(
    slots().map((slot) => slot.textContent),
    ['Bird', 'Axe', 'Anvil', 'Turn 4'],
  );
  assert.equal(slots()[3].getAttribute('aria-current'), 'step');
  assert.equal(root().querySelectorAll('button').length, 1);
  cells()[3].querySelector('button').click();
  assert.deepEqual(
    slots().map((slot) => slot.textContent),
    ['Bird', 'Axe', 'Anvil', 'Horn'],
  );
  assert.equal(root().querySelector('.m2-rune-options'), null);
  assert.deepEqual(
    [...root().querySelectorAll('.m2-rune-turn-labels > span')].map((label) => label.textContent),
    ['Turn 1', 'Turn 2', 'Turn 3', 'Turn 4'],
  );
  assert.equal(
    w.getComputedStyle(root().querySelector('.m2-rune-turn-labels')).textAlign,
    'center',
  );
  assert.equal(root().querySelector('[aria-current]'), null);
  assert.equal(
    picker.querySelector('[data-m2-rune-heading]'),
    null,
    'native confirmation heading is restored',
  );
  assert(
    root().compareDocumentPosition(d.querySelector('#rune-confirm')) &
      w.Node.DOCUMENT_POSITION_FOLLOWING,
  );
  let confirms = 0;
  d.querySelector('#rune-confirm').onclick = () => confirms++;
  d.querySelector('#rune-confirm').click();
  assert.equal(confirms, 1, 'native confirmation remains clickable');
  w.GOA2Mobile2D.destroy();
  fixture.install();
  assert.deepEqual(
    slots().map((slot) => slot.textContent),
    ['Bird', 'Axe', 'Anvil', 'Horn'],
    'confirmation survives reload',
  );
  media.matches = false;
  w.testUI.refresh();
  assert.equal(root(), null);
  assert(!sources.get('horn').hasAttribute('data-m2-rune-source'));
  assert.equal(picker.querySelector('[data-m2-rune-heading]'), null);
  media.matches = true;
  w.testUI.refresh();
  assert(root());
  request.type = 'CHOOSE_ACTION';
  request.prompt = 'Choose action';
  w.testUI.refresh();
  assert.equal(root(), null);
  assert(!sources.get('horn').hasAttribute('data-m2-rune-source'));
});

test('joining inscription midway does not guess earlier order or reuse the old saved rune layout', (t) => {
  const { d, w, picker, request, hero } = setup(t);
  hero.rune_slots = { 1: 'axe', 2: 'bird', 3: 'horn', 4: 'anvil' };
  request.type = 'SELECT_OPTION';
  request.prompt = 'Place a rune below turn slot 3';
  request.options = [
    { id: 'anvil', text: 'Anvil' },
    { id: 'horn', text: 'Horn' },
  ];
  for (const text of ['Anvil', 'Horn']) {
    const button = d.createElement('button');
    button.textContent = text;
    picker.append(button);
  }
  w.testUI.refresh();
  const slots = () => [...picker.querySelectorAll('.m2-rune-slot')].map((slot) => slot.textContent);
  assert.deepEqual(slots(), ['Turn 1', 'Turn 2', 'Turn 3', 'Turn 4']);
  request.prompt = 'Place a rune below turn slot 4';
  request.options.shift();
  w.testUI.refresh();
  assert.deepEqual(slots(), ['Turn 1', 'Turn 2', 'Anvil', 'Turn 4']);
  request.type = 'CHOOSE_ACTION';
  request.prompt = 'Choose action';
  w.testUI.refresh();
  assert.equal(w.sessionStorage.getItem('goa2-mobile-rune-progress'), null);
});

test('published rune layout is visible when installing directly at inscription confirmation', (t) => {
  const { d, w, picker, request, hero } = setup(t);
  hero.current_turn_card = {
    ...hero.current_turn_card,
    id: 'inscribe_the_runes',
    name: 'Inscribe the Runes',
  };
  hero.rune_slots = { 1: 'horn', 2: 'anvil', 3: 'bird', 4: 'axe' };
  request.type = 'SELECT_OPTION';
  request.type = 'CHOOSE_ACTION';
  request.prompt = 'Confirm your action.';
  request.options = [{ id: 'CONFIRM', text: 'Confirm' }];
  w.testUI.refresh();
  assert.deepEqual(
    [...picker.querySelectorAll('.m2-rune-slot')].map((slot) => slot.textContent),
    ['Horn', 'Anvil', 'Bird', 'Axe'],
  );
  assert.equal(picker.querySelector('.m2-rune-options'), null);
  assert.equal(picker.querySelector('[data-m2-rune-heading]'), null);
  hero.current_turn_card = { ...hero.current_turn_card, id: 'other', name: 'Other card' };
  request.prompt = 'Choose action';
  w.testUI.refresh();
  request.type = 'CHOOSE_ACTION';
  request.prompt = 'Confirm your action.';
  w.testUI.refresh();
  assert.equal(
    picker.querySelector('.m2-rune-choices'),
    null,
    'other action confirmations do not inherit the rune display',
  );
});

test('automatic final rune appears when turn-three selection goes straight to confirmation', (t) => {
  const { d, w, picker, request, hero } = setup(t);
  hero.current_turn_card = {
    ...hero.current_turn_card,
    id: 'inscribe_the_runes',
    name: 'Inscribe the Runes',
  };
  hero.rune_slots = {};
  request.type = 'SELECT_OPTION';
  request.prompt = 'Place a rune below turn slot 3';
  request.options = [
    { id: 'bird', text: 'Bird' },
    { id: 'horn', text: 'Horn' },
  ];
  for (const text of ['Bird', 'Horn']) {
    const button = d.createElement('button');
    button.textContent = text;
    picker.append(button);
  }
  w.testUI.refresh();
  hero.rune_slots = { 1: 'axe', 2: 'anvil', 3: 'bird', 4: 'horn' };
  request.type = 'CHOOSE_ACTION';
  request.prompt = 'Confirm your action.';
  request.options = [{ id: 'CONFIRM', text: 'Confirm' }];
  w.testUI.refresh();
  assert.deepEqual(
    [...picker.querySelectorAll('.m2-rune-slot')].map((slot) => slot.textContent),
    ['Axe', 'Anvil', 'Bird', 'Horn'],
  );
  assert.equal(picker.querySelector('.m2-rune-options'), null);
});
