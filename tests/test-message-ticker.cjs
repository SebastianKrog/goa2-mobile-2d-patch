const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');
const { selectScreenMedia, landscapeQuery } = require('./helpers/screen-media.cjs');

function setup(t) {
  const f = browserFixture({
    html: `<div><header class="_bar_test"><span class="_phase_test">RESOLUTION</span>
      <div class="_statusCopy_test"><strong>Your turn</strong><span class="_statusDetail_test">Select movement destination within range two, avoiding enemy heroes</span></div>
      </header><main class="_main_test"><div class="_boardArea_test"><button id="native">Options</button></div>
      <aside class="_sidebar_test"></aside></main></div>`,
    hooks: ['refresh', 'measureMobileStatus'],
  });
  t.after(() => f.close());
  const { w, d } = f;
  let width = 180,
    characterWidth = 6;
  Object.defineProperties(w.HTMLElement.prototype, {
    clientWidth: {
      configurable: true,
      get() {
        return this.classList.contains('m2-status') ? width : 0;
      },
    },
    scrollWidth: {
      configurable: true,
      get() {
        return this.classList.contains('m2-status-text')
          ? this.textContent.length * characterWidth
          : 0;
      },
    },
  });
  const nativeRect = w.HTMLElement.prototype.getBoundingClientRect;
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    if (!this.classList.contains('m2-hud-bottom')) return nativeRect.call(this);
    return { height: this.classList.contains('m2-status-expanded') ? 46 : 22 };
  };
  const observers = [];
  w.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.nodes = new Set();
      observers.push(this);
    }
    observe(node) {
      this.nodes.add(node);
    }
    unobserve(node) {
      this.nodes.delete(node);
    }
    disconnect() {
      this.disconnected = true;
      this.nodes.clear();
    }
    fire() {
      this.callback([...this.nodes].map((target) => ({ target })));
    }
  };
  f.install();
  const strip = d.querySelector('.m2-hud-bottom'),
    status = strip.querySelector('.m2-status');
  const observer = () => observers.findLast((x) => x.nodes.has(strip));
  return {
    ...f,
    strip,
    status,
    observers,
    observer,
    resize(value) {
      width = value;
      observer().fire();
    },
    font(value) {
      characterWidth = value;
      observer().fire();
    },
  };
}

test('only overflowing action text ticks; resizing, fonts and new messages keep measurements current', (t) => {
  const { w, d, strip, status, observer, resize, font } = setup(t);
  const text = status.firstElementChild;
  assert(status.classList.contains('m2-status-overflow'));
  assert.equal(
    status.style.getPropertyValue('--m2-ticker-distance'),
    text.scrollWidth - 180 + 'px',
  );
  assert.equal(strip.querySelector('.m2-phase').textContent, 'RESOLUTION');
  assert.equal(strip.querySelectorAll('.m2-status-text').length, 1);
  w.testUI.refresh();
  assert.equal(
    status.firstElementChild,
    text,
    'normal refresh does not restart the current message',
  );
  assert(observer().nodes.has(text));
  resize(1000);
  assert(!status.classList.contains('m2-status-overflow'));
  assert.equal(status.style.getPropertyValue('--m2-ticker-distance'), '0px');
  resize(text.scrollWidth);
  assert(!status.classList.contains('m2-status-overflow'), 'exact fit stays still');
  font(8);
  assert(status.classList.contains('m2-status-overflow'), 'font changes can introduce overflow');
  d.querySelector('._statusDetail_test').textContent = 'Done';
  w.testUI.refresh();
  assert.equal(status.textContent, 'Your turn · Done');
  assert.notEqual(status.firstElementChild, text, 'new message gets a fresh CSS animation');
  assert(!observer().nodes.has(text), 'old text nodes are not retained');
  assert(!status.classList.contains('m2-status-overflow'));
  d.querySelector('._statusDetail_test').textContent = 'A long replacement message '.repeat(12);
  w.testUI.refresh();
  assert(status.classList.contains('m2-status-overflow'));
  assert(
    parseFloat(status.style.getPropertyValue('--m2-ticker-cycle')) > 8,
    'long messages keep a readable speed',
  );
  resize(0);
  assert(
    !status.classList.contains('m2-status-overflow'),
    'hidden or unmeasured text does not start scrolling',
  );
});

