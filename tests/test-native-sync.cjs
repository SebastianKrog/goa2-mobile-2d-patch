const { JSDOM } = require('jsdom');
const fs = require('fs'),
  assert = require('assert');
const dom = new JSDOM(
  `
  <header class="_bar_x"><span class="_phase_x">RESOLUTION</span>
    <div class="_statusCopy_x"><strong>Choosing</strong></div>
    <img class="_tieBreaker_x" src="/icons/blue.png">
  </header><div class="_boardArea_x"></div><aside class="_sidebar_x">
    <section><div class="_name_x">Hanu (You)</div><div class="_details_x">Lv 1</div></section>
  </aside><div id="tip" style="position:fixed;z-index:9999">
    Initiative: 3 Primary Action: ATTACK<button>Movement 4</button>
  </div>`,
  {
    url: 'https://goa2.frontend.pedroliv.dev/game/test?3d=0',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  },
);
const w = dom.window,
  d = w.document,
  tick = () => new Promise((resolve) => setTimeout(resolve, 70));
w.matchMedia = () => ({ matches: true, addEventListener() {} });
const card = {
  id: 'c',
  name: 'Test',
  image_id: 'art',
  color: 'RED',
  initiative: 3,
  primary_action: 'ATTACK',
  primary_action_value: 3,
  secondary_actions: { MOVEMENT: 4 },
};
const view = { phase: 'RESOLUTION', turn: 1, board: { entity_locations: {} } };
d.querySelector('aside').__reactFiber$test = { memoizedProps: { view } };
d.querySelector('section').__reactFiber$test = {
  memoizedProps: {
    hero: {
      id: 'hero_hanu',
      name: 'Hanu',
      team: 'BLUE',
      hand: [card],
      played_cards: [],
      discard_pile: [],
      items: {},
    },
  },
};
const tip = d.getElementById('tip');
tip.__reactFiber$test = { memoizedProps: { card } };
w.refreshes = 0;
w.eval(
  fs
    .readFileSync('dist/goa2-mobile-2d.user.js', 'utf8')
    .replace('function refresh() {', 'function refresh() { window.refreshes++;'),
);
const proxies = () => [...d.querySelectorAll('.m2-card-foot button[data-action]')];
(async () => {
  try {
    await tick();
    const portrait = d.querySelector('.m2-hero-portrait');
    assert.equal(portrait.style.filter, '', 'team ring and status overlays keep their colors');
    assert.equal(portrait.querySelector('img').style.filter, 'grayscale(1)');
    const art = d.querySelector('#goa2-m2-details .m2-card-art img');
    const dismiss = d.querySelector('#goa2-m2-details .m2-card-dismiss');
    const idleCount = w.refreshes;
    await tick();
    assert.equal(w.refreshes, idleCount, 'generated mutations do not keep refreshing the page');

    d.querySelector('._phase_x').firstChild.nodeValue = 'PLANNING';
    d.querySelector('._statusCopy_x strong').firstChild.nodeValue = 'Selecting';
    d.querySelector('._tieBreaker_x').src = '/icons/orange.png';
    view.phase = 'PLANNING';
    await tick();
    assert.equal(d.querySelector('.m2-phase').textContent, 'PLANNING');
    assert.equal(d.querySelector('.m2-status').textContent, 'Selecting');
    assert.equal(d.querySelector('.m2-coin small').textContent, 'ORANGE');

    let oldClicks = 0,
      newClicks = 0;
    const native = tip.querySelector(':scope>button');
    native.onclick = () => oldClicks++;
    native.disabled = true;
    proxies()[0].click();
    assert.equal(oldClicks, 0, 'native availability is checked even before the next frame');
    await tick();
    assert(proxies().every((button) => button.disabled));
    native.disabled = false;
    native.firstChild.nodeValue = 'Movement 5';
    await tick();
    assert(proxies().every((button) => button.textContent === 'Movement 5' && !button.disabled));
    const replacement = d.createElement('button');
    replacement.textContent = 'Movement 5';
    replacement.onclick = () => newClicks++;
    native.replaceWith(replacement);
    await tick();
    proxies()[0].click();
    assert.equal(oldClicks, 0);
    assert.equal(newClicks, 1, 'replacement native button receives the action');
    assert.equal(
      d.querySelector('#goa2-m2-details .m2-card-art img'),
      art,
      'button changes preserve card artwork',
    );
    assert.equal(d.querySelector('#goa2-m2-details .m2-card-dismiss'), dismiss);

    const settled = w.refreshes;
    await tick();
    assert.equal(w.refreshes, settled, 'action reconciliation settles without a feedback loop');
    // Native class changes still refresh even when the row also has our classes.
    const node = d.querySelector('aside>section');
    node.classList.add('_selected_x');
    await tick();
    assert(w.refreshes > settled);

    const retainedProxy = proxies()[0];
    replacement.remove();
    retainedProxy.click();
    assert.equal(newClicks, 1, 'a retained proxy cannot click a detached native control');
    await tick();
    assert.equal(proxies().length, 0, 'removed native controls become read-only secondary stats');
    assert.equal(d.querySelector('#goa2-m2-details .m2-card-art img'), art);
    assert.equal(d.querySelector('#goa2-m2-details .m2-card-dismiss'), dismiss);
    console.log(
      'PASS: native text/src/disabled/replacement updates, stable artwork, no idle feedback and colored off-board rings',
    );
  } finally {
    w.GOA2Mobile2D.destroy();
    w.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
