const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');
const { selectScreenMedia, landscapeQuery } = require('./helpers/screen-media.cjs');

function setup(t, tiers = { RED: 1, BLUE: 1, GREEN: 1 }, remaining = 1) {
  const fixture = browserFixture({
    html: '<aside class="_sidebar_test"></aside><div class="_overlayUpgrade_test"><div class="_pickerUpgrade_test"><div class="_titleRow_test"><b class="_title_test">Level up</b><button class="_peekBtn_test">Board</button></div><div class="_upgradeGroups_test"><button class="_upgradeCard_test"><span class="_cardName_test">Native option</span></button></div><button class="_upgradeConfirmBtn_test">Confirm</button></div></div>',
    hooks: ['refresh', 'upgradeTreeState', 'updateUpgradeTree'],
  });
  t.after(() => fixture.close());
  const { w, d } = fixture,
    colors = ['RED', 'BLUE', 'GREEN'],
    cards = [];
  for (const color of colors)
    for (const tier of [1, 2, 3])
      for (const variant of tier === 1 ? ['A'] : ['B', 'A']) {
        const roman = ['I', 'II', 'III'][tier - 1];
        cards.push({
          id: `${color}:${tier}:${variant}`,
          name: `${color} ${tier} ${variant}`,
          image_id: color.toLowerCase() + roman + variant,
          color,
          tier: roman,
          is_facedown: true,
          initiative: 5,
          primary_action: 'ATTACK',
          primary_action_value: 3,
          secondary_actions: { MOVEMENT: 2, DEFENSE: 4 },
          item: variant === 'A' ? 'ATTACK' : 'DEFENSE',
        });
      }
  cards.push(
    { id: 'gold', name: 'Gold', color: 'GOLD', tier: 'UNTIERED' },
    { id: 'silver', name: 'Silver', color: 'SILVER', tier: 'UNTIERED' },
    { id: 'ult', name: 'Ultimate', color: 'PURPLE', tier: 'IV' },
  );
  const hero = {
    id: 'hero_test',
    name: 'Test',
    deck: cards,
    items: { INITIATIVE: 1 },
    hand: cards
      .filter(
        (card) =>
          card.id === `${card.color}:${tiers[card.color]}:A` ||
          ['gold', 'silver'].includes(card.id),
      )
      .map((card) => ({ ...card, is_facedown: false })),
    played_cards: [],
    discard_pile: [],
    level: 4,
  };
  const view = { phase: 'UPGRADE', round: 2, teams: { RED: { heroes: [hero] } } },
    picker = d.querySelector('._pickerUpgrade_test'),
    anchor = d.querySelector('._upgradeCard_test'),
    calls = [],
    timers = new Map();
  let request,
    callback = (payload) => calls.push(payload),
    nativeClicks = 0,
    timerId = 0;
  const timeout = w.setTimeout.bind(w),
    clear = w.clearTimeout.bind(w);
  w.setTimeout = (fn, delay, ...args) => {
    if (delay !== 15000) return timeout(fn, delay, ...args);
    timers.set(--timerId, fn);
    return timerId;
  };
  w.clearTimeout = (id) => {
    if (timers.has(id)) timers.delete(id);
    else clear(id);
  };
  const currentTiers = () =>
    Object.fromEntries(
      colors.map((color) => [
        color,
        Math.max(
          ...hero.hand
            .filter((card) => card.color === color)
            .map((card) => ({ I: 1, II: 2, III: 3 })[card.tier]),
        ),
      ]),
    );
  const update = () => {
    const owned = currentTiers(),
      lowest = Math.min(...Object.values(owned));
    const options = colors
      .filter((color) => owned[color] === lowest && lowest < 3)
      .map((color) => ({
        color,
        tier: lowest + 1,
        card_details: cards.filter(
          (card) => card.color === color && card.tier === ['I', 'II', 'III'][lowest],
        ),
      }));
    request = {
      type: 'UPGRADE_PHASE',
      request_id: 'step-' + remaining,
      players: { hero_test: { remaining, options } },
    };
    const props = { inputRequest: request, myHeroId: hero.id, view, onSelect: callback };
    anchor.__reactFiber$test = picker.__reactFiber$test = { memoizedProps: props };
    if (w.testUI) w.testUI.refresh();
  };
  anchor.onclick = () => nativeClicks++;
  update();
  fixture.install();
  const node = (id) => d.querySelector(`.m2-upgrade-browser [data-card-id="${id}"]`),
    control = (cls) => d.querySelector('.m2-upgrade-browser .' + cls),
    acknowledge = () => {
      const payload = calls.at(-1),
        card = cards.find((card) => card.id === payload.card_id);
      hero.hand = hero.hand
        .filter((owned) => owned.color !== card.color)
        .concat({ ...card, is_facedown: false });
      remaining--;
      update();
    };
  return {
    ...fixture,
    hero,
    view,
    cards,
    picker,
    anchor,
    calls,
    timers,
    node,
    control,
    acknowledge,
    update,
    setRemaining: (value) => {
      remaining = value;
      update();
    },
    setCallback: (value) => {
      callback = value;
      update();
    },
    nativeClicks: () => nativeClicks,
  };
}