test('tap expands to three rows until another click, without swallowing native actions', (t) => {
  const { w, d, strip, status } = setup(t);
  const css = (node) => w.getComputedStyle(node);
  assert.equal(strip.getAttribute('role'), 'button');
  assert.equal(strip.getAttribute('aria-expanded'), 'false');
  assert.equal(css(strip).pointerEvents, 'auto');
  status.firstElementChild.click();
  assert.equal(strip.getAttribute('aria-expanded'), 'true');
  assert.equal(css(strip).height, '46px');
  assert.equal(css(status).height, '36px');
  assert.equal(css(status.firstElementChild).whiteSpace, 'normal');
  assert.equal(css(status.firstElementChild).animation, 'none');
  assert.equal(d.documentElement.style.getPropertyValue('--m2-status-h'), '46px');
  strip.click();
  assert.equal(strip.getAttribute('aria-expanded'), 'true', 'tapping inside does not collapse it');
  d.querySelector('strong').textContent = 'Another action';
  w.testUI.refresh();
  assert.equal(strip.getAttribute('aria-expanded'), 'true', 'live updates keep the expanded view');
  let clicks = 0;
  d.querySelector('#native').onclick = () => clicks++;
  d.querySelector('#native').click();
  assert.equal(clicks, 1);
  assert.equal(strip.getAttribute('aria-expanded'), 'false');
  assert.equal(d.documentElement.style.getPropertyValue('--m2-status-h'), '22px');
  assert(status.classList.contains('m2-status-overflow'));
  let nativeKeys = 0;
  d.addEventListener('keydown', () => nativeKeys++);
  strip.dispatchEvent(
    new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
  );
  assert.equal(strip.getAttribute('aria-expanded'), 'true');
  strip.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(strip.getAttribute('aria-expanded'), 'false');
  strip.dispatchEvent(
    new w.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
  );
  assert.equal(nativeKeys, 0, 'message disclosure keys cannot trigger native commit shortcuts');
  d.querySelector('#native').focus();
  assert.equal(
    strip.getAttribute('aria-expanded'),
    'false',
    'keyboard focus elsewhere also collapses',
  );
});

test('CSS holds both ends and resets once per cycle; expanded/reduced-motion views stay still in both orientations', (t) => {
  const { w, d, strip, status } = setup(t);
  const style = d.querySelector('#goa2-m2-style');
  const frames = [...style.sheet.cssRules].find((rule) => rule.name === 'm2-action-ticker');
  assert(frames);
  assert.deepEqual(
    [...frames.cssRules].map((frame) => [frame.keyText, frame.style.transform]),
    [
      ['0%, 20%', 'translateX(0)'],
      ['80%, 100%', 'translateX(calc(-1 * var(--m2-ticker-distance, 0px)))'],
    ],
    'there is one continuous advance and no animated return leg',
  );
  for (const landscape of [false, true]) {
    selectScreenMedia(style, new Set(landscape ? [landscapeQuery] : []));
    assert.match(
      w.getComputedStyle(status.firstElementChild).animation,
      /m2-action-ticker.*linear infinite/,
    );
    strip.click();
    assert.equal(w.getComputedStyle(strip).height, '46px');
    assert.equal(w.getComputedStyle(status.firstElementChild).animation, 'none');
    d.body.click();
    selectScreenMedia(
      style,
      new Set([...(landscape ? [landscapeQuery] : []), '(prefers-reduced-motion: reduce)']),
    );
    assert.equal(w.getComputedStyle(status.firstElementChild).animation, 'none');
  }
});

test('board and disconnect messages tick too; observers and disclosure clean up across deactivation and reinstall', (t) => {
  const { w, d, strip, status, media, observers, observer, install } = setup(t);
  const banner = d.createElement('div');
  banner.className = '_banner_test';
  const request = {
    type: 'SELECT_HEX',
    prompt: 'Select a movement destination within range two, avoiding enemy heroes',
  };
  banner.__reactFiber$t = { memoizedProps: { inputRequest: request } };
  d.querySelector('._boardArea_test').append(banner);
  w.testUI.refresh();
  assert.equal(status.textContent, request.prompt);
  assert(status.classList.contains('m2-status-overflow'));
  const warning = d.createElement('div');
  warning.className = '_disconnected_test';
  warning.textContent =
    'Disconnected — reconnecting to the server; waiting for the current connection to recover';
  d.body.append(warning);
  w.testUI.refresh();
  assert.match(status.textContent, /^Reconnecting/);
  assert.equal(strip.querySelector('.m2-phase').textContent, 'DISCONNECTED');
  warning.textContent = 'Disconnected — A different warning';
  w.testUI.refresh();
  assert.equal(status.textContent, 'A different warning', 'other warnings remain unchanged');
  warning.remove();
  w.testUI.refresh();
  assert.equal(status.textContent, request.prompt);
  strip.click();
  const oldObserver = observer();
  media.matches = false;
  w.testUI.refresh();
  assert(oldObserver.disconnected);
  assert.equal(strip.getAttribute('aria-expanded'), 'false');
  media.matches = true;
  w.testUI.refresh();
  assert.notEqual(observer(), oldObserver);
  assert(status.classList.contains('m2-status-overflow'));
  assert.equal(observers.filter((x) => !x.disconnected && x.nodes.has(strip)).length, 1);
  strip.click();
  const lastObserver = observer();
  w.GOA2Mobile2D.destroy();
  assert(lastObserver.disconnected);
  assert(!d.querySelector('.m2-hud-bottom'));
  assert.equal(d.documentElement.style.getPropertyValue('--m2-status-h'), '');
  install();
  const freshStrip = d.querySelector('.m2-hud-bottom');
  assert.notEqual(freshStrip, strip);
  freshStrip.click();
  assert.equal(freshStrip.getAttribute('aria-expanded'), 'true');
  d.body.click();
  assert.equal(freshStrip.getAttribute('aria-expanded'), 'false');
});
