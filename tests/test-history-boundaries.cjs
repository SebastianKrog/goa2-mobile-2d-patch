const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

const storageKey = 'goa2-mobile-events:/game/test';
const event = (id) => ({ id, timestamp: id, event: { event_type: 'MOVE', actor_id: 'Hanu' } });

function setup(t, { saved, events = [] } = {}) {
  const fixture = browserFixture({
    html: `<aside class="_sidebar_test"></aside><div><button class="_toggle_test">Log</button>
      <div class="_log_test"><div class="_empty_test">No events yet</div></div></div>`,
    hooks: ['updateEventHistory'],
  });
  t.after(() => fixture.close());
  const props = { eventLog: events };
  fixture.d.querySelector('button').__reactFiber$test = { memoizedProps: props };
  if (saved !== undefined) fixture.w.localStorage.setItem(storageKey, saved);
  return { ...fixture, props };
}

test('archives retain the latest 2,000 delivered events without rewriting on idle polls', (t) => {
  const fixture = setup(t, { events: Array.from({ length: 2005 }, (_, id) => event(id)) });
  const { w } = fixture;
  const prototype = Object.getPrototypeOf(w.localStorage);
  const original = prototype.setItem;
  let writes = 0;
  prototype.setItem = function (key, value) {
    if (key === storageKey) writes++;
    return original.call(this, key, value);
  };
  t.after(() => {
    prototype.setItem = original;
  });
  fixture.install();
  const archivedIds = () => JSON.parse(w.localStorage.getItem(storageKey)).map((entry) => entry.id);
  const expected = Array.from({ length: 2000 }, (_, index) => index + 5);
  assert.deepEqual(archivedIds(), expected);
  assert.equal(writes, 1);
  w.testUI.updateEventHistory();
  w.testUI.updateEventHistory();
  assert.deepEqual(archivedIds(), expected, 'trimmed events must not rotate back into the archive');
  assert.equal(writes, 1, 'an unchanged native backlog does not churn localStorage');

  fixture.props.eventLog.push(event(2005));
  w.testUI.updateEventHistory();
  assert.deepEqual(archivedIds(), expected.slice(1).concat(2005));
  assert.equal(writes, 2, 'one newly delivered event produces one additional write');
});

test('saved history ignores corrupt entries and caps older stored archives', (t) => {
  const saved = JSON.stringify([
    null,
    { timestamp: 1, event: 'invalid' },
    { timestamp: '2', event: {} },
    ...Array.from({ length: 2005 }, (_, id) => event(id)),
  ]);
  const fixture = setup(t, { saved });
  fixture.install();
  const summaries = fixture.d.querySelectorAll('.m2-saved-events summary');
  assert.equal(summaries.length, 2000);
  assert.equal(JSON.parse(summaries[0].parentElement.dataset.key)[1], 5);
  assert.equal(JSON.parse(summaries[1999].parentElement.dataset.key)[1], 2004);
});

test('malformed storage can recover by collecting a valid live event', (t) => {
  const fixture = setup(t, { saved: '{broken' });
  fixture.install();
  assert.match(fixture.d.querySelector('.m2-saved-events').textContent, /could not be read/);
  fixture.props.eventLog = [event(1)];
  fixture.w.testUI.updateEventHistory();
  assert.deepEqual(JSON.parse(fixture.w.localStorage.getItem(storageKey)), [event(1)]);
  assert.equal(
    fixture.d.querySelector('.m2-saved-events'),
    null,
    'successful persistence clears the warning',
  );
});

test('invalid live entries cannot break collection or appear in the saved archive', (t) => {
  const fixture = setup(t, {
    events: [null, { timestamp: 1, event: 'invalid' }, { timestamp: '2', event: {} }, event(3)],
  });
  fixture.install();
  assert.deepEqual(JSON.parse(fixture.w.localStorage.getItem(storageKey)), [event(3)]);
  fixture.props.eventLog = [];
  fixture.w.testUI.updateEventHistory();
  assert.equal(fixture.d.querySelectorAll('.m2-saved-events summary').length, 1);
});
