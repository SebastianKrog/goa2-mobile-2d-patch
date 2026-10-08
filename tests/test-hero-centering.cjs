const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function setup(t, initialZoom = 1) {
  const f = browserFixture({
    html: `<div class="_layout_test"><header class="_bar_test"><span class="_phase_test">PLANNING</span></header>
      <main class="_main_test"><div class="_boardArea_test"><div id="map"><svg class="_svg_test"><g id="figure"></g></svg>
      <button class="_zoomReset_test">Reset</button></div></div><aside class="_sidebar_test">
      <section><div class="_name_test">Test · Player (You)</div><div class="_details_test">Lv 4</div></section>
      </aside></main></div>`,
    hooks: ['refresh', 'centerBoardHero', 'get boardRotation(){return boardRotation}'],
  });
  t.after(() => f.close());
  const { w, d } = f;
  const hero = {
    id: 'hero_test',
    name: 'Test',
    team: 'BLUE',
    level: 4,
    items: {},
    hand: [],
    played_cards: [],
    discard_pile: [],
  };
  const view = {
    phase: 'PLANNING',
    turn: 1,
    teams: { BLUE: { heroes: [hero] } },
    board: { entity_locations: { hero_test: {} } },
  };
  const source = d.querySelector('section'),
    svg = d.querySelector('svg'),
    host = d.getElementById('map');
  source.__reactFiber$test = { memoizedProps: { hero } };
  d.querySelector('aside').__reactFiber$test = { memoizedProps: { view } };
  svg.__reactFiber$test = { memoizedProps: { view } };
  const tile = { occupantId: hero.id, cx: 70, cy: -35 };
  d.getElementById('figure').__reactFiber$test = { memoizedProps: tile };
  host.getBoundingClientRect = () => ({ left: 0, top: 40, width: 800, height: 440 });
  let camera = { k: initialZoom, x: 0, y: 0 },
    drag,
    blockedClick = false,
    wheelCalls = 0,
    actions = 0;
  const wheelDeltas = [];
  const repaint = () => {
    const snapshot = { ...camera };
    host.__reactFiber$test = {
      memoizedProps: {
        onPointerDown(e) {
          if (snapshot.k > 1) drag = { x: e.clientX, y: e.clientY, camera: snapshot };
        },
        onPointerMove(e) {
          if (!drag) return;
          blockedClick = true;
          // Model the native edge clamp to verify the remaining screen correction.
          camera.x = Math.max(-40, Math.min(40, drag.camera.x + e.clientX - drag.x));
          camera.y = Math.max(-40, Math.min(40, drag.camera.y + e.clientY - drag.y));
          w.requestAnimationFrame(repaint);
        },
        onPointerUp() {
          drag = null;
        },
        onPointerCancel() {
          drag = null;
        },
        onClickCapture(e) {
          if (blockedClick) {
            blockedClick = false;
            e.stopPropagation();
          }
        },
      },
    };
    svg.style.transform =
      camera.k === 1 ? '' : `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})`;
    host.querySelector('button').textContent = Math.round(camera.k * 100) + '% · Reset';
  };
  host.addEventListener('wheel', (e) => {
    wheelCalls++;
    wheelDeltas.push(e.deltaY);
    camera.k = Math.min(6, Math.max(1, camera.k * Math.exp(-e.deltaY * 0.002)));
    w.requestAnimationFrame(repaint);
  });
  host.querySelector('button').onclick = () => {
    camera = { k: 1, x: 0, y: 0 };
    repaint();
  };
  svg.onclick = () => actions++;
  const computed = w.getComputedStyle.bind(w);
  w.getComputedStyle = (element) => {
    const css = computed(element);
    return element === svg
      ? new Proxy(css, {
          get(target, key) {
            return key === 'translate' ? '-160px 0px' : Reflect.get(target, key);
          },
        })
      : css;
  };
  svg.getScreenCTM = () => {
    const angle =
      (Number(host.style.getPropertyValue('--m2-angle').replace('deg', '')) * Math.PI) / 180;
    return {
      a: camera.k * Math.cos(angle),
      b: camera.k * Math.sin(angle),
      c: -camera.k * Math.sin(angle),
      d: camera.k * Math.cos(angle),
      e: 240 + camera.x + (parseFloat(host.style.getPropertyValue('--m2-center-x')) || 0),
      f: 260 + camera.y + (parseFloat(host.style.getPropertyValue('--m2-center-y')) || 0),
    };
  };
  repaint();
  f.install();
  function screenPoint() {
    const m = svg.getScreenCTM();
    return { x: m.a * tile.cx + m.c * tile.cy + m.e, y: m.b * tile.cx + m.d * tile.cy + m.f };
  }
  async function settled() {
    for (let i = 0; i < 12 && w.testUI.boardRotation.centerPending; i++)
      await new Promise((resolve) => w.requestAnimationFrame(resolve));
    assert(!w.testUI.boardRotation.centerPending);
  }
  return {
    ...f,
    hero,
    view,
    svg,
    host,
    tile,
    source,
    settled,
    screenPoint,
    wheelDeltas,
    camera: () => camera,
    wheelCalls: () => wheelCalls,
    actions: () => actions,
    blocked: () => blockedClick,
  };
}

