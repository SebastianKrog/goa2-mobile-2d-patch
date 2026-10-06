const { JSDOM } = require('jsdom');
const fs = require('fs'), assert = require('assert');
const dom = new JSDOM('<header class="_bar_x"><span class="_phase_x">RESOLUTION</span></header><div class="_sidebar_x"></div>', {
  url: 'https://goa2.frontend.pedroliv.dev/?3d=0', runScripts: 'outside-only', pretendToBeVisual: true,
});
const w = dom.window, doc = w.document;
w.matchMedia = () => ({ matches: true, addEventListener() {} });
const card = id => ({ id, name: id, color: 'GREEN', tier: 'I', initiative: 2, primary_action: 'SKILL', secondary_actions: { MOVEMENT: 2 }, effect_text: 'Effect' });
const side = doc.querySelector('._sidebar_x'), view = { phase: 'RESOLUTION', turn: 2 };
side.__reactFiber$test = { memoizedProps: { view } };
const heroes = [];
for (const own of [true, false]) {
  const box = doc.createElement('section');
  box.id = own ? 'own' : 'other';
  box.innerHTML = '<div class="_name_x">' + (own ? 'Hanu (You)' : 'Misa') + '</div><div class="_details_x">Lv 1<i class="_handColorDot_x" style="background-color:green"></i></div>';
  const hero = { id: box.id, name: box.id, hand: [card(own ? 'Own hand' : 'SECRET')], current_turn_card: card('Current'), played_cards: [card('Turn one'), null, null, null], discard_pile: [card('Discard one'), card('Discard two')], items: { INITIATIVE: 1 } };
  heroes.push(hero);
  box.__reactFiber$test = { memoizedProps: { hero } };
  side.append(box);
}
w.eval(fs.readFileSync('dist/goa2-mobile-2d.user.js', 'utf8').replace(/window\.GOA2Mobile2D\s*=\s*\{/, 'window.refreshTest=refresh;window.GOA2Mobile2D={'));
const clickHero = id => { doc.querySelector('#' + id + ' ._name_x').click(); w.refreshTest(); };
try {
  doc.querySelector('[data-mode="heroes"]').click();
  assert.equal(doc.querySelectorAll('.m2-expanded-card').length, 2, 'collapsed heroes retain their current card');
  clickHero('own');
  let own = doc.querySelector('#own .m2-expanded-board');
  assert.deepEqual([...own.querySelectorAll('h4')].map(x => x.textContent), ['', '', 'Discard:']);
  assert.equal(own.querySelectorAll('.m2-slot-label').length, 2, 'future turns are omitted');
  assert.equal(own.querySelectorAll('.m2-expanded-card').length, 4);
  assert(!own.textContent.includes('Own hand'));
  assert.equal(own.querySelector('.m2-upgraded-value').textContent, '3');
  own.querySelector('.m2-expanded-card').click();
  assert(doc.querySelector('#goa2-m2-hero-display>.m2-text-card'));
  clickHero('other');
  assert(doc.querySelector('#own').classList.contains('m2-hero-expanded'), 'opening another hero leaves ours open');
  assert(!doc.querySelector('#other .m2-expanded-board').textContent.includes('SECRET'));
  clickHero('other');
  assert.equal(doc.querySelectorAll('#other .m2-expanded-card').length, 1);
  assert(!doc.querySelector('#other .m2-slot-label'));
  doc.querySelector('[data-mode="hand"]').click(); w.refreshTest();
  clickHero('own');
  assert(doc.querySelector('#own').classList.contains('m2-hero-expanded'));
  assert(!doc.querySelector('#own .m2-expanded-board').textContent.includes('Hand:'));
  assert(!doc.querySelector('#own .m2-expanded-board').textContent.includes('Own hand'));
  for (let turn = 1; turn <= 4; turn++) {
    view.turn = turn; w.refreshTest();
    assert.equal(doc.querySelectorAll('#own .m2-slot-label').length, turn);
  }
  view.phase = 'PLANNING'; w.refreshTest(); clickHero('own'); clickHero('other');
  assert(!doc.querySelector('.m2-hero-expanded'));
  assert(!doc.querySelector('.m2-slot-label'));
  assert.equal(doc.querySelectorAll('#own .m2-expanded-card').length, 1);
  heroes[1].current_turn_card = { ...card('Hidden secret'), is_facedown: true };
  w.refreshTest();
  assert(!doc.querySelector('#other .m2-expanded-card'));
  assert.equal(doc.querySelector('#other .m2-selection-status').textContent, '✓ Selected');
  view.phase = 'RESOLUTION'; w.refreshTest();
  assert(doc.querySelector('#own').classList.contains('m2-hero-expanded'));
  console.log('PASS: independent expansion, retained current cards, planning lock, forced Hand expansion, turn slots, privacy and card inspection');
} finally { w.GOA2Mobile2D.destroy(); w.close(); }
