import { trackCardSource } from './card-highlight.js';
import { centerBoardHero } from './camera.js';
import {
  cardColors,
  cardSymbol,
  goldSymbol,
  itemUpgradeSymbols,
  miniatureCard,
  ultimateIndicator,
} from './cards.js';
import { inspectHeroCard, updateHeroDashboard, updateTurnPortrait } from './heroes.js';
import { refresh } from './main.js';
import { componentProp } from './react.js';
import { c, q, root, uiState } from './runtime.js';
import { clearHeroCard, summary } from './ui.js';

function renderFocusedHero(h, upgradeRequest) {
  const source = Array.from(document.querySelectorAll('[data-m2="sidebar"] [data-m2="hero"]'))
    .find(box => componentProp(box, 'hero')?.id === h.id);
  const hero = source && componentProp(source, 'hero');
  if (!hero) { uiState.focusedHeroId = null; return false; }
  let box = q('.m2-focused-hero', summary);
  if (!box || box.dataset.heroId !== h.id) {
    summary.replaceChildren();
    box = document.createElement('section');
    box.className = 'm2-focused-hero';
    box.dataset.m2 = 'hero';
    box.dataset.heroId = h.id;
    box.toggleAttribute('data-m2-other', source.hasAttribute('data-m2-other'));
    for (const selector of [c('name'), c('details')]) {
      const native = q(':scope>' + selector, source);
      if (native) box.append(native.cloneNode(true));
    }
    summary.append(box);
  }
  // Native hand dots and player labels can change while this entry stays focused.
  for (const selector of [c('name'), c('details')]) {
    const native = q(':scope>' + selector, source), copy = q(':scope>' + selector, box);
    if (native && copy && native.innerHTML !== copy.innerHTML) copy.innerHTML = native.innerHTML;
  }
  const view = componentProp(q('[data-m2="sidebar"]'), 'view');
  updateHeroDashboard(box, view, hero, upgradeRequest);
  box.ondblclick = event => {
    if (!event.target.closest('button')) { event.preventDefault(); centerBoardHero(h.id); }
  };
  box.classList.toggle('m2-current-hero', !!h.resolution?.current);
  box.classList.toggle('m2-pending-hero', !!h.resolution);
  box.classList.toggle('m2-done-hero', h.done);
  updateTurnPortrait(box, h.resolution, h.done, h.offboard, /^RESOLUTION$/i.test(view?.phase));
  const portrait = q('.m2-hero-portrait', box);
  if (portrait && !q('.m2-focus-back', portrait)) {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'm2-focus-back';
    back.textContent = '◀';
    back.setAttribute('aria-label', 'Back to hero summaries');
    back.onclick = () => { uiState.focusedHeroId = null; clearHeroCard(); delete summary.dataset.key; refresh(); };
    portrait.append(back);
  }
  return true;
}
// Clone only the generated portrait and its current turn/initiative badges.
// Native hero nodes remain in the sidebar; buttons select the focused identity.
function renderFocusPortraits(heroes) {
  let strip = q('.m2-focus-portraits', summary);
  if (!strip) {
    strip = document.createElement('nav');
    strip.className = 'm2-focus-portraits';
    strip.setAttribute('aria-label', 'Heroes in turn order');
    summary.append(strip);
  }
  const sources = Array.from(document.querySelectorAll('[data-m2="sidebar"] [data-m2="hero"]'));
  const entries = heroes.filter(h => h.id).map(h => {
    const source = sources.find(box => componentProp(box, 'hero')?.id === h.id);
    return { h, portrait: source && q('.m2-hero-portrait', source) };
  });
  const key = JSON.stringify(entries.map(({h, portrait}) =>
    [h.id, h.name, h.resolution?.current, h.done, portrait?.outerHTML, h.id === uiState.focusedHeroId]));
  if (strip.dataset.key === key) return;
  strip.dataset.key = key;
  const scroll = strip.scrollLeft;
  strip.replaceChildren();
  for (const {h, portrait} of entries) {
    if (!portrait) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'm2-focus-hero-icon';
    button.dataset.m2 = 'hero';
    button.dataset.heroId = h.id;
    button.classList.toggle('m2-current-hero', !!h.resolution?.current);
    button.classList.toggle('m2-done-hero', h.done);
    button.setAttribute('aria-label', 'Show ' + h.name);
    button.setAttribute('aria-pressed', String(h.id === uiState.focusedHeroId));
    button.title = h.name + ' · Double-click to center on Board at 250%';
    const copy = portrait.cloneNode(true);
    copy.querySelectorAll('.m2-hero-center').forEach(node => node.remove());
    button.append(copy);
    button.onclick = () => {
      uiState.focusedHeroId = h.id;
      clearHeroCard();
      delete summary.dataset.key;
      refresh();
    };
    button.ondblclick = event => { event.preventDefault(); centerBoardHero(h.id); };
    strip.append(button);
  }
  strip.scrollLeft = scroll;
}
function renderSummary(heroes, upgradeRequest = null) {
  if (summary.classList.contains('m2-summary-focused') !== !!uiState.focusedHeroId) {
    summary.classList.toggle('m2-summary-focused', !!uiState.focusedHeroId);
    // Do not carry a previous scrolled overview into the replacement hero entry.
    summary.scrollLeft = 0;
    summary.scrollTop = 0;
  }
  if (uiState.focusedHeroId) {
    const h = heroes.find(hero => hero.id === uiState.focusedHeroId);
    if (h && renderFocusedHero(h, upgradeRequest)) { renderFocusPortraits(heroes); delete summary.dataset.key; return; }
    uiState.focusedHeroId = null;
    summary.classList.remove('m2-summary-focused');
    root.style.setProperty('--m2-summary-h', heroes.length * 32 + 12 + 'px');
  }
  const key = JSON.stringify(heroes);
  if (summary.dataset.key === key) return;
  summary.dataset.key = key;
  summary.replaceChildren();
  const separator = () => {
    const dot = document.createElement('span');
    dot.className = 'm2-summary-separator';
    dot.textContent = '·';
    dot.setAttribute('aria-hidden', 'true');
    return dot;
  };
  for (const h of heroes) {
    const row = document.createElement('article');
    if (h.resolution?.current) row.classList.add('m2-current-hero');
    if (h.done) row.classList.add('m2-done-hero');
    const turn = document.createElement('span');
    turn.className = 'm2-summary-turn';
    let status;
    if (h.resolution) {
      const order = document.createElement('b');
      order.textContent = h.resolution.current ? 'NOW' : h.resolution.order + '.';
      turn.append(order, cardSymbol('INITIATIVE', h.resolution.initiative));
      status = 'Turn ' + order.textContent + ', initiative ' + h.resolution.initiative;
    } else if (h.upgrading || h.planning) {
      const selecting = h.upgrading ? h.upgradeRemaining > 0 : !h.committed;
      const unknown = h.upgrading && h.upgradeRemaining === null;
      status = unknown ? 'Waiting' : selecting ? 'Selecting' : h.upgrading ? 'Done' : 'Selected';
      if (selecting) {
        const dots = document.createElement('span');
        dots.className = 'm2-selecting-dots';
        dots.textContent = '...';
        dots.setAttribute('aria-hidden', 'true');
        turn.append(dots);
      } else turn.textContent = unknown ? '…' : '✓';
    } else {
      turn.textContent = h.offboard ? '☠' : h.done ? '✓' : '—';
      status = h.offboard ? 'Off board' : h.done ? 'Turn completed' : 'No card played';
    }
    turn.title = status;
    turn.setAttribute('aria-label', status);

    const identity = document.createElement('span');
    identity.className = 'm2-summary-identity';
    identity.setAttribute('role', 'button');
    identity.tabIndex = 0;
    identity.setAttribute('aria-label', 'Open ' + h.name);
    const focus = () => { if (h.id) { uiState.focusedHeroId = h.id; clearHeroCard(); refresh(); } };
    identity.onclick = focus;
    identity.onkeydown = event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); focus(); }
    };
    identity.title = h.name;
    const [heroName, ...playerParts] = h.name.split(/[·•]/);
    const name = document.createElement('strong');
    name.textContent = heroName.trim();
    name.style.color = h.color;
    identity.append(name);
    if (playerParts.length) {
      const player = document.createElement('span');
      player.className = 'm2-summary-player';
      const playerName = playerParts.join('·').trim();
      player.textContent = playerName.includes('(You)') ? '(You)' : playerName;
      identity.append(separator(), player);
    }
    const level = document.createElement('span');
    level.className = 'm2-summary-level';
    level.textContent = h.level == null ? 'Lv.—' : 'Lv.' + h.level;
    const gold = goldSymbol(h.gold ?? '—');
    gold.classList.add('m2-gold-overlay');
    const piles = document.createElement('span');
    piles.className = 'm2-summary-piles';
    const add = (label, cards) => {
      const group = document.createElement('span');
      group.append(document.createTextNode(label));
      for (const card of cards) {
        const dot = document.createElement('i');
        dot.style.backgroundColor = card.color;
        dot.style.setProperty('--effect-color', card.color);
        dot.title = card.name || 'Hand card';
        if (card.active) dot.classList.add('m2-effect-active');
        group.append(dot);
      }
      if (!cards.length) group.append(document.createTextNode('–'));
      piles.append(group);
    };
    add('H', h.dots.map(color => ({ color })));
    add('P', h.cardPiles.find(p => p.label === 'P')?.cards || []);
    add('D', h.cardPiles.find(p => p.label === 'D')?.cards || []);
    const resources = document.createElement('span');
    resources.className = 'm2-summary-resources';
    resources.append(level, separator(), gold);
    row.append(turn, identity, resources, piles);
    // Keep a just-resolved card in its fixed column, with a subdued appearance.
    const currentSlot = document.createElement('span');
    currentSlot.className = 'm2-summary-current-slot';
    if (h.currentCard) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'm2-micro-button';
      trackCardSource(button, h.currentCard, 'hero', h.id);
      button.disabled = !!h.currentCard.is_facedown;
      button.setAttribute('aria-label', h.currentCard.is_facedown ? 'Hidden card' : h.currentCard.name);
      button.classList.toggle('m2-card-resolved', h.done && !h.resolution);
      if (h.currentActive) {
        button.classList.add('m2-effect-active');
        button.style.setProperty('--effect-color', cardColors[h.currentCard.color] || '#888');
      }
      button.append(miniatureCard(h.currentCard, h.upgrades));
      button.onclick = () => { inspectHeroCard(h.id, h.currentCard); refresh(); };
      currentSlot.append(button);
    }
    const upgrades = itemUpgradeSymbols(h.upgrades, 'm2-summary-upgrades');
    upgrades.prepend(ultimateIndicator(h, true));
    row.append(currentSlot, upgrades);
    summary.append(row);
  }
  // Share one compact pile width across every row. Reserve only what the largest
  // H/P/D group needs, rather than leaving a fixed gap after sparse piles.
  const pileWidth = Math.max(26, ...heroes.map(h => {
    const counts = [h.dots.length, ...['P', 'D'].map(label =>
      h.cardPiles.find(pile => pile.label === label)?.cards.length || 0)];
    return Math.ceil(24 + counts.reduce((width, count) => width + (count ? count * 5.5 : 4.5), 0));
  }));
  summary.style.setProperty('--m2-piles-width', pileWidth + 'px');
  // Portrait hero names never ellipsize. Player names surrender space first; at very narrow
  // widths the row can scroll rather than cropping the hero name or overlapping stats.
  const names = Array.from(summary.querySelectorAll('.m2-summary-identity strong'));
  const nameWidth = Math.max(0, ...names.map(name =>
    name.getBoundingClientRect().width || name.textContent.length * 6.2));
  summary.style.setProperty('--m2-name-min', Math.ceil(nameWidth + 8) + 'px');
}

export { renderSummary };
