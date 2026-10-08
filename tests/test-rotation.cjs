const { JSDOM } = require('jsdom'),
  fs = require('fs'),
  assert = require('assert');
const d = new JSDOM(
  '<main><header class="_bar_x"></header><div class="_boardArea_x"><div id="host"><svg class="_svg_x" viewBox="0 0 600 400" style="transform:translate(12px, 20px) scale(2)"><g id="tile"/></svg><button class="_zoomReset_x">200% · Reset</button></div></div><div class="_sidebar_x"></div></main>',
  {
    url: 'https://goa2.frontend.pedroliv.dev/?3d=0',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  },
);
const w = d.window,
  doc = w.document,
  svg = doc.querySelector('svg'),
  host = doc.querySelector('#host');
w.matchMedia = () => ({ matches: true, addEventListener() {} });
Object.defineProperty(svg, 'clientWidth', { value: 360 });
Object.defineProperty(svg, 'clientHeight', { value: 300 });
let resets = 0;
doc.querySelector('button').onclick = () => {
  resets++;
  svg.style.transform = '';
};
w.eval(fs.readFileSync('dist/goa2-mobile-2d.user.js', 'utf8'));
const buttons = doc.querySelectorAll('.m2-board-controls button');
assert.equal(buttons.length, 2);
assert(buttons[1].hidden, 'fullscreen is hidden when the browser API is unavailable');
const pointer = (type, id, x, y) => {
  const e = new w.Event(type, { bubbles: true });
  Object.assign(e, { pointerType: 'touch', pointerId: id, clientX: x, clientY: y });
  svg.dispatchEvent(e);
};
pointer('pointerdown', 1, 100, 100);
pointer('pointerdown', 2, 200, 100);
pointer('pointermove', 2, 100, 200);
assert.equal(host.style.getPropertyValue('--m2-angle'), '90deg');
assert.equal(
  host.style.getPropertyValue('--m2-native-transform'),
  'translate(12px, 20px) scale(2)',
);
assert.equal(host.style.getPropertyValue('--m2-rotation-fit'), '1');
assert.equal(doc.querySelector('#tile').parentElement, svg);
pointer('pointerup', 2, 100, 200);
pointer('pointermove', 1, 50, 50);
assert.equal(host.style.getPropertyValue('--m2-angle'), '90deg');
pointer('pointerdown', 2, 150, 50);
pointer('pointercancel', 2, 150, 50);
pointer('pointermove', 1, 40, 40);
assert.equal(host.style.getPropertyValue('--m2-angle'), '90deg');
buttons[0].click();
assert.equal(resets, 1);
assert.equal(host.style.getPropertyValue('--m2-angle'), '0deg');
svg.style.transform = 'translate(8px, 9px) scale(3)';
setTimeout(() => {
  try {
    assert.equal(host.style.getPropertyValue('--m2-native-transform'), svg.style.transform);
    w.GOA2Mobile2D.destroy();
    assert(!doc.querySelector('.m2-board-controls'));
    assert(!svg.hasAttribute('data-m2-rotate'));
    assert.equal(svg.style.transform, 'translate(8px, 9px) scale(3)');
    console.log(
      'PASS: two-finger twist, cancellation, native zoom composition, combined reset, native tile preservation and removal.',
    );
  } finally {
    w.close();
  }
}, 40);
