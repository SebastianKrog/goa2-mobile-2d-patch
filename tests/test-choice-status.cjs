const { JSDOM } = require('jsdom');
const fs = require('fs'),
  assert = require('assert');
const dom = new JSDOM(
  '<div><header class="_bar_x"><span class="_phase_x">LEVEL UP</span></header><div class="_boardArea_x"><div><button>Options</button></div></div><div class="_sidebar_x"><section><div class="_name_x">Hanu (You)</div><div class="_details_x">Lv 2</div></section><section><div class="_name_x">Garrus</div><div class="_details_x">Lv 3</div></section></div></div>',
  {
    url: 'https://goa2.frontend.pedroliv.dev/game/test?3d=0',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  },
);
const w = dom.window,
  d = w.document;
w.matchMedia = () => ({ matches: true, addEventListener() {} });
const request = {
  type: 'UPGRADE_PHASE',
  players: { hanu: { remaining: 1 }, garrus: { remaining: 0 } },
};
d.querySelector('._sidebar_x').__reactFiber$t = {
  memoizedProps: { view: { phase: 'LEVEL_UP' }, inputRequest: request },
};
[...d.querySelectorAll('section')].forEach((node, i) => {
  node.__reactFiber$t = {
    memoizedProps: {
      hero: { id: i ? 'garrus' : 'hanu', played_cards: [], items: {}, level: 2, gold: 0 },
    },
  };
});
const native = d.querySelector('button');
let clicks = 0;
native.onclick = () => clicks++;
w.eval(
  fs
    .readFileSync('dist/goa2-mobile-2d.user.js', 'utf8')
    .replace(/window\.GOA2Mobile2D\s*=\s*\{/, 'window.testRefresh=refresh;window.GOA2Mobile2D={'),
);
try {
  assert.deepEqual(
    [...d.querySelectorAll('.m2-summary-turn')].map((x) => x.getAttribute('aria-label')),
    ['Upgrading · Open Hanu (You)', 'Committed · Open Garrus'],
  );
  assert.equal(d.querySelector('.m2-selection-status').textContent, 'Upgrading...');
  assert.equal(d.querySelectorAll('.m2-selection-status')[1].textContent, 'Committed ✓');
  assert(d.querySelector('.m2-summary-turn .m2-selecting-dots'));
  const proxy = d.querySelector('.m2-choice-launchers button');
  proxy.click();
  assert.equal(clicks, 1);
  w.testRefresh();
  assert.equal(d.querySelector('.m2-choice-launchers button'), proxy);
  request.players.hanu.remaining = 0;
  w.testRefresh();
  assert.equal(
    d.querySelector('.m2-summary-turn').getAttribute('aria-label'),
    'Committed · Open Hanu (You)',
  );
  assert(!d.querySelector('.m2-summary-turn .m2-selecting-dots'));
  assert.equal(d.querySelector('.m2-selection-status').textContent, 'Committed ✓');
  delete request.players.hanu;
  w.testRefresh();
  assert.equal(
    d.querySelector('.m2-summary-turn').getAttribute('aria-label'),
    'Upgrading · Open Hanu (You)',
  );
  assert(d.querySelector('.m2-summary-turn .m2-selecting-dots'));
  assert.equal(d.querySelector('.m2-selection-status').textContent, 'Upgrading...');
  const sidebarProps = d.querySelector('._sidebar_x').__reactFiber$t.memoizedProps;
  sidebarProps.myHeroId = 'hanu';
  sidebarProps.isMyTurn = false;
  sidebarProps.view.teams = {
    BLUE: {
      heroes: [
        { id: 'hanu', name: 'Hanu' },
        { id: 'garrus', name: 'Garrus' },
      ],
    },
  };
  request.type = 'NONE';
  const logToggle = d.createElement('button');
  logToggle.className = '_toggle_test';
  const waiting = ['Garrus'];
  logToggle.__reactFiber$t = { memoizedProps: { waitingForNames: waiting } };
  d.body.append(logToggle);
  w.testRefresh();
  assert.equal(
    d.querySelector('.m2-selection-status').textContent,
    'Committed ✓',
    'own completion survives disappearance of the private request',
  );
  assert.equal(d.querySelectorAll('.m2-selection-status')[1].textContent, 'Upgrading...');
  waiting[0] = 'Hanu';
  w.testRefresh();
  assert.equal(
    d.querySelectorAll('.m2-selection-status')[1].textContent,
    'Committed ✓',
    'public waiting names update other heroes without their private offers',
  );
  assert.equal(d.querySelectorAll('.m2-summary-turn')[1].textContent, '✓');
  logToggle.remove();
  native.remove();
  w.testRefresh();
  assert(d.querySelector('.m2-choice-launchers').hidden);
  const setup = d.createElement('div');
  setup.setAttribute('aria-label', 'Starting position');
  setup.innerHTML = '<button>Change starting position</button>';
  d.body.append(setup);
  w.testRefresh();
  const setupButton = d.querySelector('.m2-choice-launchers button');
  assert.equal(setupButton.textContent, 'Position');
  setupButton.click();
  assert.equal(d.documentElement.dataset.m2Panel, 'setup');
  w.GOA2Mobile2D.destroy();
  assert(!native.hasAttribute('data-m2-choice-source'));
  assert(!d.querySelector('.m2-choice-launchers'));
  console.log('PASS: upgrade status transitions, stable choice proxies, setup and cleanup');
} finally {
  w.GOA2Mobile2D?.destroy();
  w.close();
}
