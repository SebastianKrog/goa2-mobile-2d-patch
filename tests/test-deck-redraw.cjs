const { JSDOM } = require('jsdom'),
  fs = require('fs'),
  assert = require('assert');
const d = new JSDOM(
  '<div class="_sidebar_x"></div><div class="_modal_x"><div class="_cardGrid_x"><canvas width="100" height="140"></canvas></div></div>',
  {
    url: 'https://goa2.frontend.pedroliv.dev/game/x?3d=0',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  },
);
const w = d.window,
  doc = w.document;
w.matchMedia = () => ({ matches: true, addEventListener() {} });
let draws = 0;
const contexts = new WeakMap();
w.HTMLCanvasElement.prototype.getContext = function () {
  if (!contexts.has(this))
    contexts.set(this, {
      drawImage() {
        draws++;
      },
      fillRect() {},
      clearRect() {},
    });
  return contexts.get(this);
};
const src = doc.querySelector('canvas');
src.__reactFiber$x = {
  memoizedProps: {
    card: { id: 'c', name: 'Test', color: 'RED', tier: 'I', initiative: 3, secondary_actions: {} },
  },
};
const original = src.getContext('2d').drawImage;
w.eval(
  fs
    .readFileSync('dist/goa2-mobile-2d.user.js', 'utf8')
    .replace(
      /window\.GOA2Mobile2D\s*=\s*\{/,
      ' window.__deck=()=>uiState.deckState;window.GOA2Mobile2D={',
    ),
);
doc.querySelector('[data-mode="deck"]').click();
[...doc.querySelectorAll('.m2-deck-controls button')]
  .find((button) => button.textContent === 'Grid')
  .click();
const wait = () => new Promise((r) => setTimeout(r, 100));
(async () => {
  try {
    await wait();
    const before = draws;
    await wait();
    assert.equal(draws, before);
    src.getContext('2d').drawImage({});
    await wait();
    assert(draws > before + 1);
    for (let i = 0; i < 10; i++) {
      doc.querySelector('.m2-deck-card').click();
      doc.querySelector('.m2-deck-zoom button').click();
    }
    assert(w.__deck().copies.length <= 2);
    w.GOA2Mobile2D.destroy();
    assert.equal(src.getContext('2d').drawImage, original);
    console.log(
      'PASS: no idle redraws, source paint triggers copy, zoom retention bounded, context restored',
    );
  } finally {
    w.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
