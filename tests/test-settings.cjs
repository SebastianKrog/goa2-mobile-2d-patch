const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function setup(t, saved) {
  const fixture = browserFixture({
    html: '<aside class="_sidebar_test"></aside><div class="_gameToolsRow_test"><button>Report bug</button><button disabled>Fix game state</button><button>Share links</button></div>',
    hooks: ['refresh', 'textCard', 'appendCardArtwork', 'saveGameSettings'],
  });
  t.after(() => fixture.close());
  if (saved !== undefined) fixture.w.localStorage.setItem('goa2-mobile-display', saved);
  fixture.install();
  fixture.d.querySelector('[data-mode="tools"]').click();
  return {
    ...fixture,
    control: (key) => fixture.d.querySelector('#goa2-m2-settings [data-setting="' + key + '"]'),
  };
}

test('Settings has grouped controls, default-on artwork and centered typography; font steps preserve board geometry', (t) => {
  const { w, d, control } = setup(t);
  assert.deepEqual(
    [...d.querySelectorAll('#goa2-m2-settings h3')].map((e) => e.textContent),
    ['Appearance', 'Game', 'Tools'],
  );
  assert.equal(control('art').getAttribute('aria-checked'), 'true');
  const input = control('font');
  assert.equal(input.value, '0');
  assert.equal(Number(input.min) + Number(input.max), 0);
  assert.equal(input.getAttribute('aria-valuetext'), '100%');
  const sheet = d.getElementById('goa2-m2-style'),
    baseline = sheet.textContent;
  const card = w.testUI.textCard({ name: 'Card', color: 'RED', secondary_actions: {} }, 'deck');
  d.body.append(card);
  const footer = d.getElementById('goa2-m2-nav');
  const defaultHeight = w.getComputedStyle(footer).height;
  assert.equal(w.getComputedStyle(card).fontSize, '13px');
  const step = (value) => {
    input.value = value;
    input.dispatchEvent(new w.Event('input'));
  };
  step(1);
  assert.equal(w.getComputedStyle(card).fontSize, '14.3px');
  assert.equal(input.getAttribute('aria-valuetext'), '110%');
  step(-1);
  assert.equal(w.getComputedStyle(card).fontSize, '12.35px');
  assert.equal(input.getAttribute('aria-valuetext'), '95%');
  step(2);
  assert.equal(w.getComputedStyle(card).fontSize, '15.73px');
  assert.equal(w.getComputedStyle(footer).height, defaultHeight);
  assert.equal(w.getComputedStyle(footer.querySelector('button')).minHeight, '44px');
  assert(
    !d.querySelectorAll('style')[1],
    'scaling replaces the canonical sheet rather than accumulating overrides',
  );
  d.querySelector('.m2-font-range-labels button').click();
  assert.equal(input.value, '0');
  assert.equal(sheet.textContent, baseline);
});

test('Settings help supports tap, hover and keyboard without changing preferences', (t) => {
  const { w, d, control } = setup(t);
  const info = (key) => d.querySelector('[data-setting-info="' + key + '"]');
  const explanation = (key) => d.getElementById(info(key).getAttribute('aria-controls'));
  for (const key of ['art', 'font', 'cursors', 'sounds', 'volume', 'fullscreen']) {
    assert(info(key).title.length > 30, key + ' has hover help');
    assert.equal(info(key).getAttribute('aria-expanded'), 'false');
    assert(explanation(key).hidden);
    assert.equal(control(key).getAttribute('aria-describedby'), explanation(key).id);
    assert(!info(key).closest('[role="switch"]'), 'help never nests in a toggle');
  }
  info('art').click();
  assert(!explanation('art').hidden);
  assert.equal(info('art').getAttribute('aria-expanded'), 'true');
  assert.equal(control('art').getAttribute('aria-checked'), 'true');
  assert.equal(w.localStorage.getItem('goa2-mobile-display'), null);
  info('font').click();
  assert(explanation('art').hidden, 'only one explanation is open');
  assert.match(explanation('font').textContent, /0\.95/);
  assert.match(explanation('font').textContent, /1\.10/);
  assert(!explanation('font').hidden);
  control('font').value = '1';
  control('font').dispatchEvent(new w.Event('input'));
  assert(!explanation('font').hidden, 'refresh preserves the open explanation');
  info('font').click();
  assert(explanation('font').hidden, 'second tap closes help');
  info('cursors').click();
  assert.match(explanation('cursors').textContent, /Apply & reload/);
  assert(d.querySelector('.m2-settings-apply').hidden, 'reading help does not alter game settings');
  info('cursors').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert(explanation('cursors').hidden);
  assert.equal(info('cursors').getAttribute('aria-expanded'), 'false');
  assert(control('fullscreen').parentElement.hidden, 'unsupported fullscreen hides its help too');
});

