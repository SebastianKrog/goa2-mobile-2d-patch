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
    <section id="own"><div class="_name_t">Gydion · Me (You)</div><div class="_details_t">Lv 3</div><div id="old-own-counts" class="_details_t">Spellbook: 4 · Cast: 2</div></section>
    <section id="other"><div class="_name_t">Gydion · Opponent</div><div class="_details_t">Lv 3</div><div id="old-other-counts" class="_details_t">Spellbook: 4 · Cast: 1</div></section>
    <section id="snorri"><div class="_name_t">Snorri · Someone</div><div class="_details_t">Lv 3</div></section></aside>
    <div class="_modal_t"><div class="_header_t">Deck</div><div class="_cardGrid_t"><canvas></canvas></div></div>`,
    hooks: ['refresh', 'heroIndicators', 'uiState', 'spellColorName', 'textCard'],
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
    assert.equal(button.querySelector('img').getAttribute('src'), '/cards/logos/gydion.png');
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
  const panel = () => d.querySelector('#goa2-m2-spells');
  const viewer = () => d.querySelector('#goa2-m2-hero-display');
  assert.equal(panel().querySelectorAll('.m2-spell-row').length, 1);
  assert(!panel().textContent.includes('Spell 12'));
  panel().querySelector('.m2-spell-row').click();
  assert(viewer().querySelector('.m2-spell-large'), 'Large is the default spell viewer');
  assert(panel().querySelector('.m2-spell-row').hasAttribute('data-m2-viewed'));
  d.querySelector('[data-mode="tools"]').click();
  const format = d.querySelector('[data-setting="spell-view"]');
  format.value = 'image';
  format.dispatchEvent(new w.Event('change'));
  d.querySelector('[data-mode="heroes"]').click();
  d.querySelector('#other .m2-indicator-spells').click();
  refresh();
  panel().querySelector('.m2-spell-row').click();
  const img = viewer().querySelector('.m2-spell-face > img');
  assert.equal(img.getAttribute('src'), '/cards/spells/GreenI2.webp');
  assert.equal(
    viewer().querySelector('.m2-card-type'),
    null,
    'spells do not invent initiative or basic actions',
  );
  img.dispatchEvent(new w.Event('error'));
  assert.equal(viewer().querySelector('.m2-spell-face img'), null);
  assert.match(viewer().textContent, /Spell 2/);
  viewer().querySelector('.m2-card-dismiss').click();
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
      [...rows.querySelectorAll('.m2-spell-group h3, .m2-spell-group h4')].map(
        (h) => h.textContent,
      ),
      ['Cast Spells (2)', 'Cantrips', 'Rank I', 'Rank II', 'Rank III'],
    );
    assert.equal(rows.querySelector('.m2-spell-group > h3').textContent, 'Cast Spells (2)');
    assert([...rows.children].find((el) => el.tagName === 'H3' && el.textContent === 'Spellbook'));
    assert.equal(rows.querySelector('.m2-spell-group').querySelectorAll('h4').length, 0);
    rows.querySelector('.m2-spell-group:has(> h4) .m2-spell-row').click();
    const preview = d.querySelector('.m2-deck-preview');
    assert.equal(
      preview.querySelector('.m2-spell-large .m2-card-art img').getAttribute('src'),
      '/cards/spells/RedI12.webp',
    );
    assert(rows.querySelector('.m2-spell-row[data-m2-viewed]'));
    if (mode === 'Grid') assert.equal(rows.querySelectorAll('.m2-spell-face > img').length, 6);
    refresh();
    assert(preview.querySelector('.m2-spell-large'), 'selection survives a refresh');
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

test('spell counters use the emblem and replace native count rows only while adapted', (t) => {
  const { d, w, media, refresh } = setup(t);
  for (const id of ['old-own-counts', 'old-other-counts'])
    assert.equal(w.getComputedStyle(d.getElementById(id)).display, 'none');
  for (const img of d.querySelectorAll('.m2-indicator-spells > img')) {
    assert.equal(img.getAttribute('src'), '/cards/logos/gydion.png');
    assert.equal(w.getComputedStyle(img).objectFit, 'contain');
  }
  assert(d.querySelector('#own .m2-hero-resources').textContent.includes('Lv 3'));
  media.matches = false;
  refresh();
  assert.notEqual(w.getComputedStyle(d.getElementById('old-own-counts')).display, 'none');
  media.matches = true;
  refresh();
  assert.equal(w.getComputedStyle(d.getElementById('old-own-counts')).display, 'none');
  w.GOA2Mobile2D.destroy();
  assert.notEqual(w.getComputedStyle(d.getElementById('old-own-counts')).display, 'none');
});

test('compact indicators follow the name inside its column and consume no empty slot', (t) => {
  const { d, w, hero, snorri, view, refresh } = setup(t);
  snorri.rune_slots = {};
  refresh();
  const marked = boardRow(d);
  const cell = marked.querySelector('.m2-summary-name-cell');
  const identity = cell.querySelector('.m2-summary-identity');
  const indicators = cell.querySelector('.m2-summary-indicators');
  assert.equal(identity.nextElementSibling, indicators);
  assert.equal(indicators.querySelector('button').parentElement.parentElement, cell);
  assert(
    !identity.contains(indicators),
    'name and spell counter are separate interactive controls',
  );
  assert.equal(marked.children.length, 6);
  assert.equal(w.getComputedStyle(identity).flexBasis, '0px');
  assert.equal(w.getComputedStyle(identity.querySelector('strong')).flexShrink, '1');
  assert.equal(w.getComputedStyle(identity.querySelector('strong')).textOverflow, 'ellipsis');
  assert.equal(w.getComputedStyle(indicators).flexShrink, '0');
  const plain = [...d.querySelectorAll('#goa2-m2-summary article')].find((row) =>
    row.textContent.includes('Snorri'),
  );
  assert.equal(plain.querySelector('.m2-summary-indicators'), null);
  assert.equal(plain.querySelector('.m2-summary-name-cell').children.length, 1);
  assert.equal(
    w.getComputedStyle(plain).gridTemplateColumns,
    w.getComputedStyle(marked).gridTemplateColumns,
  );
  assert.equal(w.getComputedStyle(plain.querySelector('strong')).flexShrink, '0');
  hero.id = 'plain';
  hero.spellbook = null;
  hero.cast_spells = [];
  view.markers = { bounty: { target_id: hero.id, value: 1 } };
  refresh();
  assert(boardRow(d).querySelector('.m2-summary-name-cell .m2-indicator-bounty'));
  view.markers = {};
  refresh();
  assert.equal(boardRow(d).querySelector('.m2-summary-indicators'), null);
  assert.equal(boardRow(d).querySelector('.m2-summary-name-cell').children.length, 1);
});

test('cast spells use Tiny cards without initiative, sort by Rank/Color without headings, and default to shorter Large cards', (t) => {
  const { d, w, hero, refresh } = setup(t);
  const attack = {
    ...spell(0),
    id: 'magic_missile',
    name: 'Magic Missile',
    image_id: 'GoldII',
    spell_rank: 0,
    color: 'GOLD',
    primary_action: 'ATTACK',
    primary_action_value: 2,
    is_ranged: true,
    range_value: 3,
    effect_text: 'Target a unit in range.',
  };
  const shield = {
    ...spell(1),
    name: 'Shield',
    spell_rank: 1,
    color: 'GREEN',
    primary_action: 'SKILL',
    effect_text: 'This round: You are immune to basic attacks.',
  };
  const blue = {
    ...spell(2),
    spell_rank: 2,
    color: 'BLUE',
    primary_action: 'SKILL',
    radius_value: 3,
    effect_text: 'Choose a hero in radius.',
  };
  const wish = {
    ...spell(3),
    name: 'Wish',
    image_id: 'Ultimate',
    spell_rank: 4,
    color: 'PURPLE',
    primary_action: 'SKILL',
    effect_text: 'Cast any spell in the spellbook.',
  };
  hero.cast_spells = [blue, wish, shield, attack];
  refresh();
  boardRow(d).querySelector('.m2-indicator-spells').click();
  refresh();
  const panel = () => d.querySelector('#goa2-m2-spells');
  const viewer = () => d.querySelector('#goa2-m2-hero-display');
  const rows = () => [...panel().querySelectorAll('.m2-spell-row')];
  assert.equal(rows()[0].textContent.includes('Magic Missile'), true);
  assert.equal(rows()[0].querySelectorAll('.m2-symbol').length, 2);
  assert.equal(rows()[0].querySelector('.m2-symbol[title="initiative"]'), null);
  assert.equal(rows()[0].querySelector('.m2-list-secondary'), null);
  assert.equal(rows()[0].querySelector('.m2-spell-tiny').children.length, 1);
  assert.equal(w.getComputedStyle(rows()[0]).height, '30px');
  assert.deepEqual(
    [...panel().querySelectorAll('.m2-spell-group h3')].map((h) => h.textContent),
    [],
  );
  assert.equal(panel().querySelector('.m2-sort-switch > span').textContent, 'RankColor');
  assert.deepEqual(
    rows().map((row) => row.dataset.spellId),
    [attack.id, shield.id, blue.id, wish.id],
  );
  panel().querySelector('.m2-sort-switch').click();
  assert.deepEqual(
    rows().map((row) => row.dataset.spellId),
    [attack.id, blue.id, shield.id, wish.id],
  );
  assert.deepEqual(
    [...panel().querySelectorAll('.m2-spell-group h3')].map((h) => h.textContent),
    [],
  );
  assert.equal(panel().querySelector('.m2-sort-switch').getAttribute('aria-checked'), 'true');
  rows()[0].click();
  const large = viewer().querySelector('.m2-spell-large');
  assert(large);
  assert.equal(large.querySelector('.m2-card-top').children.length, 2);
  assert.equal(large.querySelector('.m2-symbol[title="initiative"]'), null);
  assert.equal(large.querySelector('.m2-card-body > aside'), null);
  assert.equal(large.querySelector('.m2-card-type .m2-symbol-value').textContent, '2');
  assert.equal(large.querySelector('.m2-card-type .m2-symbol[title="range"]').textContent, '3');
  assert.equal(large.querySelector('.m2-card-effect').textContent, attack.effect_text);
  assert.match(w.getComputedStyle(large).minHeight, /130px.*175px/);
  assert.equal(w.getComputedStyle(rows()[0]).boxSizing, 'border-box');
  assert.equal(w.getComputedStyle(rows()[0].querySelector('.m2-spell-tiny')).minHeight, '0px');
  assert.equal(w.getComputedStyle(panel().querySelector('.m2-sort-switch')).borderWidth, '0px');
  assert.equal(w.getComputedStyle(panel().querySelector('.m2-spells-close')).borderWidth, '0px');
  assert.equal(panel().querySelector('.m2-spell-formats'), null);
  assert.equal(
    rows()
      .find((row) => row.textContent.includes('Wish'))
      .querySelector('.m2-spell-tiny').dataset.spellRank,
    '4',
  );
  const stableList = panel().firstChild;
  const content = panel().querySelector('.m2-spells-content');
  content.scrollTop = 60;
  rows()[1].focus();
  rows()[1].click();
  refresh();
  assert.equal(panel().firstChild, stableList);
  assert.equal(content.scrollTop, 60);
  assert.equal(d.activeElement, rows()[1]);
  assert.equal(rows()[1].getAttribute('aria-pressed'), 'true');
  viewer().querySelector('.m2-card-dismiss').click();
  assert.equal(viewer().childElementCount, 0);
  assert.equal(panel().firstChild, stableList);
  assert(d.documentElement.hasAttribute('data-m2-spells-open'));
  assert.equal(panel().querySelector('.m2-sort-switch').getAttribute('aria-checked'), 'true');
  assert.deepEqual(JSON.parse(w.localStorage.getItem('goa2-mobile-spells')), {
    sort: 'color',
    view: 'large',
  });
  assert.equal(hero.cast_spells[0], blue, 'presentation sorting never mutates the game array');
});

test('Deck spell groups follow its sort and use major headings above rank/color subheadings', (t) => {
  const { d, hero, refresh } = setup(t);
  d.querySelector('[data-mode="deck"]').click();
  const toggle = () => d.querySelector('.m2-deck-controls [role="switch"]');
  toggle().click();
  const rows = () => d.querySelector('.m2-deck-row-list');
  assert.deepEqual(
    [...rows().querySelectorAll('.m2-spell-group h4')].map((h) => h.textContent),
    ['gold', 'red', 'blue', 'green'],
  );
  const spell = rows().querySelector('.m2-spell-row');
  spell.click();
  assert(spell.hasAttribute('data-m2-viewed'));
  toggle().click();
  assert(rows().querySelector('.m2-spell-row[data-m2-viewed]'), 'selection survives sorting');
  assert.deepEqual(
    [...rows().querySelectorAll('.m2-spell-group h4')].map((h) => h.textContent),
    ['Cantrips', 'Rank I', 'Rank II', 'Rank III'],
  );
  assert.deepEqual(
    hero.spellbook.map((card) => card.id),
    ['spell-12', 'spell-13', 'spell-14', 'spell-15'],
  );
  refresh();
});

test('owner spell rules use unique slim Tiny rows in every viewer and return to their parent card', async (t) => {
  const { d, w, hero, other, refresh } = setup(t);
  hero.spellbook = [
    { ...spell(12, true), id: 'shield', name: 'Shield', primary_action: 'SKILL' },
    { ...spell(13, true), id: 'midas_touch', name: "Midas' Touch", primary_action: 'SKILL' },
  ];
  hero.cast_spells = [
    { ...spell(0), id: 'banishment', name: 'Banishment', primary_action: 'SKILL', radius_value: 3 },
  ];
  const main = hero.deck[0];
  main.effect_text =
    'Choose one —\n• "Shield"\n• "Banishment"\n• "Midas Touch"\nAfter casting, gain 1 gold.\n(Shield and Banishment are mentioned again here.)';
  const original = main.effect_text;
  refresh();
  d.querySelector('[data-mode="deck"]').click();
  d.querySelector('.m2-deck-card, .m2-tree-card').click();
  const preview = () => d.querySelector('.m2-deck-preview');
  const effect = preview().querySelector('.m2-card-effect');
  assert.equal(effect.querySelectorAll('.m2-inline-spell').length, 3);
  assert.equal(effect.querySelectorAll('.m2-inline-spell .m2-spell-tiny').length, 3);
  assert.equal(effect.querySelector('.m2-mini-current'), null);
  const embedded = effect.querySelector('.m2-inline-spell');
  assert.equal(w.getComputedStyle(embedded).width, '100%');
  assert.equal(w.getComputedStyle(embedded).height, '26px');
  assert.equal(w.getComputedStyle(embedded.firstChild).height, '24px');
  assert.equal(embedded.querySelector('.m2-list-name').textContent, 'Shield');
  assert(effect.lastChild.textContent.startsWith('(Shield'));
  assert.equal(effect.querySelectorAll('[data-spell-id="shield"]').length, 1);
  assert(effect.textContent.includes('Choose one'));
  assert(effect.textContent.includes('After casting, gain 1 gold.'));
  assert(!effect.textContent.includes('•'));
  effect.querySelector('[data-spell-id="banishment"]').click();
  assert(preview().textContent.includes('Banishment'));
  assert(preview().querySelector('.m2-nested-spell'));
  const parent = effect.closest('.m2-text-card');
  const frame = parent.querySelector(':scope > .m2-nested-spell-frame');
  assert(frame, 'spell opens inside the existing parent card');
  assert.equal(w.getComputedStyle(frame).padding, '12px');
  assert.match(w.getComputedStyle(frame.firstChild).boxShadow, /0 0 10px/);
  assert.equal(
    w.getComputedStyle(frame).position,
    'absolute',
    'inset does not participate in parent layout',
  );
  assert.equal(
    w.getComputedStyle(parent.querySelector(':scope > .m2-card-body')).display,
    'grid',
    'parent keeps its original layout',
  );
  assert(parent.querySelector(':scope > .m2-card-body').hasAttribute('inert'));
  refresh();
  assert(preview().querySelector('.m2-nested-spell'), 'refresh preserves child inspection');
  w.history.back();
  await new Promise((resolve) => w.setTimeout(resolve, 40));
  assert.equal(
    preview().querySelector('.m2-card-effect'),
    effect,
    'Back restores the exact parent DOM',
  );
  assert.equal(d.activeElement, effect.querySelector('[data-spell-id="banishment"]'));
  assert.equal(parent.querySelector('.m2-nested-spell-frame'), null);
  assert(!parent.classList.contains('m2-nested-open'));
  assert(!parent.querySelector(':scope > .m2-card-body').hasAttribute('inert'));
  effect.querySelector('[data-spell-id="shield"]').click();
  preview().querySelector('[aria-label="Back to card"]').click();
  await new Promise((resolve) => w.setTimeout(resolve, 40));
  assert.equal(preview().querySelector('.m2-card-effect'), effect);
  const normal = w.testUI.textCard(main, 'hero', null, hero.id);
  assert.equal(normal.querySelectorAll('.m2-inline-spell').length, 3);
  for (const context of ['hand', 'hero', 'deck']) {
    const viewer = w.testUI.textCard(main, context, null);
    assert.equal(
      viewer.querySelectorAll('.m2-inline-spell').length,
      3,
      context + ' resolves owner',
    );
  }
  const opponent = w.testUI.textCard(main, 'deck', null, other.id, null, () => {});
  assert.equal(opponent.querySelector('.m2-inline-spell'), null);
  assert.equal(opponent.querySelector('.m2-card-effect').textContent, original);
  main.effect_text = 'Cast "Shield"; after the spell, gain 1 gold.';
  const preserved = w.testUI.textCard(main, 'deck', null, hero.id, null, () => {});
  assert.equal(preserved.querySelector('.m2-card-effect').firstChild.textContent, main.effect_text);
  assert(preserved.textContent.includes('after the spell, gain 1 gold.'));
  assert.equal(preserved.querySelectorAll('.m2-inline-spell').length, 1);
  assert.equal(
    preserved.querySelector('.m2-card-effect').lastChild.className,
    'm2-spell-rule-line',
  );
  main.effect_text = 'Cast "Shield" in the spellbook. (Shield protects you.)';
  const note = w.testUI.textCard(main, 'hero', null, hero.id).querySelector('.m2-card-effect');
  assert.equal(note.querySelectorAll('.m2-inline-spell').length, 1);
  assert.equal(note.firstChild.textContent, 'Cast "Shield" in the spellbook.');
  assert.equal(note.children[1].className, 'm2-spell-rule-line');
  assert.equal(note.lastChild.textContent, '(Shield protects you.)');
  main.effect_text = 'Cast "Shield"; after the spell, gain 1 gold.';
  assert.equal(main.effect_text, 'Cast "Shield"; after the spell, gain 1 gold.');
  assert(hero.spellbook.every((card) => card.is_facedown));
});

test('Snorri shows his active rune only in compact indicators and named runes in hero turn slots', (t) => {
  const { d, w, snorri, hero, view, refresh, media } = setup(t);
  snorri.rune_slots = { 1: 'bird', 2: 'axe', 3: 'anvil', 4: 'horn' };
  snorri.played_cards = [hero.deck[0]];
  const native = d.createElement('div');
  native.className = '_runes_test';
  native.textContent = 'RUNES T1 Bird T2 Axe T3 Anvil T4 Horn';
  d.getElementById('snorri').append(native);
  refresh();
  const compact = () =>
    [...d.querySelectorAll('#goa2-m2-summary article')].find((row) =>
      row.querySelector('.m2-summary-identity strong')?.textContent.includes('Snorri'),
    );
  assert.equal(
    compact().querySelector('.m2-summary-name-cell .m2-indicator-rune img').getAttribute('src'),
    '/icons/rune_bird.png',
  );
  assert.equal(d.querySelector('#snorri .m2-hero-indicators .m2-indicator-rune'), null);
  const slots = () => [...d.querySelectorAll('#snorri .m2-micro-history-slot')];
  assert.equal(slots()[0].querySelector('.m2-rune-floating').textContent, 'Bird');
  assert(slots()[0].querySelector('.m2-rune-floating.m2-turn-rune-active'));
  assert.match(
    w.getComputedStyle(compact().querySelector('.m2-indicator-rune')).backgroundColor,
    /0\.18/,
  );
  assert(slots()[0].querySelector('.m2-micro-button'));
  assert.equal(
    w.getComputedStyle(slots()[0].querySelector('.m2-rune-floating')).position,
    'absolute',
  );
  assert.equal(w.getComputedStyle(slots()[0].querySelector('.m2-rune-floating')).top, '-12px');
  const historyStyle = w.getComputedStyle(slots()[0].parentElement);
  assert.equal(historyStyle.paddingTop, '14px');
  assert.equal(historyStyle.marginTop, '-8px', 'overlay space compensates for its extra padding');
  assert.equal(slots()[1].querySelector('.m2-micro-placeholder').textContent, 'Axe');
  assert.equal(slots()[2].querySelector('.m2-micro-placeholder').textContent, 'Anvil');
  assert.equal(slots()[3].querySelector('.m2-micro-placeholder').textContent, 'Horn');
  assert.equal(slots()[4].querySelector('.m2-rune-label'), null);
  assert.equal(w.getComputedStyle(native).display, 'none');
  view.turn = 2;
  refresh();
  assert.equal(
    compact().querySelector('.m2-indicator-rune img').getAttribute('src'),
    '/icons/rune_axe.png',
  );
  assert.equal(slots()[0].querySelector('.m2-turn-rune-active'), null);
  assert(slots()[1].querySelector('.m2-micro-placeholder .m2-turn-rune-active'));
  assert.equal(
    w.getComputedStyle(slots()[1].querySelector('.m2-turn-rune-active')).color,
    'rgb(255, 215, 0)',
  );
  snorri.rune_slots[2] = 'horn';
  refresh();
  assert.equal(slots()[1].textContent, 'Horn', 'rune changes refresh without a card change');
  view.markers = { bounty: { target_id: snorri.id } };
  refresh();
  assert.equal(compact().querySelector('.m2-indicator-total').textContent, '2');
  assert.match(compact().querySelector('.m2-indicator-total').title, /Active rune: Horn.*Bounty/);
  assert.equal(d.querySelector('#snorri .m2-indicator-rune'), null);
  media.matches = false;
  refresh();
  assert.notEqual(w.getComputedStyle(native).display, 'none');
});
