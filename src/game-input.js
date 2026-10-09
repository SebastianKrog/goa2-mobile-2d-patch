import { componentProp } from './react.js';

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
  return typeof remaining === 'number' && Number.isFinite(remaining) ? remaining : null;
}


export { currentUpgradeRequest, remainingUpgrades };
