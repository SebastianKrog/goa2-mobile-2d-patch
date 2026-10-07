const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function setup(t) {
  const fixture = browserFixture({
    html: `<header class="_bar_test"><span class="_phase_test">PLANNING</span></header>
      <div class="_boardArea_test"></div><aside class="_sidebar_test">
      <section><div class="_name_test" tabindex="7" role="heading" aria-expanded="mixed">Hanu (You)</div>
      <div class="_details_test">Lv 1</div></section></aside>`,
  });
  t.after(() => fixture.close());
  const { w, d } = fixture;
  d.querySelector('section').__reactFiber$test = {
    memoizedProps: {
      hero: {
        id: 'hero_hanu',
        name: 'Hanu',
        level: 1,
        gold: 0,
        hand: [],
        played_cards: [],
        discard_pile: [],
        items: {},
      },
    },
  };
  d.querySelector('aside').__reactFiber$test = {
    memoizedProps: { view: { phase: 'PLANNING', turn: 1 } },
  };
  const frames = new Map();
  const timers = new Map();
  let nextId = 0;
  w.requestAnimationFrame = (callback) => {
    const id = ++nextId;
    frames.set(id, callback);
    return id;
  };
  w.cancelAnimationFrame = (id) => frames.delete(id);
  w.setInterval = (callback) => {
    const id = ++nextId;
    timers.set(id, callback);
    return id;
  };
  w.clearInterval = (id) => timers.delete(id);
  const viewport = new w.EventTarget();
  viewport.height = 620;
  viewport.offsetTop = 20;
  w.innerHeight = 800;
  Object.defineProperty(w, 'visualViewport', { value: viewport });
  fixture.install();

  // Allow observer records to arrive, then run queued frames without wall-clock sleeps.
  const settle = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      if (!frames.size) return;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(0));
    }
    assert.fail('DOM reconciliation did not settle within ten frames');
  };
  return { ...fixture, viewport, frames, timers, settle };
}

test('visual viewport resize and scroll update offsets and coalesce into one frame', async (t) => {
  const { w, d, viewport, frames, settle } = setup(t);
  await settle();
  const root = d.documentElement;
  assert.equal(root.style.getPropertyValue('--m2-vh'), '620px');
  assert.equal(root.style.getPropertyValue('--m2-offset'), '160px');

  viewport.height = 500;
  viewport.offsetTop = 35;
  viewport.dispatchEvent(new w.Event('resize'));
  viewport.dispatchEvent(new w.Event('scroll'));
  w.dispatchEvent(new w.Event('resize'));
  assert.equal(frames.size, 1, 'all viewport events share one refresh');
  await settle();
  assert.equal(root.style.getPropertyValue('--m2-vh'), '500px');
  assert.equal(root.style.getPropertyValue('--m2-offset'), '265px');

  viewport.height = 900;
  viewport.dispatchEvent(new w.Event('resize'));
  await settle();
  assert.equal(root.style.getPropertyValue('--m2-offset'), '0px', 'offset never becomes negative');
});

test('desktop/mobile, missing sidebar and 3D/2D transitions restore native attributes', async (t) => {
  const { w, d, media, settle } = setup(t);
  await settle();
  const root = d.documentElement;
  const name = d.querySelector('._name_test');
  assert(root.hasAttribute('data-m2-active'));
  assert.equal(name.getAttribute('role'), 'button');

  media.matches = false;
  media.dispatchEvent(new w.Event('change'));
  await settle();
  assert(!root.hasAttribute('data-m2-active'));
  assert.equal(name.getAttribute('tabindex'), '7');
  assert.equal(name.getAttribute('role'), 'heading');
  assert.equal(name.getAttribute('aria-expanded'), 'mixed');

  media.matches = true;
  media.dispatchEvent(new w.Event('change'));
  await settle();
  assert(root.hasAttribute('data-m2-active'));
  assert.equal(name.getAttribute('role'), 'button');

  const sidebar = d.querySelector('aside');
  sidebar.remove();
  await settle();
  assert(!root.hasAttribute('data-m2-active'));
  d.body.append(sidebar);
  await settle();
  assert(root.hasAttribute('data-m2-active'));

  w.history.replaceState(null, '', '?3d=1');
  w.dispatchEvent(new w.Event('resize'));
  await settle();
  assert(!root.hasAttribute('data-m2-active'));
  w.history.replaceState(null, '', '?3d=0');
  w.dispatchEvent(new w.Event('resize'));
  await settle();
  assert(root.hasAttribute('data-m2-active'));
  assert.equal(d.querySelectorAll('#goa2-m2-nav').length, 1);
});

test('destroy cancels pending work, removes event listeners and permits a clean reinstall', async (t) => {
  const fixture = setup(t);
  const { w, d, media, viewport, frames, timers, settle } = fixture;
  await settle();
  assert.equal(timers.size, 1, 'the archive collector is installed');
  w.dispatchEvent(new w.Event('resize'));
  assert.equal(frames.size, 1);
  w.GOA2Mobile2D.destroy();
  assert.equal(frames.size, 0, 'the queued frame is cancelled');
  assert.equal(timers.size, 0, 'the archive interval is cleared');
  assert.equal(d.querySelectorAll('[data-m2],#goa2-m2-style,#goa2-m2-nav').length, 0);
  assert.equal(d.documentElement.style.getPropertyValue('--m2-vh'), '');
  assert.equal(d.querySelector('._name_test').getAttribute('role'), 'heading');

  w.dispatchEvent(new w.Event('resize'));
  w.dispatchEvent(new w.Event('online'));
  w.dispatchEvent(new w.Event('pagehide'));
  media.dispatchEvent(new w.Event('change'));
  viewport.dispatchEvent(new w.Event('resize'));
  viewport.dispatchEvent(new w.Event('scroll'));
  d.querySelector('._phase_test').textContent = 'RESOLUTION';
  await settle();
  assert.equal(frames.size, 0, 'destroyed observers and listeners cannot schedule new work');
  assert(!d.querySelector('#goa2-m2-nav'));

  fixture.install();
  await settle();
  assert.equal(timers.size, 1);
  assert.equal(d.querySelectorAll('#goa2-m2-nav').length, 1);
  assert.equal(d.querySelector('.m2-phase').textContent, 'RESOLUTION');
  assert(d.documentElement.hasAttribute('data-m2-active'));
});
