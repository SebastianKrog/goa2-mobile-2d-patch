const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function spell(index, prepared = false) {
  const color = ['Red', 'Blue', 'Green', 'Gold'][index % 4];
  return {
    id: 'spell-' + index,
    name: 'Spell ' + index,
    image_id: color + 'I' + index,
    spell_rank: index % 4,
    tier: 'UNTIERED',
    color: null,
    primary_action: null,
    initiative: 0,
    secondary_actions: {},
    effect_text: null,
    state: prepared ? 'SPELLBOOK' : 'OUTSIDE_SPELLBOOK',
    is_facedown: prepared,
  };
}
function setup(t) {
  const f = browserFixture({
    html: `<header class="_bar_t"><span class="_phase_t">PLANNING</span></header>
    <div class="_boardArea_t"></div><aside class="_sidebar_t">
    <section id="own"><div class="_name_t">Gydion · Me (You)</div><div class="_details_t">Lv 3</div></section>
    <section id="other"><div class="_name_t">Gydion · Opponent</div><div class="_details_t">Lv 3</div></section>
    <section id="snorri"><div class="_name_t">Snorri · Someone</div><div class="_details_t">Lv 3</div></section></aside>
    <div class="_modal_t"><div class="_header_t">Deck</div><div class="_cardGrid_t"><canvas></canvas></div></div>`,
    hooks: ['refresh', 'heroIndicators', 'uiState', 'spellColorName'],
  });
  t.after(() => f.close());
  f.w.HTMLCanvasElement.prototype.getContext = () => ({
    drawImage() {},
    fillRect() {},
    fillText() {},
  });
  const card = {
    id: 'normal',
    name: 'Normal card',
    color: 'RED',
    tier: 'I',
    initiative: 8,
    primary_action: 'ATTACK',
    primary_action_value: 3,
    secondary_actions: { DEFENSE: 2, MOVEMENT: 2 },
  };
  const hero = {
    id: 'hero_gydion',
    name: 'Gydion',
    team: 'RED',
    level: 3,
    gold: 0,
    items: {},
    hand: [],
    played_cards: [],
    discard_pile: [],
    current_turn_card: card,
    deck: [card],
    spellbook: [spell(12, true), spell(13, true), spell(14, true), spell(15, true)],
    cast_spells: [spell(0), spell(1)],
  };
  const other = {
    ...hero,
    id: 'other_gydion',
    deck: { count: 6 },
    spellbook: { count: 4 },
    cast_spells: [spell(2)],
  };
  const snorri = {
    ...hero,
    id: 'hero_snorri',
    name: 'Snorri',
    spellbook: null,
    cast_spells: [],
    rune_slots: { 1: 'bird' },
  };
  const view = {
    phase: 'PLANNING',
    turn: 1,
    effects: [],
    teams: { RED: { heroes: [hero, other, snorri] } },
    markers: {},
    hero_pieces: { piece: { id: 'piece', owner_hero_id: hero.id } },
  };
  for (const [id, h] of [
    ['own', hero],
    ['other', other],
    ['snorri', snorri],
  ])
    f.d.getElementById(id).__reactFiber$t = { memoizedProps: { hero: h } };
  f.d.querySelector('aside').__reactFiber$t = { memoizedProps: { view, myHeroId: hero.id } };
  f.d.querySelector('._modal_t').__reactFiber$t = { memoizedProps: { hero } };
  f.d.querySelector('canvas').__reactFiber$t = { memoizedProps: { card } };
  f.install();
  return { ...f, hero, other, snorri, view, refresh: () => f.w.testUI.refresh() };
}
const boardRow = (d, own = true) =>
  [...d.querySelectorAll('#goa2-m2-summary article')].find((row) =>
    row.textContent.includes(own ? '(You)' : 'Opponent'),
  );

