import { componentProp } from './react.js';
import { c, q, root, uiState } from './runtime.js';
import { addExtra, on } from './ui.js';

// 7. Header, settings, compact Board summaries, and gestures
// Derive a compact HUD from native labels and controls without changing the phase.
// Team rosters can retain defeated minions. Count unique roster IDs that still
// have a board location, rather than counting token artwork or minion values.
function remainingMinions(view, teamColor) {
  const team = view?.teams?.[teamColor],
    locations = view?.board?.entity_locations;
  if (!Array.isArray(team?.minions) || !locations) return null;
  return new Set(
    team.minions.filter((minion) => minion?.id &&
      Object.hasOwn(locations, minion.id) && locations[minion.id] != null)
      .map((minion) => minion.id),
  ).size;
}
// Read current native labels on every refresh, so recovery restores the latest
// game phase/action rather than a snapshot from before the disconnect.
function mobileHeaderStatus(header) {
  const warning = q(c('disconnected'));
  if (warning) {
    const message = warning.textContent.trim()
      .replace(/^Disconnected\s*(?:[—–:-]\s*)?/i, '').trim();
    return { disconnected: true, phase: 'DISCONNECTED', action: message
      ? message.replace(/^reconnecting\b/i, 'Reconnecting') : 'Reconnecting…' };
  }
  const status = q(c('statusCopy'), header),
    title = q('strong', status || header)?.textContent || '',
    rawDetail = q(c('statusDetail'), status || header)?.textContent || '';
  const detail = /locked in$/i.test(title) && rawDetail.includes(' · ')
    ? rawDetail.slice(rawDetail.lastIndexOf(' · ') + 3) : rawDetail;
  return {
    disconnected: false,
    phase: q(c('phase'), header)?.textContent || '',
    action: title + (detail ? ' · ' + detail : ''),
  };
}
let mobileStatusStrip = null;
let statusResizeObserver = null;