test('Deck and level-up share printed paths while planning, staging and Preview stay isolated', (t) => {
  const { w, d, cards, hero, calls, node, control } = setup(t);
  w.HTMLCanvasElement.prototype.getContext = () => ({
    drawImage() {},
    fillRect() {},
    fillText() {},
  });
  w.document.fonts = { load: () => new Promise(() => {}), ready: Promise.resolve() };
  const modal = d.createElement('div');
  modal.className = '_modal_test';
  modal.innerHTML = '<div class="_header_test">Test</div><div class="_cardGrid_test"></div>';
  modal.__reactFiber$test = { memoizedProps: { hero } };
  for (const card of cards.filter((card) => ['RED', 'BLUE', 'GREEN'].includes(card.color))) {
    const canvas = d.createElement('canvas');
    canvas.__reactFiber$test = { memoizedProps: { card: { ...card, is_facedown: false } } };
    modal.lastElementChild.append(canvas);
  }
  d.body.append(modal);
  d.querySelector('[data-mode="deck"]').click();
  const deck = d.querySelector('.m2-deck-browser');
  const geometry = (host) =>
    [...host.querySelectorAll('.m2-tree-color')].map((section) => ({
      label: section.getAttribute('aria-label'),
      color: section.style.getPropertyValue('--path-color'),
      rows: section.querySelector('.m2-tree-path').style.gridTemplateRows,
      fork: section.querySelector('.m2-tree-fork').style.height,
      links: [...section.querySelectorAll('.m2-tree-link, .m2-tree-branch-link')].map((line) => [
        line.className,
        line.style.top,
      ]),
      slots: [...section.querySelectorAll('.m2-tree-card')].map((button) => [
        button.dataset.cardId,
        button.dataset.tier,
        button.dataset.variant,
        button.style.gridColumn,
        button.style.gridRow,
        button.querySelector('.m2-micro-grant')?.textContent,
      ]),
    }));
  assert.deepEqual(geometry(deck), geometry(d.querySelector('.m2-upgrade-browser')));
  const storageKey = 'goa2-mobile-build:' + JSON.stringify(['/game/test', hero.id]);
  deck.querySelector('[data-card-id="RED:2:B"]').click();
  const savedPlan = w.localStorage.getItem(storageKey);
  assert.deepEqual(JSON.parse(savedPlan).planned, [['RED:2', 'RED:2:B']]);
  assert(control('m2-upgrade-commit').disabled, 'Deck planning cannot stage a native upgrade');
  assert.equal(node('RED:2:B').getAttribute('aria-pressed'), 'false');
  node('BLUE:2:A').click();
  assert.deepEqual(
    [...d.querySelectorAll('.m2-upgrade-browser [data-upgrade-tier="2"]')].map(
      (label) => label.textContent,
    ),
    ['Tier 2 · 1/1'],
    'one top heading keeps the shared upgrade count synchronized',
  );
  assert(!control('m2-upgrade-commit').disabled);
  assert.equal(w.localStorage.getItem(storageKey), savedPlan, 'staging is not a saved Deck plan');
  control('m2-upgrade-preview-toggle').click();
  node('GREEN:3:B').click();
  assert(control('m2-upgrade-commit').disabled);
  assert.equal(w.localStorage.getItem(storageKey), savedPlan, 'Preview cannot write Deck plans');
  assert.equal(calls.length, 0, 'no planning or staging action submits a native choice');
  control('m2-upgrade-preview-toggle').click();
  control('m2-upgrade-reset').click();
  assert.equal(
    w.localStorage.getItem(storageKey),
    savedPlan,
    'upgrade Reset retains the Deck plan',
  );
  const selected = deck.querySelector('[data-card-id="RED:2:B"]');
  assert(selected.classList.contains('m2-tree-planned'));
  assert(
    hero.deck.every((card) => card.is_facedown || ['gold', 'silver', 'ult'].includes(card.id)),
  );
});

