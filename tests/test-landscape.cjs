const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');
const { selectScreenMedia, landscapeQuery } = require('./helpers/screen-media.cjs');

function setup(t, initialWidth = 844, initialHeight = 360, initialCoarse = true) {
  const fixture = browserFixture({
    html: `<div class="_layout_test"><header class="_bar_test">
      <div class="_matchMeta_test"><span>ROUND 2</span><span class="_phase_test">PLANNING</span><span>TURN 1</span></div>
      <img class="_tieBreaker_test" src="/icons/coin_blue.png">
      <section aria-label="Red team has 6 life remaining"><span class="_lifeScore_test"></span></section>
      <section aria-label="Blue team has 6 life remaining"><span class="_lifeScore_test"></span></section>
      <div class="_statusCopy_test"><strong>Select a card</strong><span class="_statusDetail_test">Waiting for players</span></div>
      </header><main class="_main_test"><div class="_boardArea_test"><div><svg class="_svg_test"></svg><button class="_zoomReset_test">100% Reset</button></div>
      <div aria-label="Starting position"><button>Done adjusting</button></div></div>
      <aside class="_sidebar_test"><section class="own"><div class="_name_test">Test · Player (You)</div><div class="_details_test">Lv 4</div></section>
      <section class="other"><div class="_name_test">Other · Player</div><div class="_details_test">Lv 4</div></section>
      <div><div class="_label_test">Hand</div><div class="_row_test"><span class="_cardName_test">Card</span></div></div>
      <div><button>Commit</button></div></aside></main></div>
      <div class="_backdrop_test"><div class="_modal_test"><div class="_tierGroup_test"><div class="_cardGrid_test"></div></div></div></div>`,
    hooks: ['refresh'],
  });
  t.after(() => fixture.close());
  const { w, d, media } = fixture;
  let width = initialWidth,
    height = initialHeight,
    coarse = initialCoarse,
    activationQuery,
    nativeClicks = 0;
  Object.defineProperties(w, {
    innerWidth: { get: () => width },
    innerHeight: { get: () => height },
  });
  w.matchMedia = (query) => {
    activationQuery = query;
    media.matches = width <= 900 || (width > height && width <= 1200 && height <= 600 && coarse);
    return media;
  };
  w.HTMLCanvasElement.prototype.getContext = () => ({
    drawImage() {},
    fillRect() {},
    fillText() {},
  });
  w.document.fonts = { load: () => new Promise(() => {}), ready: Promise.resolve() };
  const cards = [];
  for (const color of ['RED', 'BLUE', 'GREEN'])
    for (const tier of ['I', 'II', 'III'])
      for (const variant of tier === 'I' ? ['A'] : ['A', 'B'])
        cards.push({
          id: color + tier + variant,
          name: color + ' ' + tier + ' ' + variant,
          image_id: color.toLowerCase() + tier + variant,
          color,
          tier,
          initiative: 6,
          primary_action: 'ATTACK',
          primary_action_value: 4,
          secondary_actions: { MOVEMENT: 3, DEFENSE: 2 },
          item: variant === 'A' ? 'ATTACK' : 'DEFENSE',
          effect_text: 'Printed rules.',
        });
  const hero = {
      id: 'hero_test',
      name: 'Test',
      team: 'RED',
      level: 4,
      gold: 2,
      items: {},
      deck: cards,
      hand: cards.filter((card) => card.tier === 'I'),
      played_cards: [],
      discard_pile: [],
    },
    other = { ...hero, id: 'hero_other', name: 'Other', team: 'BLUE' },
    view = {
      phase: 'PLANNING',
      round: 2,
      turn: 1,
      teams: { RED: { heroes: [hero], minions: [] }, BLUE: { heroes: [other], minions: [] } },
      board: { entity_locations: { hero_test: {}, hero_other: {} } },
    },
    row = d.querySelector('._row_test'),
    modal = d.querySelector('._modal_test');
  d.querySelector('.own').__reactFiber$test = { memoizedProps: { hero } };
  d.querySelector('.other').__reactFiber$test = { memoizedProps: { hero: other } };
  d.querySelector('aside').__reactFiber$test = { memoizedProps: { view } };
  modal.__reactFiber$test = { memoizedProps: { hero } };
  row.__reactFiber$test = { memoizedProps: { card: cards[0] } };
  row.onclick = () => nativeClicks++;
  for (const card of cards) {
    const canvas = d.createElement('canvas');
    canvas.__reactFiber$test = { memoizedProps: { card } };
    d.querySelector('._cardGrid_test').append(canvas);
  }
  fixture.install();
  function screen(nextWidth = width, nextHeight = height, nextCoarse = coarse) {
    width = nextWidth;
    height = nextHeight;
    coarse = nextCoarse;
    media.matches = width <= 900 || (width > height && width <= 1200 && height <= 600 && coarse);
    const enabled = new Set();
    if (height <= 500) enabled.add('(max-height: 500px)');
    if (width <= 360) enabled.add('(max-width: 360px)');
    if (width > height && width >= 600 && width <= 1200 && height <= 600)
      enabled.add(landscapeQuery);
    selectScreenMedia(d.getElementById('goa2-m2-style'), enabled);
    w.testUI.refresh();
  }
  screen();
  const css = (selector) => w.getComputedStyle(d.querySelector(selector));
  const navigate = (mode) => d.querySelector('#goa2-m2-nav [data-mode="' + mode + '"]').click();
  return {
    ...fixture,
    screen,
    css,
    navigate,
    row,
    modal,
    activationQuery: () => activationQuery,
    nativeClicks: () => nativeClicks,
  };
}

