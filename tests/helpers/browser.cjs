const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../dist/goa2-mobile-2d.user.js'),
  'utf8',
);

// Evaluate the built userscript, with optional private hooks for isolated integration checks.
// The production bundle never exports these hooks.
function browserFixture({ html = '<aside class="_sidebar_test"></aside>', hooks = [], url } = {}) {
  const dom = new JSDOM(html, {
    url: url || 'https://goa2.frontend.pedroliv.dev/game/test?3d=0',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  const media = new w.EventTarget();
  media.matches = true;
  w.matchMedia = () => media;

  let code = source;
  if (hooks.length) {
    const boundary = /window\.GOA2Mobile2D\s*=\s*\{/g;
    assert.equal(
      [...source.matchAll(boundary)].length,
      1,
      'public API injection boundary exists once',
    );
    code = source.replace(boundary, `window.testUI={${hooks.join(',')}};window.GOA2Mobile2D={`);
  }
  return {
    w,
    d: w.document,
    media,
    install: () => w.eval(code),
    close() {
      try {
        w.GOA2Mobile2D?.destroy();
      } finally {
        w.close();
      }
    },
  };
}

module.exports = { browserFixture };
