const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function setup(t) {
  const fixture = browserFixture({
    html: `<div class="_layout_test"><header class="_bar_test">
      <div class="_matchMeta_test"><span>ROUND 1</span><span class="_phase_test">PLANNING</span><span>TURN 1</span></div>
      <img class="_tieBreaker_test" src="/icons/coin_blue.png">
      <section aria-label="Red team has 6 life remaining"><span class="_lifeScore_test"></span></section>
      </header><main class="_main_test"><div class="_boardArea_test"></div><aside class="_sidebar_test">
      <section><div class="_name_test">Hanu (You)</div><div class="_details_test">Lv 1</div>
      <div class="_modal_test"><div class="_cardGrid_test"><canvas></canvas></div></div></section>
      <div><div class="_label_test">Hand</div><div class="_row_test"><span class="_cardName_test">Card</span></div></div>
      </aside></main><div class="_gameToolsRow_test"><button>Options</button></div></div>`,
    hooks: ['refresh'],
  });
  t.after(() => fixture.close());
  const { w, d } = fixture;
  w.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
  const card = {
    id: 'card',
    name: 'Card',
    color: 'RED',
    tier: 'II',
    initiative: 4,
    primary_action: 'ATTACK',
    primary_action_value: 3,
    range_value: 2,
    secondary_actions: { MOVEMENT: 1, DEFENSE: 2 },
  };
  const hero = {
    id: 'hero_hanu',
    name: 'Hanu',
    team: 'BLUE',
    level: 1,
    gold: 3,
    items: {},
    hand: [card],
    played_cards: [card],
    discard_pile: [card],
    current_turn_card: card,
  };
  d.querySelector('aside>section').__reactFiber$test = { memoizedProps: { hero } };
  d.querySelector('aside').__reactFiber$test = {
    memoizedProps: {
      view: {
        phase: 'PLANNING',
        turn: 1,
        teams: { RED: { minions: [] }, BLUE: { minions: [] } },
        board: { entity_locations: { hero_hanu: {} } },
      },
    },
  };
  for (const element of [d.querySelector('._row_test'), d.querySelector('canvas')])
    element.__reactFiber$test = { memoizedProps: { card } };
  fixture.install();
  return fixture;
}

test('the stylesheet has one definition per selector and media context, with no empty rules', (t) => {
  const { d } = setup(t);
  const selectors = new Set();
  let rules = 0;
  function selectorList(text) {
    const list = [];
    let depth = 0;
    let start = 0;
    let quote = null;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quote) {
        if (char === '\\') i++;
        else if (char === quote) quote = null;
      } else if (char === '"' || char === "'") quote = char;
      else if (char === '(' || char === '[') depth++;
      else if (char === ')' || char === ']') depth--;
      else if (char === ',' && depth === 0) {
        list.push(text.slice(start, i).trim());
        start = i + 1;
      }
    }
    list.push(text.slice(start).trim());
    return list;
  }
  function walk(list, context = '') {
    for (const rule of list) {
      if (rule.conditionText) walk(rule.cssRules, context + ' / ' + rule.conditionText);
      else if (rule.selectorText) {
        assert(rule.style.length > 0, `empty CSS rule: ${rule.selectorText}`);
        // Split selector groups without splitting the arguments of :is/:has or
        // quoted attribute values, so overlapping groups cannot hide duplicates.
        for (const selector of selectorList(rule.selectorText)) {
          const key = context + ' / ' + selector.replace(/\s+/g, ' ');
          assert(!selectors.has(key), `duplicate CSS definition: ${key}`);
          selectors.add(key);
        }
        rules++;
      }
    }
  }
  walk(d.getElementById('goa2-m2-style').sheet.cssRules);
  assert(rules > 100, 'the generated stylesheet parsed, including component and media rules');
});