test('level-up tree omits basics, separates allowed tiers, aligns A/B variants and retains native fallback on teardown', (t) => {
  const { w, d, node, control, picker } = setup(t);
  assert(picker.hasAttribute('data-m2-upgrade-tree'));
  assert.equal(d.querySelectorAll('.m2-upgrade-browser .m2-tree-card').length, 15);
  for (const id of ['gold', 'silver', 'ult']) assert(!node(id));
  assert.equal(d.querySelector('[data-upgrade-tier="2"]').textContent, 'Tier 2 · 0/1');
  assert.equal(d.querySelector('[data-upgrade-tier="3"]').textContent, 'Tier 3 · 0/0');
  for (const color of ['RED', 'BLUE', 'GREEN'])
    for (const tier of [2, 3]) {
      assert.equal(node(`${color}:${tier}:A`).style.gridRow, '2');
      assert.equal(node(`${color}:${tier}:B`).style.gridRow, '3');
      assert.equal(node(`${color}:${tier}:B`).dataset.variant, 'alternate');
      assert.equal(node(`${color}:${tier}:A`).style.gridColumn, tier === 3 ? '3' : '1 / span 2');
      assert.equal(node(`${color}:1:A`).style.gridRow, '1');
    }
  assert(control('m2-upgrade-commit').disabled);
  assert.equal(w.getComputedStyle(d.querySelector('._upgradeGroups_test')).display, 'none');
  w.GOA2Mobile2D.destroy();
  assert(!d.querySelector('.m2-upgrade-browser'));
  assert(!picker.hasAttribute('data-m2-upgrade-tree'));
  assert.notEqual(w.getComputedStyle(d.querySelector('._upgradeGroups_test')).display, 'none');
});

test('known face-down deck cards show printed upgrade stats and paired grants without changing live flags', (t) => {
  const { d, node, cards, hero } = setup(t);
  for (const card of cards.filter((card) => ['RED', 'BLUE', 'GREEN'].includes(card.color))) {
    const button = node(card.id);
    assert(!button.querySelector('.m2-micro-hidden'), card.id);
    assert.equal(button.querySelector('.m2-micro-cap .m2-symbol-value').textContent, '5');
    assert.equal(button.querySelector('.m2-mini-current .m2-symbol-value').textContent, '3');
    const defense = button.querySelector('.m2-mini-current').lastElementChild;
    assert(defense.querySelector('img').src.endsWith('/defense.png'));
    assert.equal(defense.querySelector('.m2-symbol-value').textContent, '4');
    if (card.tier !== 'I') {
      const expectedItem = card.id.endsWith('A') ? 'defense' : 'attack';
      assert(button.querySelector('.m2-micro-grant img').src.endsWith('/' + expectedItem + '.png'));
    }
    assert.equal(card.is_facedown, true, 'rendering never mutates native deck cards');
  }
  node('GREEN:3:B').click();
  assert(d.querySelector('.m2-upgrade-details .m2-upgrade-gain img').src.endsWith('/attack.png'));
  assert(hero.hand.every((card) => card.is_facedown === false));
});

