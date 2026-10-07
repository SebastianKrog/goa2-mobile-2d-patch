const { JSDOM } = require('jsdom');
const fs = require('fs'),
  assert = require('assert');
const d = new JSDOM(
  '<div class="_sidebar_x_1"></div><div class="_modal_x_1"><div class="_tierGroup_x_1"><div class="_cardGrid_x_1"></div></div></div>',
  {
    url: 'https://goa2.frontend.pedroliv.dev/game/test?3d=0',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  },
);
const w = d.window,
  doc = w.document;
w.matchMedia = () => ({ matches: true, addEventListener() {} });
w.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {}, fillRect() {}, fillText() {} });
for (const [name, tier, color] of [
  ['Blue two', 'II', 'BLUE'],
  ['Green one', 'I', 'GREEN'],
  ['Red three', 'III', 'RED'],
  ['Ultimate', null, 'PURPLE'],
]) {
  const c = doc.createElement('canvas');
  c.__reactFiber$test = {
    memoizedProps: {
      card: {
        name,
        tier,
        color,
        initiative: 4,
        effect_text: 'Move a unit.',
        secondary_actions: { DEFENSE: 2 },
      },
    },
  };
  doc.querySelector('._cardGrid_x_1').append(c);
}
doc.querySelector('._modal_x_1').__reactFiber$test = {
  memoizedProps: {
    hero: {
      id: 'hero_hanu',
      deck: [
        { id: 'gold', name: 'Gold basic', color: 'GOLD', tier: 'UNTIERED' },
        { id: 'silver', name: 'Silver basic', color: 'SILVER', tier: 'UNTIERED' },
      ],
    },
  },
};
w.document.fonts = { load: () => new Promise(() => {}), ready: Promise.resolve() };
w.eval(fs.readFileSync('dist/goa2-mobile-2d.user.js', 'utf8'));
const wait = () => new Promise((r) => setTimeout(r, 450));
(async () => {
  await wait();
  const headings = () =>
    Array.from(doc.querySelectorAll('.m2-deck-browser h3'), (e) => e.textContent);
  const click = (t) =>
    Array.from(doc.querySelectorAll('.m2-deck-controls button'))
      .find((b) => (t === 'By tier' ? b.getAttribute('role') === 'switch' : b.textContent === t))
      .click();
  assert.deepEqual(headings(), ['Tier 1', 'Tier 2', 'Tier 3', 'Ultimate & basics']);
  assert.equal(doc.querySelectorAll('.m2-deck-grid').length, 4);
  click('By tier');
  assert.deepEqual(headings(), ['red', 'blue', 'green', 'purple', 'gold', 'silver']);
  click('List');
  assert.equal(doc.querySelectorAll('.m2-deck-list').length, 6);
  assert.equal(JSON.parse(w.localStorage.getItem('goa2-mobile-deck')).view, 'list');
  const ult = Array.from(doc.querySelectorAll('.m2-text-card')).find(
    (e) => e.querySelector('.m2-card-top b').textContent === 'Ultimate',
  );
  assert.equal(ult.querySelector('.m2-card-type b').textContent, 'Ultimate');
  assert.equal(ult.querySelectorAll('.m2-card-top img').length, 0);
  assert(doc.querySelector('.m2-deck-list').textContent.includes('Move a unit.'));
  doc.querySelector('.m2-deck-card').click();
  assert(!doc.querySelector('.m2-deck-zoom').hidden);
  doc.querySelector('.m2-deck-zoom button').click();
  assert(doc.querySelector('.m2-deck-zoom').hidden);
  click('Compact');
  assert.equal(doc.querySelectorAll('.m2-deck-compact').length, 6);
  assert(doc.querySelector('.m2-deck-preview:empty'));
  assert.equal(doc.querySelectorAll('.m2-deck-compact .m2-list-card').length, 6);
  doc.querySelector('.m2-deck-compact .m2-deck-card').click();
  assert(doc.querySelector('.m2-deck-preview .m2-text-card'));
  assert.equal(
    doc.querySelector('.m2-deck-compact .m2-deck-card').getAttribute('aria-pressed'),
    'true',
  );
  assert(!doc.querySelector('.m2-deck-preview .m2-upgraded-value'));
  doc.querySelector('.m2-deck-preview button').click();
  assert(doc.querySelector('.m2-deck-preview:empty'));
  assert(doc.querySelector('.m2-deck-row-list .m2-deck-compact'));
  assert.equal(doc.querySelectorAll('._cardGrid_x_1 canvas').length, 4);
  doc.querySelector('._modal_x_1').remove();
  await wait();
  w.GOA2Mobile2D.destroy();
  w.close();
  console.log(
    'PASS: tier/color grouping, grid/list/compact, preview, descriptions, enlarge/close, native cards retained, deck removal.',
  );
})().catch((e) => {
  console.error(e);
  w.close();
  process.exitCode = 1;
});