// JS measures overflow and handles disclosure; CSS owns every animation frame.
function measureMobileStatus() {
  if (!mobileStatusStrip?.isConnected || !root.hasAttribute('data-m2-active') || uiState.dead) return;
  const status = q('.m2-status', mobileStatusStrip),
    text = q('.m2-status-text', status),
    expanded = mobileStatusStrip.classList.contains('m2-status-expanded');
  const distance = !expanded && status.clientWidth > 0
    ? Math.max(0, text.scrollWidth - status.clientWidth) : 0;
  status.classList.toggle('m2-status-overflow', distance > 0);
  const values = {
    '--m2-ticker-distance': distance + 'px',
    // Keep a readable speed for long messages and pauses at both ends.
    '--m2-ticker-cycle': Math.max(8, distance / (28 * 0.6)).toFixed(2) + 's',
  };
  for (const [name, value] of Object.entries(values))
    if (status.style.getPropertyValue(name) !== value) status.style.setProperty(name, value);
  // Board controls follow the strip when it grows or collapses.
  const height = Math.ceil(mobileStatusStrip.getBoundingClientRect().height);
  if (height > 0 && root.style.getPropertyValue('--m2-status-h') !== height + 'px')
    root.style.setProperty('--m2-status-h', height + 'px');
}
function expandMobileStatus(expanded) {
  if (!mobileStatusStrip || uiState.dead || !root.hasAttribute('data-m2-active') ||
      mobileStatusStrip.classList.contains('m2-status-expanded') === expanded) return;
  mobileStatusStrip.classList.toggle('m2-status-expanded', expanded);
  mobileStatusStrip.setAttribute('aria-expanded', String(expanded));
  measureMobileStatus();
}
function clearMobileStatus() {
  statusResizeObserver?.disconnect();
  statusResizeObserver = null;
  mobileStatusStrip?.classList.remove('m2-status-expanded');
  mobileStatusStrip?.setAttribute('aria-expanded', 'false');
  q('.m2-status', mobileStatusStrip || document)?.classList.remove('m2-status-overflow');
}
function observeMobileStatus() {
  if (statusResizeObserver || typeof ResizeObserver === 'undefined') return;
  statusResizeObserver = new ResizeObserver(measureMobileStatus);
  for (const node of [mobileStatusStrip, q('.m2-status', mobileStatusStrip), q('.m2-status-text', mobileStatusStrip)])
    statusResizeObserver.observe(node);
}
function updateMobileHeader(header, boardPrompt = '') {
  if (!header) return;
  let hud = q('.m2-hud', header);
  if (!hud) {
    hud = document.createElement('div');
    hud.className = 'm2-hud';
    hud.innerHTML =
      '<div class="m2-hud-top"><div class="m2-life red"><img src="/icons/life_counter_red_front.png" alt="Orange lives"><b></b></div><div class="m2-minions red"><img src="/hero-images/minion_melee_red.png" alt=""><b></b></div><div class="m2-round"><span></span><span></span></div><div class="m2-coin"><img alt="Tie breaker"><small></small></div><div class="m2-waves"><img src="/icons/wave_counter.png" alt="Waves"><b></b></div><div class="m2-minions blue"><img src="/hero-images/minion_melee_blue.png" alt=""><b></b></div><div class="m2-life blue"><b></b><img src="/icons/life_counter_blue_front.png" alt="Blue lives"></div></div>';
    header.append(hud);
    addExtra(hud);
  }
  // Only generated nodes are moved; native React elements remain in place.
  if (!mobileStatusStrip) {
    mobileStatusStrip = document.createElement('div');
    mobileStatusStrip.className = 'm2-hud-bottom';
    mobileStatusStrip.innerHTML =
      '<div class="m2-phase"></div><span class="m2-action-dot" aria-hidden="true"></span><div class="m2-status"><span class="m2-status-text"></span></div>';
    mobileStatusStrip.setAttribute('role', 'button');
    mobileStatusStrip.tabIndex = 0;
    mobileStatusStrip.setAttribute('aria-expanded', 'false');
    on(mobileStatusStrip, 'click', () => expandMobileStatus(true));
    on(mobileStatusStrip, 'keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        expandMobileStatus(true);
      } else if (event.key === 'Escape') {
        event.stopPropagation();
        expandMobileStatus(false);
      }
    });
    on(document, 'click', event => {
      if (!mobileStatusStrip.contains(event.target)) expandMobileStatus(false);
    }, { capture: true });
    on(document, 'focusin', event => {
      if (!mobileStatusStrip.contains(event.target)) expandMobileStatus(false);
    });
  }
  if (mobileStatusStrip.parentElement !== header.parentElement ||
      header.nextElementSibling !== mobileStatusStrip)
    header.after(mobileStatusStrip);
  addExtra(mobileStatusStrip);
  observeMobileStatus();
  const put = (sel, text) => {
    const e = q(sel, hud) || q(sel, mobileStatusStrip);
    if (e.textContent !== text) e.textContent = text;
  };
  for (const [team, cls] of [
    ['Red', 'red'],
    ['Blue', 'blue'],
  ])
    put(
      '.m2-life.' + cls + ' b',
      q('[aria-label^="' + team + ' team"] [data-m2-fraction]', header)?.dataset.m2Fraction ||
        '—',
    );
  // Both native PhaseBar and Sidebar receive the public view. The Sidebar
  // fallback also covers header variants whose own props only contain labels.
  const view = componentProp(header, 'view') || componentProp(q(c('sidebar')), 'view');
  for (const team of ['RED', 'BLUE']) {
    const cls = team.toLowerCase(), count = remainingMinions(view, team),
      counter = q('.m2-minions.' + cls, hud),
      label = team + ' minions remaining: ' + (count ?? 'unavailable');
    put('.m2-minions.' + cls + ' b', count === null ? '—' : String(count));
    if (counter.getAttribute('aria-label') !== label) {
      counter.setAttribute('aria-label', label);
      counter.title = label;
    }
  }
  const meta = q(c('matchMeta'), header);
  put('.m2-round span:first-child', meta?.children[0]?.textContent || '');
  put('.m2-round span:last-child', meta?.children[2]?.textContent || '');
  const coin = q(c('tieBreaker'), header),
    img = q('.m2-coin img', hud);
  if (coin && img.getAttribute('src') !== coin.getAttribute('src'))
    img.src = coin.getAttribute('src');
  put('.m2-coin small', coin?.getAttribute('src')?.includes('orange') ? 'ORANGE' : 'BLUE');
  const lanes = Array.from(header.querySelectorAll(c('waveLane')));
  put(
    '.m2-waves b',
    lanes
      .map((e) => e.getAttribute('aria-label')?.match(/(\d+) Wave/i)?.[1] || '0')
      .join(' / ') || '0',
  );
  const headerStatus = mobileHeaderStatus(header);
  mobileStatusStrip.classList.toggle('m2-disconnected', headerStatus.disconnected);
  mobileStatusStrip.classList.toggle('m2-board-prompt', !!boardPrompt && !headerStatus.disconnected);
  put('.m2-phase', headerStatus.phase);
  const message = !headerStatus.disconnected && boardPrompt ? boardPrompt : headerStatus.action;
  const text = q('.m2-status-text', mobileStatusStrip);
  if (text.textContent !== message) {
    // Replacing only our text node restarts a new message at its beginning.
    const status = text.parentElement;
    status.classList.remove('m2-status-overflow');
    put('.m2-status-text', message);
    statusResizeObserver?.unobserve(text);
    const replacement = text.cloneNode(true);
    text.replaceWith(replacement);
    statusResizeObserver?.observe(replacement);
  }
  measureMobileStatus();
  // Keep fractional CSS pixels so the strip meets the header without a seam.
  const height = header.getBoundingClientRect().height;
  if (height > 4 && root.style.getPropertyValue('--m2-head') !== height + 'px')
    root.style.setProperty('--m2-head', height + 'px');
}
// Shared slim/normal row structure: initiative, colored primary/name/range band,
// then secondary stats. Adapt the contents while preserving native row click handlers.

export { clearMobileStatus, updateMobileHeader };