test('full-screen upgrade menu reserves the viewer, scrolls only the tree and keeps controls at the bottom', (t) => {
  const { w, d, node, control, picker } = setup(t);
  const details = d.querySelector('.m2-upgrade-details'),
    style = (el) => w.getComputedStyle(el);
  const initialHeight = style(details).minHeight;
  assert.notEqual(style(details).display, 'none');
  assert.equal(initialHeight, 'var(--m2-card-display-height)');
  assert.match(style(picker).inset, /^0(?:px)? 0(?:px)? /);
  assert.equal(style(d.querySelector('._overlayUpgrade_test')).inset, '0px');
  assert.equal(style(d.querySelector('.m2-upgrade-heading')).textAlign, 'center');
  assert.equal(style(d.querySelector('.m2-upgrade-content')).overflow, 'hidden');
  assert.equal(style(d.querySelector('.m2-upgrade-content > .m2-deck-row-list')).overflow, 'auto');
  const controls = control('m2-upgrade-preview-toggle').parentElement;
  assert.equal(controls.previousElementSibling, control('m2-upgrade-status'));
  assert.equal(control('m2-upgrade-status').previousElementSibling.className, 'm2-upgrade-content');
  assert.equal(style(control('m2-upgrade-status')).textAlign, 'center');
  assert.equal(style(control('m2-upgrade-status')).alignItems, 'flex-end');
  assert(!control('m2-upgrade-clear-preview'));
  assert(controls.contains(control('m2-upgrade-reset')));
  assert.equal(style(control('m2-upgrade-commit')).width, '100%');
  assert.equal(style(control('m2-upgrade-commit')).minHeight, '44px');
  let boardClicks = 0;
  d.querySelector('._peekBtn_test').onclick = () => boardClicks++;
  d.querySelector('._peekBtn_test').click();
  assert.equal(boardClicks, 1, 'native Board control retains its handler');
  node('RED:2:A').click();
  assert(node('RED:2:A').hasAttribute('data-m2-viewed'));
  node('BLUE:1:A').click();
  assert(node('BLUE:1:A').hasAttribute('data-m2-viewed'));
  assert(!node('RED:2:A').hasAttribute('data-m2-viewed'));
  assert(node('RED:2:A').classList.contains('m2-upgrade-selected'));
  d.querySelector('.m2-upgrade-details .m2-card-dismiss').click();
  assert(!d.querySelector('[data-m2-viewed]'));
  assert(node('RED:2:A').classList.contains('m2-upgrade-selected'));
  assert.equal(details.children.length, 0);
  assert.notEqual(style(details).display, 'none');
  assert.equal(style(details).minHeight, initialHeight);
});

test('staged choices and changed totals are gold while isolated Preview totals remain purple', (t) => {
  const { w, d, node, control } = setup(t);
  const stat = (key) => d.querySelector('.m2-upgrade-totals [data-stat="' + key + '"]');
  node('RED:2:A').click();
  assert.equal(w.getComputedStyle(node('RED:2:A')).borderTopColor, 'rgb(231, 204, 131)');
  assert.equal(w.getComputedStyle(stat('DEFENSE')).color, 'rgb(231, 204, 131)');
  assert.equal(
    w.getComputedStyle(stat('DEFENSE').querySelector('.m2-symbol-value')).color,
    'rgb(231, 204, 131)',
  );
  assert.equal(w.getComputedStyle(stat('INITIATIVE')).color, 'rgb(255, 255, 255)');
  control('m2-upgrade-preview-toggle').click();
  node('BLUE:3:B').click();
  assert.equal(w.getComputedStyle(node('BLUE:3:B')).borderTopColor, 'rgb(183, 153, 222)');
  assert.equal(w.getComputedStyle(stat('ATTACK')).color, 'rgb(183, 153, 222)');
  assert.equal(w.getComputedStyle(node('RED:2:A')).borderTopColor, 'rgb(231, 204, 131)');
  control('m2-upgrade-preview-toggle').click();
  assert.equal(w.getComputedStyle(stat('DEFENSE')).color, 'rgb(231, 204, 131)');
  control('m2-upgrade-reset').click();
  assert(!node('RED:2:A').classList.contains('m2-upgrade-selected'));
  assert(stat('DEFENSE').classList.contains('m2-upgrade-empty'));
});

