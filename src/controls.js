import { navigate } from './navigation.js';
import { c, managedAttribute, q, uiState } from './runtime.js';
import { addExtra, extras, on } from './ui.js';

let planningActions = null;
// Create compact proxies for native take-back/finish controls. Their original click
// handlers still validate actions, while the proxies can fit the mobile layout.
function updatePlanningActions() {
  const sources = Array.from(
    document.querySelectorAll(c('takeBackBtn') + ',' + c('finishPlanningBtn')),
  ).filter(source => uiState.mode !== 'board' || !source.matches(c('takeBackBtn')));
  const host = uiState.mode === 'board' ? q('[data-m2="board"]') : q('[data-m2="hand-list"]');
  if (!sources.length || !host) {
    if (planningActions) {
      planningActions.element.remove();
      extras.delete(planningActions.element);
    }
    planningActions = null;
    return;
  }
  if (!planningActions) {
    const element = document.createElement('div');
    element.className = 'm2-planning-actions';
    planningActions = { element, sources: [] };
    addExtra(element);
  }
  const state = planningActions;
  state.element.classList.toggle('m2-on-board', uiState.mode === 'board');
  if (state.element.parentElement !== host) host.append(state.element);
  if (
    sources.length !== state.sources.length ||
    sources.some((source, i) => source !== state.sources[i])
  ) {
    state.sources = sources;
    state.element.replaceChildren(
      ...sources.map((source) => {
        const button = document.createElement('button');
        button.type = 'button';
        on(button, 'click', () => source.click());
        return button;
      }),
    );
  }
  sources.forEach((source, i) => {
    const button = state.element.children[i];
    if (button.textContent !== source.textContent) button.textContent = source.textContent;
    button.disabled = source.disabled;
  });
}


// Proxies live in board coordinates, outside native centered wrappers. They only
// open native choices; the website retains all decision and validation handlers.
function updateChoiceLaunchers(boardControls = []) {
  const board = q('[data-m2="board"]');
  if (!board) return;
  let host = q('.m2-choice-launchers', board);
  if (!host) {
    host = document.createElement('div');
    host.className = 'm2-choice-launchers';
    board.append(host);
    addExtra(host);
  }
  const sources = boardControls.length ? [...boardControls].sort((a, b) =>
    Number(/^Undo$/i.test(b.textContent.trim())) - Number(/^Undo$/i.test(a.textContent.trim()))) : Array.from(board.querySelectorAll('button')).filter(button =>
    !button.closest('.m2-choice-launchers') && /^(Options|Setup|Upgrades?)$/i.test(button.textContent.trim())
  );
  for (const button of new Set([...(host._sources || []), ...document.querySelectorAll('[data-m2-choice-source]')])) {
    if (!sources.includes(button)) button.removeAttribute('data-m2-choice-source');
  }
  for (const source of sources) managedAttribute(source, 'data-m2-choice-source', 'true');
  const setup = !!q('[data-m2="setup"]');
  const key = JSON.stringify([setup, sources.map(button => [button.textContent, button.disabled])]);
  if (host._sources?.length === sources.length && host._sources.every((source, i) => source === sources[i]) && host.dataset.key === key) return;
  host._sources = sources;
  host.dataset.key = key;
  host.replaceChildren();
  for (const source of sources) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = source.textContent.trim();
    button.disabled = source.disabled;
    button.classList.toggle('m2-undo', /^Undo$/i.test(button.textContent));
    button.onclick = () => source.click();
    host.append(button);
  }
  if (setup && !sources.some(button => /^Setup$/i.test(button.textContent.trim()))) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Setup';
    button.onclick = () => navigate('setup');
    host.append(button);
  }
  host.hidden = !host.children.length;
}

export { updateChoiceLaunchers, updatePlanningActions };
