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
  assert.equal(doc.querySelectorAll('.m2-hero-current-mini').length, 2, 'heroes retain a Mini card');
  assert.equal(doc.querySelectorAll('.m2-hero-micro-slots').length, 2);
  clickHero('own'); clickHero('other');
  assert(!doc.querySelector('.m2-hero-expanded'), 'Heroes expansion is temporarily disabled');
  assert(!doc.querySelector('.m2-expanded-board'));
  assert(!doc.querySelector('#other').textContent.includes('SECRET'));
  doc.querySelector('#own .m2-hero-current-mini button').click();
  assert(doc.querySelector('#goa2-m2-hero-display>.m2-text-card'));
  doc.querySelector('[data-mode="hand"]').click(); w.refreshTest();
  clickHero('own');
  assert(!doc.querySelector('.m2-hero-expanded'));
  assert(!doc.querySelector('.m2-expanded-board'));
  assert(!doc.querySelector('#own').textContent.includes('Own hand'));
  for (let turn = 1; turn <= 4; turn++) {
    view.turn = turn; w.refreshTest();
    assert.equal(doc.querySelectorAll('#own .m2-micro-history-slot').length, 5);
  }
  view.phase = 'PLANNING'; w.refreshTest(); clickHero('own'); clickHero('other');
  assert(!doc.querySelector('.m2-hero-expanded'));
  assert(!doc.querySelector('.m2-slot-label'));
  assert.equal(doc.querySelectorAll('#own .m2-expanded-card').length, 0);
  assert(doc.querySelector('#own .m2-hero-current-mini'));
  heroes[1].current_turn_card = { ...card('Hidden secret'), is_facedown: true };
  w.refreshTest();
  assert(!doc.querySelector('#other .m2-expanded-card'));
  assert.equal(doc.querySelector('#other .m2-selection-status').textContent, 'Selected');
  // Local rendered selection is still known while public commitment is facedown.
  heroes[0].current_turn_card = { id: 'Current', name: 'Hidden', is_facedown: true };
  const hand = doc.createElement('div');
  hand.innerHTML = '<div class="_label_x">Hand</div><div class="_row_x _selected_x"></div>';
  hand.querySelector('._row_x').__reactFiber$test = { memoizedProps: { card: { ...card('Current'), name: 'Known commitment' } } };
  side.append(hand); w.refreshTest();
  assert.equal(doc.querySelector('#own .m2-current-card-mini .m2-list-name').textContent, 'Known commitment');
  assert(!doc.querySelector('#other .m2-current-card-mini'), 'opponent commitment remains hidden');
  assert.equal(doc.querySelectorAll('#own .m2-micro-history-slot').length, 5);
  assert(!doc.querySelector('#own .m2-selection-status'));
  // Selection props can change without a highlighted DOM row in a hidden pane.
  hand.querySelector('._row_x').className = '_row_x';
  heroes[0].hand = [card('Native selected')];
  side.__reactFiber$test.memoizedProps.selectedCardId = 'Native selected';
  heroes[0].current_turn_card = null;
  w.refreshTest();
  assert.equal(doc.querySelector('#own .m2-current-card-mini .m2-list-name').textContent, 'Native selected');
  assert(!doc.querySelector('#own .m2-selection-status'));
  assert(!doc.querySelector('#other .m2-current-card-mini'), 'native own selection never applies to opponents');
  side.__reactFiber$test.memoizedProps.selectedCardId = null;
  w.refreshTest();
  assert(!doc.querySelector('#own .m2-current-card-mini'), 'clearing selection removes own Mini');
  assert(doc.querySelector('#own .m2-current-card-slot .m2-selecting-dots'));
  assert.equal(w.getComputedStyle(doc.querySelector('#own .m2-hero-current-mini')).height, '26px');
  assert.equal(doc.querySelector('#own .m2-hero-played-label').textContent, 'Played:');
  hand.__reactFiber$test = { memoizedProps: { selectedId: 'Native selected' } };
  w.refreshTest();
  assert(doc.querySelector('#own .m2-current-card-mini'), 'CardList selection prop is also supported');
  // The deployed commit handler clears selection immediately. The own current
  // card can still carry a facedown STATE alongside full, player-visible values.
  hand.__reactFiber$test.memoizedProps.selectedId = null;
  heroes[0].current_turn_card = { ...card('Committed'), is_facedown: true };
  w.refreshTest();
  assert.equal(doc.querySelector('#own .m2-list-name').textContent, 'Committed');
  assert(!doc.querySelector('#other .m2-current-card-mini'), 'same flag never reveals opponents');
  doc.querySelector('#own .m2-current-card-mini').click();
  assert.equal(doc.querySelector('#goa2-m2-hero-display .m2-card-top b').textContent, 'Committed');
  // If only the commitment ID is supplied, its own known definition suffices.
  heroes[0].deck = [card('Committed')];
  heroes[0].current_turn_card = { id: 'Committed', name: 'Hidden', is_facedown: true };
  w.refreshTest();
  assert.equal(doc.querySelector('#own .m2-list-name').textContent, 'Committed');
  heroes[0].deck = [];
  w.refreshTest();
  assert(!doc.querySelector('#own .m2-current-card-mini'), 'no guessing if the card definition is unknown');
  heroes[0].current_turn_card = card('Current');
  view.phase = 'RESOLUTION'; w.refreshTest();
  assert(!doc.querySelector('.m2-hero-expanded'));
  assert(doc.querySelector('#own .m2-hero-current-mini'));
  console.log('PASS: disabled Heroes expansion, retained current cards, planning lock, shared compact Hand entry, turn slots, privacy and card inspection');
} finally { w.GOA2Mobile2D.destroy(); w.close(); }