test('artwork can be disabled and restored on existing Large and Small cards without rebuilding them', (t) => {
  const { w, d, control } = setup(t);
  const card = { name: 'Card', color: 'RED', image_id: 'card', secondary_actions: {} };
  const large = w.testUI.textCard(card, 'deck', null, 'hero_hanu');
  const small = d.createElement('span');
  small.className = 'm2-small-card';
  const band = d.createElement('span');
  band.className = 'm2-list-band';
  small.append(band);
  w.testUI.appendCardArtwork(band, card, null, 'hero_hanu');
  d.body.append(large, small);
  for (const box of [large, band])
    box.querySelector('.m2-card-art img').dispatchEvent(new w.Event('load'));
  const nodes = [large.querySelector('.m2-card-art'), band.querySelector('.m2-card-art')];
  control('art').click();
  assert(d.documentElement.hasAttribute('data-m2-no-card-art'));
  for (const art of nodes) assert.equal(w.getComputedStyle(art).display, 'none');
  assert.equal(JSON.parse(w.localStorage.getItem('goa2-mobile-display')).cardArt, false);
  control('art').click();
  assert(!d.documentElement.hasAttribute('data-m2-no-card-art'));
  for (const art of nodes) assert.notEqual(w.getComputedStyle(art).display, 'none');
  assert.equal(large.querySelector('.m2-card-art'), nodes[0]);
});

test('appearance preferences restore, invalid values use defaults, and unavailable storage keeps controls usable', (t) => {
  const restored = setup(t, JSON.stringify({ cardArt: false, fontStep: 3 }));
  assert.equal(restored.control('art').getAttribute('aria-checked'), 'false');
  assert.equal(restored.control('font').value, '3');
  assert.equal(restored.control('font').getAttribute('aria-valuetext'), '133%');
  for (const saved of ['null', '{broken', JSON.stringify({ cardArt: 'false', fontStep: 500 })]) {
    const fixture = setup(t, saved);
    assert.equal(fixture.control('art').getAttribute('aria-checked'), 'true');
    assert.equal(fixture.control('font').value, '0');
  }
  const broken = browserFixture({ hooks: ['refresh'] });
  t.after(() => broken.close());
  const prototype = Object.getPrototypeOf(broken.w.localStorage);
  const read = prototype.getItem,
    write = prototype.setItem;
  t.after(() => {
    prototype.getItem = read;
    prototype.setItem = write;
  });
  prototype.getItem = prototype.setItem = () => {
    throw new Error('storage blocked');
  };
  broken.install();
  const art = broken.d.querySelector('[data-setting="art"]');
  art.click();
  assert.equal(art.getAttribute('aria-checked'), 'false');
});

test('game preferences use native cursor/sound keys, and live tool proxies follow availability and replacement', (t) => {
  const { w, d, control } = setup(t);
  assert(d.querySelector('.m2-settings-apply').hidden);
  control('cursors').click();
  control('sounds').click();
  control('volume').value = '75';
  control('volume').dispatchEvent(new w.Event('input'));
  assert(!d.querySelector('.m2-settings-apply').hidden);
  assert.equal(
    w.localStorage.getItem('goa2.sound.volume'),
    null,
    'game preferences wait for Apply',
  );
  assert(w.testUI.saveGameSettings());
  assert.equal(w.localStorage.getItem('goa2:remote-pointers-visible'), 'hidden');
  assert.equal(w.localStorage.getItem('goa2.sound.muted'), '0', 'positive volume enables sound');
  assert.equal(w.localStorage.getItem('goa2.sound.volume'), '0.75');
  const native = d.querySelector('._gameToolsRow_test');
  assert.equal(w.getComputedStyle(native).display, 'none');
  assert(d.querySelectorAll('.m2-settings-actions button')[1].disabled);
  let calls = 0;
  native.firstChild.onclick = () => calls++;
  const proxy = d.querySelector('.m2-settings-actions button');
  native.firstChild.disabled = true;
  proxy.click();
  assert.equal(calls, 0, 'a stale enabled proxy cannot activate a newly disabled native control');
  const replacement = d.createElement('button');
  replacement.textContent = 'Report issue';
  replacement.onclick = () => calls++;
  native.firstChild.replaceWith(replacement);
  w.testUI.refresh();
  d.querySelector('.m2-settings-actions button').click();
  assert.equal(calls, 1);
  assert.equal(d.documentElement.dataset.m2Panel, '', 'opening native tools dismisses Settings');
});

test('fullscreen follows browser availability and all generated Settings controls disappear at teardown', async (t) => {
  const { w, d, control } = setup(t);
  assert(control('fullscreen').hidden);
  let fullscreen = null;
  Object.defineProperty(d, 'fullscreenEnabled', { value: true });
  Object.defineProperty(d, 'fullscreenElement', { get: () => fullscreen });
  d.documentElement.requestFullscreen = async () => {
    fullscreen = d.documentElement;
  };
  d.exitFullscreen = async () => {
    fullscreen = null;
  };
  w.testUI.refresh();
  assert(!control('fullscreen').hidden);
  control('fullscreen').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(control('fullscreen').getAttribute('aria-checked'), 'true');
  control('fullscreen').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(control('fullscreen').getAttribute('aria-checked'), 'false');
  w.GOA2Mobile2D.destroy();
  assert(!d.getElementById('goa2-m2-settings'));
  assert(!d.documentElement.hasAttribute('data-m2-no-card-art'));
});
