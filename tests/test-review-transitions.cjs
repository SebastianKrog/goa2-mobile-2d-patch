const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

async function until(predicate) {
  for (let i = 0; i < 50; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('Expected navigation transition did not settle');
}
function setup(t) {
  const f = browserFixture({
    html: `<header class="_bar_test"><span class="_phase_test">PLANNING</span></header>
      <div class="_boardArea_test"><div aria-label="Starting position"><button>Change starting position</button></div></div>
      <aside class="_sidebar_test"><section><div class="_name_test">Emmitt (You)</div><div class="_details_test">Lv 3</div></section></aside>`,
    hooks: ['refresh', 'renderSummary'],
  });
  t.after(() => f.close());
  return f;
}
function summaryHero(id = 'hero_emmitt') {
  return {
    id,
    name: id,
    isOwn: true,
    level: 3,
    gold: 0,
    detail: '',
    dots: [],
    cardPiles: [],
    piles: [],
    upgrades: {},
    planning: true,
    committed: false,
    clock: { text: '9.9s', label: 'Clock 9.9s', running: true, tone: '', paused: false },
  };
}

test('sub-second clock updates retain compact rows, scroll and focused controls through clock state changes', (t) => {
  const f = setup(t),
    { d, w } = f;
  f.install();
  const hero = summaryHero();
  w.testUI.renderSummary([hero]);
  const row = d.querySelector('#goa2-m2-summary article');
  const clock = row.querySelector('.m2-summary-turn');
  const control = row.querySelector('[aria-label="Open your Hand"]');
  row.scrollLeft = 50;
  control.focus();
  for (const [text, tone, running, paused] of [
    ['9.8s', '', true, false],
    ['0.1s', 'critical', true, false],
    ['19:59', '', true, false],
    ['19:59', '', false, true],
    ['✓', '', false, false],
  ]) {
    hero.clock = { text, label: 'Clock ' + text, tone, running, paused };
    w.testUI.renderSummary([hero]);
    assert.equal(d.querySelector('#goa2-m2-summary article'), row);
    assert.equal(row.querySelector('.m2-summary-turn'), clock);
    assert.equal(clock.textContent, text);
    assert.equal(clock.dataset.tone, tone);
    assert.equal(clock.dataset.running, String(running));
    assert.equal(row.scrollLeft, 50);
    assert.equal(d.activeElement, control);
  }
  hero.clock = null;
  w.testUI.renderSummary([hero]);
  assert(clock.querySelector('.m2-selecting-dots'));
  assert(!clock.classList.contains('m2-summary-clock'));
  assert(!clock.hasAttribute('data-tone'));
  assert.equal(d.activeElement, control);
  hero.resolving = true;
  hero.planning = false;
  hero.resolution = { order: 2, position: 2, initiative: 9 };
  w.testUI.renderSummary([hero]);
  const resolvedRow = d.querySelector('#goa2-m2-summary article');
  const turn = resolvedRow.querySelector('.m2-summary-turn');
  assert.equal(turn.firstElementChild.textContent, '2.');
  hero.clock = { text: '5.4s', label: 'Clock 5.4s', running: true, tone: 'warning' };
  w.testUI.renderSummary([hero]);
  assert.equal(turn.textContent, '5.4s');
  hero.clock.running = false;
  w.testUI.renderSummary([hero]);
  assert.equal(turn.firstElementChild.textContent, '2.');
  assert.equal(d.querySelector('#goa2-m2-summary article'), resolvedRow);
});

test('Position → Back → Done and native Done synchronize without reopening setup', async (t) => {
  const f = setup(t),
    { d, w } = f;
  const source = d.querySelector('[aria-label="Starting position"] button');
  const props = { choosing: false };
  source.parentElement.__reactFiber$test = { memoizedProps: props };
  source.onclick = () => {
    // Match React's delayed commit: navigation runs before the new label appears.
    const next = !props.choosing;
    w.setTimeout(() => {
      props.choosing = next;
      source.textContent = next ? 'Done adjusting' : 'Change starting position';
      w.testUI.refresh();
    }, 0);
  };
  f.install();
  const launcher = () =>
    [...d.querySelectorAll('.m2-choice-launchers button')].find((button) =>
      /^(Position|Done)$/.test(button.textContent),
    );
  launcher().click();
  assert.equal(d.documentElement.dataset.m2Panel, 'setup');
  await until(() => props.choosing);
  w.history.back();
  await until(() => d.documentElement.dataset.m2Panel === '');
  assert(props.choosing, 'Back hides the panel without submitting a position action');
  assert.equal(launcher().textContent, 'Done');
  launcher().click();
  await until(() => !props.choosing);
  assert.equal(d.documentElement.dataset.m2Panel, '');
  assert(!w.history.state?.goa2Mobile2DMenu);
  launcher().click();
  await until(() => props.choosing);
  assert.equal(d.documentElement.dataset.m2Panel, 'setup');
  source.click();
  await until(() => !props.choosing && d.documentElement.dataset.m2Panel === '');
  await until(() => !w.history.state?.goa2Mobile2DMenu);
});

test('deactivating mobile retires its history entry so desktop Back reaches the previous page', async (t) => {
  const f = setup(t),
    { d, w, media } = f;
  w.history.replaceState({ page: 'previous' }, '', '/previous');
  w.history.pushState({ page: 'game' }, '', '/game/test?3d=0');
  f.install();
  d.querySelector('[data-mode="hand"]').click();
  assert(w.history.state.goa2Mobile2DMenu);
  media.matches = false;
  w.testUI.refresh();
  assert(!d.documentElement.hasAttribute('data-m2-active'));
  await until(() => w.history.state?.page === 'game' && !w.history.state?.goa2Mobile2DMenu);
  w.history.back();
  await until(() => w.location.pathname === '/previous');
});

test('rapid mobile reactivation while history cleanup is pending creates exactly one new entry', async (t) => {
  const f = setup(t),
    { d, w, media } = f;
  w.history.replaceState({ page: 'game' }, '');
  f.install();
  d.querySelector('[data-mode="heroes"]').click();
  media.matches = false;
  w.testUI.refresh();
  media.matches = true;
  w.testUI.refresh();
  await until(() => w.history.state?.goa2Mobile2DMenu);
  // Wait for the queued Back/forward-entry replacement to complete.
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(d.documentElement.dataset.m2Mode, 'heroes');
  assert(w.history.state.goa2Mobile2DMenu);
  w.history.back();
  await until(() => d.documentElement.dataset.m2Mode === 'board');
  assert.equal(w.history.state.page, 'game');
  assert(!w.history.state.goa2Mobile2DMenu);
});

for (const name of ['Emmitt', 'Gydion']) {
  test(
    name + ' data and hidden-card boundaries survive timed navigation and deactivation',
    async (t) => {
      const f = setup(t),
        { d, w, media } = f;
      const card = (id, facedown = false) => ({
        id,
        name: id,
        color: 'BLUE',
        tier: 'I',
        primary_action: 'SKILL',
        secondary_actions: { DEFENSE: 3 },
        is_facedown: facedown,
      });
      const hero = {
        id: 'hero_' + name.toLowerCase(),
        name,
        level: 3,
        gold: 0,
        items: {},
        hand: [],
        played_cards: [],
        discard_pile: [],
        current_turn_card: card('Committed'),
        ...(name === 'Emmitt'
          ? { extra_turn_card: card('Second commitment') }
          : { cast_spells: [card('Public spell')], spellbook: { count: 4 } }),
      };
      const opponent = {
        ...hero,
        id: hero.id + '_other',
        name: 'Opponent',
        current_turn_card: card('Private commitment', true),
        extra_turn_card: name === 'Emmitt' ? card('Private second commitment', true) : null,
        hand: [],
        deck: { count: 9 },
        spellbook: { count: 4 },
      };
      const opponentBox = d.createElement('section');
      opponentBox.innerHTML =
        '<div class="_name_test">Opponent</div><div class="_details_test">Lv 3</div>';
      opponentBox.__reactFiber$test = { memoizedProps: { hero: opponent } };
      d.querySelector('aside').append(opponentBox);
      const snapshot = JSON.stringify(hero);
      const section = d.querySelector('section');
      section.__reactFiber$test = { memoizedProps: { hero } };
      d.querySelector('aside').__reactFiber$test = {
        memoizedProps: { view: { phase: 'PLANNING', turn: 1 } },
      };
      f.install();
      d.querySelector('[data-mode="heroes"]').click();
      section.querySelector('.m2-current-card-mini, .m2-current-card-pair button').click();
      assert(d.querySelector('#goa2-m2-hero-display .m2-text-card'));
      w.history.back();
      await until(() => d.documentElement.dataset.m2Mode === 'board');
      const summary = summaryHero(hero.id);
      w.testUI.renderSummary([summary]);
      const row = d.querySelector('#goa2-m2-summary article');
      const identity = row.querySelector('.m2-summary-identity');
      identity.focus();
      row.scrollLeft = 37;
      summary.clock.text = '9.8s';
      w.testUI.renderSummary([summary]);
      assert.equal(d.activeElement, identity);
      assert.equal(row.scrollLeft, 37);
      media.matches = false;
      w.testUI.refresh();
      await until(() => !w.history.state?.goa2Mobile2DMenu);
      media.matches = true;
      w.testUI.refresh();
      assert.equal(
        JSON.stringify(hero),
        snapshot,
        'private/public special-hero data is never mutated',
      );
      assert.equal(
        opponentBox.querySelector('.m2-current-card-mini'),
        null,
        'a hidden opponent commitment cannot become inspectable after layout changes',
      );
      assert(!d.querySelector('#goa2-m2-summary').textContent.includes('Private commitment'));
      assert(
        !d.querySelector('#goa2-m2-hero-display .m2-text-card'),
        'dismissed inspection stays closed',
      );
    },
  );
}