test('landscape level-up keeps the reserved viewer left and gates Commit in the right control pane', (t) => {
  const { w, d, node, control, calls } = setup(t);
  Object.defineProperties(w, {
    innerWidth: { value: 844 },
    innerHeight: { value: 360 },
  });
  selectScreenMedia(
    d.getElementById('goa2-m2-style'),
    new Set([landscapeQuery, '(max-height: 500px)']),
  );
  w.testUI.refresh();
  const css = (selector) => w.getComputedStyle(d.querySelector(selector));
  assert.equal(css('.m2-upgrade-browser').display, 'grid');
  assert.equal(css('.m2-upgrade-browser').overflowY, 'auto');
  assert.equal(css('.m2-upgrade-content').display, 'contents');
  assert.equal(css('.m2-upgrade-details').gridColumn, '1');
  assert.equal(css('.m2-upgrade-details').gridRow, '1 / -1');
  for (const selector of [
    '.m2-upgrade-heading',
    '.m2-upgrade-status',
    '.m2-upgrade-controls',
    '.m2-upgrade-actions',
    '.m2-upgrade-content > .m2-deck-row-list',
  ])
    assert.equal(css(selector).gridColumn, '2');
  assert.equal(css('.m2-upgrade-actions').gridRow, '5');
  assert.equal(css('.m2-upgrade-commit').width, '100%');
  assert.equal(d.documentElement.style.getPropertyValue('--m2-vh'), '360px');
  assert(control('m2-upgrade-commit').disabled);
  node('RED:2:A').click();
  assert(!control('m2-upgrade-commit').disabled);
  control('m2-upgrade-preview-toggle').click();
  assert(control('m2-upgrade-commit').disabled);
  assert.equal(calls.length, 0, 'layout changes and preview never submit an upgrade');
});

test('one-upgrade staging uses paired items and never invokes native selection before Commit', (t) => {
  const { d, node, control, calls, nativeClicks } = setup(t);
  node('RED:2:A').click();
  assert(!control('m2-upgrade-commit').disabled);
  assert.equal(node('RED:2:A').dataset.state, 'planned');
  assert.equal(calls.length, 0);
  assert.equal(nativeClicks(), 0);
  assert(d.querySelector('.m2-upgrade-details .m2-upgrade-gain img').src.endsWith('/defense.png'));
  const defense = d.querySelector('.m2-upgrade-totals [data-stat="DEFENSE"]');
  assert.equal(defense.dataset.planned, '1');
  node('BLUE:2:B').click();
  assert.equal(node('RED:2:A').getAttribute('aria-pressed'), 'false');
  assert.equal(node('BLUE:2:B').getAttribute('aria-pressed'), 'true');
  control('m2-upgrade-commit').click();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { hero_id: 'hero_test', card_id: 'BLUE:2:B' },
  ]);
  control('m2-upgrade-commit').click();
  assert.equal(calls.length, 1, 'double click cannot resubmit');
});

test('mixed-tier batches require every lower-tier choice and clear dependent Tier 3 choices when editing Tier 2', (t) => {
  const { d, node, control, calls } = setup(t, { RED: 2, BLUE: 1, GREEN: 1 }, 3);
  assert.equal(d.querySelector('[data-upgrade-tier="2"]').textContent, 'Tier 2 · 0/2');
  assert.equal(d.querySelector('[data-upgrade-tier="3"]').textContent, 'Tier 3 · 0/1');
  node('RED:3:A').click();
  assert.equal(node('RED:3:A').getAttribute('aria-pressed'), 'false');
  node('BLUE:2:A').click();
  node('RED:3:A').click();
  assert(control('m2-upgrade-commit').disabled);
  node('GREEN:2:A').click();
  assert.equal(node('RED:3:A').dataset.eligible, 'true');
  node('BLUE:3:B').click();
  assert(!control('m2-upgrade-commit').disabled);
  node('GREEN:2:B').click();
  assert.equal(node('BLUE:3:B').getAttribute('aria-pressed'), 'false');
  assert(control('m2-upgrade-commit').disabled);
  node('RED:3:A').click();
  assert(!control('m2-upgrade-commit').disabled);
  assert.equal(calls.length, 0);
});

