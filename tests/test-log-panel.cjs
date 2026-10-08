const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const event = (id) => ({ id, timestamp: id, event: { event_type: 'MOVE', actor_id: 'Hanu' } });
const decision = (index, extras = {}) => ({
  index,
  type: 'COMMIT_CARD',
  label: 'A hidden card was committed',
  round: 1,
  turn: 2,
  ...extras,
});
function setup(t, { events = [], saved, url } = {}) {
  const fixture = browserFixture({
    html: '<aside class="_sidebar_test"></aside><div class="native-log"><button class="_toggle_test">Log</button><div class="_log_test"><div class="_empty_test">No events yet</div></div></div>',
    url: url || 'https://goa2.frontend.pedroliv.dev/game/test?3d=0&token=test-token',
    hooks: ['updateEventHistory', 'refresh'],
  });
  t.after(() => fixture.close());
  const props = { eventLog: events, gameId: 'test' };
  fixture.d.querySelector('._toggle_test').__reactFiber$test = { memoizedProps: props };
  if (saved) fixture.w.localStorage.setItem('goa2-mobile-events:/game/test', JSON.stringify(saved));
  const calls = [];
  fixture.w.fetch = (url, options) =>
    new Promise((resolve) => calls.push({ url, options, resolve }));
  fixture.install();
  return {
    ...fixture,
    props,
    calls,
    open: () => fixture.d.querySelector('[data-mode="log"]').click(),
  };
}
function respond(call, data, status = 200, etag = '') {
  call.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    headers: { get: () => etag },
  });
}

test('Log sits before Settings, displays archived/live events once, and replaces the native floating trigger', (t) => {
  const { w, d, calls, open, media } = setup(t, {
    saved: [event(1)],
    events: [event(1), event(2)],
  });
  const nav = [...d.querySelectorAll('#goa2-m2-nav button:not([hidden])')].map(
    (button) => button.textContent,
  );
  assert.deepEqual(nav, ['Heroes', 'Hand', 'Deck', 'Log', 'Settings']);
  assert.equal(calls.length, 0, 'closed Log does not make history requests');
  assert.equal(w.getComputedStyle(d.querySelector('.native-log')).display, 'none');
  open();
  assert.equal(d.documentElement.dataset.m2Panel, 'log');
  assert.equal(w.getComputedStyle(d.getElementById('goa2-m2-log')).display, 'flex');
  assert.equal(d.querySelectorAll('.m2-log-entries details').length, 2);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/games/test/overrides/history');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
  assert(!d.getElementById('goa2-m2-log').outerHTML.includes('test-token'));
  open();
  assert.equal(d.documentElement.dataset.m2Panel, '');
  assert(calls[0].options.signal.aborted);
  media.matches = false;
  w.testUI.refresh();
  assert.notEqual(
    w.getComputedStyle(d.querySelector('.native-log')).display,
    'none',
    'desktop restores the native log',
  );
});

test('server history respects masked labels, coalesces requests and handles ETags and rewinds', async (t) => {
  const { w, d, calls, open } = setup(t);
  open();
  w.testUI.updateEventHistory();
  w.testUI.updateEventHistory();
  assert.equal(calls.length, 1);
  respond(
    calls[0],
    {
      total: 3,
      decisions: [
        decision(1),
        decision(2, { superseded: true }),
        decision(3, { label: '<script>text</script>' }),
      ],
    },
    200,
    'revision-1',
  );
  await tick();
  assert.equal(
    d.querySelector('[data-log-tab="decisions"]').getAttribute('aria-pressed'),
    'true',
    'a new device with no events starts with earlier server decisions',
  );
  assert.equal(d.querySelectorAll('.m2-log-entries details').length, 3);
  assert(d.querySelector('.m2-log-superseded').textContent.includes('(undone)'));
  assert(!d.querySelector('.m2-log-entries script'), 'server labels remain plain text');
  assert(d.querySelector('.m2-log-entries').textContent.includes('A hidden card was committed'));
  assert(!d.getElementById('goa2-m2-log').outerHTML.includes('test-token'));
  w.testUI.updateEventHistory();
  assert.equal(calls.length, 1, 'idle collection respects the request cooldown');
  const first = d.querySelector('.m2-log-entries details');
  first.open = true;
  d.querySelector('.m2-panel-title button').click();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.headers['If-None-Match'], 'revision-1');
  respond(calls[1], null, 304);
  await tick();
  assert.equal(
    d.querySelector('.m2-log-entries details'),
    first,
    'unchanged data preserves expanded rows',
  );
  d.querySelector('.m2-panel-title button').click();
  respond(calls[2], { total: 1, decisions: [decision(1)] }, 200, 'revision-2');
  await tick();
  assert.equal(
    d.querySelectorAll('.m2-log-entries details').length,
    1,
    'rewinds discard stale history rows',
  );
  assert(d.querySelector('.m2-log-entries details').open);
});

test('permission errors and malformed responses retain local events and never try admin replay routes', async (t) => {
  for (const status of [401, 403, 404, 500, 200]) {
    const { w, d, calls, open } = setup(t, { saved: [event(1)] });
    open();
    respond(calls[0], { total: 1, decisions: [{ index: 'bad', label: 'bad' }] }, status);
    await tick();
    assert.equal(d.querySelectorAll('.m2-log-entries details').length, 1);
    d.querySelector('[data-log-tab="decisions"]').click();
    assert(d.querySelector('.m2-log-status').textContent.includes('unavailable'));
    w.testUI.updateEventHistory();
    assert.equal(calls.length, 1);
    assert(calls.every((call) => !call.url.includes('/replays') && call.options.method === 'GET'));
  }
});

test('switching player links or games aborts stale requests and isolates server history', async (t) => {
  const { w, d, props, calls, open } = setup(t);
  open();
  const original = calls[0];
  w.history.replaceState(null, '', '/game/test?3d=0&token=other-token');
  w.testUI.refresh();
  assert(original.options.signal.aborted);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer other-token');
  respond(original, { total: 1, decisions: [decision(1, { label: 'Stale private response' })] });
  respond(calls[1], { total: 1, decisions: [decision(2, { label: 'Current player history' })] });
  await tick();
  assert(!d.getElementById('goa2-m2-log').textContent.includes('Stale private response'));
  assert(d.getElementById('goa2-m2-log').textContent.includes('Current player history'));
  w.history.replaceState(null, '', '/game/next?3d=0&token=next-token');
  props.gameId = 'next';
  props.eventLog = [];
  w.testUI.refresh();
  assert.equal(calls[2].url, '/api/games/next/overrides/history');
  assert(!d.getElementById('goa2-m2-log').textContent.includes('Current player history'));
  w.GOA2Mobile2D.destroy();
  assert(calls[2].options.signal.aborted);
  respond(calls[2], { total: 1, decisions: [decision(1)] });
  await tick();
  assert(!d.getElementById('goa2-m2-log'));
  assert(!d.querySelector('.native-log').hasAttribute('data-m2'));
});
