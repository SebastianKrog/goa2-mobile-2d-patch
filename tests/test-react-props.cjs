const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function fixture(t) {
  const fixture = browserFixture({ hooks: ['componentProp'] });
  t.after(() => fixture.close());
  fixture.install();
  return fixture;
}

test('committed React props follow root replacement even with an obsolete DOM pointer', (t) => {
  const { w, d } = fixture(t);
  const element = d.createElement('div');
  const rootState = {};
  const oldRoot = { stateNode: rootState };
  element.__reactFiber$test = { return: oldRoot, memoizedProps: { value: 'obsolete' } };

  const commit = (value) => {
    const root = { stateNode: rootState };
    const parent = { return: root, memoizedProps: { value } };
    const host = { stateNode: element, return: parent, memoizedProps: {} };
    root.child = parent;
    parent.child = host;
    rootState.current = root;
  };
  commit('first commit');
  assert.equal(w.testUI.componentProp(element, 'value'), 'first commit');
  commit('second commit');
  // No refresh between reads: the cache must notice root.current changed.
  assert.equal(w.testUI.componentProp(element, 'value'), 'second commit');

  rootState.current = { stateNode: rootState };
  assert.equal(
    w.testUI.componentProp(element, 'value'),
    null,
    'removed hosts cannot leak stale props',
  );
});

test('committed tree traversal includes sibling hosts and isolated roots', (t) => {
  const { w, d } = fixture(t);
  const elements = [d.createElement('div'), d.createElement('div')];
  const rootState = {};
  const root = { stateNode: rootState };
  rootState.current = root;
  const hosts = elements.map((element, index) => {
    const host = { stateNode: element, return: root, memoizedProps: { value: index } };
    element.__reactFiber$test = host;
    return host;
  });
  root.child = hosts[0];
  hosts[0].sibling = hosts[1];
  assert.equal(w.testUI.componentProp(elements[1], 'value'), 1);
  assert.equal(w.testUI.componentProp(elements[0], 'value'), 0, 'zero is a supplied value');

  const other = d.createElement('div');
  const otherState = {};
  const otherRoot = { stateNode: otherState };
  otherState.current = otherRoot;
  const otherHost = { stateNode: other, return: otherRoot, memoizedProps: { value: false } };
  otherRoot.child = otherHost;
  other.__reactFiber$test = otherHost;
  assert.equal(w.testUI.componentProp(other, 'value'), false, 'a separate root has its own cache');
  assert.equal(w.testUI.componentProp(elements[1], 'value'), 1);
});

test('missing props, mounting fibers and the ancestor limit return safe values', (t) => {
  const { w, d } = fixture(t);
  const read = w.testUI.componentProp;
  assert.equal(read(null, 'value'), null);
  assert.equal(read(d.createElement('div'), 'value'), null);

  const element = d.createElement('div');
  const host = { memoizedProps: { value: null } };
  element.__reactFiber$test = host;
  const ancestors = [host];
  for (let i = 1; i <= 32; i++) {
    ancestors[i] = { memoizedProps: {} };
    ancestors[i - 1].return = ancestors[i];
  }
  ancestors[31].memoizedProps.value = '';
  assert.equal(read(element, 'value'), '', 'the last allowed ancestor and empty string are valid');
  delete ancestors[31].memoizedProps.value;
  ancestors[32].memoizedProps.value = 'too far';
  assert.equal(read(element, 'value'), null, 'the walk stops before the 33rd fiber');
});
