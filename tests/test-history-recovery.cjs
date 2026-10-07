const { JSDOM } = require('jsdom');
const fs = require('fs'),
  assert = require('assert');
const source = fs
  .readFileSync('dist/goa2-mobile-2d.user.js', 'utf8')
  .replace(
    /window\.GOA2Mobile2D\s*=\s*\{/,
    'window.testUI={refresh,updateEventHistory};window.GOA2Mobile2D={',
  );
const event = (id) => ({ id, timestamp: id, event: { event_type: 'MOVE', actor_id: 'h' } });
function setup(hidden = false) {
  const dom = new JSDOM(
    `<aside class="_sidebar_x"></aside><div><button class="_toggle_x">Log</button>
    <div class="_log_x"><div class="_empty_x" ${hidden ? 'hidden' : ''}>No events</div></div></div>`,
    {
      url: 'https://goa2.frontend.pedroliv.dev/game/A?3d=0',
      runScripts: 'outside-only',
      pretendToBeVisual: true,
    },
  );
  const w = dom.window,
    d = w.document;
  let mobile = true;
  w.matchMedia = () => ({
    get matches() {
      return mobile;
    },
    addEventListener() {},
  });
  const props = { eventLog: [] };
  d.querySelector('button').__reactFiber$test = { memoizedProps: props };
  return {
    w,
    d,
    props,
    load: () => w.eval(source),
    desktop: () => {
      mobile = false;
      w.testUI.refresh();
    },
  };
}
const t = setup();
const proto = Object.getPrototypeOf(t.w.localStorage),
  originalWrite = proto.setItem,
  originalRead = proto.getItem;
try {
  t.w.localStorage.setItem('goa2-mobile-events:/game/A', JSON.stringify([event(0)]));
  t.props.eventLog = [event(1)];
  proto.setItem = () => {
    throw new Error('quota');
  };
  t.load();
  t.w.history.pushState(null, '', '/game/B?3d=0');
  t.props.eventLog = [event(10)];
  t.w.testUI.refresh();
  t.w.history.pushState(null, '', '/game/A?3d=0');
  proto.getItem = function (key) {
    if (key === 'goa2-mobile-events:/game/A') throw new Error('unavailable');
    return originalRead.call(this, key);
  };
  t.props.eventLog = [event(2)];
  t.w.testUI.refresh();
  proto.getItem = originalRead;
  proto.setItem = originalWrite;
  t.w.testUI.updateEventHistory();
  const ids = (key) =>
    JSON.parse(t.w.localStorage.getItem('goa2-mobile-events:/game/' + key)).map(
      (entry) => entry.id,
    );
  assert.deepEqual(
    ids('A'),
    [0, 1, 2],
    'returning to A preserves its queued history despite read/write failures',
  );
  assert.deepEqual(ids('B'), [10], 'pending writes remain isolated by game');
  t.w.testUI.updateEventHistory();
  assert.deepEqual(ids('A'), [0, 1, 2], 'recovery does not duplicate archived events');
} finally {
  proto.getItem = originalRead;
  proto.setItem = originalWrite;
  t.w.GOA2Mobile2D?.destroy();
  t.w.close();
}
for (const initiallyHidden of [false, true]) {
  const fixture = setup(initiallyHidden);
  try {
    fixture.w.localStorage.setItem('goa2-mobile-events:/game/A', JSON.stringify([event(1)]));
    fixture.load();
    const empty = fixture.d.querySelector('._empty_x');
    assert(empty.hidden, 'archive replaces the native empty-log message while active');
    fixture.desktop();
    assert.equal(empty.hidden, initiallyHidden, 'desktop restores the original native visibility');
    assert.equal(
      fixture.w.getComputedStyle(fixture.d.querySelector('.m2-saved-events')).display,
      'none',
    );
    fixture.w.GOA2Mobile2D.destroy();
    assert.equal(empty.hidden, initiallyHidden, 'teardown also preserves native visibility');
  } finally {
    fixture.w.GOA2Mobile2D?.destroy();
    fixture.w.close();
  }
}
console.log(
  'PASS: queued history survives game switching/read failures, no duplicates, desktop and teardown restore native log visibility',
);
