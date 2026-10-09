const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function setup(t, tier) {
  const fixture = browserFixture({
    html: `<header class="_bar_test"><span class="_phase_test">RESOLUTION</span></header>
      <main><div class="_boardArea_test"></div><aside class="_sidebar_test">
      <section><div class="_name_test">Swift · Other player</div>
      <div class="_details_test">Lv 3 · 1 Gold</div></section></aside></main>`,
    hooks: ['refresh', 'cardGrantedItem'],
  });
  t.after(() => fixture.close());
  const { w, d } = fixture;
  const card = {
    id: 'swift-red-' + tier,
    name: 'Revealed attack ' + tier,
    color: 'RED',
    tier,
    initiative: 8,
    primary_action: 'ATTACK',
    primary_action_value: 4,
    secondary_actions: { MOVEMENT: 2 },
    effect_text: 'Public card rules.',
    is_facedown: false,
    item: 'ATTACK',
  };
  const hero = {
    id: 'hero_swift',
    name: 'Swift',
    team: 'RED',
    level: 3,
    gold: 1,
    deck: { count: 9 },
    hand: [{ id: 'hidden', is_facedown: true }],
    current_turn_card: card,
    played_cards: [null, null, null, null],
    discard_pile: [],
    items: { ATTACK: 1 },
  };
  const view = {
    phase: 'RESOLUTION',
    turn: 1,
    effects: [],
    board: { entity_locations: { hero_swift: {} } },
  };
  const source = d.querySelector('section');
  source.__reactFiber$test = { memoizedProps: { hero } };
  d.querySelector('aside').__reactFiber$test = { memoizedProps: { view } };
  const errors = [];
  w.addEventListener('error', (event) => {
    errors.push(event.error);
    event.preventDefault();
  });
  fixture.install();
  return { ...fixture, hero, card, source, errors };
}

for (const tier of ['II', 'III']) {
  test(`other heroes' revealed Tier ${tier} cards open from Board, Heroes and Board focus with a count-only deck`, (t) => {
    const { w, d, hero, card, source, errors } = setup(t, tier);
    const assertViewer = () => {
      assert.deepEqual(errors, [], 'clicking a revealed card must not throw');
      const viewer = d.querySelector('#goa2-m2-hero-display .m2-text-card');
      assert(viewer, 'the Card viewer opens');
      assert(
        d.querySelectorAll('[data-m2-viewed]').length >= 2,
        'highlight matching Board and Heroes sources',
      );
      for (const button of d.querySelectorAll('[data-m2-viewed]')) {
        assert.equal(button.getAttribute('aria-label'), card.name);
        assert.notEqual(w.getComputedStyle(button).outline, '2px solid #f3f6ff');
        assert.equal(w.getComputedStyle(button).position, 'relative');
        assert.equal(w.getComputedStyle(button).isolation, 'isolate');
      }
      w.testUI.refresh();
      assert(d.querySelector('[data-m2-viewed]'), 'cached refresh preserves highlighting');
      assert.equal(viewer.querySelector('.m2-card-top b').textContent, card.name);
      assert.equal(viewer.querySelector('.m2-card-type .m2-upgraded-value').textContent, '5');
      assert(viewer.textContent.includes('Public card rules.'));
      assert(
        !viewer.querySelector('.m2-upgrade-gain'),
        'an unknown alternative grants no invented item',
      );
      viewer.querySelector('.m2-card-dismiss').click();
      assert(!d.querySelector('#goa2-m2-hero-display .m2-text-card'));
      assert(!d.querySelector('[data-m2-viewed]'), 'dismissal clears all matching source overlays');
    };
    d.querySelector('#goa2-m2-summary .m2-micro-button').click();
    assertViewer();
    d.querySelector('[data-mode="heroes"]').click();
    source.querySelector('.m2-current-card-mini').click();
    assertViewer();
    d.querySelector('[data-mode="heroes"]').click();
    d.querySelector('.m2-summary-identity').click();
    d.querySelector('.m2-focused-hero .m2-current-card-mini').click();
    assertViewer();
    assert.deepEqual(hero.deck, { count: 9 }, 'inspection leaves the masked deck unchanged');
    assert.equal(card.primary_action_value, 4, 'printed card values remain unchanged');
    assert.equal(hero.hand[0].is_facedown, true);
    card.is_facedown = true;
    w.testUI.refresh();
    assert(!d.querySelector('.m2-focused-hero .m2-current-card-mini'));
    d.querySelector('.m2-focus-back').click();
    assert(d.querySelector('#goa2-m2-summary .m2-micro-button').disabled);
    assert(!d.querySelector('#goa2-m2-hero-display .m2-text-card'));
  });
}

test('count-only and absent catalogs cannot supply a paired item grant', (t) => {
  const { w, card } = setup(t, 'II');
  for (const catalog of [{ count: 9 }, null, undefined])
    assert.equal(w.testUI.cardGrantedItem(card, catalog), null);
});

