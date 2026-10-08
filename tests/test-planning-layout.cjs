const { JSDOM } = require('jsdom'),
  fs = require('fs'),
  assert = require('assert');
const d = new JSDOM(
  '<div><header class="_bar_x"><div class="_statusCopy_x"><strong>Card locked in</strong><span class="_statusDetail_x">Fight and Flight · Waiting for Garrus, Cutter</span></div></header><div class="_boardArea_x"><button class="_takeBackBtn_x">Take back card</button></div><div class="_sidebar_x"><div><span class="_label_x">HAND</span></div></div></div>',
  {
    url: 'https://goa2.frontend.pedroliv.dev/?3d=0',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  },
);
const w = d.window,
  doc = w.document;
w.matchMedia = () => ({ matches: true, addEventListener() {} });
let taken = 0;
doc.querySelector('button').onclick = () => taken++;
w.eval(fs.readFileSync('dist/goa2-mobile-2d.user.js', 'utf8'));
assert.equal(
  doc.querySelector('.m2-status').textContent,
  'Card locked in · Waiting for Garrus, Cutter',
);
assert(!doc.querySelector('[data-m2="board"]>.m2-planning-actions'));
assert.equal(w.getComputedStyle(doc.querySelector('._takeBackBtn_x')).display, 'none');
doc.querySelector('[data-mode="hand"]').click();
assert(doc.querySelector('[data-m2="hand-list"]>.m2-planning-actions'));
doc.querySelector('.m2-planning-actions button').click();
assert.equal(taken, 1);
doc.querySelector('[data-mode="hand"]').click();
assert.equal(doc.documentElement.dataset.m2Mode, 'board');
assert(!doc.querySelector('.m2-planning-actions'));
doc.querySelector('[data-mode="hand"]').click();
doc.querySelector('.m2-planning-actions button').click();
assert.equal(taken, 2);
w.GOA2Mobile2D.destroy();
assert(!doc.querySelector('.m2-planning-actions'));
w.close();
console.log(
  'PASS: status omits card name; take-back is absent on Board and retained in Hand with its native handler.',
);
