const { JSDOM } = require('jsdom');
const fs = require('fs'),
  vm = require('vm'),
  assert = require('assert');
const tick = () => new Promise((resolve) => setTimeout(resolve, 70));

async function assetRecovery() {
  let failSprite = true,
    failBackground = true,
    failFont = false,
    fontCalls = 0;
  const requests = [];
  class Image {
    set src(url) {
      this.url = url;
      requests.push(url);
      queueMicrotask(() =>
        (url.endsWith('/title.png') && failSprite) ||
        (url.includes('/backgrounds/') && failBackground)
          ? this.onerror?.()
          : this.onload?.(),
      );
    }
  }
  const scope = {
    Image,
    HTMLImageElement: Image,
    console,
    document: {
      fonts: {
        ready: Promise.resolve(),
        async load() {
          fontCalls++;
          if (failFont) throw new Error('font unavailable');
        },
      },
    },
  };
  vm.createContext(scope);
  vm.runInContext(
    fs.readFileSync('src/painter.js', 'utf8').replace(/^export \{ m2Painter \};$/m, '') +
      ';globalThis.painter=m2Painter;',
    scope,
  );
  const painter = scope.painter;
  const pending = painter.ensureCardAssetsReady();
  assert.equal(painter.ensureCardAssetsReady(), pending, 'simultaneous cards share initialization');
  await assert.rejects(pending, /incomplete/);
  const firstCount = requests.length;
  failSprite = false;
  await painter.ensureCardAssetsReady();
  assert.deepEqual(
    requests.slice(firstCount),
    ['/cards/sheets/title.png'],
    'retry only missing sprites',
  );
  assert.equal(fontCalls, 2);
  const loadedCount = requests.length;
  await painter.ensureCardAssetsReady();
  assert.equal(requests.length, loadedCount, 'successful initialization stays cached');

  assert.equal(await painter.loadCardBackground('hanu', 'gold'), undefined);
  failBackground = false;
  const image = await painter.loadCardBackground('hanu', 'gold');
  assert(image, 'failed backgrounds can load after recovery');
  const afterRecovery = requests.length;
  assert.equal(await painter.loadCardBackground('hanu', 'gold'), image);
  assert.equal(requests.length, afterRecovery);

  // A font failure must not poison the shared readiness promise either.
  const second = {
    ...scope,
    document: {
      fonts: {
        ready: Promise.resolve(),
        async load() {
          if (failFont) throw new Error('font unavailable');
        },
      },
    },
  };
  vm.createContext(second);
  failFont = true;
  vm.runInContext(
    fs.readFileSync('src/painter.js', 'utf8').replace(/^export \{ m2Painter \};$/m, '') +
      ';globalThis.painter=m2Painter;',
    second,
  );
  await assert.rejects(second.painter.ensureCardAssetsReady(), /font unavailable/);
  failFont = false;
  await second.painter.ensureCardAssetsReady();
}

