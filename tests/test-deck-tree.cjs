const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function setup(t, owned = [], saved = {}) {
  const fixture = browserFixture({
    html: `<div class="_layout_test"><header class="_bar_test"><span class="_phase_test">PLANNING</span></header>
      <main class="_main_test"><div class="_boardArea_test"></div><aside class="_sidebar_test">
      <section><div class="_name_test">Hanu (You)</div><div class="_details_test">Lv 1</div></section></aside></main></div>
      <div class="_modal_test"><div class="_header_test">Hanu</div><div class="_tierGroup_test"><div class="_cardGrid_test"></div></div></div>`,
    hooks: ['refresh', 'extendedMicroCard', 'cardGrantedItem', 'textCard'],
  });
  t.after(() => fixture.close());
  const { w, d } = fixture;
  w.HTMLCanvasElement.prototype.getContext = () => ({
    drawImage() {},
    fillRect() {},
    fillText() {},
  });
  w.document.fonts = { load: () => new Promise(() => {}), ready: Promise.resolve() };
  const cards = [];
  for (const color of ['RED', 'BLUE', 'GREEN']) {
    for (const [tier, variants] of [
      ['I', ['a']],
      ['II', ['a', 'b']],
      ['III', ['a', 'b']],
    ]) {
      for (const variant of variants) {
        cards.push({
          id: `${color}-${tier}-${variant}`,
          name: `${color} ${tier} ${variant}`,
          color,
          tier,
          initiative: 6,
          primary_action: 'ATTACK',
          primary_action_value: 4,
          range_value: 2,
          secondary_actions: { MOVEMENT: 3, DEFENSE: 2 },
          item: variant === 'a' ? 'ATTACK' : 'DEFENSE',
          effect_text: 'Printed card rules.',
        });
      }
    }
  }
  for (const color of ['GOLD', 'SILVER', 'PURPLE'])
    cards.push({
      id: color,
      name: color,
      color,
      tier: color === 'PURPLE' ? 'IV' : 'UNTIERED',
      secondary_actions: {},
    });
  const hero = {
    id: 'hero_hanu',
    name: 'Hanu',
    level: saved.level ?? 3,
    items: { INITIATIVE: 2 },
    deck: cards,
    hand: cards.filter((card) => owned.includes(card.id)),
    played_cards: [],
    discard_pile: [],
  };
  const view = { phase: 'PLANNING', turn: 1 };
  const modal = d.querySelector('._modal_test'),
    box = d.querySelector('aside>section');
  box.__reactFiber$test = { memoizedProps: { hero } };
  modal.__reactFiber$test = { memoizedProps: { hero } };
  d.querySelector('aside').__reactFiber$test = { memoizedProps: { view } };
  for (const card of cards.filter((card) => !['GOLD', 'SILVER'].includes(card.color))) {
    const canvas = d.createElement('canvas');
    canvas.__reactFiber$test = { memoizedProps: { card } };
    d.querySelector('._cardGrid_test').append(canvas);
  }
  w.localStorage.setItem('goa2-mobile-deck', JSON.stringify({ view: 'tree', sort: 'tier' }));
  if (saved.build !== undefined)
    w.localStorage.setItem(
      'goa2-mobile-build:' + JSON.stringify(['/game/test', 'hero_hanu']),
      saved.build,
    );
  fixture.install();
  d.querySelector('[data-mode="deck"]').click();
  const node = (id) => d.querySelector(`.m2-tree-card[data-card-id="${id}"]`);
  const option = (label) =>
    [...d.querySelectorAll('.m2-deck-controls button')].find(
      (button) => button.textContent === label,
    );
  return { ...fixture, cards, hero, view, modal, box, node, option };
}

