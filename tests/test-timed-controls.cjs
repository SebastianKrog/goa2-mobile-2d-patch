const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

test('Position opens native adjustment directly; pause UI retains native actions within mobile frame', (t) => {
  const f = browserFixture({
    html: `<header class="_bar_test"><span class="_phase_test">PLANNING</span></header>
    <div class="_boardArea_test"><div aria-label="Starting position"><button>Change starting position</button><span>Choose a highlighted space or request a swap.</span><small>Available while you have no committed card.</small><button data-swap>Swap with Dodger</button></div>
    <div class="_banner_test" role="status"><span class="_kicker_test">Arien asks the table to pause</span>
    <button>Approve</button></div></div>
    <div class="_sidebar_test"><section><div class="_name_test">Arien (You)</div>
    <div class="_details_test">Lv 1</div></section></div>
    <div role="dialog"><section><h1 id="ready-title">Match paused</h1><button>I’m back</button></section></div>`,
    hooks: ['refresh'],
  });
  t.after(() => f.close());
  const { w, d } = f;
  const position = d.querySelector('[aria-label="Starting position"] button');
  let clicks = 0;
  position.onclick = () => {
    clicks++;
    position.textContent = clicks % 2 ? 'Done adjusting' : 'Change starting position';
  };
  const banner = d.querySelector('._banner_test');
  banner.__reactFiber$test = { memoizedProps: { proposal: { family: 'pause' } } };
  f.install();
  assert(!d.querySelector('[data-mode="setup"]'));
  assert.equal(d.querySelectorAll('#goa2-m2-nav button').length, 5);
  const launcher = () =>
    [...d.querySelectorAll('.m2-choice-launchers button')].find((b) =>
      /^(Position|Done)$/.test(b.textContent),
    );
  assert.equal(launcher().textContent, 'Position');
  launcher().click();
  assert.equal(clicks, 1, 'one click invokes native change-position handler');
  assert.equal(d.documentElement.dataset.m2Panel, 'setup');
  assert.equal(launcher().textContent, 'Done');
  const panel = position.parentElement;
  assert.equal(w.getComputedStyle(panel).bottom, 'auto');
  assert.match(w.getComputedStyle(panel).top, /m2-head.*m2-status-h/);
  assert.equal(w.getComputedStyle(position).position, 'absolute');
  assert.equal(w.getComputedStyle(position).bottom, '3px');
  assert.equal(w.getComputedStyle(position).fontSize, '0px');
  assert.equal(w.getComputedStyle(panel.querySelector('small')).display, 'none');
  assert.equal(w.getComputedStyle(panel.querySelector(':scope > span')).display, 'none');
  assert.equal(
    d.querySelector('.m2-status-text').textContent,
    'Choose a highlighted space or request a swap.',
  );
  let swapped = false;
  panel.querySelector('[data-swap]').onclick = () => (swapped = true);
  panel.querySelector('[data-swap]').click();
  assert(swapped, 'swap controls retain native handlers');
  position.click(); // The native Done control is presented as the lower-right ×.
  w.testUI.refresh();
  assert.equal(clicks, 2);
  assert.equal(d.documentElement.dataset.m2Panel, '');
  assert.notEqual(
    d.querySelector('.m2-status-text').textContent,
    'Choose a highlighted space or request a swap.',
  );
  assert.equal(banner.dataset.m2, 'pause-vote');
  assert.equal(w.getComputedStyle(banner).position, 'fixed');
  assert.equal(d.querySelector('[role="dialog"]').dataset.m2, 'match-ready');
  let approved = false;
  banner.querySelector('button').onclick = () => (approved = true);
  banner.querySelector('button').click();
  assert(approved, 'pause voting remains native');
});