test('markers resolve hero and piece targets, coexist with Gydion and shorten only crowded cards', (t) => {
  const { d, w, hero, view, refresh } = setup(t);
  assert.equal(d.querySelector('#snorri .m2-hero-played-label').textContent, 'Played:');
  assert.equal(d.querySelector('#own .m2-hero-played-label'), null);
  const current = () => d.querySelector('#own .m2-hero-current-mini');
  const height = w.getComputedStyle(current()).height;
  view.markers = {
    bounty: { target_id: hero.id, value: 3 },
    poison: { target_id: 'piece', value: 1 },
    rune: { target_id: hero.id },
    unknown: { target_id: hero.id },
  };
  refresh();
  assert.deepEqual(
    [...current().querySelectorAll('.m2-hero-indicator')].map((n) => n.getAttribute('aria-label')),
    ['Spells cast: 2', 'Bounty', 'Poison'],
  );
  assert.equal(current().querySelector('.m2-indicator-bounty').textContent, 'Bounty');
  assert.equal(
    w.getComputedStyle(current().querySelector('.m2-indicator-bounty')).color,
    'rgb(233, 201, 86)',
  );
  assert.equal(
    w.getComputedStyle(current().querySelector('.m2-indicator-poison')).color,
    'rgb(106, 189, 125)',
  );
  assert.equal(w.getComputedStyle(current().querySelector('.m2-list-name')).display, 'none');
  assert.equal(w.getComputedStyle(current()).height, height);
  assert.equal(
    boardRow(d).querySelector('.m2-indicator-total').textContent,
    '3',
    'counter counts indicators, not spells or marker value',
  );
  delete view.markers.bounty;
  refresh();
  assert.notEqual(w.getComputedStyle(current().querySelector('.m2-list-name')).display, 'none');
  assert.equal(boardRow(d).querySelector('.m2-indicator-total').textContent, '2');
  hero.spellbook = null;
  hero.id = 'plain';
  hero.cast_spells = [];
  view.hero_pieces.piece.owner_hero_id = hero.id;
  refresh();
  const compact = boardRow(d).querySelector('.m2-indicator-poison');
  assert.equal(compact.textContent, 'P');
  assert.equal(w.getComputedStyle(compact).borderRadius, '50%');
  view.markers = { bounty: { target_id: hero.id, value: 1 } };
  refresh();
  assert.equal(boardRow(d).querySelector('.m2-indicator-bounty').textContent, 'B');
  view.markers = {};
  refresh();
  assert.equal(current().querySelector('.m2-hero-indicators'), null);
  assert.equal(current().querySelector('.m2-hero-played-label').textContent, 'Played:');
});

test('Gydion uses colored dice pips through nine, then a number; compact always uses a number', (t) => {
  const { d, w, hero, refresh } = setup(t);
  assert.equal(w.testUI.spellColorName({ image_id: 'Ultimate', color: null }), 'PURPLE');
  for (let count = 0; count <= 10; count++) {
    hero.cast_spells = Array.from({ length: count }, (_, i) => spell(i));
    refresh();
    const button = d.querySelector('#own .m2-indicator-spells');
    assert.equal(button.querySelector('img').getAttribute('src'), '/hero-images/gydion.webp');
    assert.equal(
      button.querySelectorAll('.m2-spell-pips i').length,
      count > 0 && count <= 9 ? count : 0,
    );
    if (count > 0 && count <= 9) {
      const pips = [...button.querySelectorAll('i')];
      assert.equal(
        new Set(pips.map((p) => p.style.gridColumn + ':' + p.style.gridRow)).size,
        count,
      );
      assert.equal(
        pips[0].style.backgroundColor,
        'rgb(222, 98, 98)',
        'printed Red artwork gives color when native color is null',
      );
    } else assert.equal(button.querySelector('b').textContent, String(count));
    assert.equal(boardRow(d).querySelector('.m2-indicator-spells b').textContent, String(count));
  }
});

