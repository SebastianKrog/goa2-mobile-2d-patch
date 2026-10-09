const { JSDOM } = require('jsdom');
const fs = require('fs'),
  assert = require('assert');
const dom = new JSDOM(
  `
  <header class="_bar_x"><span class="_phase_x">RESOLUTION</span>
    <div class="_statusCopy_x"><strong>Queued is choosing</strong><span class="_statusDetail_x">Waiting for their decision</span></div>
    <img class="_tieBreaker_x" src="/icons/coin_blue.png">
  </header><div class="_boardArea_x"></div><aside class="_sidebar_x"></aside>
  <div class="_container_x">
    <div class="_entry_x _nextEntry_x"><span class="_initiative_x">12</span><span class="_heroName_x">Queued</span><span class="_cardName_x">Card</span></div>
    <div class="_entry_x"><span class="_initiative_x">11</span><span class="_heroName_x">Second</span><span class="_cardName_x">Card</span></div>
  </div>`,
  {
    url: 'https://goa2.frontend.pedroliv.dev/game/fixture?3d=0',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  },
);
const w = dom.window,
  d = w.document;
w.matchMedia = () => ({ matches: true, addEventListener() {} });
const side = d.querySelector('aside');
const view = {
  phase: 'RESOLUTION',
  turn: 1,
  teams: {
    RED: { minions: [{ id: 'alive' }, { id: 'alive' }, { id: 'dead' }] },
    BLUE: { minions: [] },
  },
  board: { entity_locations: { alive: {}, Queued: {}, Second: {} } },
};
side.__reactFiber$test = { memoizedProps: { view } };
for (const name of ['Second', 'Queued']) {
  const box = d.createElement('section');
  box.id = name;
  box.innerHTML = `<div class="_name_x">${name}</div><div class="_details_x">Lv 1</div>`;
  box.__reactFiber$test = {
    memoizedProps: { hero: { id: name, name, played_cards: [], discard_pile: [], items: {} } },
  };
  side.append(box);
}
w.eval(
  fs
    .readFileSync('dist/goa2-mobile-2d.user.js', 'utf8')
    .replace(
      /window\.GOA2Mobile2D\s*=\s*\{/,
      'window.testUI={refresh,remainingMinions};window.GOA2Mobile2D={',
    ),
);
const { refresh, remainingMinions } = w.testUI;
const style = (el) => w.getComputedStyle(el);
const badge = (root) => root.querySelector('.m2-resolution-info > .m2-symbol');
try {
  const header = d.querySelector('header'),
    strip = d.querySelector('.m2-hud-bottom');
  assert.equal(
    header.nextElementSibling,
    strip,
    'status strip sits outside and immediately below header',
  );
  assert.equal(
    strip.querySelector('.m2-status').textContent,
    'Queued is choosing · Waiting for their decision',
  );
  assert.equal(style(strip.querySelector('.m2-status')).textOverflow, 'ellipsis');
  assert.equal(style(strip.querySelector('.m2-phase')).textAlign, 'center');
  assert.equal(style(strip).backdropFilter, 'blur(3px)');
  assert.equal(d.querySelector('.m2-coin small').textContent, 'BLUE');
  header.querySelector('._tieBreaker_x').src = '/icons/coin_orange.png';
  refresh();
  assert.equal(d.querySelector('.m2-coin small').textContent, 'ORANGE');
  assert.equal(
    d.querySelector('.m2-minions.red b').textContent,
    '1',
    'count unique surviving minions',
  );
  assert.equal(remainingMinions({}, 'RED'), null, 'unknown roster is not zero');
  const dot = strip.querySelector('.m2-action-dot');
  const dotColor = style(dot).color,
    columns = style(strip).gridTemplateColumns;
  const warning = d.createElement('div');
  warning.className = '_disconnected_x';
  warning.textContent = 'Disconnected — reconnecting...';
  d.body.append(warning);
  refresh();
  assert(strip.classList.contains('m2-disconnected'));
  assert.equal(strip.querySelector('.m2-phase').textContent, 'DISCONNECTED');
  assert.equal(strip.querySelector('.m2-status').textContent, 'Reconnecting...');
  assert.equal(style(strip).backgroundColor, 'rgba(179, 38, 38, 0.6)');
  assert.equal(style(strip).backdropFilter, 'blur(3px)');
  assert.equal(style(dot).color, dotColor);
  assert.equal(
    style(strip).gridTemplateColumns,
    columns,
    'disconnect keeps the dot in the same column',
  );
  header.querySelector('strong').textContent = 'Second is choosing';
  warning.remove();
  refresh();
  assert(!strip.classList.contains('m2-disconnected'));
  assert(strip.querySelector('.m2-status').textContent.startsWith('Second is choosing'));

  d.querySelector('[data-mode="heroes"]').click();
  for (const name of ['Queued', 'Second']) {
    assert.equal(
      style(badge(d.getElementById(name))).backgroundColor,
      'rgba(0, 0, 0, 0)',
      'Heroes initiative has no black box',
    );
  }
  d.querySelector('[data-mode="heroes"]').click();
  const summary = d.querySelector('#goa2-m2-summary');
  assert.equal(style(summary).backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(style(summary.querySelector('article')).backdropFilter, 'blur(3px)');
  summary.querySelector('.m2-summary-identity').click();
  const portraits = () => [...summary.querySelectorAll('.m2-focus-hero-icon')];
  assert.deepEqual(
    portraits().map((x) => x.dataset.heroId),
    ['Queued', 'Second'],
    'portrait buttons follow turn order, not native DOM order',
  );
  assert.equal(summary.querySelector('[aria-pressed="true"]').dataset.heroId, 'Queued');
  for (const button of portraits()) {
    assert.equal(
      style(badge(button)).backgroundColor,
      'rgba(0, 0, 0, 0)',
      'Board initiative has no black box',
    );
    assert(!button.querySelector('.m2-focus-back'));
  }
  assert.equal(badge(portraits()[1]).textContent, '11');
  portraits()[1].click();
  assert.equal(summary.querySelector('.m2-focused-hero').dataset.heroId, 'Second');
  assert.equal(summary.querySelector('[aria-pressed="true"]').dataset.heroId, 'Second');
  assert.equal(style(summary).height, 'auto');
  assert.equal(style(summary).backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(style(summary.querySelector('.m2-focused-hero')).backdropFilter, 'blur(3px)');
  const back = summary.querySelector('.m2-focus-back');
  assert.equal(back.textContent, '◀');
  assert.equal(style(back).color, 'rgb(174, 181, 190)');
  assert.equal(side.querySelectorAll('.m2-focus-back').length, 0, 'native heroes stay untouched');
  back.click();
  assert(!summary.querySelector('.m2-focused-hero'));
  assert(!summary.querySelector('.m2-focus-portraits'));
  w.GOA2Mobile2D.destroy();
  assert(!d.querySelector('.m2-hud-bottom'), 'generated strip is removed on teardown');
  console.log(
    'PASS: floating HUD, connection recovery, stable dot, minion counts, ordered focus switching, transparent initiative badges and gray back triangle',
  );
} finally {
  w.GOA2Mobile2D?.destroy();
  w.close();
}
