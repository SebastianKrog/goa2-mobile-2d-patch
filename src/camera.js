import { componentProp } from './react.js';
import { c, q, root, uiState } from './runtime.js';
import { fullscreenAvailable, fullscreenPending, toggleFullscreen } from './settings.js';
import { addExtra, on } from './ui.js';

// Keep rotation inside the native screen-space pan/zoom transform.
let boardRotation = null;
// Locate an on-board figure from public ownership and rendered HexTile props.
// No hero-name rules or board-coordinate constants are needed.
function boardHeroPoint(svg, heroId) {
  const view = componentProp(svg, 'view') || componentProp(q('[data-m2="sidebar"]'), 'view');
  const locations = view?.board?.entity_locations;
  if (!locations) return null;
  const ids = [heroId, ...Object.entries(view.hero_pieces || {})
    .filter(([, piece]) => piece.owner_hero_id === heroId).map(([id, piece]) => piece.id || id)]
    .filter(id => Object.hasOwn(locations, id) && locations[id] != null);
  for (const id of ids) {
    for (const tile of svg.querySelectorAll('g')) {
      if (componentProp(tile, 'occupantId') !== id) continue;
      const x = componentProp(tile, 'cx'), y = componentProp(tile, 'cy');
      if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    }
  }
  return null;
}
function boardScreenPoint(svg, point) {
  const matrix = svg.getScreenCTM?.();
  if (!matrix || !point) return null;
  const x = matrix.a * point.x + matrix.c * point.y + matrix.e,
    y = matrix.b * point.x + matrix.d * point.y + matrix.f;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}
const boardFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
function nativeBoardZoom(svg) {
  const transform = svg.style.transform;
  if (!transform) return 1;
  const scale = transform.match(/scale\(\s*([\d.]+)\s*\)/);
  return scale ? Number(scale[1]) : null;
}
// Use native wheel/pan handlers so dragging, zoom labels and Reset retain their
// camera state. A small screen-space remainder allows exact centering at edges
// where the native pan clamp would otherwise stop short, including when rotated.
async function centerBoardHero(heroId) {
  const state = boardRotation;
  if (!state || uiState.dead || !root.hasAttribute('data-m2-active') || document.hidden) return;
  state.centerTarget = heroId;
  if (state.centerPending) return;
  const live = () => !uiState.dead && boardRotation === state && state.centerTarget &&
    root.hasAttribute('data-m2-active') && !document.hidden;
  const handlers = () => Object.fromEntries(['onPointerDown', 'onPointerMove', 'onPointerUp', 'onClickCapture']
    .map(key => [key, componentProp(state.host, key)]));
  const available = props => ['onPointerDown', 'onPointerMove', 'onPointerUp'].every(key => typeof props[key] === 'function');
  if (!available(handlers()) || !boardHeroPoint(state.svg, heroId)) { state.centerTarget = null; return; }
  const rect = state.host.getBoundingClientRect(), zoom = nativeBoardZoom(state.svg);
  if (!rect.width || !rect.height || !zoom) { state.centerTarget = null; return; }
  state.centerPending = true;
  state.host.style.removeProperty('--m2-center-x');
  state.host.style.removeProperty('--m2-center-y');
  try {
    const midpoint = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    // The native wheel camera uses exp(-deltaY * .002), with a 1x–6x range.
    if (Math.abs(zoom - 2.5) > .0001) {
      state.host.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true,
        clientX: midpoint.x, clientY: midpoint.y, deltaY: -Math.log(2.5 / zoom) / .002 }));
      for (let frames = 0; frames < 6 && live() && Math.abs((nativeBoardZoom(state.svg) || 0) - 2.5) > .0001; frames++) await boardFrame();
    }
    if (!live() || Math.abs((nativeBoardZoom(state.svg) || 0) - 2.5) > .0001) return;
    const translate = getComputedStyle(state.svg).translate.split(/\s+/).map(parseFloat);
    const destination = { x: midpoint.x + (translate[0] || 0), y: midpoint.y + (translate[1] || 0) };
    const point = boardScreenPoint(state.svg, boardHeroPoint(state.svg, state.centerTarget));
    const props = handlers();
    if (!point || !available(props)) return;
    const pointer = { pointerId: -250, pointerType: 'mouse', buttons: 1, currentTarget: state.host,
      clientX: midpoint.x, clientY: midpoint.y, stopPropagation() {}, preventDefault() {} };
    props.onPointerDown(pointer);
    try {
      props.onPointerMove({ ...pointer, clientX: midpoint.x + destination.x - point.x,
        clientY: midpoint.y + destination.y - point.y });
    } finally {
      props.onPointerUp(pointer);
      // Clear the native drag-click suppression without invoking any tile action.
      props.onClickCapture?.(pointer);
    }
    await boardFrame();
    if (!live()) return;
    const centered = boardScreenPoint(state.svg, boardHeroPoint(state.svg, state.centerTarget));
    if (!centered) return;
    state.host.style.setProperty('--m2-center-x', (destination.x - centered.x) + 'px');
    state.host.style.setProperty('--m2-center-y', (destination.y - centered.y) + 'px');
    state.sync();
  } catch {} finally {
    state.centerPending = false;
    state.centerTarget = null;
  }
}
// Detach gesture listeners and restore the board’s native inline transform.
function clearBoardRotation() {
  if (!boardRotation) return;
  const state = boardRotation;
  state.observer.disconnect();
  state.resize?.disconnect();
  state.gestures.abort();
  state.controls.remove();
  state.svg.removeAttribute('data-m2-rotate');
  state.host.removeAttribute('data-m2-rotation-host');
  for (const key of ['--m2-native-transform', '--m2-angle', '--m2-rotation-fit', '--m2-center-x', '--m2-center-y'])
    state.host.style.removeProperty(key);
  boardRotation = null;
}
// Track the angle between two touch pointers. Rotation is composed with native
// pan/zoom rather than replacing their handlers; reset restores both transforms.
function updateBoardRotation() {
  const svg = q('[data-m2="board"] svg' + c('svg'));
  if (!svg) {
    clearBoardRotation();
    return;
  }
  if (boardRotation?.svg === svg) {
    boardRotation.sync();
    return;
  }
  clearBoardRotation();
  const host = svg.parentElement,
    controls = document.createElement('div');
  controls.className = 'm2-board-controls';
  controls.setAttribute('aria-label', 'Board orientation');
  const state = {
    svg,
    host,
    controls,
    angle: 0,
    observer: null,
    resize: null,
    sync: null,
    gestures: new AbortController(),
  };
  boardRotation = state;
  svg.setAttribute('data-m2-rotate', '');
  host.setAttribute('data-m2-rotation-host', '');
  const put = (key, value) => {
    if (host.style.getPropertyValue(key) !== value) host.style.setProperty(key, value);
  };
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.setAttribute('aria-label', 'Reset board zoom, pan and rotation');
  const fullscreen = document.createElement('button');
  fullscreen.type = 'button';
  fullscreen.className = 'm2-board-fullscreen';
  state.sync = () => {
    const native = svg.style.transform || 'translate(0px,0px) scale(1)';
    put('--m2-native-transform', native);
    put('--m2-angle', state.angle + 'deg');
    // Twisting must not change magnification; pinch owns the zoom scale.
    put('--m2-rotation-fit', '1');
    const nativeReset = q(c('zoomReset'), host),
      zoom = nativeReset?.textContent.match(/\d+%/)?.[0] || '100%';
    const label = zoom + ' · Reset';
    if (reset.textContent !== label) reset.textContent = label;
    const active = !!document.fullscreenElement;
    fullscreen.hidden = !fullscreenAvailable();
    fullscreen.disabled = fullscreenPending;
    fullscreen.setAttribute('aria-pressed', String(active));
    fullscreen.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
    fullscreen.textContent = active ? 'Exit fullscreen' : 'Fullscreen';
  };
  // Native pan/zoom uses Pointer Events too. Observe without consuming its events.
  const touches = new Map();
  let previousAngle = null;
  const pairAngle = () => {
    const [a, b] = Array.from(touches.values());
    return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  };
  const listen = (event, fn) =>
    host.addEventListener(event, fn, { capture: true, signal: state.gestures.signal });
  listen('pointerdown', (e) => {
    if (
      e.pointerType !== 'touch' ||
      controls.contains(e.target) ||
      !root.hasAttribute('data-m2-active')
    )
      return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    previousAngle = touches.size === 2 ? pairAngle() : null;
  });
  listen('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size !== 2) return;
    const next = pairAngle();
    if (previousAngle !== null) {
      const delta = ((next - previousAngle + 540) % 360) - 180;
      state.angle = (state.angle + delta + 360) % 360;
      state.sync();
    }
    previousAngle = next;
  });
  const end = (e) => {
    touches.delete(e.pointerId);
    previousAngle = touches.size === 2 ? pairAngle() : null;
  };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(event, end);
  on(reset, 'click', () => {
    state.centerTarget = null;
    state.host.style.removeProperty('--m2-center-x');
    state.host.style.removeProperty('--m2-center-y');
    touches.clear();
    previousAngle = null;
    state.angle = 0;
    q(c('zoomReset'), host)?.click();
    state.sync();
  });
  on(fullscreen, 'click', toggleFullscreen);
  controls.append(reset, fullscreen);
  for (const event of [
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'dblclick',
    'click',
  ])
    on(controls, event, (e) => e.stopPropagation());
  host.append(controls);
  addExtra(controls);
  state.observer = new MutationObserver(state.sync);
  state.observer.observe(svg, { attributes: true, attributeFilter: ['style', 'viewBox'] });
  if (typeof ResizeObserver !== 'undefined') {
    state.resize = new ResizeObserver(state.sync);
    state.resize.observe(svg);
  }
  state.sync();
}

export { boardRotation, centerBoardHero, clearBoardRotation, updateBoardRotation };
