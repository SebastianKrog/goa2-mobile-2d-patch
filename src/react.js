// Read only props already supplied to the rendered hero/sidebar components.
// 8. Public component props and hero dashboards
// The cache lasts only until the next refresh; retaining a React tree across updates
// would produce stale selections, item values, and event arrays.
const committedFiberCache = new Map();

// React may leave an alternate fiber on a DOM node. Read the committed tree, not stale props.
// This private integration is isolated here because a website update may change it.
function currentFiber(element) {
  const key = element && Object.keys(element).find((k) => k.startsWith('__reactFiber$'));
  const original = key ? element[key] : null;
  if (!original) return null;
  let top = original;
  while (top.return) top = top.return;
  const rootState = top.stateNode,
    current = rootState?.current;
  if (!current) return original;
  let cache = committedFiberCache.get(rootState);
  if (!cache || cache.current !== current) {
    const hosts = new WeakMap(),
      stack = [current];
    while (stack.length) {
      const node = stack.pop();
      if (node.stateNode && typeof node.stateNode === 'object') hosts.set(node.stateNode, node);
      for (let child = node.child; child; child = child.sibling) stack.push(child);
    }
    cache = { current, hosts };
    committedFiberCache.set(rootState, cache);
  }
  return cache.hosts.get(element) || null;
}
// Walk up a bounded number of component ancestors to find a supplied prop.
// Missing props are normal during mounting/navigation; callers must tolerate null.
function componentProp(element, key) {
  let fiber = currentFiber(element);
  for (let i = 0; fiber && i < 32; i++, fiber = fiber.return) {
    const value = fiber.memoizedProps?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

export { committedFiberCache, componentProp };