test('phone landscape keeps a full-width Board beneath floating summaries/focus and a far-right navigation rail', (t) => {
  const { d, css } = setup(t);
  assert.equal(css('[data-m2="main"]').flexDirection, 'row');
  assert.equal(css('[data-m2="board"]').width, '100%');
  assert.equal(css('[data-m2="sidebar"]').width, 'var(--m2-list-width)');
  assert.equal(css('[data-m2="sidebar"]').position, 'absolute');
  assert.equal(css('#goa2-m2-summary').backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(css('#goa2-m2-nav').width, 'var(--m2-nav-width)');
  assert.equal(css('#goa2-m2-nav').gridAutoRows, 'minmax(44px, 1fr)');
  assert.equal(css('#goa2-m2-nav').overflowY, 'auto');
  assert.equal(css('#goa2-m2-nav button').minHeight, '44px');
  assert.equal(css('[data-m2="layout"]').paddingBottom, '0px');
  assert.equal(css('#goa2-m2-summary').top, 'var(--m2-head)');
  assert.equal(css('#goa2-m2-summary').right, 'var(--m2-nav-width)');
  assert.equal(css('#goa2-m2-summary').maxHeight, 'none');
  d.querySelector('.m2-summary-identity').click();
  assert(d.querySelector('#goa2-m2-summary').classList.contains('m2-summary-focused'));
  assert.equal(css('#goa2-m2-summary').width, 'var(--m2-list-width)');
  assert.equal(css('#goa2-m2-summary').overflowY, 'auto');
  d.querySelector('.m2-focus-back').click();
  assert(!d.querySelector('#goa2-m2-summary').classList.contains('m2-summary-focused'));
});

test('corner counters and centered coin stay above the map strip with a stable disconnect dot and stacked board controls', (t) => {
  const { w, d, css } = setup(t);
  assert.equal(css('.m2-minions.red').position, 'static');
  assert.equal(css('.m2-minions.red').gridColumn, '2');
  assert.equal(css('.m2-minions.blue').gridColumn, '6');
  assert.equal(css('.m2-waves').gridColumn, '5');
  assert.equal(css('.m2-waves').justifySelf, 'start');
  assert.equal(css('.m2-round').gridColumn, '3');
  assert.equal(css('.m2-round').justifySelf, 'end');
  assert.equal(css('.m2-life.blue').gridColumn, '7');
  assert.equal(css('.m2-coin').gridColumn, '4');
  assert.equal(css('.m2-hud-bottom').top, 'var(--m2-head)');
  assert(css('.m2-hud-bottom').right.includes('var(--m2-list-width)'));
  assert.equal(css('.m2-board-controls').top, 'calc(var(--m2-status-h, 22px) + 6px)');
  assert.equal(css('.m2-board-controls').flexDirection, 'column');
  assert.equal(css('.m2-board-controls').left, '8px');
  assert.equal(css('.m2-board-controls').right, 'auto');
  assert.equal(css('.m2-board-controls').alignItems, 'flex-start');
  assert.equal(css('[data-m2="header"]').overflow, 'visible');
  assert(
    Number(css('[data-m2="header"]').zIndex) > Number(css('.m2-hud-bottom').zIndex),
    'protruding icons paint above the sibling status strip',
  );
  const viewer = d.querySelector('#goa2-m2-hero-display');
  viewer.append(d.createElement('div'));
  assert(
    Number(css('#goa2-m2-hero-display').zIndex) > Number(css('[data-m2="header"]').zIndex),
    'visible card viewers retain their overlay priority',
  );
  viewer.replaceChildren();
  assert.equal(css('[data-m2="header"]').paddingTop, '1px');
  assert.equal(css('.m2-hud-top').height, '25px');
  assert.equal(css('.m2-hud-top').gridTemplateRows, '25px');
  for (const selector of [
    '.m2-life.red',
    '.m2-life.blue',
    '.m2-minions.red',
    '.m2-minions.blue',
    '.m2-coin',
    '.m2-waves',
  ]) {
    assert.equal(
      css(selector).transform,
      'translateY(5px)',
      'move each icon and its overlaid label together',
    );
  }
  assert.notEqual(css('.m2-round').transform, 'translateY(5px)');
  assert.equal(
    css('.m2-coin img').height,
    '32px',
    'coin retains its size beyond the slim background',
  );
  const before = css('.m2-hud-bottom').gridTemplateColumns,
    dot = d.querySelector('.m2-action-dot');
  const warning = d.createElement('div');
  warning.className = '_disconnected_test';
  warning.textContent = 'Disconnected — Reconnecting…';
  d.body.append(warning);
  w.testUI.refresh();
  assert.equal(d.querySelector('.m2-phase').textContent, 'DISCONNECTED');
  assert.equal(css('.m2-hud-bottom').gridTemplateColumns, before);
  assert.equal(d.querySelector('.m2-action-dot'), dot);
  warning.remove();
  w.testUI.refresh();
  assert.equal(d.querySelector('.m2-phase').textContent, 'PLANNING');
});

test('landscape choices stack below the left controls, follow fullscreen availability and retain portrait positions', (t) => {
  const { w, d, css, screen } = setup(t);
  const root = d.documentElement,
    header = d.querySelector('[data-m2="header"]');
  let headerHeight = 27,
    clicks = 0;
  header.getBoundingClientRect = () => ({ height: headerHeight });
  for (const label of ['Upgrades', 'Options']) {
    const button = d.createElement('button');
    button.textContent = label;
    button.onclick = () => clicks++;
    d.querySelector('[data-m2="board"]').append(button);
  }
  w.testUI.refresh();
  const stack = () => w.getComputedStyle(root).getPropertyValue('--m2-control-stack-h').trim();
  assert.equal(
    root.style.getPropertyValue('--m2-head'),
    '27px',
    'measure the real header background, not oversized icons',
  );
  assert.equal(stack(), '40px', 'one 34px control plus 6px spacing');
  assert.equal(css('.m2-choice-launchers').left, '8px');
  assert.equal(css('.m2-choice-launchers').flexDirection, 'column');
  assert.equal(css('.m2-choice-launchers').alignItems, 'flex-start');
  assert.equal(
    css('.m2-choice-launchers').top,
    'calc(var(--m2-status-h, 22px) + 6px + var(--m2-control-stack-h))',
  );
  const proxy = [...d.querySelectorAll('.m2-choice-launchers button')].find(
    (button) => button.textContent === 'Upgrades',
  );
  proxy.click();
  assert.equal(clicks, 1);
  Object.defineProperty(d, 'fullscreenEnabled', { value: true, configurable: true });
  root.requestFullscreen = async () => {};
  w.testUI.refresh();
  assert.equal(stack(), '78px', 'two 34px controls, 4px internal gap and 6px spacing');
  assert.equal(
    [...d.querySelectorAll('.m2-choice-launchers button')].find(
      (button) => button.textContent === 'Upgrades',
    ),
    proxy,
  );
  headerHeight = 40;
  screen(393, 760);
  assert.equal(root.style.getPropertyValue('--m2-head'), '40px');
  assert.equal(css('.m2-hud-top').height, '36px');
  for (const selector of [
    '.m2-life.red',
    '.m2-life.blue',
    '.m2-minions.red',
    '.m2-minions.blue',
    '.m2-coin',
    '.m2-waves',
  ]) {
    assert.notEqual(css(selector).transform, 'translateY(5px)', 'restore portrait icon positions');
  }
  assert.equal(css('[data-m2="header"]').overflow, 'hidden');
  assert.equal(css('[data-m2="header"]').zIndex, '80');
  assert.equal(css('[data-m2="header"]').paddingTop, '2px');
  assert.equal(css('.m2-board-controls').right, '8px');
  assert.notEqual(css('.m2-board-controls').left, '8px');
  assert.equal(css('.m2-choice-launchers').left, '10px');
  assert.equal(css('.m2-choice-launchers').top, 'calc(var(--m2-status-h, 22px) + 6px)');
  headerHeight = 27;
  screen(844, 360);
  assert.equal(root.style.getPropertyValue('--m2-head'), '27px');
  assert.equal(css('.m2-coin').transform, 'translateY(5px)');
  Object.defineProperty(d, 'fullscreenEnabled', { value: false });
  w.testUI.refresh();
  assert.equal(stack(), '40px', 'removing fullscreen removes its reserved spacing');
});

test('Hand and Heroes keep lists beside the left viewer and retain native row actions through rotation', (t) => {
  const { w, d, css, navigate, row, screen, nativeClicks } = setup(t);
  const parent = row.parentElement;
  navigate('hand');
  row.classList.add('_selected_test');
  row.click();
  w.testUI.refresh();
  const viewer = d.querySelector('#goa2-m2-details'),
    card = viewer.firstElementChild;
  assert(card);
  assert(row.hasAttribute('data-m2-viewed'));
  assert.equal(css('#goa2-m2-details').inset, '6px calc(var(--m2-list-width) + 6px) auto 6px');
  assert.equal(css('#goa2-m2-details').height, 'var(--m2-card-display-height)');
  assert.equal(css('[data-m2="sidebar"]').display, 'flex');
  screen(393, 760);
  assert.equal(css('[data-m2="main"]').flexDirection, 'column');
  assert.equal(css('#goa2-m2-nav').height, 'var(--m2-nav)');
  assert.equal(viewer.firstElementChild, card, 'rotation preserves inspected content');
  assert(row.hasAttribute('data-m2-viewed'));
  assert.equal(row.parentElement, parent, 'native rows are never moved');
  screen(844, 360);
  assert.equal(css('[data-m2="main"]').flexDirection, 'row');
  assert.equal(viewer.firstElementChild, card);
  assert.equal(nativeClicks(), 1, 'rotation never submits a game action');
  navigate('heroes');
  assert.equal(css('[data-m2="sidebar"]').width, 'var(--m2-list-width)');
  assert.equal(css('#goa2-m2-details').display, 'none');
  assert(!row.hasAttribute('data-m2-viewed'));
  navigate('hand');
  assert(row.hasAttribute('data-m2-viewed'));
  viewer.querySelector('.m2-card-dismiss').click();
  assert(!row.hasAttribute('data-m2-viewed'));
  w.GOA2Mobile2D.destroy();
  assert(!row.classList.contains('m2-card-source'));
  assert(!row.hasAttribute('data-m2-viewed'));
});

test('landscape centers the map in the left area through view changes and Reset; portrait keeps its vertical panes', (t) => {
  const { w, d, css, navigate, screen } = setup(t);
  const board = d.querySelector('[data-m2="board"]'),
    svg = board.querySelector('svg'),
    parent = svg.parentElement;
  svg.style.transform = 'translate(12px, 20px) scale(2)';
  w.testUI.refresh();
  const basis = css('[data-m2="board"]').flexBasis;
  const offset = 'calc(var(--m2-list-width) / -2) 0';
  assert.equal(css('svg').translate, offset);
  for (const mode of ['hand', 'heroes', 'deck', 'log', 'tools', 'setup']) {
    navigate(mode);
    assert.equal(css('[data-m2="board"]').width, '100%', mode);
    assert.equal(css('[data-m2="board"]').flexBasis, basis, mode);
    assert.notEqual(css('[data-m2="board"]').display, 'none', mode);
    assert.equal(css('svg').translate, offset, mode);
    assert.equal(svg.parentElement, parent);
    assert.equal(svg.style.transform, 'translate(12px, 20px) scale(2)');
    assert.equal(parent.style.getPropertyValue('--m2-native-transform'), svg.style.transform);
  }
  navigate('setup'); // Toggle the last open pane off to return to Board.
  assert.equal(d.documentElement.dataset.m2Mode, 'board');
  parent.querySelector('._zoomReset_test').onclick = () => {
    svg.style.transform = '';
  };
  d.querySelector('.m2-board-controls button').click();
  assert.equal(svg.style.transform, '');
  assert.equal(css('svg').translate, offset, 'Reset returns to the left-area center');
  assert.equal(
    parent.style.getPropertyValue('--m2-native-transform'),
    'translate(0px,0px) scale(1)',
  );
  screen(393, 760);
  navigate('hand');
  assert.equal(css('svg').translate, 'none', 'portrait has no landscape offset');
  assert.equal(css('[data-m2="main"]').flexDirection, 'column');
  // jsdom cannot expand a flex shorthand containing an unresolved variable.
  const boardRules = [...d.getElementById('goa2-m2-style').sheet.cssRules].filter(
    (rule) => rule.selectorText && board.matches(rule.selectorText) && rule.style.flex,
  );
  assert.equal(boardRules.at(-1).style.flex, '0 0 var(--m2-board-pane-height)');
  assert.equal(
    w.getComputedStyle(d.documentElement).getPropertyValue('--m2-board-pane-height').trim(),
    'calc(var(--m2-card-display-height) + 8px)',
  );
  screen(844, 360);
  assert.equal(css('svg').translate, offset);
});

test('board fullscreen toggle shares Settings state, handles external exits/rejection and prevents pending double requests', async (t) => {
  const { w, d, navigate } = setup(t);
  const boardButton = d.querySelector('.m2-board-fullscreen');
  assert(boardButton.hidden);
  let fullscreen = null,
    enters = 0,
    exits = 0,
    finish;
  Object.defineProperties(d, {
    fullscreenEnabled: { value: true },
    fullscreenElement: { get: () => fullscreen },
  });
  d.documentElement.requestFullscreen = () => {
    enters++;
    return new Promise((resolve) => {
      finish = () => {
        fullscreen = d.documentElement;
        resolve();
      };
    });
  };
  d.exitFullscreen = async () => {
    exits++;
    fullscreen = null;
  };
  w.testUI.refresh();
  assert(!boardButton.hidden);
  assert.equal(
    boardButton.previousElementSibling.getAttribute('aria-label'),
    'Reset board zoom, pan and rotation',
  );
  boardButton.click();
  boardButton.click();
  assert.equal(enters, 1);
  assert(boardButton.disabled);
  finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(boardButton.getAttribute('aria-pressed'), 'true');
  assert.equal(d.querySelector('[data-setting="fullscreen"]').getAttribute('aria-checked'), 'true');
  fullscreen = null;
  d.dispatchEvent(new w.Event('fullscreenchange'));
  assert.equal(boardButton.getAttribute('aria-pressed'), 'false');
  assert.equal(boardButton.textContent, 'Fullscreen');
  d.documentElement.requestFullscreen = async () => {
    enters++;
    fullscreen = d.documentElement;
  };
  navigate('tools');
  d.querySelector('[data-setting="fullscreen"]').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(boardButton.getAttribute('aria-pressed'), 'true');
  boardButton.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(exits, 1);
  assert.equal(boardButton.getAttribute('aria-pressed'), 'false');
  d.documentElement.requestFullscreen = async () => {
    throw new Error('Fullscreen denied');
  };
  boardButton.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(boardButton.getAttribute('aria-pressed'), 'false');
  assert(!boardButton.disabled, 'rejected requests restore the toggle');
});

test('Settings, Log and starting-position controls occupy the right pane above the viewport offset', (t) => {
  const { w, d, css, navigate } = setup(t);
  for (const [mode, selector] of [
    ['tools', '#goa2-m2-settings'],
    ['log', '#goa2-m2-log'],
    ['setup', '[data-m2="setup"]'],
  ]) {
    navigate(mode);
    assert.equal(css(selector).right, 'var(--m2-nav-width)');
    assert.equal(css(selector).width, 'var(--m2-list-width)');
    assert.equal(css(selector).top, 'var(--m2-head)');
    assert.equal(css('[data-m2="board"]').visibility, 'visible');
  }
  const viewport = new w.EventTarget();
  viewport.height = 250;
  viewport.offsetTop = 0;
  Object.defineProperty(w, 'visualViewport', { value: viewport });
  w.testUI.refresh();
  assert.equal(d.documentElement.style.getPropertyValue('--m2-vh'), '250px');
  assert.equal(d.documentElement.style.getPropertyValue('--m2-offset'), '110px');
  assert.equal(css('#goa2-m2-nav').bottom, 'var(--m2-offset, 0px)');
});

test('Deck Tree/List use a left viewer; Grid keeps its cards and image enlargement in separate panes', (t) => {
  const { d, css, navigate } = setup(t);
  navigate('deck');
  assert.equal(css('.m2-deck-browser').display, 'grid');
  assert.equal(css('.m2-deck-preview').gridColumn, '1');
  assert.equal(css('.m2-deck-preview').gridRow, '1 / -1');
  assert.equal(css('.m2-deck-row-list').gridColumn, '2');
  assert.equal(css('.m2-tree-build').gridRow, '3');
  d.querySelector('.m2-tree-card').click();
  assert(d.querySelector('.m2-tree-card[data-m2-viewed]'));
  assert(d.querySelector('.m2-deck-preview .m2-text-card'));
  const options = () => [...d.querySelectorAll('.m2-deck-controls button')];
  options()
    .find((button) => button.textContent === 'List')
    .click();
  assert.equal(css('.m2-deck-preview').gridColumn, '1');
  assert(d.querySelector('.m2-deck-row-list .m2-deck-compact'));
  assert(
    d.querySelector('.m2-deck-compact [data-m2-viewed]'),
    'Tree to List retains the viewed card',
  );
  const cards = d.querySelectorAll('.m2-deck-compact button');
  cards[1].click();
  assert(cards[1].hasAttribute('data-m2-viewed'));
  assert(!cards[0].hasAttribute('data-m2-viewed'));
  options()
    .find((button) => button.textContent === 'Grid')
    .click();
  assert(d.querySelector('.m2-deck-row-list .m2-deck-grid'));
  assert(!d.querySelector('[data-m2-viewed]'), 'Grid starts with the image viewer closed');
  d.querySelector('.m2-deck-grid button').click();
  const zoom = d.querySelector('.m2-deck-zoom');
  assert.equal(zoom.hidden, false);
  assert(d.querySelector('.m2-deck-grid [data-m2-viewed]'));
  assert(css('.m2-deck-zoom').inset.includes('var(--m2-list-width)'));
  assert.equal(css('.m2-deck-zoom canvas').objectFit, 'contain');
  zoom.querySelector('button').click();
  assert.equal(zoom.hidden, true);
  assert(!d.querySelector('[data-m2-viewed]'));
});

test('wide rotated phones stay active while large tablets/desktops retain native layout; teardown restores all sources', (t) => {
  const { w, d, screen, activationQuery, row } = setup(t, 980, 400);
  assert(activationQuery().includes('(pointer:coarse)'));
  assert(d.documentElement.hasAttribute('data-m2-active'));
  for (const [width, height, coarse] of [
    [980, 400, false],
    [1024, 768, true],
    [1440, 420, true],
  ]) {
    screen(width, height, coarse);
    assert(!d.documentElement.hasAttribute('data-m2-active'));
  }
  screen(980, 400, true);
  assert(d.documentElement.hasAttribute('data-m2-active'));
  const parent = row.parentElement;
  w.GOA2Mobile2D.destroy();
  assert.equal(row.parentElement, parent);
  assert(!d.querySelector('#goa2-m2-style'));
  assert(!d.querySelector('#goa2-m2-nav'));
  assert(!d.querySelector('[data-m2]'));
  assert.equal(d.documentElement.style.getPropertyValue('--m2-vh'), '');
});

test('landscape reserves full H/P/D width and takes the space from names through rotation', (t) => {
  const { w, d, css, screen } = setup(t);
  const hero = d.querySelector('.own').__reactFiber$test.memoizedProps.hero;
  const hand = d.querySelector('[data-m2="hand-list"]');
  for (const card of hero.hand.slice(1)) {
    const row = d.createElement('div');
    row.className = '_row_test';
    row.innerHTML = '<span class="_cardName_test">' + card.name + '</span>';
    row.__reactFiber$test = { memoizedProps: { card } };
    hand.append(row);
  }
  hero.played_cards = hero.deck.filter((card) => card.tier === 'II').slice(0, 4);
  hero.discard_pile = hero.deck.filter((card) => card.tier === 'III').slice(0, 3);
  w.testUI.refresh();
  const summary = d.querySelector('#goa2-m2-summary');
  const expected = Math.ceil(24 + (3 + 4 + 3) * 5.5) + 'px';
  for (const [width, height] of [
    [600, 360],
    [844, 360],
    [1200, 600],
  ]) {
    screen(width, height);
    assert.equal(summary.style.getPropertyValue('--m2-piles-width'), expected);
    const article = css('#goa2-m2-summary > article');
    assert.notEqual(article.getPropertyValue('--m2-piles-width').trim(), '36px');
    assert.equal(article.getPropertyValue('--m2-name-min').trim(), '0px');
    assert.equal(css('.m2-summary-identity strong').flexShrink, '1');
    assert.equal(css('.m2-summary-identity strong').textOverflow, 'ellipsis');
    assert.equal(css('.m2-summary-piles > span').flexShrink, '0');
    assert.equal(summary.querySelector('.m2-summary-piles').textContent, 'HPD');
    assert.equal(summary.querySelectorAll('article:first-child .m2-summary-piles i').length, 10);
  }
  screen(393, 760);
  assert.equal(css('.m2-summary-identity strong').flexShrink, '0');
  assert.equal(css('.m2-summary-identity strong').textOverflow, 'clip');
  assert.equal(summary.style.getPropertyValue('--m2-piles-width'), expected);
  for (const width of [320, 360, 393]) {
    screen(width, 760);
    assert.equal(css('.m2-summary-piles').minWidth, 'max-content');
    assert.equal(css('.m2-summary-piles > span').flexShrink, '0');
    assert.equal(css('.m2-summary-piles').overflow, 'visible');
    assert(
      css('#goa2-m2-summary > article').gridTemplateColumns.includes(
        'minmax(var(--m2-piles-width, 48px), max-content)',
      ),
    );
  }
});
