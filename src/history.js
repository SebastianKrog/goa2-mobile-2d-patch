// Persist only the events already delivered to the rendered EventLog component.
// 9. Received-event history
// This archive contains only events delivered to this browser. It cannot backfill
// events missed while offline. Storage is per game pathname and capped at 2,000 entries.
const EVENT_LIMIT = 2000;
let eventHistoryKey = '',
  savedEvents = [],
  seenEvents = new Set(),
  historyDirty = false,
  historyError = '',
  historyRevision = 0,
  lastLogArrays = new Set(),
  blockedLogArrays = new WeakSet();
const pendingHistoryWrites = new Map();
// Event IDs can restart after refresh; include timestamp and payload for deduplication.
function eventKey(entry) {
  return JSON.stringify([entry.timestamp, entry.id, entry.event]);
}

// Keep failed writes queued per game; a temporary storage failure must not discard received events.
function flushEventHistory() {
  if (historyDirty && eventHistoryKey) {
    pendingHistoryWrites.set(eventHistoryKey, JSON.stringify(savedEvents));
    historyDirty = false;
  }
  if (!pendingHistoryWrites.size) return;
  historyError = '';
  for (const [key, data] of pendingHistoryWrites) {
    try {
      localStorage.setItem(key, data);
      pendingHistoryWrites.delete(key);
    } catch {
      historyError = 'Event history could not be saved on this device. Retrying…';
    }
  }
}

// SPA navigation can leave old components mounted briefly. Quarantine their event arrays.
function changeEventGame() {
  const key = 'goa2-mobile-events:' + location.pathname;
  if (key === eventHistoryKey) return false;
  flushEventHistory();
  if (eventHistoryKey) blockedLogArrays = new WeakSet(lastLogArrays);
  lastLogArrays = new Set();
  eventHistoryKey = key;
  savedEvents = [];
  seenEvents.clear();
  historyDirty = false;
  historyError = '';
  historyRevision++;
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(value))
      savedEvents = value
        .filter((x) => x?.event && typeof x.event === 'object' && typeof x.timestamp === 'number')
        .slice(-EVENT_LIMIT);
  } catch {
    historyError = 'Saved event history could not be read on this device.';
  }
  seenEvents = new Set(savedEvents.map(eventKey));
  for (const el of document.querySelectorAll('.m2-saved-events')) el.remove();
  expandedHeroIds.clear();
  clearHeroCard();
  return true;
}
// Prefer supplied text, then common event summaries. Unknown event types still get
// a readable fallback; expandable raw metadata preserves details not summarized here.
function savedEventText(entry) {
  const event = entry.event,
    meta = event.metadata || {},
    names = entry.names || {};
  const name = (id) => {
    const record = names[id];
    return typeof record === 'string' ? record : record?.name || id || '';
  };
  const actor = name(event.actor_id),
    target = name(event.target_id),
    type = String(event.event_type || event.type || 'Event');
  if (entry.text) return String(entry.text);
  switch (type) {
    case 'MOVE':
    case 'UNIT_MOVED':
      return (actor || target || 'A unit') + ' moved';
    case 'ATTACK':
      return (
        (actor || 'A unit') +
        ' attacked ' +
        (target || 'a target') +
        (meta.damage != null ? ' for ' + meta.damage + ' damage' : '')
      );
    case 'CARD_PLAYED':
      return (
        (actor || 'A hero') + ' played ' + (meta.card_name || name(meta.card_id) || 'a card')
      );
    case 'GOLD_GAINED':
      return (actor || target || 'A hero') + ' gained ' + (meta.amount ?? '') + ' gold';
    case 'DEATH':
    case 'KNOCKOUT':
    case 'UNIT_DEFEATED':
      return (target || actor || 'A unit') + ' was defeated';
    case 'TURN_ENDED':
    case 'TURN_END':
      return 'Turn ended';
    default:
      return [actor, type.toLowerCase().replaceAll('_', ' '), target && '→ ' + target]
        .filter(Boolean)
        .join(' ');
  }
}
// Merge current delivered entries with the local archive, then show only archived
// entries absent from the native log. The native log remains responsible for live rows.
function updateEventHistory() {
  if (dead) return;
  committedFiberCache.clear();
  changeEventGame();
  for (const toggle of document.querySelectorAll('button' + c('toggle'))) {
    const events = componentProp(toggle, 'eventLog');
    if (!Array.isArray(events) || blockedLogArrays.has(events)) continue;
    lastLogArrays.add(events);
    if (lastLogArrays.size > 4) lastLogArrays.delete(lastLogArrays.values().next().value);
    // Do not collect an old, still-mounted game component after SPA navigation.
    const gameId = componentProp(toggle, 'gameId');
    if (
      gameId &&
      decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '') !==
        String(gameId)
    )
      continue;
    let changed = false;
    for (const entry of events) {
      if (!entry?.event || typeof entry.timestamp !== 'number') continue;
      const key = eventKey(entry);
      if (seenEvents.has(key)) continue;
      seenEvents.add(key);
      savedEvents.push(entry);
      changed = true;
    }
    if (changed) {
      savedEvents = savedEvents.slice(-EVENT_LIMIT);
      seenEvents = new Set(savedEvents.map(eventKey));
      historyDirty = true;
      historyRevision++;
    }
    flushEventHistory();
    if (!root.hasAttribute('data-m2-active')) continue;
    const container = toggle.parentElement,
      log = q(c('log'), container);
    if (!log) continue;
    const liveKeys = new Set(events.map(eventKey)),
      earlier = savedEvents.filter((entry) => !liveKeys.has(eventKey(entry)));
    let history = q('.m2-saved-events', log);
    const renderKey = JSON.stringify([historyRevision, earlier.map(eventKey), historyError]);
    const empty = q(c('empty'), log);
    if (empty) {
      empty.hidden = earlier.length > 0;
      empty.dataset.m2HistoryEmpty = 'true';
    }
    if (!earlier.length && !historyError) {
      history?.remove();
      continue;
    }
    if (history?.dataset.key === renderKey) continue;
    if (!history) {
      history = document.createElement('div');
      history.className = 'm2-saved-events';
      log.prepend(history);
      extras.add(history);
    }
    const open = new Set(
      Array.from(history.querySelectorAll('details[open]')).map((el) => el.dataset.key),
    );
    history.dataset.key = renderKey;
    history.replaceChildren();
    const label = document.createElement('small');
    label.textContent = historyError || 'Saved on this device · earlier events';
    history.append(label);
    for (const entry of earlier) {
      const row = document.createElement('details'),
        title = document.createElement('summary'),
        data = document.createElement('pre');
      row.dataset.key = eventKey(entry);
      row.open = open.has(row.dataset.key);
      title.textContent = savedEventText(entry);
      data.textContent = JSON.stringify(entry.event, null, 2);
      row.append(title, data);
      history.append(row);
    }
  }
  flushEventHistory();
}
on(window, 'pagehide', updateEventHistory);
// Periodic collection also runs when no relevant DOM mutation occurs; pagehide
// attempts a final collection/write before the document is unloaded.
const eventHistoryTimer = setInterval(updateEventHistory, 1500);

