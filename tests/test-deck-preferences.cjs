const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

const storageKey = 'goa2-mobile-deck';
function setup(t, saved) {
  const fixture = browserFixture({
    html: `<aside class="_sidebar_test"></aside>
      <div class="_modal_test"><div class="_cardGrid_test"><canvas></canvas><canvas></canvas></div></div>`,
  });
  t.after(() => fixture.close());
  const { w, d } = fixture;
  w.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
  [...d.querySelectorAll('canvas')].forEach((canvas, index) => {
    canvas.__reactFiber$test = {
      memoizedProps: {
        card: {
          id: `card-${index}`,
          name: `Test ${index}`,
          color: index ? 'BLUE' : 'RED',
          tier: index ? 'II' : 'I',
          initiative: 3,
          primary_action: 'ATTACK',
          primary_action_value: 2,
          secondary_actions: {},
        },
      },
    };
  });
  if (saved !== undefined) w.localStorage.setItem(storageKey, saved);
  return fixture;
}

function assertOptions(d, view, sort) {
  assert.equal(d.querySelector('.m2-deck-browser').dataset.view, view);
  assert.equal(
    d.querySelector('.m2-sort-switch').getAttribute('aria-checked'),
    String(sort === 'color'),
  );
  assert.equal(
    d.querySelectorAll('.m2-deck-controls button[aria-pressed="true"]:not([role])').length,
    1,
  );
  const viewLabel = { tree: 'Tree', compact: 'List', grid: 'Grid' }[view];
  assert.equal(
    d.querySelector('.m2-deck-controls button[aria-pressed="true"]:not([role])').textContent,
    viewLabel,
  );
}

test('every saved Deck view/sort restores on the first render', (t) => {
  for (const view of ['tree', 'compact', 'grid']) {
    for (const sort of ['tier', 'color']) {
      const fixture = setup(t, JSON.stringify({ view, sort }));
      fixture.install();
      assertOptions(fixture.d, view, sort);
      fixture.close();
    }
  }
});

test('removed List and legacy large views migrate; malformed or unknown preferences use defaults', (t) => {
  const cases = [
    [JSON.stringify({ view: 'large', sort: 'color' }), 'compact', 'color'],
    [JSON.stringify({ view: 'list', sort: 'tier' }), 'compact', 'tier'],
    ['{broken', 'tree', 'tier'],
    ['null', 'tree', 'tier'],
    ['[]', 'tree', 'tier'],
    [JSON.stringify({ view: 'unknown', sort: 'unknown' }), 'tree', 'tier'],
    [JSON.stringify({ view: 'list', sort: 'unknown' }), 'compact', 'tier'],
    [JSON.stringify({ view: 'unknown', sort: 'color' }), 'tree', 'color'],
  ];
  for (const [saved, view, sort] of cases) {
    const fixture = setup(t, saved);
    fixture.install();
    assertOptions(fixture.d, view, sort);
    fixture.close();
  }
});

test('fresh Deck starts with Tree, List and Grid in order', (t) => {
  const fixture = setup(t);
  fixture.install();
  assertOptions(fixture.d, 'tree', 'tier');
  assert.deepEqual(
    [...fixture.d.querySelectorAll('.m2-deck-controls button:not([role])')].map(
      (button) => button.textContent,
    ),
    ['Tree', 'List', 'Grid'],
  );
  assert(fixture.d.querySelector('.m2-deck-tree'));
});

test('Deck controls persist preferences that a fresh installation restores', (t) => {
  const first = setup(t);
  first.install();
  [...first.d.querySelectorAll('.m2-deck-controls button')]
    .find((button) => button.textContent === 'List')
    .click();
  first.d.querySelector('.m2-sort-switch').click();
  const saved = first.w.localStorage.getItem(storageKey);
  assert.deepEqual(JSON.parse(saved), { view: 'compact', sort: 'color' });
  first.close();

  const restored = setup(t, saved);
  restored.install();
  assertOptions(restored.d, 'compact', 'color');
});

test('unavailable storage does not prevent Deck rendering or changing preferences', (t) => {
  const fixture = setup(t);
  const prototype = Object.getPrototypeOf(fixture.w.localStorage);
  const originalRead = prototype.getItem;
  const originalWrite = prototype.setItem;
  t.after(() => {
    prototype.getItem = originalRead;
    prototype.setItem = originalWrite;
  });
  prototype.getItem = () => {
    throw new Error('storage unavailable');
  };
  prototype.setItem = () => {
    throw new Error('storage unavailable');
  };
  fixture.install();
  assertOptions(fixture.d, 'tree', 'tier');
  [...fixture.d.querySelectorAll('.m2-deck-controls button')]
    .find((button) => button.textContent === 'List')
    .click();
  fixture.d.querySelector('.m2-sort-switch').click();
  assertOptions(fixture.d, 'compact', 'color');
});