test('Tree uses six printed slots, correct card grants, and standard/alternate tier positions', (t) => {
  const { w, d, node } = setup(t);
  assert.equal(d.querySelector('.m2-deck-browser').dataset.view, 'tree');
  assert.equal(d.querySelectorAll('.m2-tree-color').length, 3);
  assert.equal(d.querySelectorAll('.m2-tree-card').length, 18);
  assert(!d.querySelector('.m2-sort-switch').hidden);
  assert.equal(d.querySelectorAll('.m2-deck-controls > button').length, 4);
  assert.equal(
    w.getComputedStyle(d.querySelector('.m2-deck-controls')).gridTemplateColumns,
    'repeat(3, minmax(0, 1fr)) 54px',
  );
  const controls = w.getComputedStyle(d.querySelector('.m2-deck-controls'));
  assert.equal(controls.height, 'var(--m2-head)', 'Deck controls share the main header height');
  assert.equal(controls.boxSizing, 'border-box');
  assert.equal(controls.paddingTop, '2px');
  assert.equal(controls.paddingBottom, '2px');
  assert.equal(w.getComputedStyle(d.querySelector('[data-m2="deck"]')).paddingTop, '0px');
  assert(!d.querySelector('.m2-deck-title'));
  assert(!d.querySelector('.m2-deck-tree h3'));
  for (const color of ['RED', 'BLUE', 'GREEN']) {
    assert.equal(node(`${color}-I-a`).style.gridColumn, '1');
    assert.equal(node(`${color}-I-a`).style.gridRow, '1');
    for (const [tier, column] of [
      ['II', '1 / span 2'],
      ['III', '3'],
    ]) {
      assert.equal(node(`${color}-${tier}-a`).style.gridColumn, column);
      assert.equal(node(`${color}-${tier}-a`).style.gridRow, '2');
      assert.equal(node(`${color}-${tier}-b`).style.gridColumn, column);
      assert.equal(node(`${color}-${tier}-b`).style.gridRow, '3');
    }
  }
  const micro = node('RED-II-a').querySelector('.m2-micro-extended');
  assert.equal(micro.children.length, 3);
  assert.equal(micro.children[1].children.length, 4);
  assert.equal(micro.querySelector('.m2-micro-cap .m2-symbol-value').textContent, '6');
  assert(micro.querySelector('.m2-micro-grant img').src.endsWith('/defense.png'));
  assert(node('RED-II-b').querySelector('.m2-micro-grant img').src.endsWith('/attack.png'));
  assert(!node('RED-I-a').querySelector('.m2-micro-grant img'));
  assert.equal(micro.querySelector('.m2-micro-grant .m2-symbol-value').textContent, '+');
  assert.equal(w.getComputedStyle(micro).width, '132px');
  assert.equal(w.getComputedStyle(micro.children[0]).backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(w.getComputedStyle(micro.children[2]).backgroundColor, 'rgba(0, 0, 0, 0)');
  assert(!micro.querySelector('.m2-upgraded-value'), 'Tree keeps printed values');
  const defense = micro.children[1].lastElementChild;
  assert(defense.querySelector('img').src.endsWith('/defense.png'));
  assert.equal(defense.querySelector('.m2-symbol-value').textContent, '2');
  assert.equal(w.getComputedStyle(micro.children[1]).width, '92px');
  assert.equal(w.getComputedStyle(node('RED-II-a')).width, '136px');
  assert.equal(
    w.getComputedStyle(d.querySelector('.m2-tree-path')).gridTemplateColumns,
    '136px minmax(0, 1fr) 136px',
    'Tier 3 occupies the right edge of a flexible tree',
  );
  assert.equal(w.getComputedStyle(d.querySelector('.m2-deck-tree')).width, '100%');
  assert.equal(d.querySelectorAll('.m2-tree-headings').length, 1);
  assert.equal(d.querySelectorAll('.m2-tree-link').length, 6);
  assert.equal(d.querySelector('.m2-deck-tree').firstElementChild.className, 'm2-tree-headings');
  assert.equal(node('RED-II-a').style.justifySelf, 'end');
  assert.equal(node('RED-I-a').style.justifySelf, 'start');
  const tree = d.querySelector('.m2-deck-tree');
  const path = d.querySelector('.m2-tree-path');
  assert.equal(w.getComputedStyle(tree).getPropertyValue('--m2-tree-gap'), '12px');
  assert.equal(w.getComputedStyle(path).columnGap, 'var(--m2-tree-gap)');
  assert.equal(w.getComputedStyle(path).rowGap, '4px');
  const fork = w.getComputedStyle(path.querySelector('.m2-tree-fork'));
  assert.equal(fork.left, 'var(--m2-tree-branch-x)');
  assert.equal(fork.top, '28px', 'straight branch meets the bottom edge of Tier 1');
  assert.equal(fork.width, '0px', 'vertical line has no sideways bend');
  assert.equal(fork.borderTopStyle, 'none', 'no horizontal stroke under Tier 1');
  assert.equal(path.querySelector('.m2-tree-fork').style.height, '50px');
  assert(!path.querySelector('.m2-tree-stem'));
  assert.deepEqual(
    [...path.querySelectorAll('.m2-tree-link')].map((line) => line.style.top),
    ['46px', '78px'],
  );
  const link = w.getComputedStyle(path.querySelector('.m2-tree-link'));
  assert.equal(link.position, 'absolute');
  assert.equal(link.right, '136px', 'line stops at Tier 3 left edge');
  assert.equal(link.width, 'var(--m2-tree-gap)', 'line spans only the exposed Tier 2/3 gap');
  assert.equal(path.querySelectorAll('.m2-tree-branch-link').length, 2);
  assert(!path.querySelector('svg'), 'no full-width stroke crosses faded cards');
  const hidden = w.testUI.extendedMicroCard({
    name: 'SECRET',
    initiative: 99,
    item: 'RANGE',
    is_facedown: true,
  });
  assert.equal(hidden.querySelectorAll('.m2-symbol').length, 0);
  assert(!hidden.outerHTML.includes('SECRET'));
});

test('A/B artwork markers keep standard and alternate rows aligned even when the deck order is reversed', (t) => {
  const f = setup(t);
  for (const card of f.cards.filter((card) => ['II', 'III'].includes(card.tier)))
    card.image_id = card.color.toLowerCase() + card.tier + (card.id.endsWith('-b') ? 'B' : 'A');
  f.hero.deck.reverse();
  f.w.testUI.refresh();
  for (const color of ['RED', 'BLUE', 'GREEN'])
    for (const tier of ['II', 'III']) {
      assert.equal(f.node(`${color}-${tier}-a`).style.gridRow, '2');
      assert.equal(f.node(`${color}-${tier}-b`).style.gridRow, '3');
    }
});

test('tentative choices highlight, dim the alternative, and preview printed values plus the awarded item', (t) => {
  const { w, d, hero, node } = setup(t);
  const before = JSON.stringify(hero);
  node('RED-II-a').click();
  assert(node('RED-II-a').classList.contains('m2-tree-planned'));
  assert.equal(w.getComputedStyle(node('RED-II-b')).opacity, '0.3');
  assert.equal(d.querySelector('.m2-deck-preview .m2-card-top b').textContent, 'RED II a');
  assert(d.querySelector('.m2-deck-preview .m2-card-foot img').src.endsWith('/attack.png'));
  assert(d.querySelector('.m2-deck-preview .m2-upgrade-gain img').src.endsWith('/defense.png'));
  assert.equal(
    d.querySelector('.m2-deck-preview .m2-upgrade-gain .m2-symbol-value').textContent,
    '+',
  );
  assert.equal(
    w.getComputedStyle(d.querySelector('.m2-deck-preview .m2-card-foot')).paddingRight,
    '8px',
    'the close button does not shift the printed item away from center',
  );
  assert(!d.querySelector('.m2-deck-preview .m2-upgraded-value'));
  node('RED-II-b').click();
  assert(node('RED-II-b').classList.contains('m2-tree-planned'));
  assert(!node('RED-II-a').classList.contains('m2-tree-planned'));
  node('RED-III-a').click();
  assert.equal(d.querySelectorAll('.m2-tree-build-stats .m2-build-future').length, 2);
  assert.equal(d.querySelector('.m2-tree-build-stats [data-stat="ATTACK"]').dataset.total, '1');
  assert.equal(d.querySelector('.m2-tree-build-stats [data-stat="DEFENSE"]').dataset.total, '1');
  assert(!d.querySelector('.m2-tree-build').textContent.includes('RED II b'));
  node('RED-I-a').click();
  assert(node('RED-I-a').hasAttribute('data-m2-viewed'));
  assert(!node('RED-III-a').hasAttribute('data-m2-viewed'));
  assert.equal(d.querySelectorAll('.m2-tree-card.m2-tree-planned').length, 2);
  d.querySelector('.m2-deck-preview .m2-card-dismiss').click();
  assert.equal(d.querySelector('.m2-deck-preview').children.length, 0);
  assert(
    !d.querySelector('[data-m2-viewed]'),
    'dismissal does not leave a viewer outline on planned cards',
  );
  assert.equal(d.querySelectorAll('.m2-tree-card.m2-tree-planned').length, 2);
  d.querySelector('.m2-tree-build-title button').click();
  assert.equal(d.querySelectorAll('.m2-tree-card.m2-tree-planned').length, 0);
  assert.equal(JSON.stringify(hero), before, 'planning never mutates game props');
});

test('game-chosen upgrades stay highlighted when either choice is inspected or the plan is cleared', (t) => {
  const { w, d, node, hero } = setup(t, ['RED-II-a']);
  const before = JSON.stringify(hero);
  assert(node('RED-II-a').classList.contains('m2-tree-chosen'));
  assert.equal(w.getComputedStyle(node('RED-II-b')).opacity, '0.3');
  assert.equal(node('RED-II-b').dataset.state, 'unavailable');
  node('RED-II-b').click();
  assert.equal(d.querySelector('.m2-deck-preview .m2-card-top b').textContent, 'RED II b');
  assert(node('RED-II-a').classList.contains('m2-tree-chosen'));
  assert(!node('RED-II-b').classList.contains('m2-tree-planned'));
  node('BLUE-II-a').click();
  d.querySelector('.m2-tree-build-title button').click();
  assert(node('RED-II-a').classList.contains('m2-tree-chosen'));
  assert.equal(d.querySelectorAll('.m2-tree-card.m2-tree-planned').length, 0);
  assert.equal(d.querySelectorAll('.m2-tree-build-stats .m2-build-future').length, 0);
  assert.equal(d.querySelector('.m2-tree-build-stats [data-stat="INITIATIVE"]').dataset.total, '2');
  assert.equal(
    node('RED-II-b').dataset.state,
    'unavailable',
    'Reset keeps committed alternatives dark',
  );
  assert.equal(JSON.stringify(hero), before);
});

test('build preview sums native acquired items and alternative-card future grants without double counting', (t) => {
  const { w, d, node, hero, cards } = setup(t, ['RED-II-a']);
  hero.items = { ATTACK: 2, DEFENSE: 1, INITIATIVE: 0, AREA: 1 };
  w.testUI.refresh();
  const stat = (key) => d.querySelector(`.m2-tree-build-stats [data-stat="${key}"]`);
  assert.equal(stat('DEFENSE').dataset.total, '1', 'observed choice is already in native totals');
  assert.equal(stat('ATTACK').dataset.total, '2');
  assert(stat('ATTACK').classList.contains('m2-build-current'));
  assert.equal(w.getComputedStyle(stat('ATTACK')).color, 'rgb(255, 255, 255)');
  assert(stat('INITIATIVE').classList.contains('m2-upgrade-empty'));
  assert.equal(stat('RADIUS').dataset.total, '1');
  cards.find((card) => card.id === 'BLUE-II-b').item = 'AREA';
  w.testUI.refresh();
  node('BLUE-II-a').click();
  assert.equal(stat('RADIUS').dataset.current, '1');
  assert.equal(stat('RADIUS').dataset.planned, '1');
  assert.equal(stat('RADIUS').dataset.total, '2');
  node('RED-III-b').click();
  node('GREEN-II-b').click();
  assert.equal(stat('ATTACK').dataset.current, '2');
  assert.equal(stat('ATTACK').dataset.planned, '2');
  assert.equal(stat('ATTACK').dataset.total, '4');
  assert.equal(stat('ATTACK').querySelector('.m2-symbol-value').textContent, '+4');
  assert.equal(w.getComputedStyle(stat('ATTACK')).color, 'rgb(183, 153, 222)');
  node('RED-II-b').click();
  assert.equal(stat('ATTACK').dataset.total, '4', 'locked alternative adds no planned bonus');
  assert.equal(w.getComputedStyle(node('RED-II-a')).borderTopColor, 'rgb(255, 255, 255)');
  hero.items.ATTACK = 3;
  w.testUI.refresh();
  assert.equal(stat('ATTACK').dataset.total, '5', 'native item changes refresh the preview');
  d.querySelector('.m2-tree-build-title button').click();
  assert.equal(stat('ATTACK').dataset.total, '3');
  assert.equal(stat('RADIUS').dataset.total, '1');
  assert.equal(d.querySelectorAll('.m2-build-future').length, 0);
});

test('shared Large cards show grey paired grants; absent, ambiguous and hidden pairs give no invented item', (t) => {
  const { w, d, hero, cards, node, option } = setup(t);
  const card = cards.find((card) => card.id === 'RED-II-a');
  const grant = (display) => display.querySelector('.m2-upgrade-gain');
  const display = w.testUI.textCard(card, 'hero', null, hero.id);
  assert(grant(display).querySelector('img').src.endsWith('/defense.png'));
  assert.equal(grant(display).querySelector('.m2-symbol-value').textContent, '+');
  d.body.append(display);
  assert.equal(w.getComputedStyle(grant(display)).color, 'rgb(155, 164, 178)');
  assert.equal(
    w.getComputedStyle(grant(display).querySelector('.m2-symbol')).filter,
    'grayscale(1)',
  );
  display.remove();
  option('List').click();
  [...d.querySelectorAll('.m2-deck-compact .m2-deck-card')]
    .find((button) => button.getAttribute('aria-label') === 'View ' + card.name)
    .click();
  const row = d.querySelector('.m2-deck-preview .m2-text-card');
  assert(grant(row).querySelector('img').src.endsWith('/defense.png'));
  assert.equal(w.testUI.cardGrantedItem(card, [card]), null);
  assert.equal(w.testUI.cardGrantedItem(card, [...cards, { ...card, id: 'extra' }]), null);
  const hiddenPair = cards.map((candidate) =>
    candidate.id === 'RED-II-b' ? { ...candidate, is_facedown: true } : candidate,
  );
  assert.equal(w.testUI.cardGrantedItem(card, hiddenPair), null);
  const t1 = cards.find((card) => card.id === 'RED-I-a');
  assert.equal(w.testUI.cardGrantedItem(t1, cards), null);
  const hidden = w.testUI.extendedMicroCard({ ...card, is_facedown: true }, 'DEFENSE');
  assert.equal(hidden.querySelectorAll('.m2-symbol').length, 0);
});

test('plans survive view changes and source updates; a real choice supersedes a tentative alternative', (t) => {
  const { w, d, node, cards, hero, option } = setup(t);
  node('RED-II-b').click();
  option('List').click();
  assert(!d.querySelector('.m2-tree-build'));
  option('Tree').click();
  assert(node('RED-II-b').classList.contains('m2-tree-planned'));
  const card = cards.find((card) => card.id === 'RED-II-b');
  card.name = 'Updated card';
  w.testUI.refresh();
  assert.equal(d.querySelector('.m2-deck-preview .m2-card-top b').textContent, 'Updated card');
  hero.hand = [cards.find((card) => card.id === 'RED-II-a')];
  w.testUI.refresh();
  assert(node('RED-II-a').classList.contains('m2-tree-chosen'));
  assert(node('RED-II-b').classList.contains('m2-tree-unavailable'));
  assert.equal(d.querySelectorAll('.m2-tree-build-stats .m2-build-future').length, 0);
  const tree = d.querySelector('.m2-deck-tree');
  w.testUI.refresh();
  assert.equal(d.querySelector('.m2-deck-tree'), tree, 'idle updates preserve the rendered tree');
  d.querySelector('[data-mode="deck"]').click();
  d.querySelector('[data-mode="deck"]').click();
  assert(node('RED-II-a').classList.contains('m2-tree-chosen'));
});

test('planning and inspected cards are isolated by hero and game', (t) => {
  const { w, d, node, hero, modal, box } = setup(t);
  node('RED-II-a').click();
  const other = { ...hero, id: 'hero_misa', name: 'Misa' };
  modal.__reactFiber$test.memoizedProps.hero = other;
  box.__reactFiber$test.memoizedProps.hero = other;
  w.testUI.refresh();
  assert.equal(d.querySelectorAll('.m2-tree-card.m2-tree-planned').length, 0);
  assert.equal(d.querySelector('.m2-deck-preview').children.length, 0);
  modal.__reactFiber$test.memoizedProps.hero = hero;
  box.__reactFiber$test.memoizedProps.hero = hero;
  w.testUI.refresh();
  assert(node('RED-II-a').classList.contains('m2-tree-planned'));
  w.history.replaceState(null, '', '/game/another?3d=0');
  w.testUI.refresh();
  assert.equal(d.querySelectorAll('.m2-tree-card.m2-tree-planned').length, 0);
  assert.equal(d.querySelector('.m2-deck-preview').children.length, 0);
});

test('five card states distinguish current pools, actual item alternatives and replaced Tier 1 cards', (t) => {
  const { w, d, hero, cards, node } = setup(t, ['RED-I-a', 'GOLD']);
  const card = (id) => cards.find((card) => card.id === id);
  hero.discard_pile = [card('SILVER')];
  hero.played_cards = [card('BLUE-I-a')];
  w.testUI.refresh();
  for (const id of ['RED-I-a', 'BLUE-I-a', 'GOLD', 'SILVER'])
    assert.equal(node(id).dataset.state, 'current');
  assert.equal(node('GREEN-II-a').dataset.state, 'standard');
  hero.hand = [card('RED-II-a'), card('GOLD')];
  w.testUI.refresh();
  assert.equal(node('RED-II-a').dataset.state, 'current');
  assert.equal(node('RED-II-b').dataset.state, 'unavailable');
  assert.equal(node('RED-I-a').dataset.state, 'unavailable');
  node('GREEN-II-a').click();
  assert.equal(node('GREEN-II-a').dataset.state, 'planned');
  assert.equal(node('GREEN-II-b').dataset.state, 'unavailable');
  hero.level = 8;
  hero.ultimate_card = card('PURPLE');
  w.testUI.refresh();
  assert.equal(node('PURPLE').dataset.state, 'current');
  assert.equal(w.getComputedStyle(node('PURPLE')).borderTopColor, 'rgb(255, 255, 255)');
  hero.hand = [card('RED-III-b'), card('GOLD')];
  w.testUI.refresh();
  assert.equal(node('RED-II-a').dataset.state, 'unavailable');
  assert.equal(node('RED-II-b').dataset.state, 'item');
  assert.equal(node('RED-III-a').dataset.state, 'unavailable');
  assert.equal(node('RED-III-b').dataset.state, 'current');
  node('RED-II-b').click();
  assert.equal(
    node('RED-II-b').dataset.state,
    'item',
    'item inspections cannot change a committed build',
  );
  assert(!d.querySelector('.m2-tree-legend'));
  assert.deepEqual(
    [...d.querySelector('.m2-tree-headings').children].map((el) => el.textContent),
    ['Tier 1', 'Tier 2', 'Tier 3'],
  );
});

test('Preview uses one row with its label on the left and centered icons; basics keep a compact ultimate and wrap extras', (t) => {
  const { w, d, hero } = setup(t);
  assert.equal(d.querySelector('.m2-tree-build-title b').textContent, 'Preview');
  assert.equal(d.querySelector('.m2-tree-build-title button').textContent, 'Reset');
  assert.equal(w.getComputedStyle(d.querySelector('.m2-tree-build')).display, 'grid');
  assert.equal(w.getComputedStyle(d.querySelector('.m2-tree-build-title')).display, 'contents');
  for (const [selector, column] of [
    ['.m2-tree-build-title b', '1'],
    ['.m2-tree-build-choices', '2'],
    ['.m2-tree-build-title button', '3'],
  ]) {
    const style = w.getComputedStyle(d.querySelector(selector));
    assert.equal(style.gridColumn, column);
    assert.equal(style.gridRow, '1', 'label, icons and Reset occupy the same row');
  }
  assert.equal(w.getComputedStyle(d.querySelector('.m2-tree-build-title b')).textAlign, 'left');
  assert.equal(
    w.getComputedStyle(d.querySelector('.m2-tree-build-choices')).justifyContent,
    'center',
  );
  assert.equal(
    w.getComputedStyle(d.querySelector('.m2-tree-build-stats > .m2-symbol img')).width,
    '27px',
  );
  const extra = {
    id: 'GOLD-extra',
    name: 'Extra gold',
    color: 'GOLD',
    tier: 'UNTIERED',
    secondary_actions: {},
  };
  hero.deck.push(extra);
  w.testUI.refresh();
  assert.deepEqual(
    [...d.querySelector('.m2-tree-basics').children].map((el) => el.dataset.cardId),
    ['GOLD', 'SILVER', 'PURPLE', 'GOLD-extra'],
  );
  const basics = d.querySelector('.m2-tree-basics');
  assert.equal(w.getComputedStyle(basics).display, 'grid');
  assert.equal(w.getComputedStyle(basics).columnGap, 'var(--m2-tree-gap)');
  assert.equal(w.getComputedStyle(basics).width, 'min(100%, 330px)');
  assert.equal(w.getComputedStyle(basics).marginLeft, 'auto');
  assert.equal(w.getComputedStyle(basics).marginRight, 'auto');
  assert.equal(w.getComputedStyle(basics).alignItems, 'center');
  assert.equal(w.getComputedStyle(basics).justifyItems, 'center');
  assert.equal(w.getComputedStyle(basics).gridTemplateColumns, 'repeat(2, minmax(0, 1fr)) 74px');
  for (const card of [...basics.children].filter(
    (card) => !card.classList.contains('m2-tree-ultimate'),
  )) {
    assert.equal(w.getComputedStyle(card.querySelector('.m2-micro-grant')).display, 'none');
    assert.equal(w.getComputedStyle(card.querySelector('.m2-micro-extended')).width, '100%');
    assert.equal(w.getComputedStyle(card.querySelector('.m2-micro-tree')).minWidth, '0px');
  }
  assert.deepEqual(
    [...basics.children].map((card) => w.getComputedStyle(card).width),
    ['min(100%, 116px)', 'min(100%, 116px)', '74px', 'min(100%, 116px)'],
  );
  const ultimate = basics.querySelector('.m2-micro-ultimate');
  assert.equal(w.getComputedStyle(ultimate).width, '70px');
  assert.equal(ultimate.children[1].textContent, 'U');
  basics.querySelector('[data-card-id="PURPLE"]').click();
  assert.equal(d.querySelector('.m2-deck-preview .m2-card-top b').textContent, 'PURPLE');
});

test('observed earlier choices retain item history after advancing tiers, but rollback releases it', (t) => {
  const { w, node, cards, hero } = setup(t, ['RED-II-a']);
  hero.level = 5;
  hero.hand = [cards.find((card) => card.id === 'RED-III-b')];
  w.testUI.refresh();
  assert.equal(node('RED-II-a').dataset.state, 'unavailable');
  assert.equal(node('RED-II-b').dataset.state, 'item');
  assert(node('RED-III-b').classList.contains('m2-tree-chosen'));
  hero.level = 1;
  hero.hand = [];
  w.testUI.refresh();
  assert(!node('RED-II-a').classList.contains('m2-tree-chosen'));
  assert(!node('RED-III-b').classList.contains('m2-tree-chosen'));
});

test('saved plans and observed earlier choices survive reload after a higher tier replaces the card', (t) => {
  const first = setup(t, ['RED-II-a']);
  first.node('BLUE-III-b').click();
  first.hero.level = 5;
  first.hero.hand = [first.cards.find((card) => card.id === 'RED-III-b')];
  first.w.testUI.refresh();
  const key = 'goa2-mobile-build:' + JSON.stringify(['/game/test', 'hero_hanu']);
  const saved = first.w.localStorage.getItem(key);
  first.close();
  const restored = setup(t, ['RED-III-b'], { build: saved, level: 5 });
  assert.equal(restored.node('RED-II-a').dataset.state, 'unavailable');
  assert.equal(restored.node('RED-II-b').dataset.state, 'item');
  assert(restored.node('RED-III-b').classList.contains('m2-tree-chosen'));
  assert(restored.node('BLUE-III-b').classList.contains('m2-tree-planned'));
});

test('one upgrade-request discovery serves a roster, Deck and focused hero, with fresh undo data on each refresh', (t) => {
  const { w, d, hero, cards, view, option } = setup(t, ['RED-II-a']);
  const sidebar = d.querySelector('aside'),
    heroes = [hero];
  for (let i = 1; i < 6; i++) {
    const other = { ...hero, id: 'hero_test_' + i, name: 'Hero ' + i };
    const box = d.createElement('section');
    box.innerHTML = `<div class="_name_test">Hero ${i}</div><div class="_details_test">Lv 3</div>`;
    box.__reactFiber$test = { memoizedProps: { hero: other } };
    sidebar.append(box);
    heroes.push(other);
  }
  const queryAll = d.querySelectorAll;
  let discoveries = 0;
  d.querySelectorAll = function (selector) {
    if (selector === 'button,[class*="_banner_"],[data-m2="sidebar"]') discoveries++;
    return queryAll.call(this, selector);
  };
  t.after(() => {
    d.querySelectorAll = queryAll;
  });
  const refreshOnce = () => {
    discoveries = 0;
    w.testUI.refresh();
    assert.equal(discoveries, 1, 'one discovery regardless of roster size, Deck or focus');
  };
  const observedChoices = (hero) =>
    JSON.parse(
      w.localStorage.getItem('goa2-mobile-build:' + JSON.stringify(['/game/test', hero.id])),
    ).chosen;
  refreshOnce();
  assert.equal(d.querySelectorAll('aside .m2-hero-dashboard').length, 6);
  for (const candidate of heroes) assert.equal(observedChoices(candidate).length, 1);
  discoveries = 0;
  d.querySelector('.m2-summary-identity').click();
  assert.equal(discoveries, 1, 'Board focus shares the same absent-request result');
  assert(d.querySelector('.m2-focused-hero .m2-hero-dashboard'));

  // Removing the card from the pool alone is not evidence of an undo.
  for (const candidate of heroes) candidate.hand = [];
  refreshOnce();
  for (const candidate of heroes) assert.equal(observedChoices(candidate).length, 1);
  // A newly supplied eligible upgrade releases every hero's remembered choice.
  view.phase = 'LEVEL_UP';
  sidebar.__reactFiber$test.memoizedProps.inputRequest = {
    type: 'UPGRADE_PHASE',
    players: Object.fromEntries(
      heroes.map((candidate) => [
        candidate.id,
        {
          remaining: 1,
          options: [{ color: 'RED', tier: 'II' }],
        },
      ]),
    ),
  };
  refreshOnce();
  for (const candidate of heroes) assert.deepEqual(observedChoices(candidate), []);
  const nativeChoice = cards.find((card) => card.id === 'RED-II-a');
  // View/sort updates outside refresh must discover a fresh request themselves.
  hero.hand = [nativeChoice];
  refreshOnce();
  hero.hand = [];
  sidebar.__reactFiber$test.memoizedProps.inputRequest = null;
  discoveries = 0;
  option('List').click();
  assert.equal(discoveries, 1, 'standalone Deck update performs one live discovery');
  assert.equal(observedChoices(hero).length, 1, 'no stale eligible request survives removal');
});

test('native upgrade eligibility releases an observed choice after an undo at the same level', (t) => {
  const { w, d, node, cards, hero } = setup(t, ['RED-II-a']);
  hero.hand = [];
  d.querySelector('aside').__reactFiber$test.memoizedProps.inputRequest = {
    type: 'UPGRADE_PHASE',
    players: {
      hero_hanu: {
        remaining: 1,
        options: [
          {
            color: 'RED',
            tier: 'II',
            card_details: cards.filter((card) => card.color === 'RED' && card.tier === 'II'),
          },
        ],
      },
    },
  };
  w.testUI.refresh();
  assert(!node('RED-II-a').classList.contains('m2-tree-chosen'));
  node('RED-II-b').click();
  assert(node('RED-II-b').classList.contains('m2-tree-planned'));
});

test('corrupt or unrelated saved choices cannot highlight a card, and failed writes leave planning usable', (t) => {
  for (const build of [
    '{broken',
    'null',
    JSON.stringify({
      chosen: [
        ['RED:2', 'missing'],
        ['BLUE:3', 'RED-II-a'],
        ['__proto__', 'RED-II-a'],
      ],
      planned: [['RED:2', 'missing']],
    }),
  ]) {
    const fixture = setup(t, [], { build });
    const { w, d, node } = fixture;
    assert.equal(d.querySelectorAll('.m2-tree-card[aria-pressed="true"]').length, 0);
    const prototype = Object.getPrototypeOf(w.localStorage),
      original = prototype.setItem;
    prototype.setItem = () => {
      throw new Error('storage unavailable');
    };
    try {
      node('RED-II-a').click();
      assert(node('RED-II-a').classList.contains('m2-tree-planned'));
      assert.equal(d.querySelector('.m2-deck-preview .m2-card-top b').textContent, 'RED II a');
    } finally {
      prototype.setItem = original;
      fixture.close();
    }
  }
});

test('all viewers reference the same height, including the short-screen rule', (t) => {
  const { d } = setup(t);
  const rules = [...d.getElementById('goa2-m2-style').sheet.cssRules];
  for (const selector of [
    '#goa2-m2-details:not(:empty)',
    '#goa2-m2-hero-display:not(:empty)',
    '.m2-deck-preview',
  ]) {
    const viewers = rules.filter((rule) => rule.selectorText?.endsWith(selector));
    assert(viewers.length);
    for (const rule of viewers)
      assert.equal(rule.style.getPropertyValue('height'), 'var(--m2-card-display-height)');
  }
  const short = rules.find((rule) => rule.conditionText === '(max-height: 500px)');
  assert.equal(short.cssRules[0].style.getPropertyValue('--m2-card-display-height'), '164.8px');
  assert(!d.getElementById('goa2-m2-style').textContent.includes('--m2-deck-preview-height'));
});