test('viewer highlights follow hero identity, card changes, rebuilt history and visibility', (t) => {
  const { w, d, hero, card, source } = setup(t, 'II');
  const second = d.createElement('section');
  second.innerHTML =
    '<div class="_name_test">Another hero</div><div class="_details_test">Lv 3</div>';
  const other = { ...hero, id: 'hero_other', name: 'Other' };
  second.__reactFiber$test = { memoizedProps: { hero: other } };
  d.querySelector('aside').append(second);
  hero.current_turn_card.is_active = true;
  w.testUI.refresh();
  source.querySelector('.m2-current-card-mini').click();
  assert(!second.querySelector('[data-m2-viewed]'), 'same card ID on another hero is not selected');
  assert(source.querySelector('.m2-current-card-mini').classList.contains('m2-effect-active'));
  hero.played_cards[0] = { ...card, id: 'previous-card', name: 'Previous card' };
  w.testUI.refresh();
  assert(
    source.querySelector('.m2-current-card-mini[data-m2-viewed]'),
    'rebuild restores selection',
  );
  const history = source.querySelector('.m2-micro-button[aria-label="Previous card"]');
  history.click();
  assert(history.hasAttribute('data-m2-viewed'));
  assert(!source.querySelector('.m2-current-card-mini').hasAttribute('data-m2-viewed'));
  assert(source.querySelector('.m2-current-card-mini').classList.contains('m2-effect-active'));
  hero.played_cards[0].is_facedown = true;
  w.testUI.refresh();
  assert(
    !d.querySelector('[data-m2-viewed]'),
    'hidden selected card closes and clears its overlay',
  );
  assert(!d.querySelector('#goa2-m2-hero-display .m2-text-card'));
});

test('viewed cards animate angle and opacity levels with independent CSS cycles and retain click-through inspection', (t) => {
  const { d, source } = setup(t, 'II');
  const overlay = [...d.querySelector('#goa2-m2-style').sheet.cssRules].find((rule) =>
    rule.selectorText?.endsWith('.m2-card-source[data-m2-viewed]::after'),
  );
  assert(overlay, 'the overlay belongs only to the card shown in the viewer');
  assert.equal(overlay.style.content, '""');
  assert.equal(overlay.style.position, 'absolute');
  assert.equal(Number.parseFloat(overlay.style.inset), 0);
  assert.equal(overlay.style.zIndex, '10');
  assert.equal(overlay.style.pointerEvents, 'none');
  assert.equal(overlay.style.borderRadius, 'inherit');
  const style = d.querySelector('#goa2-m2-style');
  // jsdom cannot evaluate a registered angle in a gradient; inspect the authored rule.
  assert.match(
    style.textContent,
    /background: linear-gradient\(\s*var\(--m2-viewed-angle, 135deg\),\s*rgba\(255, 255, 255, var\(--m2-viewed-alpha-high, 0\.15\)\),\s*rgba\(255, 255, 255, var\(--m2-viewed-alpha-low, 0\.05\)\)\s*\)/,
  );

  assert.equal(
    overlay.style.animation.replace(/\s+/g, ' '),
    'm2-viewed-sweep 4s cubic-bezier(0.33, 1, 0.67, 0) infinite, m2-viewed-levels 4.2s ease-in-out infinite',
  );
  for (const [name, initial] of [
    ['high', '0.15'],
    ['low', '0.05'],
  ])
    assert.match(
      style.textContent,
      new RegExp(
        '@property --m2-viewed-alpha-' +
          name +
          '\\s*\\{\\s*syntax: "<number>";\\s*inherits: false;\\s*initial-value: ' +
          initial.replace('.', '\\.') +
          ';',
      ),
    );
  const levels = [...style.sheet.cssRules].find((rule) => rule.name === 'm2-viewed-levels');
  assert(levels);
  assert.deepEqual(
    [...levels.cssRules].map((frame) => [
      frame.keyText,
      frame.style.getPropertyValue('--m2-viewed-alpha-high'),
      frame.style.getPropertyValue('--m2-viewed-alpha-low'),
    ]),
    [
      ['0%, 100%', '0.15', '0.05'],
      ['50%', '0.2', '0'],
    ],
  );

  // jsdom skips @property rules, so check registration in the authored stylesheet.
  assert.match(
    style.textContent,
    /@property --m2-viewed-angle\s*\{\s*syntax: "<angle>";\s*inherits: false;\s*initial-value: 135deg;/,
  );
  const sweep = [...style.sheet.cssRules].find((rule) => rule.name === 'm2-viewed-sweep');
  assert(sweep);
  assert.deepEqual(
    [...sweep.cssRules].map((frame) => [
      frame.keyText,
      frame.style.getPropertyValue('--m2-viewed-angle'),
    ]),
    [
      ['0%, 100%', '135deg'],
      ['50%', '225deg'],
    ],
  );
  const reduced = [...style.sheet.cssRules].find(
    (rule) =>
      rule.conditionText === '(prefers-reduced-motion: reduce)' &&
      [...rule.cssRules].some((child) =>
        child.selectorText?.endsWith('.m2-card-source[data-m2-viewed]::after'),
      ),
  );
  assert.equal(reduced.cssRules[0].style.animation, 'none');
  source.querySelector('.m2-current-card-mini').click();
  assert(source.querySelector('[data-m2-viewed]'));
  d.querySelector('#goa2-m2-hero-display .m2-card-dismiss').click();
  source.querySelector('.m2-current-card-mini').click();
  assert(
    d.querySelector('#goa2-m2-hero-display .m2-text-card'),
    'source can be opened again after dismissal',
  );
});
