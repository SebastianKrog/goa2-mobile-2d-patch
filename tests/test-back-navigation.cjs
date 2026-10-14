const { JSDOM } = require('jsdom');
const fs = require('fs'),
  assert = require('assert');
const dom = new JSDOM(
  '<header class="_bar_x"><span class="_phase_x">RESOLUTION</span></header><div class="_main_x"><div class="_boardArea_x"></div><div class="_sidebar_x"></div></div>',
  {
    url: 'https://goa2.frontend.pedroliv.dev/?3d=0',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  },
);
const w = dom.window,
  d = w.document;
w.matchMedia = () => ({ matches: true, addEventListener() {} });
const sidebar = d.querySelector('._sidebar_x');
sidebar.__reactFiber$test = { memoizedProps: { view: { phase: 'RESOLUTION', turn: 1 } } };
let deckOpens = 0;
for (const own of [true, false]) {
  const box = d.createElement('section');
  box.id = own ? 'own' : 'other';
  box.innerHTML =
    '<div class="_name_x">' +
    (own ? 'Hanu (You)' : 'Misa') +
    '</div><div class="_details_x">Lv 1<i class="_handColorDot_x" style="background-color:red"></i></div>';
  box.__reactFiber$test = {
    memoizedProps: {
      hero: {
        id: box.id,
        level: 1,
        gold: 0,
        hand: [],
        played_cards: [],
        discard_pile: [],
        items: {},
      },
    },
  };
  if (own) {
    const native = d.createElement('button');
    native.className = '_viewDeckBtn_x';
    native.textContent = 'Deck';
    native.onclick = () => {
      deckOpens++;
      const wrap = d.createElement('div');
      wrap.className = '_backdrop_x';
      wrap.innerHTML =
        '<div class="_modal_x"><button class="_closeBtn_x">X</button><div class="_cardGrid_x"></div></div>';
      wrap.querySelector('button').onclick = () => wrap.remove();
      box.append(wrap);
    };
    box.append(native);
  }
  sidebar.append(box);
}
const hand = d.createElement('section');
hand.innerHTML = '<div class="_label_x">Hand</div>';
sidebar.append(hand);
w.eval(
  fs
    .readFileSync('dist/goa2-mobile-2d.user.js', 'utf8')
    .replace(
      /window\.GOA2Mobile2D\s*=\s*\{/,
      'window.previewRefresh=refresh;window.GOA2Mobile2D={',
    ),
);
const nav = (key) => d.querySelector('#goa2-m2-nav [data-mode="' + key + '"]').click();
const summary = () => d.querySelector('#goa2-m2-summary');

const settle = () => new Promise((resolve) => setTimeout(resolve, 40));
(async () => {
  try {
    const initial = w.history.length;
    for (const key of ['hand', 'heroes', 'log', 'tools', 'deck']) {
      nav(key);
      assert.equal(w.history.length, initial + 1, 'one menu entry');
      w.history.back();
      await settle();
      assert.equal(d.documentElement.dataset.m2Mode, 'board');
      assert.equal(d.documentElement.dataset.m2Panel, '');
      assert(!d.documentElement.hasAttribute('data-m2-deck-open'));
      assert.equal(d.querySelectorAll('#goa2-m2-nav [aria-pressed="true"]').length, 0);
      assert(!w.history.state?.goa2Mobile2DMenu);
    }
    nav('hand');
    nav('heroes');
    nav('log');
    assert.equal(w.history.length, initial + 1, 'switching panes does not stack menu entries');
    w.history.back();
    await settle();
    assert.equal(d.documentElement.dataset.m2Panel, '');
    nav('hand');
    nav('hand');
    await settle();
    assert(!w.history.state?.goa2Mobile2DMenu, 'footer close consumes marker');
    nav('hand');
    nav('hand');
    nav('log');
    await settle();
    assert(w.history.state?.goa2Mobile2DMenu, 'rapid reopen retains one back entry');
    w.history.back();
    await settle();
    assert.equal(d.documentElement.dataset.m2Panel, '');
    nav('deck');
    d.querySelector('[data-m2="deck"] ._closeBtn_x').click();
    w.previewRefresh();
    await settle();
    assert(!w.history.state?.goa2Mobile2DMenu, 'native deck close consumes marker');
    console.log(
      'PASS: Back closes Hand/Heroes/Deck/Log/Settings, panel switching uses one history entry, footer/native close and rapid reopen',
    );
  } finally {
    w.GOA2Mobile2D.destroy();
    w.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
