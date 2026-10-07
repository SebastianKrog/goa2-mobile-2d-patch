const { JSDOM } = require('jsdom'),
  fs = require('fs'),
  assert = require('assert');
const d = new JSDOM(
  '<header class="_bar_x"><span class="_phase_x">RESOLUTION</span></header><div class="_sidebar_x"></div><div class="_container_x"><div class="_entry_x _nextEntry_x"><span class="_initiative_x">8</span><span class="_heroName_x">Queued</span><span class="_cardName_x">Card</span></div></div>',
  {
    url: 'https://goa2.frontend.pedroliv.dev/?3d=0',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  },
);
const w = d.window,
  doc = w.document;
w.matchMedia = () => ({ matches: true, addEventListener() {} });
const sidebar = doc.querySelector('._sidebar_x'),
  view = {
    phase: 'RESOLUTION',
    turn: 2,
    board: { entity_locations: { Finished: {}, Unplayed: {} } },
  };
sidebar.__reactFiber$test = { memoizedProps: { view } };
for (const name of ['Queued', 'Dead', 'Finished', 'Unplayed']) {
  const box = doc.createElement('section');
  box.id = name;
  box.innerHTML = '<div class="_name_x">' + name + '</div><div class="_details_x">Lv 1</div>';
  box.__reactFiber$test = {
    memoizedProps: {
      hero: {
        id: name,
        name,
        played_cards: [{ id: 'old' }, name === 'Unplayed' ? null : { id: 'new' }],
        discard_pile: [],
        items: {},
      },
    },
  };
  sidebar.append(box);
}
w.eval(fs.readFileSync('dist/goa2-mobile-2d.user.js', 'utf8'));
assert.equal(doc.querySelector('#Queued .m2-hero-portrait .m2-turn-number').textContent, 'NOW');
assert(doc.querySelector('#Queued .m2-offboard-label'));
assert.equal(doc.querySelector('#Finished .m2-hero-portrait .m2-turn-number').textContent, '✓');
assert.equal(doc.querySelector('#Unplayed .m2-turn-number').textContent, '—');
assert(!doc.querySelector('#Unplayed').classList.contains('m2-done-hero'));
assert(!doc.querySelector('#Dead .m2-turn-number'));
assert(doc.querySelector('#Dead .m2-offboard-label'));
w.GOA2Mobile2D.destroy();
w.close();
console.log(
  'PASS: portrait anchoring, queued dead priority, finished checkmark, dead skull and unplayed dash',
);