test('header overlays stay bold white, with smaller coin labels and an unchanged status dot', (t) => {
  const { w, d } = setup(t);
  for (const element of d.querySelectorAll('.m2-life b,.m2-minions b,.m2-waves b,.m2-coin small')) {
    const style = w.getComputedStyle(element);
    assert.equal(style.color, 'rgb(255, 255, 255)');
    assert.equal(style.fontWeight, '700');
    assert.equal(style.fontSize, element.matches('small') ? '13px' : '15px');
    assert(style.textShadow.includes('#000'));
  }
  const strip = d.querySelector('.m2-hud-bottom');
  for (const [selector, column] of [
    ['.m2-life.red', '1'],
    ['.m2-minions.red', '2'],
    ['.m2-minions.blue', '6'],
    ['.m2-life.blue', '7'],
  ]) {
    const style = w.getComputedStyle(d.querySelector(selector));
    assert.equal(style.gridColumn, column);
    assert.equal(style.position, 'static');
  }
  assert.equal(
    w.getComputedStyle(d.querySelector('.m2-hud-top')).gridTemplateColumns,
    '34px 32px minmax(44px, 1fr) 56px minmax(44px, 1fr) 32px 34px',
  );
  const columns = w.getComputedStyle(strip).gridTemplateColumns;
  const dotColor = w.getComputedStyle(strip.querySelector('.m2-action-dot')).color;
  const warning = d.createElement('div');
  warning.className = '_disconnected_test';
  warning.textContent = 'Disconnected — Reconnecting';
  d.body.append(warning);
  w.testUI.refresh();
  assert.equal(w.getComputedStyle(strip).gridTemplateColumns, columns);
  assert.equal(w.getComputedStyle(strip).backdropFilter, 'blur(3px)');
  assert.equal(w.getComputedStyle(strip.querySelector('.m2-action-dot')).color, dotColor);
});

test('shared Mini gutters and Micro state remain correct inside Hero and Board containers', (t) => {
  const { w, d } = setup(t);
  const miniBand = d.querySelector('[data-m2="hero"] .m2-mini-card > .m2-list-band');
  const miniStyle = w.getComputedStyle(miniBand);
  assert.equal(miniStyle.paddingLeft, '12px');
  assert.equal(miniStyle.paddingRight, '12px');
  assert.equal(miniStyle.paddingTop, '1px');
  const rowStyle = w.getComputedStyle(d.querySelector('._row_test'));
  assert.equal(rowStyle.padding, '0px 5px', 'adapted Hand rows do not regain native row padding');

  const summary = d.getElementById('goa2-m2-summary');
  const boardMicro = summary.querySelector('.m2-micro-board');
  assert.equal(w.getComputedStyle(boardMicro).width, '70px');
  assert.equal(w.getComputedStyle(boardMicro).flexShrink, '0');
  assert.equal(w.getComputedStyle(boardMicro).borderRadius, '2px');
  assert.equal(w.getComputedStyle(boardMicro).fontSize, '10px');
  assert.equal(w.getComputedStyle(boardMicro).color, 'rgb(221, 221, 221)');
  boardMicro.parentElement.classList.add('m2-card-resolved');
  assert.equal(
    w.getComputedStyle(boardMicro).getPropertyValue('--m2-tier-edge-color'),
    'var(--m2-card-muted)',
  );
  boardMicro.classList.add('m2-micro-hidden');
  assert.equal(w.getComputedStyle(boardMicro).display, 'flex');
  assert.equal(w.getComputedStyle(boardMicro).justifyContent, 'center');

  const row = summary.querySelector('article');
  row.classList.add('m2-current-hero');
  assert.equal(w.getComputedStyle(row).borderTopColor, 'rgb(109, 98, 68)');
  assert.equal(w.getComputedStyle(row).backgroundColor, 'rgba(37, 39, 42, 0.72)');
  row.classList.remove('m2-current-hero');
  row.classList.add('m2-done-hero');
  assert.equal(w.getComputedStyle(row).borderTopColor, 'rgb(48, 56, 68)');
  assert.equal(w.getComputedStyle(row).backgroundColor, 'rgba(23, 29, 38, 0.72)');
  row.querySelector('.m2-summary-identity').click();
  assert.equal(w.getComputedStyle(summary.querySelector('.m2-focus-back')).fontSize, '19px');
  const focused = summary.querySelector('.m2-focused-hero');
  assert.equal(w.getComputedStyle(focused).backdropFilter, 'blur(3px)');
  assert.equal(w.getComputedStyle(focused.querySelector('.m2-micro-hero')).width, '64px');
  const hero = d.querySelector('aside>section').__reactFiber$test.memoizedProps.hero;
  const view = d.querySelector('aside').__reactFiber$test.memoizedProps.view;
  hero.current_turn_card = null;
  hero.played_cards = [];
  for (const phase of ['PLANNING', 'RESOLUTION']) {
    view.phase = phase;
    w.testUI.refresh();
    const slot = summary.querySelector('.m2-focused-hero .m2-current-card-slot');
    assert(slot, `${phase} keeps the placeholder visible`);
    assert.equal(w.getComputedStyle(slot).backgroundColor, 'rgba(32, 39, 49, 0.35)');
    assert.equal(w.getComputedStyle(slot).height, '26px');
  }
  for (const mode of ['heroes', 'hand', 'board']) {
    d.documentElement.setAttribute('data-m2-mode', mode);
    assert.equal(
      w.getComputedStyle(d.documentElement).getPropertyValue('--m2-board-pane-height'),
      mode === 'board' ? '43%' : 'calc(var(--m2-card-display-height) + 8px)',
    );
  }
});