test('every player can inspect public cast spells; live updates and Back close the list safely', async (t) => {
  const { d, w, other, hero, refresh, media } = setup(t);
  d.querySelector('[data-mode="heroes"]').click();
  d.querySelector('#other .m2-indicator-spells').click();
  refresh();
  const panel = () => d.querySelector('#goa2-m2-hero-display');
  assert.equal(panel().querySelectorAll('.m2-spell-row').length, 1);
  assert(!panel().textContent.includes('Spell 12'));
  panel().querySelector('.m2-spell-row').click();
  const img = panel().querySelector('.m2-spell-face > img');
  assert.equal(img.getAttribute('src'), '/cards/spells/GreenI2.webp');
  assert.equal(
    panel().querySelector('.m2-card-type'),
    null,
    'spells do not invent initiative or basic actions',
  );
  img.dispatchEvent(new w.Event('error'));
  assert.equal(panel().querySelector('.m2-spell-face img'), null);
  assert.match(panel().textContent, /Spell 2/);
  panel().querySelector('.m2-spells-back').click();
  other.cast_spells = [];
  refresh();
  assert.match(panel().textContent, /No spells cast/);
  const retired = new Promise((resolve) => w.addEventListener('popstate', resolve, { once: true }));
  media.matches = false;
  refresh();
  assert.equal(w.getComputedStyle(panel()).display, 'none');
  await retired;
  media.matches = true;
  refresh();
  assert.match(panel().textContent, /No spells cast/);
  w.history.back();
  await new Promise((resolve) => w.setTimeout(resolve, 40));
  assert.equal(panel().childElementCount, 0);
  assert.equal(d.documentElement.dataset.m2Mode, 'board');
  boardRow(d).querySelector('.m2-indicator-spells').click();
  refresh();
  assert.equal(panel().querySelectorAll('.m2-spell-row').length, hero.cast_spells.length);
  assert.equal(hero.spellbook[0].is_facedown, true);
  assert.equal(other.spellbook.count, 4);
  panel().querySelector('.m2-spells-close').click();
  refresh();
  boardRow(d).querySelector('.m2-summary-identity').click();
  d.querySelector('.m2-focused-hero .m2-indicator-spells').click();
  refresh();
  assert.equal(panel().querySelectorAll('.m2-spell-row').length, hero.cast_spells.length);
});

test('owner Deck includes prepared ranks and cast spells in Tree/List/Grid, without altering hidden state', (t) => {
  const { d, w, hero, refresh } = setup(t);
  d.querySelector('[data-mode="deck"]').click();
  for (const mode of ['Tree', 'List', 'Grid']) {
    [...d.querySelectorAll('.m2-deck-controls button')].find((b) => b.textContent === mode).click();
    const rows = d.querySelector('.m2-deck-row-list');
    assert.equal(rows.querySelectorAll('.m2-spell-row').length, 6);
    assert.deepEqual(
      [...rows.querySelectorAll('.m2-spell-group h3')].map((h) => h.textContent),
      [
        'Spellbook · Cantrips',
        'Spellbook · Rank I',
        'Spellbook · Rank II',
        'Spellbook · Rank III',
        'Cast spells (2)',
      ],
    );
    rows.querySelector('.m2-spell-row').click();
    const preview = d.querySelector('.m2-deck-preview');
    assert.equal(
      preview.querySelector('.m2-spell-face > img').getAttribute('src'),
      '/cards/spells/RedI12.webp',
    );
    if (mode === 'Grid') assert.equal(rows.querySelectorAll('.m2-spell-face > img').length, 6);
    refresh();
    assert(preview.querySelector('.m2-spell-face'), 'selection survives a refresh');
  }
  hero.spellbook.shift();
  refresh();
  assert.equal(
    d.querySelector('.m2-deck-preview').childElementCount,
    0,
    'removed prepared selection clears',
  );
  assert.equal(d.querySelectorAll('.m2-deck-row-list .m2-spell-row').length, 5);
  assert(hero.spellbook.every((card) => card.is_facedown));
  hero.spellbook = { count: 3 };
  refresh();
  assert.equal(
    d.querySelectorAll('.m2-deck-row-list .m2-spell-row').length,
    0,
    'count-only spellbooks cannot expose prepared cards',
  );
  assert.equal(w.testUI.uiState.deckOpen, true);
});