for (const start of [1, 4])
  test(`Heroes portrait centers at 250% from ${start * 100}% without leaving Heroes or changing rotation`, async (t) => {
    const f = setup(t, start),
      { w, d, host } = f;
    d.querySelector('[data-mode="heroes"]').click();
    w.testUI.boardRotation.angle = 90;
    w.testUI.boardRotation.sync();
    f.source.querySelector('.m2-hero-center').click();
    await f.settled();
    assert.equal(d.documentElement.dataset.m2Mode, 'heroes');
    assert(Math.abs(f.camera().k - 2.5) < 1e-9);
    assert.equal(f.wheelCalls(), 1);
    assert(Math.abs(f.wheelDeltas[0] + Math.log(2.5 / start) / 0.002) < 1e-9);
    assert.equal(host.style.getPropertyValue('--m2-angle'), '90deg');
    assert(Math.abs(f.screenPoint().x - 240) < 1e-9);
    assert(Math.abs(f.screenPoint().y - 260) < 1e-9);
    assert.equal(d.querySelector('.m2-board-controls button').textContent, '250% · Reset');
    assert.equal(f.actions(), 0);
    assert.equal(f.blocked(), false, 'centering does not swallow the next native click');
    assert.equal(f.svg.parentElement, host);
    d.querySelector('.m2-board-controls button').click();
    assert.equal(f.camera().k, 1);
    assert.equal(host.style.getPropertyValue('--m2-center-x'), '');
    assert.equal(host.style.getPropertyValue('--m2-center-y'), '');
  });

test('focused Board double-click centers its hero; back/card controls retain their actions', async (t) => {
  const f = setup(t),
    { d, w } = f;
  d.querySelector('.m2-summary-identity').click();
  const box = d.querySelector('.m2-focused-hero');
  assert(!box.querySelector('.m2-hero-center'));
  assert(
    !d.querySelector('.m2-focus-hero-icon .m2-hero-center'),
    'clones have no nested portrait buttons',
  );
  box
    .querySelector('.m2-hero-history')
    .dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true }));
  await f.settled();
  assert.equal(f.camera().k, 2.5);
  assert.equal(d.documentElement.dataset.m2Mode, 'board');
  assert.equal(d.querySelector('.m2-focused-hero').dataset.heroId, f.hero.id);
  d.querySelector('.m2-focus-hero-icon[aria-pressed="true"]').dispatchEvent(
    new w.MouseEvent('dblclick', { bubbles: true }),
  );
  await f.settled();
  assert(Math.abs(f.screenPoint().x - 240) < 1e-9);
  assert(Math.abs(f.screenPoint().y - 260) < 1e-9);
  const calls = f.wheelCalls();
  box
    .querySelector('.m2-focus-back')
    .dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true }));
  assert.equal(f.wheelCalls(), calls);
});

test('generic owned figures can be centered, while off-board heroes and missing native handlers are harmless', async (t) => {
  const f = setup(t),
    { d, w, host, view, tile } = f;
  delete view.board.entity_locations.hero_test;
  view.hero_pieces = { figure_a: { owner_hero_id: f.hero.id } };
  view.board.entity_locations.figure_a = {};
  tile.occupantId = 'figure_a';
  await w.testUI.centerBoardHero(f.hero.id);
  assert.equal(f.camera().k, 2.5);
  assert(Math.abs(f.screenPoint().x - 240) < 1e-9);
  delete view.board.entity_locations.figure_a;
  w.testUI.refresh();
  assert(f.source.querySelector('.m2-hero-center').disabled);
  const before = f.wheelCalls();
  await w.testUI.centerBoardHero(f.hero.id);
  assert.equal(f.wheelCalls(), before);
  view.board.entity_locations.figure_a = {};
  host.__reactFiber$test.memoizedProps = {};
  await w.testUI.centerBoardHero(f.hero.id);
  assert.equal(f.wheelCalls(), before);
  w.GOA2Mobile2D.destroy();
  assert.equal(host.style.getPropertyValue('--m2-center-x'), '');
  assert.equal(host.style.getPropertyValue('--m2-center-y'), '');
  assert(!d.querySelector('.m2-hero-center'));
});

test('Reset and teardown cancel centering while a native camera update is pending', async (t) => {
  const f = setup(t),
    { w, d, host } = f;
  const pending = w.testUI.centerBoardHero(f.hero.id);
  d.querySelector('.m2-board-controls button').click();
  await pending;
  assert.equal(f.camera().k, 1);
  assert.equal(host.style.getPropertyValue('--m2-center-x'), '');
  assert.equal(host.style.getPropertyValue('--m2-center-y'), '');
  const next = w.testUI.centerBoardHero(f.hero.id);
  w.GOA2Mobile2D.destroy();
  await next;
  assert.equal(host.style.getPropertyValue('--m2-center-x'), '');
  assert.equal(host.style.getPropertyValue('--m2-center-y'), '');
  assert(!d.querySelector('.m2-hero-center'));
});
