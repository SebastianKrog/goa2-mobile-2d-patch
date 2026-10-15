import { componentProp } from './react.js';
import { c, q } from './runtime.js';

// Use delivered upgrade counts rather than inferring completion from hero level.
function currentUpgradeRequest() {
  for (const node of document.querySelectorAll('button,[class*="_banner_"],[data-m2="sidebar"]')) {
    const request = componentProp(node, 'inputRequest');
    if (request?.type === 'UPGRADE_PHASE' && request.players) return request;
  }
  return null;
}
function remainingUpgrades(request, heroId) {
  const remaining = request?.players?.[heroId]?.remaining;
  if (typeof remaining === 'number' && Number.isFinite(remaining)) return remaining;
  const sidebar = q('[data-m2="sidebar"]');
  const view = componentProp(sidebar, 'view');
  if (!/^LEVEL[_ ]UP$/i.test(view?.phase || '')) return null;
  // The server can withhold a finished player's private upgrade request.
  const ownId = componentProp(sidebar, 'myHeroId');
  if (ownId === heroId) {
    const isMyTurn = componentProp(sidebar, 'isMyTurn');
    if (typeof isMyTurn === 'boolean') return isMyTurn ? 1 : 0;
  }
  // Other players' waiting names are public even when their offers are private.
  // A nonempty list is required: an empty legacy fallback proves nothing.
  const heroes = Object.values(view.teams || {}).flatMap(team => team.heroes || []);
  const hero = heroes.find(hero => hero.id === heroId);
  if (!hero || ownId === heroId) return null;
  for (const node of document.querySelectorAll(c('toggle') + ',' + c('picker') + ',' + c('pickerUpgrade'))) {
    const waiting = componentProp(node, 'waitingForNames');
    if (!Array.isArray(waiting) || !waiting.length) continue;
    // Use this name mapping only when every public name resolves unambiguously.
    if (!waiting.every(name => heroes.filter(hero => hero.name === name).length === 1)) continue;
    return waiting.includes(hero.name) ? 1 : 0;
  }
  return null;
}


export { currentUpgradeRequest, remainingUpgrades };