test('short/narrow and reduced-motion rules preserve overlay geometry and shared sizing', (t) => {
  const { w, d } = setup(t);
  const style = d.getElementById('goa2-m2-style');
  // jsdom does not evaluate screen media queries. Select these branches explicitly
  // to test their declarations and order at 320x480 with reduced motion enabled.
  const enabled = new Set([
    '(max-width: 360px)',
    '(max-height: 500px)',
    '(prefers-reduced-motion: reduce)',
  ]);
  const css = [...style.sheet.cssRules]
    .map((rule) =>
      rule.conditionText
        ? enabled.has(rule.conditionText)
          ? [...rule.cssRules].map((child) => child.cssText).join('\n')
          : ''
        : rule.cssText,
    )
    .join('\n');
  style.textContent = css;
  assert.equal(
    w.getComputedStyle(d.documentElement).getPropertyValue('--m2-card-display-height'),
    '164.8px',
  );
  assert.equal(w.getComputedStyle(d.querySelector('.m2-minions.red')).gridColumn, '2');
  assert.equal(w.getComputedStyle(d.querySelector('.m2-minions.blue')).gridColumn, '6');
  const effect = d.querySelector('.m2-micro-button');
  effect.classList.add('m2-effect-active');
  const dots = d.createElement('span');
  dots.className = 'm2-selecting-dots';
  d.body.append(dots);
  for (const element of [d.querySelector('.m2-action-dot'), effect, dots])
    assert.equal(w.getComputedStyle(element).animation, 'none');
  d.querySelector('[data-mode="hand"]').click();
  const row = d.querySelector('._row_test');
  row.classList.add('_selected_test');
  w.testUI.refresh();
  assert.equal(
    w.getComputedStyle(d.getElementById('goa2-m2-details')).height,
    'var(--m2-card-display-height)',
    'landscape Hand inspection shares the viewer height with every other pane',
  );
  assert.equal(w.getComputedStyle(d.querySelector('[data-m2="board"]')).visibility, 'visible');
});

test('navigation fits its touch targets without a blank band below the buttons', (t) => {
  const { w, d } = setup(t);
  const rules = [...d.getElementById('goa2-m2-style').sheet.cssRules];
  const root = rules.find((rule) => rule.selectorText === 'html[data-m2-active]');
  const nav = rules.find((rule) => rule.selectorText === 'html[data-m2-active] #goa2-m2-nav');
  const button = w.getComputedStyle(d.querySelector('#goa2-m2-nav button'));
  const navStyle = w.getComputedStyle(d.querySelector('#goa2-m2-nav'));
  const height = parseFloat(root.style.getPropertyValue('--m2-nav'));
  assert.equal(nav.style.getPropertyValue('height'), 'var(--m2-nav)');
  assert.equal(navStyle.paddingBottom, '0px');
  assert.equal(button.minHeight, '44px');
  assert.equal(
    height,
    parseFloat(navStyle.borderTopWidth) +
      parseFloat(navStyle.paddingTop) +
      parseFloat(button.minHeight),
    'the reserved footer height ends at the bottom of its 44px touch targets',
  );
  assert.equal(nav.style.getPropertyValue('bottom'), 'var(--m2-offset, 0px)');
});
