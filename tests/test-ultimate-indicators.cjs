const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function setup(t) {
  const fixture = browserFixture({
    html: `<header class="_bar_test"><span class="_phase_test">PLANNING</span></header>
      <main class="_main_test"><div class="_boardArea_test"></div><aside class="_sidebar_test">
      <section><div class="_name_test">Hanu (You)</div><div class="_details_test">Lv 7</div></section>
      <div><div class="_label_test">Hand</div><div class="_row_test"><span class="_cardName_test">Ultimate</span></div></div>
      </aside></main>`,
    hooks: ['refresh', 'updateCardRow', 'extendedMicroCard', 'miniatureCard'],
  });
  t.after(() => fixture.close());
  const { w, d } = fixture;
  const ultimate = {
    id: 'ultimate',
    name: 'Ultimate',
    color: 'PURPLE',
    tier: 'IV',
    effect_text: 'Permanent ability.',
    secondary_actions: {},
  };
  const hero = {
    id: 'hero_hanu',
    name: 'Hanu',
    level: 7,
    gold: 0,
    items: {},
    hand: [],
    played_cards: [],
    discard_pile: [],
    ultimate_card: ultimate,
  };
  const box = d.querySelector('section'),
    row = d.querySelector('._row_test');
  box.__reactFiber$test = { memoizedProps: { hero } };
  d.querySelector('aside').__reactFiber$test = {
    memoizedProps: {
      view: { phase: 'PLANNING', turn: 1, board: { entity_locations: {} } },
    },
  };
  row.__reactFiber$test = {
    memoizedProps: { card: ultimate, hero },
    return: box.__reactFiber$test,
  };
  fixture.install();
  return { ...fixture, hero, ultimate, row };
}

test('Heroes reserve a centered U Nano before items; Board reserves an Ultimate dot, both unlock and relock', (t) => {
  const { w, d, hero } = setup(t);
  const nano = () => d.querySelector('.m2-hero-upgrades > .m2-ultimate-indicator');
  const dot = () => d.querySelector('.m2-summary-upgrades > .m2-ultimate-indicator');
  assert.equal(d.querySelector('.m2-hero-upgrades').firstElementChild, nano());
  assert.equal(d.querySelector('.m2-summary-upgrades').firstElementChild, dot());
  assert(nano().classList.contains('m2-nano-card'));
  assert(dot().classList.contains('m2-ultimate-dot'));
  assert.equal(nano().textContent, 'U');
  assert.equal(w.getComputedStyle(nano()).fontWeight, '800');
  assert.equal(w.getComputedStyle(nano()).placeItems, 'center');
  assert.equal(w.getComputedStyle(nano()).width, '20px');
  assert.equal(w.getComputedStyle(dot()).width, '5px');
  assert.equal(w.getComputedStyle(nano()).opacity, '0.45');
  assert.equal(w.getComputedStyle(dot()).opacity, '0.45');
  assert.equal(d.querySelector('.m2-summary-upgrades').querySelectorAll('[data-stat]').length, 6);
  const width = w.getComputedStyle(d.querySelector('.m2-summary-upgrades')).width;
  hero.level = 8;
  w.testUI.refresh();
  for (const marker of [nano(), dot()]) {
    assert(marker.classList.contains('m2-ultimate-unlocked'));
    assert.equal(w.getComputedStyle(marker).color, 'rgb(183, 153, 222)');
    assert(w.getComputedStyle(marker).animation.includes('m2-ultimate-breathe'));
    assert.equal(marker.getAttribute('aria-label'), 'Ultimate unlocked');
  }
  assert.equal(w.getComputedStyle(dot()).backgroundColor, 'rgb(183, 153, 222)');
  assert.equal(w.getComputedStyle(d.querySelector('.m2-summary-upgrades')).width, width);
  const rules = [...d.getElementById('goa2-m2-style').sheet.cssRules];
  const motion = rules.filter((rule) => rule.conditionText === '(prefers-reduced-motion: reduce)');
  assert(
    motion.some((rule) =>
      [...rule.cssRules].some(
        (child) =>
          child.selectorText?.endsWith('.m2-ultimate-unlocked') && child.style.animation === 'none',
      ),
    ),
  );
  const frames = rules.find((rule) => rule.name === 'm2-ultimate-breathe');
  assert([...frames.cssRules].every((rule) => rule.style.getPropertyValue('text-shadow')));
  hero.level = 7;
  w.testUI.refresh();
  assert(!nano().classList.contains('m2-ultimate-unlocked'));
  assert(!dot().classList.contains('m2-ultimate-unlocked'));
});

test('Ultimate Small and Mini cards reserve the initiative cell; Extended Micro retains its clear end cap', (t) => {
  const { w, d, ultimate, row } = setup(t);
  const small = row.querySelector('.m2-list-card');
  assert(small.classList.contains('m2-small-card'));
  assert(small.firstElementChild.classList.contains('m2-symbol'));
  assert.equal(small.firstElementChild.querySelectorAll('img').length, 0);
  assert.equal(w.getComputedStyle(small.firstElementChild).flexBasis, '32px');
  assert.equal(small.children[1].querySelector('.m2-list-name').textContent, 'Ultimate');
  const holder = d.createElement('button');
  d.body.append(holder);
  w.testUI.updateCardRow(holder, ultimate, {});
  const mini = holder.querySelector('.m2-mini-card');
  assert(mini.firstElementChild.classList.contains('m2-symbol'));
  assert.equal(w.getComputedStyle(mini.firstElementChild).flexBasis, '32px');
  assert(!mini.querySelector('img[src*="initiative"]'));
  const extended = w.testUI.extendedMicroCard(ultimate);
  d.body.append(extended);
  assert.equal(w.getComputedStyle(extended.firstElementChild).width, '20px');
  assert.equal(extended.firstElementChild.children.length, 0);
  assert.equal(
    extended.children[1].children.length,
    3,
    'empty Micro cells retain the same geometry',
  );
  assert(!extended.querySelector('img[src*="initiative"]'));
});
