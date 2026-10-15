import { componentProp } from './react.js';
import { c, q } from './runtime.js';
import { addExtra, extras } from './ui.js';

const heroClocks = new Map();
const clockFields = {
  PLANNING: ['planning_allowance_ms', 'time_bank_ms'],
  RESOLUTION: ['initiative_bonus_ms', 'resolution_allowance_ms', 'time_bank_ms'],
  RESPONSE: ['response_time_ms', 'resolution_allowance_ms', 'time_bank_ms'],
  LEVEL_UP: ['upgrade_allowance_ms', 'time_bank_ms'],
};
function clockText(ms) {
  const value = Math.abs(ms), sign = ms < 0 ? '-' : '';
  if (value < 10000) return sign + (value / 1000).toFixed(1) + 's';
  const seconds = Math.ceil(value / 1000);
  return sign + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}
function heroClockSummary(id) { return heroClocks.get(id) || null; }

// Mirror the native, synchronized clocks. They already handle pool spending,
// pause, advisory overruns and server updates; never run a second countdown.
function updateHeroClocks(sidebar, header) {
  heroClocks.clear();
  const sources = Array.from(header?.querySelectorAll(c('clock')) || []);
  for (const box of sidebar.querySelectorAll('[data-m2="hero"]')) {
    const hero = componentProp(box, 'hero');
    const name = q(':scope>' + c('name'), box);
    if (!name || !hero) continue;
    const source = sources.find(node => {
      const heroes = componentProp(node, 'heroes');
      if (Array.isArray(heroes)) {
        const siblings = Array.from(node.parentElement.querySelectorAll(':scope>' + c('clock')));
        // MatchClocks omits heroes without a player clock.
        const clock = componentProp(node, 'clock');
        const shown = clock?.players ? heroes.filter(h => clock.players[h.id]) : heroes;
        return shown[siblings.indexOf(node)]?.id === hero.id;
      }
      return q(':scope>' + c('hero'), node)?.textContent.trim() === hero.name;
    });
    const pools = source && q(c('pools'), source);
    let display = q('.m2-hero-clock', name);
    if (!pools) {
      if (display) { extras.delete(display); display.remove(); }
      continue;
    }
    const clock = componentProp(source, 'clock');
    const running = clock?.status === 'RUNNING' && !!clock.players?.[hero.id]?.running;
    const tone = ['critical', 'warning', 'over'].find(t => source.matches(c(t))) || '';
    const values = Array.from(pools.children).map(pool => ({
      label: q('small', pool)?.textContent || '',
      value: q('strong', pool)?.textContent || '',
    }));
    const player = clock?.players?.[hero.id];
    const locked = values.some(v => /^locked$/i.test(v.value));
    const phase = componentProp(source, 'phase') || componentProp(header, 'view')?.phase ||
      q(c('phase'), header)?.textContent.trim();
    const kind = player?.running && clock?.active?.hero_ids?.includes(hero.id)
      ? clock.active.kind : phase;
    const fields = clockFields[kind] || ['time_bank_ms'];
    const field = fields.find(key => Number(player?.[key]) > 0) || 'time_bank_ms';
    const milliseconds = field === 'time_bank_ms'
      ? Number(player?.time_bank_ms || 0) - Number(player?.overrun_ms || 0)
      : Number(player?.[field]);
    const fallback = values.find(v => !/^bank$/i.test(v.label)) || values[0];
    const text = locked ? '✓' : player && Number.isFinite(Number(player[field]))
      ? clockText(milliseconds) : fallback?.value || '—';
    heroClocks.set(hero.id, { text, locked, running, tone, paused: clock?.status === 'PAUSED',
      label: locked ? 'Card locked' : (field === 'time_bank_ms' ? 'Bank ' : 'Clock ') + text });
    const key = JSON.stringify([values, source.title, running, tone, clock?.status]);
    if (display?.dataset.key === key) continue;
    if (!display) {
      display = document.createElement('span');
      display.className = 'm2-hero-clock';
      name.append(display);
      addExtra(display);
    }
    display.dataset.key = key;
    display.dataset.running = String(running);
    display.dataset.tone = tone;
    display.title = source.title + (clock?.status === 'PAUSED' ? ' · Paused' : '');
    display.setAttribute('aria-label', values.map(v => v.label + ' ' + v.value).join(' · ') +
      (clock?.status === 'PAUSED' ? ' · Paused' : ''));
    display.replaceChildren();
    const phaseValues = values.filter(v => !/^bank$/i.test(v.label));
    const bank = values.find(v => /^bank$/i.test(v.label));
    const primary = document.createElement('strong');
    primary.className = 'm2-clock-pool';
    const phaseFields = fields.filter(key => key !== 'time_bank_ms');
    const phaseTotal = phaseFields.reduce((sum, key) => sum + Number(player?.[key] || 0), 0);
    primary.textContent = locked ? '-' : phaseFields.length &&
      phaseFields.every(key => Number.isFinite(Number(player?.[key])))
      ? clockText(phaseTotal) : phaseValues.map(v => v.value).join(' + ') || '-';
    display.append(primary);
    if (bank) {
      const separator = document.createElement('span');
      separator.textContent = '/';
      const amount = document.createElement('strong');
      amount.className = 'm2-clock-bank';
      amount.textContent = bank.value;
      display.append(separator, amount);
    }
  }
}

export { heroClockSummary, updateHeroClocks };
