// The live API exposes player-scoped decision history, not event deltas. Keep
// server decisions separate from received events: a decision is not a combat event.
// Never fetch the admin/omniscient replay routes or create a public replay share.
let logTab = 'events',
  logTabChosen = false,
  decisionHistory = { scope: '', rows: [], total: 0, revision: 0, status: '', due: 0, etag: '', request: null };
function cancelDecisionHistory() {
  if (decisionHistory.request) {
    decisionHistory.due = 0;
    decisionHistory.status = decisionHistory.rows.length ? 'Match decision history' : '';
  }
  decisionHistory.request?.abort();
  decisionHistory.request = null;
}
function resetDecisionHistory() {
  cancelDecisionHistory();
  decisionHistory = { scope: '', rows: [], total: 0, revision: 0, status: '', due: 0, etag: '', request: null };
  logTab = 'events';
  logTabChosen = false;
  delete logPanel.dataset.key;
}
function currentLogScope() {
  const match = location.pathname.match(/^\/game\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return { gameId: decodeURIComponent(match[1]), token: new URLSearchParams(location.search).get('token') || '' };
  } catch { return null; }
}
function validDecision(row) {
  return row && Number.isInteger(row.index) && row.index >= 0 && typeof row.type === 'string' &&
    typeof row.label === 'string' && row.label.length <= 2000;
}
function requestDecisionHistory(force = false) {
  const scope = currentLogScope();
  if (!scope || typeof fetch !== 'function') return;
  const key = JSON.stringify([scope.gameId, scope.token]);
  if (decisionHistory.scope !== key) {
    resetDecisionHistory();
    decisionHistory.scope = key;
  }
  const state = decisionHistory;
  if (state.request || (!force && Date.now() < state.due)) return;
  const request = new AbortController();
  state.request = request;
  state.status = 'Loading match history…';
  state.due = Date.now() + 10000;
  const headers = {};
  if (scope.token) headers.Authorization = 'Bearer ' + scope.token;
  if (state.etag) headers['If-None-Match'] = state.etag;
  // This is the same GET and token used by the website's rewind-history picker.
  fetch('/api/games/' + encodeURIComponent(scope.gameId) + '/overrides/history', {
    method: 'GET', headers, signal: request.signal,
  }).then(async response => {
    if (request.signal.aborted || state !== decisionHistory) return;
    if (response.status === 304) {
      state.status = 'Match decision history';
      return;
    }
    if (!response.ok) {
      state.due = Date.now() + ([401, 403, 404].includes(response.status) ? 60000 : 10000);
      throw new Error('History unavailable');
    }
    const data = await response.json();
    if (request.signal.aborted || state !== decisionHistory) return;
    if (!Number.isInteger(data?.total) || data.total < 0 || !Array.isArray(data.decisions) ||
        !data.decisions.every(validDecision)) throw new Error('Invalid history');
    // Reconcile the full response, including rewinds/superseded choices. The API
    // has no after-index parameter; ETags avoid downloading unchanged data if supported.
    const rows = [...new Map(data.decisions.map(row => [row.index, {
      index: row.index, type: row.type, label: row.label, round: row.round,
      turn: row.turn, hero_id: row.hero_id, superseded: row.superseded === true,
    }])).values()].sort((a, b) => a.index - b.index).slice(-EVENT_LIMIT);
    if (JSON.stringify(rows) !== JSON.stringify(state.rows) || data.total !== state.total) state.revision++;
    state.rows = rows;
    state.total = data.total;
    state.etag = response.headers?.get('ETag') || '';
    state.status = 'Match decision history';
    if (!logTabChosen && !savedEvents.length && rows.length) logTab = 'decisions';
  }).catch(() => {
    if (request.signal.aborted || state !== decisionHistory) return;
    state.status = 'Match history unavailable. Saved events are still available.';
  }).finally(() => {
    if (request.signal.aborted || state !== decisionHistory || state.request !== request) return;
    state.request = null;
    renderLogPanel();
  });
}
function buildLogPanel() {
  logPanel.innerHTML = '<div class="m2-panel-title"><h2>Log</h2><button type="button">Refresh</button></div><div class="m2-log-tabs"><button type="button" data-log-tab="events">Events</button><button type="button" data-log-tab="decisions">Decisions</button></div><p class="m2-log-status" role="status"></p><div class="m2-log-entries"></div>';
  on(q('.m2-panel-title button', logPanel), 'click', () => updateLogPanel(true));
  for (const button of logPanel.querySelectorAll('[data-log-tab]')) on(button, 'click', () => {
    logTab = button.dataset.logTab;
    logTabChosen = true;
    delete logPanel.dataset.key;
    renderLogPanel();
  });
}
function renderLogPanel() {
  if (!logPanel.firstChild) buildLogPanel();
  const state = decisionHistory, entries = q('.m2-log-entries', logPanel),
    key = JSON.stringify([logTab, historyRevision, state.revision, historyError]);
  for (const button of logPanel.querySelectorAll('[data-log-tab]'))
    button.setAttribute('aria-pressed', String(button.dataset.logTab === logTab));
  q('.m2-panel-title button', logPanel).disabled = !!state.request;
  q('.m2-log-status', logPanel).textContent = logTab === 'decisions'
    ? state.status || 'Match history is fetched when Log opens.'
    : historyError || 'Events received on this device · ' + savedEvents.length;
  if (logPanel.dataset.key === key) return;
  logPanel.dataset.key = key;
  const open = new Set([...entries.querySelectorAll('details[open]')].map(row => row.dataset.key));
  const atBottom = entries.scrollHeight - entries.clientHeight - entries.scrollTop < 30;
  const oldScroll = entries.scrollTop;
  entries.replaceChildren();
  const rows = logTab === 'decisions' ? state.rows : savedEvents;
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'm2-log-empty';
    empty.textContent = logTab === 'decisions' ? 'No match decisions available.' : 'No events received yet.';
    entries.append(empty);
  }
  for (const entry of rows) {
    const row = document.createElement('details'), title = document.createElement('summary'),
      data = document.createElement('pre');
    row.dataset.key = logTab === 'decisions' ? String(entry.index) : eventKey(entry);
    row.open = open.has(row.dataset.key);
    if (logTab === 'decisions') {
      row.classList.toggle('m2-log-superseded', entry.superseded);
      const moment = [entry.round != null ? 'R' + entry.round : '', entry.turn != null ? 'T' + entry.turn : ''].filter(Boolean).join(' · ');
      title.textContent = (moment ? moment + ' · ' : '') + entry.label + (entry.superseded ? ' (undone)' : '');
      data.textContent = JSON.stringify(entry, null, 2);
    } else {
      title.textContent = savedEventText(entry);
      data.textContent = JSON.stringify(entry.event, null, 2);
    }
    row.append(title, data);
    entries.append(row);
  }
  entries.scrollTop = atBottom ? entries.scrollHeight : oldScroll;
}
function updateLogPanel(force = false) {
  // Hide the old floating trigger/container without opening or moving React nodes.
  for (const toggle of document.querySelectorAll('button' + c('toggle')))
    if (Array.isArray(componentProp(toggle, 'eventLog'))) tag(toggle.parentElement, 'native-log');
  const active = root.hasAttribute('data-m2-active') && panel === 'log';
  if (!active) { cancelDecisionHistory(); return; }
  if (document.visibilityState !== 'hidden') requestDecisionHistory(force);
  renderLogPanel();
}