test('Preview plans remain isolated; toggling off removes them and restores the staged batch', (t) => {
  const { d, node, control, calls } = setup(t);
  node('RED:2:A').click();
  control('m2-upgrade-preview-toggle').click();
  assert(control('m2-upgrade-commit').disabled, 'even an empty active preview blocks Commit');
  node('BLUE:3:B').click();
  assert.equal(node('BLUE:3:B').dataset.state, 'planned');
  assert.equal(node('BLUE:3:A').dataset.state, 'unavailable');
  assert.equal(d.querySelector('[data-upgrade-tier="3"]').textContent, 'Tier 3 · 0/0');
  assert.equal(calls.length, 0);
  control('m2-upgrade-preview-toggle').click();
  assert.equal(control('m2-upgrade-preview-toggle').getAttribute('aria-checked'), 'false');
  assert.equal(node('BLUE:3:B').getAttribute('aria-pressed'), 'false');
  assert.equal(node('RED:2:A').getAttribute('aria-pressed'), 'true');
  assert(!control('m2-upgrade-commit').disabled);
  control('m2-upgrade-preview-toggle').click();
  node('RED:3:A').click();
  control('m2-upgrade-preview-toggle').click();
  assert.equal(node('RED:3:A').getAttribute('aria-pressed'), 'false');
  assert(!control('m2-upgrade-commit').disabled);
});

test('batch Commit waits for each acknowledgement, uses refreshed native callbacks and handles the tier boundary', (t) => {
  const f = setup(t, { RED: 2, BLUE: 1, GREEN: 2 }, 2);
  f.node('BLUE:2:A').click();
  f.node('RED:3:B').click();
  f.control('m2-upgrade-commit').click();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].card_id, 'BLUE:2:A');
  f.update();
  f.update();
  assert.equal(f.calls.length, 1, 'unchanged state cannot submit the next choice');
  f.setCallback((payload) => f.calls.push(payload));
  f.acknowledge();
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].card_id, 'RED:3:B');
  assert.equal(f.timers.size, 1);
  f.acknowledge();
  assert.equal(f.calls.length, 2);
  assert(!f.d.querySelector('.m2-upgrade-browser'));
  assert.equal(f.timers.size, 0);
});

test('committed same-tier alternatives stay dark and cannot be staged or previewed', (t) => {
  const f = setup(t, { RED: 2, BLUE: 1, GREEN: 1 });
  assert.equal(f.node('RED:2:A').dataset.state, 'current');
  const alternative = f.node('RED:2:B');
  assert.equal(alternative.dataset.state, 'unavailable');
  assert.equal(f.w.getComputedStyle(alternative).opacity, '0.3');
  alternative.click();
  assert.equal(f.d.querySelectorAll('.m2-upgrade-selected').length, 0);
  assert(f.control('m2-upgrade-commit').disabled);
  assert.equal(f.calls.length, 0);
  f.control('m2-upgrade-preview-toggle').click();
  alternative.click();
  assert.equal(f.d.querySelectorAll('.m2-upgrade-browser .m2-tree-planned').length, 0);
  assert.equal(alternative.dataset.state, 'unavailable');
  assert.equal(
    f.node('RED:3:A').dataset.state,
    'standard',
    'future tier choices remain previewable',
  );
  assert.equal(f.node('RED:3:B').dataset.state, 'standard');
  assert.equal(f.calls.length, 0);
});

test('acknowledged lower-tier item alternatives retain item status when that playable card is replaced', (t) => {
  const f = setup(t, { RED: 2, BLUE: 1, GREEN: 2 }, 3);
  f.node('BLUE:2:A').click();
  f.node('BLUE:3:A').click();
  f.node('GREEN:3:B').click();
  f.control('m2-upgrade-commit').click();
  f.acknowledge();
  assert.equal(f.calls[1].card_id, 'BLUE:3:A');
  f.acknowledge();
  assert.equal(f.node('BLUE:2:B').dataset.state, 'item');
  assert.equal(f.node('BLUE:2:A').dataset.state, 'unavailable');
  const saved = JSON.parse(
    f.w.localStorage.getItem('goa2-mobile-build:' + JSON.stringify(['/game/test', 'hero_test'])),
  );
  assert(saved.chosen.some(([group, id]) => group === 'BLUE:2' && id === 'BLUE:2:A'));
  assert(saved.chosen.some(([group, id]) => group === 'BLUE:3' && id === 'BLUE:3:A'));
});

