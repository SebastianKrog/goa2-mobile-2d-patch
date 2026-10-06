const { JSDOM } = require('jsdom');
const fs = require('fs'), assert = require('assert');
const dom = new JSDOM('<div class="_layout_x"><header class="_bar_x"></header><div class="_main_x"><div class="_boardArea_x"></div><div class="_sidebar_x"><section><div class="_name_x">Hanu (You)</div><div class="_details_x">Lv 1</div><button class="_viewDeckBtn_x">Deck</button><div class="_backdrop_x"><div class="_modal_x"><button class="_closeBtn_x">X</button><div class="_cardGrid_x"></div></div></div></section><section><div class="_label_x">Hand</div></section></div></div><div class="_gameToolsRow_x"><button>Options</button></div></div>', { url: 'https://goa2.frontend.pedroliv.dev/game/test?3d=0', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window, d = w.document;
w.matchMedia = () => ({ matches: true, addEventListener() {} });
const handRow = d.createElement('div');
handRow.className = '_row_x';
handRow.__reactFiber$t = { memoizedProps: { card: { id: 'c', name: 'Test', color: 'BLUE', primary_action: 'SKILL', initiative: 2, secondary_actions: {} } } };
d.querySelector('._label_x').parentElement.append(handRow);
w.eval(fs.readFileSync('dist/goa2-mobile-2d.user.js', 'utf8').replace(/window\.GOA2Mobile2D\s*=\s*\{/, 'window.testRefresh=refresh;window.GOA2Mobile2D={'));
const root = d.documentElement;
const click = key => d.querySelector('[data-mode="' + key + '"]').click();
try {
  assert.equal(root.dataset.m2Mode, 'board');
  assert(!d.querySelector('[data-mode="board"], [data-mode="split"]'));
  for (const key of ['hand', 'heroes', 'tools', 'deck']) {
    click(key);
    assert.equal(d.querySelector('[data-mode="' + key + '"]').getAttribute('aria-pressed'), 'true');
    if (key === 'hand' || key === 'heroes') {
      assert.equal(w.getComputedStyle(d.querySelector('[data-m2="board"]')).visibility, 'visible');
      assert.equal(d.querySelector('#goa2-m2-hero-display').parentElement.dataset.m2, 'board');
      assert.equal(w.getComputedStyle(d.querySelector('#goa2-m2-hero-display')).display, 'none');
    }
    if (key === 'deck') {
      assert.equal(w.getComputedStyle(d.querySelector('[data-m2="board"]')).display, 'none');
      assert.notEqual(w.getComputedStyle(d.querySelector('[data-m2="sidebar"]')).display, 'none', 'nested Deck needs its ancestor');
      assert.equal(w.getComputedStyle(d.querySelector('[data-m2="deck"]')).visibility, 'visible');
    }
    click(key);
    assert.equal(root.dataset.m2Mode, 'board');
    assert.equal(root.dataset.m2Panel, '');
    assert(!root.hasAttribute('data-m2-deck-open'));
    assert.equal(d.querySelectorAll('#goa2-m2-nav [aria-pressed="true"]').length, 0);
  }
  click('hand');
  handRow.className = '_row_x _selected_x'; w.testRefresh();
  const display = d.querySelector('#goa2-m2-details');
  assert(display.firstElementChild);
  assert.equal(display.parentElement.dataset.m2, 'board');
  assert.equal(w.getComputedStyle(display).display, 'block');
  handRow.className = '_row_x'; w.testRefresh();
  assert.equal(w.getComputedStyle(display).display, 'none');
  click('heroes');
  assert.equal(root.dataset.m2Mode, 'heroes');
  click('deck');
  d.querySelector('[data-m2="deck"]').remove(); w.testRefresh();
  assert(!root.hasAttribute('data-m2-deck-open'), 'native unmount returns to Board');
  console.log('PASS: Board default, pane toggles, visible empty board, nested Deck, native close and active state');
} finally { w.GOA2Mobile2D.destroy(); w.close(); }
