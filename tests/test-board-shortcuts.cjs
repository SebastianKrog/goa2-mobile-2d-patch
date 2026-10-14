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
try {
  assert.equal(
    summary().querySelectorAll('.m2-navigation-shortcut').length,
    2,
    'only your compact row has shortcuts',
  );
  const piles = summary().querySelector('.m2-summary-piles.m2-navigation-shortcut');
  assert.equal(piles.querySelector('.m2-shortcut-border').type, 'button');
  assert.equal(piles.tagName, 'SPAN');
  assert.equal(piles.textContent, 'HP–D–');
  piles.querySelector('i').click();
  assert.equal(d.documentElement.dataset.m2Mode, 'hand', 'tapping hand dot opens Hand');
  assert.equal(d.querySelector('[data-mode="hand"]').getAttribute('aria-pressed'), 'true');
  nav('hand');
  summary()
    .querySelector('.m2-summary-upgrades.m2-navigation-shortcut .m2-ultimate-indicator')
    .click();
  assert(d.documentElement.hasAttribute('data-m2-deck-open'));
  assert.equal(deckOpens, 1, 'shortcut opens native deck');
  nav('deck');
  assert(!d.documentElement.hasAttribute('data-m2-deck-open'));
  summary().querySelector('.m2-summary-identity').click();
  w.previewRefresh();
  assert.equal(
    summary().querySelectorAll('.m2-navigation-shortcut').length,
    2,
    'your expanded Board hero has shortcuts',
  );
  summary().querySelector('.m2-history-pile.m2-navigation-shortcut .m2-history-marker').click();
  assert.equal(d.documentElement.dataset.m2Mode, 'hand');
  assert(!summary().classList.contains('m2-summary-focused'), 'navigation clears Board focus');
  nav('hand');
  summary().querySelector('.m2-summary-identity').click();
  w.previewRefresh();
  summary().querySelector('.m2-hero-upgrades.m2-navigation-shortcut').click();
  assert.equal(deckOpens, 2);
  nav('deck');
  const others = summary().querySelectorAll('.m2-summary-identity');
  others[1].click();
  w.previewRefresh();
  assert.equal(
    summary().querySelectorAll('.m2-navigation-shortcut').length,
    0,
    'other hero indicators remain informational',
  );
  assert.equal(
    d.querySelectorAll('#goa2-m2-nav button:not([hidden])').length,
    5,
    'footer remains available',
  );
  console.log(
    'PASS: own compact and expanded shortcuts, empty piles, child icon clicks, native Deck open/close, opponent isolation, footer retained',
  );
} finally {
  w.GOA2Mobile2D.destroy();
  w.close();
}
