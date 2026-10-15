const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function setup(t) {
  const f = browserFixture({
    hooks: [
      'updateDiscardChoices',
      'clearDiscardChoices',
      'primaryCardValue',
      'modifierCardValue',
      'miniatureCard',
      'nanoCard',
      'textCard',
      'updateCardRow',
    ],
  });
  t.after(() => f.close());
  f.install();
  return f;
}

const defense = {
  id: 'crowd_control',
  name: 'Crowd Control',
  color: 'SILVER',
  tier: 'I',
  initiative: 14,
  primary_action: 'DEFENSE_SKILL',
  primary_action_value: 3,
  secondary_actions: { MOVEMENT: 3 },
  is_facedown: false,
  effect_text:
    'When used as a defense action, +2 :defense: Defense for each other one of you in radius.',
};

test('defense notation is shared by full, row, Micro and Nano cards, including upgrades and hidden cards', (t) => {
  const { w, d } = setup(t);
  const api = w.testUI;
  assert.equal(api.primaryCardValue(defense), '3+');
  const block = { ...defense, primary_action_value: null, effect_text: 'Block the attack.' };
  assert.equal(api.primaryCardValue(block), '!');
  const fixed = { ...defense, id: 'fixed_defense', effect_text: 'Move 1 space.' };
  assert.equal(api.primaryCardValue(fixed), 3);
  for (const [card, expected] of [
    [defense, '5+'],
    [block, '!'],
    [fixed, '5'],
  ]) {
    const nano = api.nanoCard(card, { DEFENSE: 2 });
    assert.equal(nano.querySelector('img').getAttribute('src'), '/icons/defense-skill.png');
    assert.equal(nano.querySelector('.m2-symbol-value').textContent, expected);
    const mini = api.miniatureCard(card, { DEFENSE: 2 });
    assert.equal(mini.firstElementChild.querySelector('.m2-symbol-value').textContent, expected);
    const full = api.textCard(card, 'deck');
    assert.equal(
      full.querySelector('.m2-card-type .m2-symbol-value').textContent,
      card === defense ? '3+' : card === block ? '!' : '3',
    );
    const row = d.createElement('button');
    api.updateCardRow(row, card, { DEFENSE: 2 });
    assert.equal(row.querySelector('.m2-list-primary .m2-symbol-value').textContent, expected);
  }
  const ordinary = api.nanoCard({
    ...fixed,
    primary_action: 'SKILL',
    secondary_actions: { DEFENSE: 4 },
  });
  assert.equal(ordinary.querySelector('img').getAttribute('src'), '/icons/defense.png');
  assert.equal(ordinary.textContent, '4');
  const hidden = api.nanoCard({ ...defense, is_facedown: true });
  assert.equal(hidden.textContent, '?');
  assert.equal(hidden.querySelector('img'), null);
});

test('discard stages a Hand-style choice and submits only once on confirmation; stale offers cannot submit', (t) => {
  const { w, d } = setup(t);
  const overlay = d.createElement('div');
  const picker = d.createElement('div');
  overlay.append(picker);
  d.body.append(overlay);
  const cards = [defense, { ...defense, id: 'second', name: 'Other card', color: 'GREEN' }];
  const hero = { id: 'hero_test', hand: cards, items: {} };
  const request = {
    type: 'SELECT_CARD',
    request_id: 'r1',
    player_id: hero.id,
    prompt: 'hero_test, select a card to discard.',
    valid_options: cards.map((c) => c.id),
  };
  picker.__reactFiber$t = { memoizedProps: { inputRequest: request } };
  const hits = [];
  const sources = cards.map((card) => {
    const button = d.createElement('button');
    button.textContent = card.name;
    button.onclick = () => hits.push(card.id);
    button.__reactFiber$t = { memoizedProps: { onClick: button.onclick } };
    picker.append(button);
    return button;
  });
  const update = () => w.testUI.updateDiscardChoices(picker, request, hero);
  assert(update());
  let confirm = picker.querySelector('.m2-discard-confirm');
  assert(confirm.disabled);
  const rows = picker.querySelectorAll('.m2-discard-row');
  assert(rows[0].querySelector('.m2-small-card'));
  rows[0].click();
  assert.deepEqual(hits, []);
  assert.equal(rows[0].getAttribute('aria-pressed'), 'true');
  assert(picker.querySelector('.m2-text-card'));
  assert(!confirm.disabled);
  rows[1].click();
  update();
  assert.equal(
    picker.querySelector('.m2-discard-confirm'),
    confirm,
    'refresh retains the selection',
  );
  confirm.click();
  confirm.click();
  assert.deepEqual(hits, ['second']);
  request.request_id = 'r2';
  update();
  confirm = picker.querySelector('.m2-discard-confirm');
  assert(confirm.disabled);
  picker.querySelector('.m2-discard-row').click();
  request.request_id = 'r3';
  confirm.click();
  assert.deepEqual(hits, ['second'], 'changed request prevents stale submission before refresh');
  update();
  picker.querySelector('.m2-discard-row').click();
  sources[0].disabled = true;
  update();
  assert(picker.querySelector('.m2-discard-confirm').disabled);
  request.type = 'SELECT_OPTION';
  update();
  assert(!picker.querySelector('.m2-discard-choices'));
  assert(sources.every((s) => !s.hasAttribute('data-m2-discard-source')));
  assert(!overlay.hasAttribute('data-m2-discard-overlay'));
});

test('printed primary and modifier signs apply independently across card views', (t) => {
  const { w, d } = setup(t);
  const api = w.testUI;
  for (const action of ['ATTACK', 'MOVEMENT']) {
    const card = { ...defense, id: 'high_ground', primary_action: action, primary_action_value: 4 };
    assert.equal(api.primaryCardValue(card), '4+');
    assert.equal(api.miniatureCard(card, { [action]: 1 }).firstElementChild.textContent, '5+');
  }
  for (const [id, key, field] of [
    ['long_thrust', 'RANGE', 'range_value'],
    ['sunburst', 'RADIUS', 'radius_value'],
  ]) {
    const card = {
      ...defense,
      id,
      primary_action: 'ATTACK',
      primary_action_value: 4,
      range_value: null,
      radius_value: null,
      [field]: 3,
    };
    assert.equal(api.modifierCardValue(card, key), '3+');
    const micro = api.miniatureCard(card, { [key]: 1 });
    assert.equal(micro.children[1].textContent, '4+');
    const row = d.createElement('button');
    api.updateCardRow(row, card, { [key]: 1 });
    assert.equal(row.querySelector('.m2-list-utility').textContent, '4+');
    const full = api.textCard(card, 'deck');
    assert.equal(full.querySelector('.m2-card-type').lastElementChild.textContent, '3+');
    assert.equal(
      api.primaryCardValue(card),
      id === 'sunburst' ? '4+' : 4,
      'a modifier sign must not leak onto an unrelated primary value',
    );
    assert.equal(card[field], 3, 'printed props stay unchanged');
  }
  const ordinary = {
    ...defense,
    id: 'unknown_card',
    primary_action: 'MOVEMENT',
    primary_action_value: 4,
    range_value: 2,
  };
  assert.equal(api.primaryCardValue(ordinary), 4);
  assert.equal(api.modifierCardValue(ordinary, 'RANGE'), 2);
});
