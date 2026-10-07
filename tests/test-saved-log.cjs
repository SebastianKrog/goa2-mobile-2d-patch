const { JSDOM } = require('jsdom'),
  fs = require('fs'),
  assert = require('assert');
const source = fs.readFileSync('dist/goa2-mobile-2d.user.js', 'utf8');
function setup(saved) {
  const d = new JSDOM(
    '<div class="_sidebar_x"></div><div><button class="_toggle_x">Log</button><div class="_log_x"><div class="_empty_x">No events yet</div></div></div>',
    {
      url: 'https://goa2.frontend.pedroliv.dev/game/test?3d=0',
      runScripts: 'outside-only',
      pretendToBeVisual: true,
    },
  );
  const w = d.window;
  w.matchMedia = () => ({ matches: true, addEventListener() {} });
  if (saved) w.localStorage.setItem('goa2-mobile-events:/game/test', saved);
  const props = { eventLog: [] };
  w.document.querySelector('button').__reactFiber$test = { memoizedProps: props };
  w.eval(source);
  return { w, props };
}
const one = setup();
one.props.eventLog = [
  { id: 1, timestamp: 100, event: { event_type: 'MOVE', actor_id: 'Hanu', metadata: {} } },
];
one.w.dispatchEvent(new one.w.Event('pagehide'));
one.w.dispatchEvent(new one.w.Event('pagehide'));
const saved = one.w.localStorage.getItem('goa2-mobile-events:/game/test');
assert.equal(JSON.parse(saved).length, 1);
one.w.GOA2Mobile2D.destroy();
one.w.close();
const two = setup(saved);
assert(two.w.document.querySelector('.m2-saved-events').textContent.includes('Hanu move'));
assert(two.w.document.querySelector('._empty_x').hidden);
two.props.eventLog = [
  { id: 1, timestamp: 200, event: { event_type: 'MOVE', actor_id: 'Hanu', metadata: {} } },
];
two.w.dispatchEvent(new two.w.Event('pagehide'));
assert.equal(JSON.parse(two.w.localStorage.getItem('goa2-mobile-events:/game/test')).length, 2);
two.w.GOA2Mobile2D.destroy();
assert(!two.w.document.querySelector('.m2-saved-events'));
assert(!two.w.document.querySelector('._empty_x').hidden);
two.w.close();
console.log('PASS: event capture, duplicate polling, reload restore, reset event IDs, cleanup');