async function deckRecovery() {
  const dom = new JSDOM(
    `<aside class="_sidebar_x"></aside><div class="_modal_x">
    <div class="_cardGrid_x"><canvas width="100" height="140"></canvas></div></div>`,
    {
      url: 'https://goa2.frontend.pedroliv.dev/game/test?3d=0',
      runScripts: 'outside-only',
      pretendToBeVisual: true,
    },
  );
  const w = dom.window,
    d = w.document;
  w.matchMedia = () => ({ matches: true, addEventListener() {} });
  const contexts = new WeakMap();
  w.HTMLCanvasElement.prototype.getContext = function () {
    if (!contexts.has(this))
      contexts.set(this, {
        clears: 0,
        draws: 0,
        labels: [],
        clearRect() {
          this.clears++;
        },
        drawImage() {
          this.draws++;
        },
        fillRect() {},
        fillText(text) {
          this.labels.push(text);
        },
      });
    return contexts.get(this);
  };
  const native = d.querySelector('canvas'),
    modal = d.querySelector('._modal_x');
  native.__reactFiber$test = {
    memoizedProps: {
      card: {
        id: 'red',
        name: 'Red',
        color: 'RED',
        tier: 'I',
        initiative: 3,
        secondary_actions: {},
      },
    },
  };
  const gold = {
    id: 'gold',
    name: 'Gold',
    color: 'GOLD',
    primary_action: 'ATTACK',
    primary_action_value: 1,
  };
  modal.__reactFiber$test = { memoizedProps: { hero: { id: 'hero_hanu', deck: [gold] } } };
  const originalDraw = native.getContext('2d').drawImage;
  let assetsFail = true,
    drawingFails = false,
    attempts = 0,
    delayAssets = false,
    rejectPending;
  const warnings = [];
  w.console.warn = (...args) => warnings.push(args);
  w.prepare = (ui) => {
    ui.m2Painter.ensureCardAssetsReady = async () => {
      attempts++;
      if (delayAssets)
        await new Promise((resolve, reject) => {
          rejectPending = reject;
        });
      if (assetsFail) throw new Error('offline');
    };
    ui.m2Painter.paintCard = (canvas, ctx) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (drawingFails) throw new Error('missing sprite');
      ctx.fillText('Painted', 0, 0);
    };
  };
  w.eval(
    fs
      .readFileSync('dist/goa2-mobile-2d.user.js', 'utf8')
      .replace(
        /window\.GOA2Mobile2D\s*=\s*\{/,
        'window.testUI={m2Painter,basicCanvases,refresh,getDeck:()=>uiState.deckState};window.prepare(window.testUI);window.GOA2Mobile2D={',
      ),
  );
  try {
    await tick();
    const basic = [...w.testUI.basicCanvases.values()][0],
      ctx = basic.getContext('2d');
    assert.deepEqual(ctx.labels, ['Gold']);
    assert.equal(ctx.clears, 0);
    assert.equal(ctx.draws, 0, 'load failure preserves fallback pixels');
    assetsFail = false;
    drawingFails = true;
    d.querySelector('[data-mode="deck"]').click();
    await tick();
    assert.equal(ctx.clears, 0, 'drawing error clears only the offscreen staging canvas');
    assert.equal(ctx.draws, 0);
    assert(attempts >= 2, 'reopening Deck retries failed artwork');
    drawingFails = false;
    w.dispatchEvent(new w.Event('online'));
    await tick();
    assert.equal(ctx.draws, 1, 'online recovery publishes a completed painting');
    assert.equal(ctx.clears, 0);
    const settledAttempts = attempts;
    w.testUI.refresh();
    await tick();
    assert.equal(
      attempts,
      settledAttempts,
      'successful painting does not repeat on idle refreshes',
    );
    assert.equal(warnings.length, 2);

    // Recovery can happen while the initial failed request is still settling.
    delayAssets = true;
    modal.__reactFiber$test.memoizedProps.hero.deck = [{ ...gold, id: 'gold-late' }];
    w.testUI.refresh();
    const delayed = [...w.testUI.basicCanvases.values()][0];
    w.dispatchEvent(new w.Event('online'));
    await tick();
    assert.equal(delayed.getContext('2d').draws, 0);
    delayAssets = false;
    rejectPending(new Error('request finished after reconnect'));
    await tick();
    assert.equal(
      delayed.getContext('2d').draws,
      1,
      'online retry is retained until pending work finishes',
    );

    native.remove();
    await tick();
    assert.equal(w.testUI.getDeck(), null);
    assert(!d.querySelector('.m2-deck-browser'));
    assert(!d.querySelector('.m2-deck-zoom'));
    assert(!modal.hasAttribute('data-m2-deck-ready'));
    assert.equal(
      native.getContext('2d').drawImage,
      originalDraw,
      'empty sources release canvas hooks',
    );
    modal.querySelector('._cardGrid_x').append(native);
    await tick();
    assert(d.querySelector('.m2-deck-browser'), 'native sources can remount after cleanup');
    native.__reactFiber$test.memoizedProps.card = null;
    w.testUI.refresh();
    assert.equal(w.testUI.getDeck(), null, 'invalid props use the same cleanup path');
    assert(!modal.hasAttribute('data-m2-deck-ready'));
  } finally {
    w.GOA2Mobile2D.destroy();
    w.close();
  }
}
(async () => {
  await assetRecovery();
  await deckRecovery();
  console.log(
    'PASS: sprite/font/background retries, atomic fallback, online/reopen recovery and Deck cleanup/remount',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
