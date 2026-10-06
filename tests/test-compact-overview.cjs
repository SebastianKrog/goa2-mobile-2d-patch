// Focus on presentation boundaries: public mini-card stats, upgrade slots, and
// phase-dependent status. Rules values must stay unchanged in the supplied props.
const { JSDOM } = require('jsdom');
const fs = require('fs'), assert = require('assert');
const dom = new JSDOM('', { url: 'https://goa2.frontend.pedroliv.dev/game/fixture?3d=0', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window, d = w.document;
w.matchMedia = () => ({ matches: true, addEventListener() {} });
w.eval(fs.readFileSync('dist/goa2-mobile-2d.user.js', 'utf8').replace(/window\.GOA2Mobile2D\s*=\s*\{/, 'window.testUI={renderSummary,miniatureCard,itemUpgradeSymbols};window.GOA2Mobile2D={'));
const { renderSummary, miniatureCard, itemUpgradeSymbols } = w.testUI;
const card = { name: 'Test attack', color: 'RED', initiative: 9, primary_action: 'ATTACK', primary_action_value: 3, range_value: 2, secondary_actions: { MOVEMENT: 4, DEFENSE: 5 } };
try {
  const mini = miniatureCard(card, { ATTACK: 1, RANGE: 1, DEFENSE: 2, INITIATIVE: 1 });
  assert.deepEqual([...mini.querySelectorAll('img')].map(x => x.alt), ['Attack', 'range', 'Movement']);
  assert.equal(mini.textContent, '434');
  assert.deepEqual([...mini.querySelectorAll('.m2-upgraded-value')].map(x => x.textContent), ['4', '3']);
  assert(!mini.querySelector('img[src*="initiative"]'));
  assert.equal(card.primary_action_value, 3, 'do not mutate printed stats');
  const hidden = miniatureCard({ ...card, is_facedown: true });
  assert.equal(hidden.textContent, '?'); assert.equal(hidden.querySelectorAll('img').length, 0);
  assert(!hidden.title.includes(card.name));
  const empty = itemUpgradeSymbols({});
  assert.equal(empty.children.length, 4);
  assert.equal(empty.querySelectorAll('.m2-upgrade-empty').length, 6);
  const upgrades = itemUpgradeSymbols({ ATTACK: 2, INITIATIVE: 1, MOVEMENT: 1, AREA: 1 });
  assert.deepEqual([...upgrades.children].slice(0, 3).map(x => x.querySelector('img').alt), ['Attack', 'Defense', 'initiative']);
  assert.equal(upgrades.querySelectorAll('.m2-upgrade-rest .m2-symbol-value').length, 0);
  assert.equal(upgrades.querySelectorAll('.m2-upgrade-rest .m2-upgrade-empty').length, 1);
  const hero = { name: 'Hanu · Sebastian (You)', color: 'blue', level: 2, gold: 3, offboard: true, done: true, resolution: { current: true, initiative: 10, order: 1 }, currentCard: card, upgrades: {}, dots: ['blue'], cardPiles: [{ label: 'P', cards: [{ color: 'red', active: true }] }, { label: 'D', cards: [] }] };
  renderSummary([hero]);
  const row = d.querySelector('#goa2-m2-summary article');
  assert.equal(row.firstElementChild.className, 'm2-summary-turn');
  assert(row.firstElementChild.textContent.startsWith('NOW'), 'queued card takes priority over off-board skull');
  assert.equal(row.querySelector('.m2-summary-player').textContent, '(You)');
  assert.deepEqual([...row.querySelector('.m2-summary-piles').children].map(x => x.textContent[0]), ['P', 'H', 'D']);
  assert(row.querySelector('.m2-summary-piles .m2-effect-active'));
  assert.equal(row.querySelector('.m2-gold-value').textContent, '3');
  assert(row.querySelector('.m2-summary-piles').compareDocumentPosition(row.querySelector('.m2-mini-current')) & w.Node.DOCUMENT_POSITION_FOLLOWING);
  delete hero.resolution; renderSummary([hero]);
  assert(!d.querySelector('.m2-mini-current'), 'resolved heroes must not retain a microcard');
  assert.equal(d.querySelector('.m2-summary-turn').textContent, '☠');
  hero.offboard = false; renderSummary([hero]);
  assert.equal(d.querySelector('.m2-summary-turn').textContent, '✓');
  hero.done = false; renderSummary([hero]);
  assert(d.querySelector('.m2-mini-current'));
  hero.currentCard = null; renderSummary([hero]);
  assert(!d.querySelector('.m2-mini-current'), 'no empty microcard placeholder');
  assert.equal(d.querySelector('.m2-summary-turn').textContent, '—');
  console.log('PASS: compact stat order, purple upgrades, fixed utility slots, hidden-card privacy, piles and phase markers');
} finally { w.GOA2Mobile2D.destroy(); w.close(); }
