// Decorative artwork must use the correct hero asset, preserve printed Deck
// values and controls, and fall back cleanly without exposing a hidden card.
const { JSDOM } = require('jsdom');
const fs = require('fs'),
  assert = require('assert');
const dom = new JSDOM('', {
  url: 'https://goa2.frontend.pedroliv.dev/game/fixture?3d=0',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const w = dom.window,
  d = w.document;
w.matchMedia = () => ({ matches: true, addEventListener() {} });
w.eval(
  fs
    .readFileSync('dist/goa2-mobile-2d.user.js', 'utf8')
    .replace(
      /window\.GOA2Mobile2D\s*=\s*\{/,
      'window.__artUI={textCard,updateCardRow,miniatureCard,nanoCard};window.GOA2Mobile2D={',
    ),
);
d.documentElement.setAttribute('data-m2-active', '');
const { textCard, updateCardRow, miniatureCard, nanoCard } = w.__artUI;
const card = {
  id: 'hanu_silver',
  image_id: 'hurry_up',
  name: 'Hurry Up!',
  color: 'SILVER',
  tier: 'UNTIERED',
  initiative: 12,
  primary_action: 'SKILL',
  radius_value: 4,
  secondary_actions: { DEFENSE: 1 },
  effect_text: 'Choose a unit.',
};
const hero = d.createElement('section');
hero.dataset.m2 = 'hero';
hero.__reactFiber$fixture = {
  memoizedProps: {
    hero: {
      id: 'hero_hanu',
      deck: [card],
      items: { INITIATIVE: 2 },
    },
  },
};
d.body.append(hero);
try {
  const large = textCard(card, 'hand');
  d.body.append(large);
  const image = large.querySelector('.m2-card-art img');
  assert(image.src.endsWith('/cards/backgrounds/hanu/hurry_up.webp'));
  assert.equal(image.alt, '');
  assert.equal(image.parentElement.getAttribute('aria-hidden'), 'true');
  assert(!large.classList.contains('m2-has-art'), 'retain plain style before load');
  const titleBefore = w.getComputedStyle(large.querySelector('.m2-card-top > b'));
  assert.equal(
    titleBefore.color,
    'rgb(245, 246, 248)',
    'title starts white while artwork is loading',
  );
  const titleShadow = titleBefore.textShadow;
  assert(titleShadow.includes('0 1px 2px'), 'title always has a subtle shadow');
  image.dispatchEvent(new w.Event('load'));
  assert(large.classList.contains('m2-has-art'));
  assert.equal(
    w.getComputedStyle(large.querySelector('.m2-card-top > b')).color,
    titleBefore.color,
  );
  assert.equal(w.getComputedStyle(large.querySelector('.m2-card-top > b')).textShadow, titleShadow);
  assert.equal(
    w.getComputedStyle(large.querySelector('.m2-card-top .m2-symbol img')).width,
    '27.3px',
  );
  assert.equal(
    w.getComputedStyle(large.querySelector('.m2-card-body .m2-symbol img')).width,
    '27.3px',
  );
  assert.equal(
    w.getComputedStyle(large.querySelector('.m2-card-top .m2-symbol-value')).fontSize,
    '19.435px',
  );
  assert.equal(large.querySelector('.m2-card-top b').textContent, 'Hurry Up!');
  assert.equal(large.querySelector('.m2-card-top .m2-upgraded-value').textContent, '14');
  const artStyle = w.getComputedStyle(image.parentElement);
  assert.equal(artStyle.position, 'absolute');
  assert.equal(artStyle.opacity, '0.4');
  assert.equal(artStyle.zIndex, '1');
  assert.equal(
    large.querySelectorAll('.m2-card-art img').length,
    1,
    'one image crop for the entire card',
  );
  assert.equal(artStyle.pointerEvents, 'none');
  assert.equal(w.getComputedStyle(image).objectFit, 'cover');
  const rules = [...d.querySelector('#goa2-m2-style').sheet.cssRules];
  const maskRule = rules.find((rule) => rule.selectorText?.endsWith('.m2-has-art > .m2-card-art'));
  const mask = maskRule.style.getPropertyValue('mask-image');
  assert(mask.includes('135deg'), 'image transparency runs from top-left to bottom-right');
  assert(
    mask.includes('transparent 0%') && mask.includes('rgb(0, 0, 0) 100%'),
    'mask reveals no image at start and full capped alpha at the end',
  );
  assert.equal(maskRule.style.getPropertyValue('mask-mode'), 'alpha');
  assert.equal(
    maskRule.style.getPropertyValue('background'),
    '',
    'mask never paints a black overlay',
  );
  assert(
    !rules.some((rule) => rule.selectorText?.endsWith('.m2-has-art::after')),
    'remove the dark full-card overlay',
  );
  assert(
    !rules.some((rule) => rule.selectorText?.endsWith('.m2-has-art > .m2-card-top::after')),
    'remove the separate title tint',
  );
  const titleBase = rules.find((rule) => rule.selectorText?.endsWith('.m2-has-art > .m2-card-top'));
  assert.equal(
    titleBase.style.getPropertyValue('background'),
    'var(--card-color)',
    'transparent artwork reveals the real title color',
  );
  const bars = rules.find((rule) =>
    rule.selectorText?.endsWith('.m2-has-art > :is(.m2-card-top, .m2-card-foot)::before'),
  );
  assert.equal(bars.style.getPropertyValue('backdrop-filter'), 'blur(5px)');
  assert.equal(
    bars.style.getPropertyValue('z-index'),
    '2',
    'bars blur the same full-card artwork above its crop',
  );
  const sourceCSS = fs.readFileSync('src/styles.css', 'utf8');
  // jsdom drops vendor properties; preserve Safari fallbacks in the source.
  assert(sourceCSS.includes('-webkit-backdrop-filter: blur(5px)'));
  assert.match(sourceCSS, /-webkit-mask-image:\s*linear-gradient\(\s*135deg/);
  const content = rules.find((rule) =>
    rule.selectorText?.endsWith(
      '.m2-has-art > :is(.m2-card-top, .m2-card-body, .m2-card-foot) > *',
    ),
  );
  assert.equal(
    content.style.getPropertyValue('z-index'),
    '3',
    'sharp content and controls stay above blur',
  );
  for (const className of ['m2-card-top', 'm2-card-body', 'm2-card-foot']) {
    assert.equal(
      w.getComputedStyle(large.querySelector('.' + className)).zIndex,
      'auto',
      'bar backgrounds stay below artwork in the shared stacking context',
    );
  }
  assert(
    !rules.some(
      (rule) =>
        rule.selectorText?.includes('.m2-card-top') &&
        rule.style?.getPropertyValue('background-image').includes('url'),
    ),
    'title never crops its own image',
  );
  assert(!large.style.getPropertyValue('--m2-card-art-url'));
  image.dispatchEvent(new w.Event('error'));
  assert(!large.classList.contains('m2-has-art'));
  assert.equal(
    w.getComputedStyle(large.querySelector('.m2-card-top > b')).color,
    titleBefore.color,
    'title stays white when artwork fails',
  );
  assert(!large.querySelector('.m2-card-art'));
  assert(large.querySelector('.m2-card-effect').textContent.includes('Choose a unit.'));

  // Explicit owner supports unowned upgrade choices and Deck cards. Deck values
  // remain printed, even though the same card is upgraded in the player's hand.
  const deck = textCard({ ...card, item: 'INITIATIVE' }, 'deck', null, 'hero_hanu');
  const heroDisplay = d.createElement('div');
  heroDisplay.id = 'goa2-m2-hero-display';
  heroDisplay.append(deck);
  d.body.append(heroDisplay);
  assert.equal(
    w.getComputedStyle(deck.querySelector('.m2-card-top .m2-symbol img')).width,
    '27.3px',
    'Hero display does not shrink Large icons',
  );
  assert.equal(
    w.getComputedStyle(deck.querySelector('.m2-card-foot .m2-symbol img')).width,
    '21px',
    'footer icons keep their existing size',
  );
  assert(deck.querySelector('.m2-card-art img'));
  assert(!deck.querySelector('.m2-upgraded-value'));
  const upgrade = textCard({ ...card, id: 'new_upgrade' }, 'deck', null, 'hero_hanu');
  assert(upgrade.querySelector('.m2-card-art img'));
  assert(
    !textCard({ ...card, is_facedown: true }, 'deck', null, 'hero_hanu').querySelector(
      '.m2-card-art',
    ),
  );
  assert(
    !textCard({ ...card, image_id: null }, 'deck', null, 'hero_hanu').querySelector('.m2-card-art'),
  );
  assert(
    !textCard({ ...card, image_id: '../outside' }, 'deck', null, 'hero_hanu').querySelector(
      '.m2-card-art',
    ),
  );
  assert(
    !textCard({ ...card, id: 'unknown_owner' }, 'deck').querySelector('.m2-card-art'),
    'never guess an owner from a card name',
  );

  // Small artwork lives entirely within Hand's colored band. Other regions and
  // native row clicks are preserved; the Mini renderer gets no new artwork.
  const hand = d.createElement('section');
  hand.dataset.m2 = 'hand-list';
  const row = d.createElement('button');
  hand.append(row);
  d.body.append(hand);
  let clicks = 0;
  row.onclick = () => clicks++;
  updateCardRow(row, card, {});
  const band = row.querySelector('.m2-list-band');
  const smallImage = band.querySelector('.m2-card-art img');
  assert(smallImage.src.endsWith('/cards/backgrounds/hanu/hurry_up.webp'));
  assert.equal(row.querySelectorAll('.m2-card-art').length, 1);
  assert(!row.querySelector('.m2-list-secondary .m2-card-art'));
  smallImage.dispatchEvent(new w.Event('load'));
  assert.equal(w.getComputedStyle(smallImage.parentElement).opacity, '0.4');
  assert(w.getComputedStyle(smallImage.parentElement).maskImage.includes('90deg'));
  assert.equal(w.getComputedStyle(smallImage).filter, 'blur(4px)');
  assert.equal(w.getComputedStyle(band).overflow, 'hidden', 'art is clipped to colored center');
  row.querySelector('.m2-list-name').click();
  assert.equal(clicks, 1);
  updateCardRow(row, card, {});
  assert.equal(
    row.querySelector('.m2-card-art img'),
    smallImage,
    'unchanged rows retain loaded art',
  );
  for (const side of ['before', 'after']) {
    const rail = rules.find((rule) =>
      rule.selectorText?.includes(`.m2-small-card > .m2-list-band::${side}`),
    );
    assert(rail, `${side} tier stripe has a definition`);
    assert.equal(
      rail.style.getPropertyValue('z-index'),
      '3',
      `${side} tier stripe stays above blurred artwork`,
    );
    assert.equal(rail.style.getPropertyValue('pointer-events'), 'none');
  }
  smallImage.dispatchEvent(new w.Event('error'));
  assert(!band.querySelector('.m2-card-art'));
  assert.equal(band.querySelector('.m2-list-name').textContent, 'Hurry Up!');
  updateCardRow(row, { ...card, is_facedown: true }, {});
  assert(!row.querySelector('.m2-card-art'), 'hidden Small cards do not request artwork');

  for (const [tier, count] of [
    [null, 1],
    ['UNTIERED', 1],
    ['I', 1],
    ['II', 2],
    ['III', 3],
    [2, 2],
    [3, 3],
  ]) {
    updateCardRow(row, { ...card, image_id: null, tier, radius_value: null }, {});
    const center = row.querySelector('.m2-list-band');
    assert.equal(center.style.getPropertyValue('--m2-tier-lines'), String(count));
    const style = w.getComputedStyle(center);
    assert.equal(style.paddingLeft, '18px', 'same left tier gutter on every Small card');
    assert.equal(style.paddingRight, '18px', 'same right tier gutter on every Small card');
    assert.equal(
      style.gridTemplateColumns,
      '24px minmax(0, 1fr) 24px',
      'matching icon slots reserve utility space even when empty',
    );
    assert(!center.querySelector('.m2-list-utility'));
    assert.equal(w.getComputedStyle(center.querySelector('.m2-list-name')).gridColumn, '2');
  }
  const mini = d.createElement('button');
  d.body.append(mini);
  updateCardRow(mini, card, {});
  assert(!mini.querySelector('.m2-card-art'), 'Mini rows retain their plain color');
  for (const [tier, count] of [
    [null, 1],
    ['I', 1],
    ['II', 2],
    ['III', 3],
  ]) {
    updateCardRow(mini, { ...card, tier, radius_value: null }, {});
    const center = mini.querySelector('.m2-list-band');
    assert.equal(center.style.getPropertyValue('--m2-tier-lines'), String(count));
    assert(
      !mini.querySelector('.m2-card-art'),
      'Mini rows never attach artwork, even for known image IDs',
    );
    const style = w.getComputedStyle(center);
    assert.equal(style.paddingLeft, '12px');
    assert.equal(style.paddingRight, '12px');
    assert.equal(style.gridTemplateColumns, '19px minmax(0, 1fr) 19px');
    assert.equal(w.getComputedStyle(center.querySelector('.m2-list-name')).gridColumn, '2');
    assert(!center.querySelector('.m2-list-utility'));
    assert.equal(w.getComputedStyle(center.querySelector('.m2-list-primary img')).width, '19px');
  }

  // Three-pixel side cues consume padding, never extra outer width. Exercise
  // summary selectors too: their older sizing rules must not reset the gutters.
  const summary = d.createElement('section');
  summary.id = 'goa2-m2-summary';
  d.body.append(summary);
  for (const [tier, count] of [
    [null, 1],
    ['I', 1],
    ['II', 2],
    ['III', 3],
  ]) {
    const tierCard = { ...card, tier };
    for (const [element, width] of [
      [miniatureCard(tierCard), 70],
      [miniatureCard(tierCard, {}, true), 64],
      [nanoCard(tierCard), 20],
    ]) {
      summary.append(element);
      assert.equal(element.dataset.tierLines, String(count));
      const style = w.getComputedStyle(element);
      assert.equal(style.width, width + 'px');
      assert.equal(style.boxSizing, 'border-box');
      assert.equal(style.height, '24px');
      assert.equal(style.borderLeftWidth, '1px');
      assert.equal(style.borderRightWidth, '1px');
      assert.equal(style.paddingLeft, '2px');
      assert.equal(style.paddingRight, '2px');
    }
  }
  const tier2left = rules.find((rule) =>
    rule.selectorText?.includes('[data-tier-lines="2"]::before'),
  );
  const tier2right = rules.find((rule) =>
    rule.selectorText?.includes('[data-tier-lines="2"]::after'),
  );
  assert(tier2left.style.getPropertyValue('background').includes('90deg'));
  assert(tier2right.style.getPropertyValue('background').includes('270deg'));
  const tier3 = rules.find((rule) => rule.selectorText?.includes('[data-tier-lines="3"]::before'));
  assert.equal(tier3.style.getPropertyValue('background'), 'var(--m2-tier-edge-color)');
  for (const element of [
    miniatureCard({ ...card, tier: 'III', is_facedown: true }),
    nanoCard({ ...card, tier: 'II', is_facedown: true }),
  ]) {
    assert.equal(element.dataset.tierLines, '1', 'tier cues cannot reveal facedown card props');
    assert(!element.querySelector('.m2-symbol'));
  }
  const resolved = d.createElement('div');
  resolved.className = 'm2-card-resolved';
  const resolvedMicro = miniatureCard({ ...card, tier: 'III' });
  resolved.append(resolvedMicro);
  summary.append(resolved);
  assert.equal(
    w.getComputedStyle(resolvedMicro).getPropertyValue('--m2-tier-edge-color'),
    'var(--m2-card-muted)',
    'resolved stripes stay muted in Board',
  );
  const tierStyle = w.getComputedStyle(deck.querySelector('.m2-card-top > span:last-child'));
  assert.equal(tierStyle.placeItems, 'center');
  assert.equal(tierStyle.textAlign, 'center');
  assert.equal(card.initiative, 12);
  console.log(
    'PASS: Large artwork ownership, crop/fade/blur styles, load/error fallback, printed Deck values and hidden-card privacy',
  );
} finally {
  w.GOA2Mobile2D.destroy();
  w.close();
}
