// Focus on presentation boundaries: public mini-card stats, upgrade slots, and
// phase-dependent status. Rules values must stay unchanged in the supplied props.
const { JSDOM } = require('jsdom');
const fs = require('fs'),
  assert = require('assert');
const dom = new JSDOM('', {
  url: 'https://goa2.frontend.pedroliv.dev/game/fixture?3d=0',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const w = dom.window,
  d = w.document;
w.matchMedia = () => ({ matches: true, addEventListener() {} });
w.eval(
  fs
    .readFileSync('dist/goa2-mobile-2d.user.js', 'utf8')
    .replace(
      /window\.GOA2Mobile2D\s*=\s*\{/,
      'window.testUI={renderSummary,miniatureCard,itemUpgradeSymbols};window.GOA2Mobile2D={',
    ),
);
const { renderSummary, miniatureCard, itemUpgradeSymbols } = w.testUI;
// This presentation-only fixture has no native sidebar to activate the adapter.
// Enable its scoped stylesheet explicitly for real cascade assertions.
d.documentElement.setAttribute('data-m2-active', '');
const card = {
  name: 'Test attack',
  color: 'RED',
  initiative: 9,
  primary_action: 'ATTACK',
  primary_action_value: 3,
  range_value: 2,
  secondary_actions: { MOVEMENT: 4, DEFENSE: 5 },
};
try {
  const mini = miniatureCard(card, { ATTACK: 1, RANGE: 1, DEFENSE: 2, INITIATIVE: 1 });
  assert.deepEqual(
    [...mini.querySelectorAll('img')].map((x) => x.alt),
    ['Attack', 'range', 'Movement'],
  );
  assert.equal(mini.textContent, '434');
  assert.deepEqual(
    [...mini.querySelectorAll('.m2-upgraded-value')].map((x) => x.textContent),
    ['4', '3'],
  );
  assert(!mini.querySelector('img[src*="initiative"]'));
  assert.equal(card.primary_action_value, 3, 'do not mutate printed stats');
  const hidden = miniatureCard({ ...card, is_facedown: true });
  assert.equal(hidden.textContent, '?');
  assert.equal(hidden.querySelectorAll('img').length, 0);
  assert(!hidden.title.includes(card.name));
  const empty = itemUpgradeSymbols({});
  assert.equal(empty.children.length, 4);
  assert.equal(empty.querySelectorAll('.m2-upgrade-empty').length, 6);
  const upgrades = itemUpgradeSymbols({ ATTACK: 2, INITIATIVE: 1, MOVEMENT: 1, AREA: 1 });
  assert.deepEqual(
    [...upgrades.children].slice(0, 3).map((x) => x.querySelector('img').alt),
    ['Attack', 'Defense', 'initiative'],
  );
  assert.equal(upgrades.querySelectorAll('.m2-upgrade-rest .m2-symbol-value').length, 0);
  assert.equal(upgrades.querySelectorAll('.m2-upgrade-rest .m2-upgrade-empty').length, 1);
  const hero = {
    name: 'Hanu · Sebastian (You)',
    color: 'blue',
    level: 2,
    gold: 3,
    offboard: true,
    done: true,
    resolution: { current: true, initiative: 10, order: 1 },
    currentCard: card,
    upgrades: {},
    dots: ['blue'],
    cardPiles: [
      { label: 'P', cards: [{ color: 'red', active: true }] },
      { label: 'D', cards: [] },
    ],
  };
  renderSummary([hero]);
  const row = d.querySelector('#goa2-m2-summary article');
  assert.equal(row.firstElementChild.className, 'm2-summary-turn');
  assert.equal(row.children.length, 6, 'six table columns without separator columns');
  assert.equal(row.querySelector('.m2-summary-identity').textContent, 'Hanu·(You)');
  assert.equal(row.querySelector('.m2-summary-resources').textContent, 'Lv.2·3');
  assert.equal(
    row.querySelectorAll('.m2-summary-separator').length,
    2,
    'dots only inside identity/resources',
  );
  assert(
    row.firstElementChild.textContent.startsWith('NOW'),
    'queued card takes priority over off-board skull',
  );
  assert.equal(row.querySelector('.m2-summary-player').textContent, '(You)');
  assert.deepEqual(
    [...row.querySelector('.m2-summary-piles').children].map((x) => x.textContent[0]),
    ['H', 'P', 'D'],
  );
  assert(row.querySelector('.m2-summary-piles .m2-effect-active'));
  assert.equal(row.querySelector('.m2-gold-value').textContent, '3');
  const summary = d.querySelector('#goa2-m2-summary');
  // Verify the whole outer box fits its column, not just the CSS content width.
  // This caught the earlier higher-specificity content-box override.
  const micro = row.querySelector('.m2-micro-board');
  const microStyle = w.getComputedStyle(micro);
  const slotStyle = w.getComputedStyle(row.querySelector('.m2-summary-current-slot'));
  assert.equal(microStyle.boxSizing, 'border-box');
  assert.equal(microStyle.width, slotStyle.width);
  assert.equal(microStyle.gridTemplateColumns, 'repeat(3, 20px)');
  assert.equal(w.getComputedStyle(micro.parentElement).width, '70px');
  assert.equal(micro.children.length, 3, 'reserve every cell even for missing stats');
  assert(!micro.querySelector('img[alt="Defense"]'), 'Board Micro omits secondary defense');
  // A wider containing column must not stretch the three-icon card or its button.
  micro.parentElement.parentElement.style.width = '120px';
  assert.equal(w.getComputedStyle(micro).width, '70px');
  assert.equal(w.getComputedStyle(micro.parentElement).width, '70px');
  assert.equal(w.getComputedStyle(micro.parentElement).flexGrow, '0');
  micro.parentElement.parentElement.style.removeProperty('width');
  assert.equal(
    summary.style.getPropertyValue('--m2-piles-width'),
    '33px',
    'sparse piles reclaim spare width',
  );
  const nameStyle = w.getComputedStyle(row.querySelector('.m2-summary-identity strong'));
  assert.equal(nameStyle.maxWidth, 'none');
  assert.equal(nameStyle.textOverflow, 'clip');
  assert.equal(
    w.getComputedStyle(row).overflowX,
    'auto',
    'narrow rows scroll rather than hide full hero names',
  );
  assert(
    row
      .querySelector('.m2-summary-piles')
      .compareDocumentPosition(row.querySelector('.m2-mini-current')) &
      w.Node.DOCUMENT_POSITION_FOLLOWING,
  );
  renderSummary([{ ...hero, currentCard: { ...card, is_facedown: true } }]);
  const facedown = d.querySelector('.m2-micro-board');
  assert.equal(
    w.getComputedStyle(facedown).display,
    'flex',
    'hidden marker centers across the entire card',
  );
  assert.equal(facedown.textContent, '?');
  renderSummary([hero]);
  delete hero.resolution;
  renderSummary([hero]);
  assert(
    d.querySelector('.m2-card-resolved .m2-mini-current'),
    'retain and fade a resolved microcard',
  );
  assert.equal(d.querySelector('.m2-summary-turn').textContent, '☠');
  hero.offboard = false;
  renderSummary([hero]);
  assert.equal(d.querySelector('.m2-summary-turn').textContent, '✓');
  hero.done = false;
  renderSummary([hero]);
  assert(d.querySelector('.m2-mini-current'));
  hero.currentCard = null;
  renderSummary([hero]);
  assert(!d.querySelector('.m2-mini-current'), 'no empty microcard placeholder');
  assert.equal(d.querySelector('.m2-summary-turn').textContent, '—');
  hero.name = 'Silverarrow · A very long player name';
  renderSummary([hero]);
  assert.equal(d.querySelector('.m2-summary-identity strong').textContent, 'Silverarrow');
  assert(
    Number.parseFloat(summary.style.getPropertyValue('--m2-name-min')) >= 68,
    'reserve the full longest hero name',
  );
  const sparseWidth = Number.parseFloat(summary.style.getPropertyValue('--m2-piles-width'));
  hero.dots = ['red', 'blue', 'green', 'gold', 'silver'];
  renderSummary([hero]);
  assert(
    Number.parseFloat(summary.style.getPropertyValue('--m2-piles-width')) > sparseWidth,
    'column grows to fit larger piles',
  );
  console.log(
    'PASS: compact stat order, purple upgrades, fixed utility slots, hidden-card privacy, piles and phase markers',
  );
} finally {
  w.GOA2Mobile2D.destroy();
  w.close();
}
