const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function setup(t, saved) {
  const fixture = browserFixture({
    html:
      '<aside class="_sidebar_test"></aside><div class="_boardArea_test"><svg class="_svg_test">' +
      [0, 1, 2]
        .map(
          (i) =>
            `<g id="tile${i}" transform="translate(${i * 20} 0)"><polygon points="10,0 5,8.66 -5,8.66 -10,0 -5,-8.66 5,-8.66"/><image href="minion.png"/></g>`,
        )
        .join('') +
      '</svg></div>',
    hooks: ['refresh', 'updateBoardTexture'],
  });
  t.after(() => fixture.close());
  const { w, d } = fixture;
  const svg = d.querySelector('svg');
  svg.__reactFiber$test = { memoizedProps: { mapName: 'test-map' } };
  const tiles = [...svg.children];
  tiles.forEach((tile, i) => {
    tile.__reactFiber$test = {
      memoizedProps: {
        hex: { q: i, r: 0, s: -i },
        spawnPoint: i ? { type: i === 1 ? 'MINION' : 'HERO' } : null,
        occupantId: 'unit',
      },
    };
  });
  if (saved !== undefined) w.localStorage.setItem('goa2-mobile-display', saved);
  fixture.install();
  return { ...fixture, svg, tiles, toggle: () => d.querySelector('[data-setting="texture"]') };
}

test('map-seeded textures stay below icons, vary per tile and outline occupied spawn points', (t) => {
  const { w, svg, tiles } = setup(t);
  const transforms = tiles.map((tile, i) => {
    const [base, texture, icon] = tile.children;
    assert.equal(texture.getAttribute('class'), 'm2-hex-texture');
    assert.equal(icon.tagName.toLowerCase(), 'image');
    assert.equal(texture.getAttribute('pointer-events'), 'none');
    const [shade, border] = texture.children;
    assert.equal(shade.getAttribute('opacity'), '0.08');
    assert.equal(border.getAttribute('points'), base.getAttribute('points'));
    assert.equal(border.getAttribute('display'), i ? 'inline' : 'none');
    assert.equal(border.getAttribute('stroke-opacity'), '0.1');
    assert.equal(border.getAttribute('stroke-width'), '1');
    assert.equal(border.getAttribute('vector-effect'), 'non-scaling-stroke');
    const transform = texture.getAttribute('transform');
    const [, angle, scale] = transform.match(/rotate\(([^)]+)\) scale\(([^)]+)\)/);
    assert(Number(angle) >= 0 && Number(angle) < 60);
    assert(Number(scale) >= 0.7 && Number(scale) < 0.8);
    return transform;
  });
  assert.equal(new Set(transforms).size, 3);
  w.testUI.updateBoardTexture();
  assert.equal(svg.querySelectorAll('.m2-hex-texture').length, 3);
  const replacement = svg.cloneNode(true);
  replacement.querySelectorAll('.m2-hex-texture').forEach((node) => node.remove());
  replacement.__reactFiber$test = svg.__reactFiber$test;
  [...replacement.children].forEach((tile, i) => {
    tile.__reactFiber$test = tiles[i].__reactFiber$test;
  });
  svg.replaceWith(replacement);
  w.testUI.updateBoardTexture();
  assert.deepEqual(
    [...replacement.querySelectorAll('.m2-hex-texture')].map((node) =>
      node.getAttribute('transform'),
    ),
    transforms,
  );
  w.GOA2Mobile2D.destroy();
  assert.equal(replacement.querySelectorAll('.m2-hex-texture').length, 0);
});

test('texture toggle defaults on, persists off and restores the same geometry', (t) => {
  const { w, svg, toggle } = setup(t, JSON.stringify({ cardArt: false }));
  assert.equal(toggle().getAttribute('aria-checked'), 'true');
  const transforms = [...svg.querySelectorAll('.m2-hex-texture')].map((node) =>
    node.getAttribute('transform'),
  );
  toggle().click();
  w.testUI.refresh();
  assert.equal(toggle().getAttribute('aria-checked'), 'false');
  assert.equal(JSON.parse(w.localStorage.getItem('goa2-mobile-display')).boardTexture, false);
  assert.equal(svg.querySelectorAll('.m2-hex-texture').length, 0);
  toggle().click();
  w.testUI.refresh();
  assert.deepEqual(
    [...svg.querySelectorAll('.m2-hex-texture')].map((node) => node.getAttribute('transform')),
    transforms,
  );
  const restored = setup(t, JSON.stringify({ boardTexture: false }));
  assert.equal(restored.toggle().getAttribute('aria-checked'), 'false');
  assert.equal(restored.svg.querySelectorAll('.m2-hex-texture').length, 0);
});