test('external choices invalidate staging; timeout pauses uncertain batches without automatic retries', (t) => {
  const f = setup(t, { RED: 2, BLUE: 1, GREEN: 2 }, 2);
  f.node('BLUE:2:A').click();
  f.node('RED:3:A').click();
  f.setRemaining(1);
  assert(f.control('m2-upgrade-commit').disabled);
  assert.equal(f.calls.length, 0);
  f.node('BLUE:2:B').click();
  f.control('m2-upgrade-commit').click();
  const timer = [...f.timers.values()][0];
  timer();
  assert.match(f.control('m2-upgrade-status').textContent, /acknowledgement/);
  assert(f.control('m2-upgrade-commit').disabled);
  f.update();
  assert.equal(f.calls.length, 1);
});

test('partial/ambiguous native data retains the native picker without inventing card rules', (t) => {
  const f = setup(t);
  f.hero.hand.push(f.cards.find((card) => card.id === 'RED:2:A'));
  f.update();
  assert(!f.d.querySelector('.m2-upgrade-browser'));
  assert(!f.picker.hasAttribute('data-m2-upgrade-tree'));
  assert.equal(f.calls.length, 0);
  f.hero.hand = f.hero.hand.filter((card) => card.id !== 'RED:2:A');
  f.update();
  assert(f.d.querySelector('.m2-upgrade-browser'));
  f.setCallback(null);
  assert(
    !f.d.querySelector('.m2-upgrade-browser'),
    'missing native callback keeps the native picker',
  );
});

test('an unrelated acknowledgement or newly rejected option cannot continue a committed batch', (t) => {
  const f = setup(t, { RED: 2, BLUE: 1, GREEN: 2 }, 2);
  f.node('BLUE:2:A').click();
  f.node('RED:3:A').click();
  f.control('m2-upgrade-commit').click();
  f.hero.hand = f.hero.hand
    .filter((card) => card.color !== 'BLUE')
    .concat(f.cards.find((card) => card.id === 'BLUE:2:B'));
  f.setRemaining(1);
  assert.equal(f.calls.length, 1, 'another choice is not an acknowledgement of our submitted card');
  assert(f.control('m2-upgrade-commit').disabled);
  assert.match(f.control('m2-upgrade-status').textContent, /state changed/);
});

test('hiding the page pauses a batch and requires a new Commit after acknowledgement', (t) => {
  const f = setup(t, { RED: 2, BLUE: 1, GREEN: 2 }, 2);
  f.node('BLUE:2:A').click();
  f.node('RED:3:A').click();
  f.control('m2-upgrade-commit').click();
  let visibility = 'hidden';
  Object.defineProperty(f.d, 'visibilityState', { get: () => visibility });
  f.d.dispatchEvent(new f.w.Event('visibilitychange'));
  f.acknowledge();
  assert.equal(f.calls.length, 1);
  visibility = 'visible';
  f.d.dispatchEvent(new f.w.Event('visibilitychange'));
  assert(!f.control('m2-upgrade-commit').disabled);
  f.control('m2-upgrade-commit').click();
  assert.equal(f.calls.length, 2, 'only another explicit Commit resumes submission');
});

test('closing, hero/game changes and desktop transitions cancel queued work and restore the native menu', (t) => {
  const f = setup(t, { RED: 2, BLUE: 1, GREEN: 2 }, 2);
  f.node('BLUE:2:A').click();
  f.node('RED:3:A').click();
  f.control('m2-upgrade-commit').click();
  f.media.matches = false;
  f.w.testUI.refresh();
  assert(!f.picker.hasAttribute('data-m2-upgrade-tree'));
  assert.equal(f.timers.size, 0);
  f.acknowledge();
  assert.equal(f.calls.length, 1, 'teardown cannot continue the batch');
  f.media.matches = true;
  f.update();
  assert(f.control('m2-upgrade-commit').disabled);
  f.node('RED:3:A').click();
  f.w.history.replaceState(null, '', '/game/other?3d=0');
  f.update();
  assert(f.control('m2-upgrade-commit').disabled, 'choices never carry into another game');
});
