const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function setup(t, { withViewport = true } = {}) {
  const fixture = browserFixture({
    html: `<header class="_bar_test"><span class="_phase_test">PLANNING</span></header>
      <div class="_boardArea_test"></div><aside class="_sidebar_test">
      <section><div class="_name_test" tabindex="7" role="heading" aria-expanded="mixed">Hanu (You)</div>
      <div class="_details_test">Lv 1</div></section></aside>`,
  });
  t.after(() => fixture.close());
  const { w, d } = fixture;
  d.querySelector('section').__reactFiber$test = {
    memoizedProps: {
      hero: {
        id: 'hero_hanu',
        name: 'Hanu',
        level: 1,
        gold: 0,
        hand: [],
        played_cards: [],
        discard_pile: [],
        items: {},
      },
    },
  };
  d.querySelector('aside').__reactFiber$test = {
    memoizedProps: { view: { phase: 'PLANNING', turn: 1 } },
  };
  const frames = new Map();
  const timers = new Map();
  let nextId = 0;
  w.requestAnimationFrame = (callback) => {
    const id = ++nextId;
    frames.set(id, callback);
    return id;
  };
  w.cancelAnimationFrame = (id) => frames.delete(id);
  w.setInterval = (callback) => {
    const id = ++nextId;
    timers.set(id, callback);
    return id;
  };
  w.clearInterval = (id) => timers.delete(id);
  const viewport = new w.EventTarget();
  viewport.height = 620;
  viewport.offsetTop = 20;
  w.innerHeight = 800;
  if (withViewport) Object.defineProperty(w, 'visualViewport', { value: viewport });
  fixture.install();

  // Allow observer records to arrive, then run queued frames without wall-clock sleeps.
  const settle = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      if (!frames.size) return;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(0));
    }
    assert.fail('DOM reconciliation did not settle within ten frames');
  };
  return { ...fixture, viewport, frames, timers, settle };
}

test('visual viewport resize and scroll update offsets and coalesce into one frame', async (t) => {
  const { w, d, viewport, frames, settle } = setup(t);
  await settle();
  const root = d.documentElement;
  assert.equal(root.style.getPropertyValue('--m2-vh'), '620px');
  assert.equal(root.style.getPropertyValue('--m2-offset'), '160px');
  assert.equal(root.style.getPropertyValue('--m2-viewport-top'), '20px');

  viewport.height = 500;
  viewport.offsetTop = 35;
  viewport.dispatchEvent(new w.Event('resize'));
  viewport.dispatchEvent(new w.Event('scroll'));
  w.dispatchEvent(new w.Event('resize'));
  assert.equal(frames.size, 1, 'all viewport events share one refresh');
  await settle();
  assert.equal(root.style.getPropertyValue('--m2-vh'), '500px');
  assert.equal(root.style.getPropertyValue('--m2-offset'), '265px');
  assert.equal(root.style.getPropertyValue('--m2-viewport-top'), '35px');

  viewport.height = 900;
  viewport.dispatchEvent(new w.Event('resize'));
  await settle();
  assert.equal(root.style.getPropertyValue('--m2-offset'), '0px', 'offset never becomes negative');
});

test('desktop/mobile, missing sidebar and 3D/2D transitions restore native attributes', async (t) => {
  const { w, d, media, settle } = setup(t);
  await settle();
  const root = d.documentElement;
  const name = d.querySelector('._name_test');
  assert(root.hasAttribute('data-m2-active'));
  assert.equal(name.getAttribute('role'), 'heading');
  assert(!name.hasAttribute('aria-disabled'), 'native headings are not disabled expansion buttons');

  media.matches = false;
  media.dispatchEvent(new w.Event('change'));
  await settle();
  assert(!root.hasAttribute('data-m2-active'));
  assert.equal(name.getAttribute('tabindex'), '7');
  assert.equal(name.getAttribute('role'), 'heading');
  assert.equal(name.getAttribute('aria-expanded'), 'mixed');

  media.matches = true;
  media.dispatchEvent(new w.Event('change'));
  await settle();
  assert(root.hasAttribute('data-m2-active'));
  assert.equal(name.getAttribute('role'), 'heading');
  assert(!name.hasAttribute('aria-disabled'), 'native headings are not disabled expansion buttons');

  const sidebar = d.querySelector('aside');
  sidebar.remove();
  await settle();
  assert(!root.hasAttribute('data-m2-active'));
  d.body.append(sidebar);
  await settle();
  assert(root.hasAttribute('data-m2-active'));

  w.history.replaceState(null, '', '?3d=1');
  w.dispatchEvent(new w.Event('resize'));
  await settle();
  assert(!root.hasAttribute('data-m2-active'));
  w.history.replaceState(null, '', '?3d=0');
  w.dispatchEvent(new w.Event('resize'));
  await settle();
  assert(root.hasAttribute('data-m2-active'));
  assert.equal(d.querySelectorAll('#goa2-m2-nav').length, 1);
});

test('footer closes the native Deck, permits reopening and cannot resurrect a dismissed modal on desktop', (t) => {
  const fixture = browserFixture({
    html: '<aside class="_sidebar_test"><section><div class="_name_test">Test (You)</div><div class="_details_test">Lv 1</div><button class="_viewDeckBtn_test">View Deck</button></section></aside>',
    hooks: ['refresh'],
  });
  t.after(() => fixture.close());
  const { w, d, media } = fixture;
  let opens = 0,
    closes = 0;
  d.querySelector('._viewDeckBtn_test').onclick = () => {
    opens++;
    const backdrop = d.createElement('div');
    backdrop.className = '_backdrop_test';
    backdrop.innerHTML =
      '<div class="_modal_test"><button class="_closeBtn_test">Close</button><div class="_cardGrid_test"></div></div>';
    backdrop.querySelector('button').onclick = () => {
      closes++;
      backdrop.remove();
    };
    d.body.append(backdrop);
  };
  fixture.install();
  const deck = d.querySelector('[data-mode="deck"]');
  deck.click();
  assert(d.querySelector('[data-m2="deck"]'));
  deck.click();
  assert.equal(closes, 1);
  assert(!d.querySelector('._modal_test'), 'native close unmounts the modal');
  media.matches = false;
  w.testUI.refresh();
  assert(!d.querySelector('._backdrop_test'), 'desktop cannot reveal a dismissed Deck');
  media.matches = true;
  w.testUI.refresh();
  deck.click();
  assert.equal(opens, 2, 'reopening invokes the native Deck control again');
  d.querySelector('[data-mode="hand"]').click();
  assert.equal(closes, 2, 'switching footer views also closes the native modal');
  assert(!d.querySelector('._modal_test'));
  assert.equal(d.documentElement.dataset.m2Mode, 'hand');
});

test('destroy cancels pending work, removes event listeners and permits a clean reinstall', async (t) => {
  const fixture = setup(t);
  const { w, d, media, viewport, frames, timers, settle } = fixture;
  await settle();
  assert.equal(timers.size, 1, 'the archive collector is installed');
  w.dispatchEvent(new w.Event('resize'));
  assert.equal(frames.size, 1);
  w.GOA2Mobile2D.destroy();
  assert.equal(frames.size, 0, 'the queued frame is cancelled');
  assert.equal(timers.size, 0, 'the archive interval is cleared');
  assert.equal(d.querySelectorAll('[data-m2],#goa2-m2-style,#goa2-m2-nav').length, 0);
  assert.equal(d.documentElement.style.getPropertyValue('--m2-vh'), '');
  assert.equal(d.documentElement.style.getPropertyValue('--m2-viewport-top'), '');
  assert.equal(d.querySelector('._name_test').getAttribute('role'), 'heading');

  w.dispatchEvent(new w.Event('resize'));
  w.dispatchEvent(new w.Event('online'));
  w.dispatchEvent(new w.Event('pagehide'));
  media.dispatchEvent(new w.Event('change'));
  viewport.dispatchEvent(new w.Event('resize'));
  viewport.dispatchEvent(new w.Event('scroll'));
  d.querySelector('._phase_test').textContent = 'RESOLUTION';
  await settle();
  assert.equal(frames.size, 0, 'destroyed observers and listeners cannot schedule new work');
  assert(!d.querySelector('#goa2-m2-nav'));

  fixture.install();
  await settle();
  assert.equal(timers.size, 1);
  assert.equal(d.querySelectorAll('#goa2-m2-nav').length, 1);
  assert.equal(d.querySelector('.m2-phase').textContent, 'RESOLUTION');
  assert(d.documentElement.hasAttribute('data-m2-active'));
});

test('report dialog follows the keyboard viewport without replacing native controls', async (t) => {
  const { w, d, media, viewport, settle } = setup(t);
  const nativeStyle = d.createElement('style');
  nativeStyle.textContent = `
    ._backdrop_report { position: fixed; inset: 0; z-index: 2000;
      display: flex; align-items: center; justify-content: center; }
    ._modal_report { width: min(92vw, 440px); display: flex; flex-direction: column; }
  `;
  d.head.prepend(nativeStyle);
  const backdrop = d.createElement('div');
  backdrop.className = '_backdrop_report';
  backdrop.innerHTML = `<div class="_modal_report">
    <div class="_header_report"><span class="_heading_report">Report a bug</span>
      <button aria-label="Close">×</button></div>
    <p>Describe what went wrong.</p>
    <input class="_input_report" placeholder="Short summary">
    <textarea class="_textarea_report" rows="5"></textarea>
    <div class="_actions_report"><button disabled>Submit report</button></div>
  </div>`;
  const modal = backdrop.firstElementChild;
  const input = modal.querySelector('input');
  const submit = modal.querySelector('._actions_report button');
  let nativeInputCalls = 0;
  input.addEventListener('input', () => {
    nativeInputCalls++;
    submit.disabled = !input.value;
  });
  modal.querySelector('[aria-label="Close"]').addEventListener('click', () => backdrop.remove());
  d.body.append(backdrop);
  await settle();

  assert.equal(modal.dataset.m2, 'report-dialog');
  const bounds = w.getComputedStyle(backdrop);
  assert.equal(bounds.top, 'var(--m2-viewport-top, 0px)');
  assert.equal(
    bounds.bottom,
    'auto',
    'the native inset must not anchor the dialog below the keyboard',
  );
  assert.equal(bounds.height, 'var(--m2-vh, 100dvh)');
  assert(
    Number(bounds.zIndex) > Number(w.getComputedStyle(d.querySelector('#goa2-m2-nav')).zIndex),
  );
  assert.equal(w.getComputedStyle(modal).maxHeight, '100%');
  assert.equal(w.getComputedStyle(modal).overflowY, 'auto');
  assert.equal(w.getComputedStyle(input).flexShrink, '0');

  input.focus();
  input.value = 'Example report';
  input.dispatchEvent(new w.Event('input', { bubbles: true }));
  viewport.height = 280;
  viewport.offsetTop = 90;
  viewport.dispatchEvent(new w.Event('resize'));
  viewport.dispatchEvent(new w.Event('scroll'));
  await settle();
  assert.equal(d.documentElement.style.getPropertyValue('--m2-vh'), '280px');
  assert.equal(d.documentElement.style.getPropertyValue('--m2-viewport-top'), '90px');
  assert.equal(d.activeElement, input);
  assert.equal(modal.querySelector('input'), input);
  assert.equal(input.value, 'Example report');
  assert.equal(nativeInputCalls, 1);
  assert(!submit.disabled);

  viewport.height = 800;
  viewport.offsetTop = 0;
  viewport.dispatchEvent(new w.Event('resize'));
  await settle();
  assert.equal(d.documentElement.style.getPropertyValue('--m2-vh'), '800px');
  assert.equal(d.documentElement.style.getPropertyValue('--m2-viewport-top'), '0px');

  // Success keeps the same layout even after the native form fields are removed.
  modal.querySelectorAll('input,textarea,._actions_report').forEach((node) => node.remove());
  const thanks = d.createElement('p');
  thanks.textContent = 'Thanks!';
  modal.append(thanks);
  const other = d.createElement('div');
  other.className = '_modal_other';
  other.innerHTML = '<span class="_heading_other">Share links</span>';
  d.body.append(other);
  await settle();
  assert.equal(modal.dataset.m2, 'report-dialog');
  assert(!other.hasAttribute('data-m2'), 'unrelated native dialogs retain their layout');

  media.matches = false;
  media.dispatchEvent(new w.Event('change'));
  await settle();
  assert.equal(w.getComputedStyle(backdrop).zIndex, '2000', 'desktop uses the native dialog');
  w.GOA2Mobile2D.destroy();
  assert(!modal.hasAttribute('data-m2'));
  assert(!backdrop.hasAttribute('data-m2'));
  modal.querySelector('[aria-label="Close"]').click();
  assert(!backdrop.isConnected, 'native close still works after teardown');
});

test('dialog viewport bounds fall back to window resize without VisualViewport', async (t) => {
  const { w, d, settle } = setup(t, { withViewport: false });
  await settle();
  assert.equal(d.documentElement.style.getPropertyValue('--m2-vh'), '800px');
  assert.equal(d.documentElement.style.getPropertyValue('--m2-viewport-top'), '0px');
  w.innerHeight = 350;
  w.dispatchEvent(new w.Event('resize'));
  await settle();
  assert.equal(d.documentElement.style.getPropertyValue('--m2-vh'), '350px');
  assert.equal(d.documentElement.style.getPropertyValue('--m2-offset'), '0px');
});

test('Fix game state fits the viewport and retains native tabs, forms and confirmation', async (t) => {
  const { w, d, viewport, media, settle } = setup(t);
  const nativeStyle = d.createElement('style');
  nativeStyle.textContent = `
    ._backdrop_fix { position: fixed; inset: 0; z-index: 120;
      display: flex; align-items: center; justify-content: center; }
    ._panel_fix { width: min(640px, calc(100vw - 32px));
      max-height: min(80vh, 720px); overflow-y: auto; padding: 18px 20px; }
    ._tabs_fix { display: flex; gap: 4px; }
    ._formRow_fix textarea { flex: 1; min-width: 220px; }
    ._placeControls_fix, ._confirmActions_fix { display: flex; gap: 8px; }
  `;
  d.head.prepend(nativeStyle);
  const backdrop = d.createElement('div');
  backdrop.className = '_backdrop_fix';
  const labels = ['Board', 'Cards', 'Values', 'Advanced', 'Unstick', 'Rewind'];
  backdrop.innerHTML = `<div class="_panel_fix" role="dialog" aria-label="Fix game state">
    <div class="_titleRow_fix"><h2>Fix game state</h2><button aria-label="Close">✕</button></div>
    <p>Propose a correction.</p>
    <div class="_tabs_fix" role="tablist">${labels
      .map((label) => `<button role="tab" aria-selected="false">${label}</button>`)
      .join('')}</div>
    <div class="_section_fix"></div>
  </div>`;
  const dialog = backdrop.firstElementChild;
  const tabs = dialog.querySelector('[role="tablist"]');
  const section = dialog.querySelector('._section_fix');
  let selected = '';
  for (const tab of tabs.children) {
    tab.addEventListener('click', () => {
      selected = tab.textContent;
      for (const other of tabs.children) other.setAttribute('aria-selected', String(other === tab));
      section.innerHTML = `<div class="_formRow_fix"><label>Operation</label><select><option>Example</option></select>
        <textarea rows="3">{"value":1}</textarea></div>
        <div class="_placeControls_fix"><button disabled>Unavailable correction</button></div>`;
    });
  }
  dialog.querySelector('[aria-label="Close"]').addEventListener('click', () => backdrop.remove());
  d.body.append(backdrop);
  await settle();
  assert.equal(dialog.dataset.m2, 'fix-dialog');
  const bounds = w.getComputedStyle(backdrop);
  assert.equal(bounds.top, 'var(--m2-viewport-top, 0px)');
  assert.equal(bounds.bottom, 'auto');
  assert.equal(bounds.height, 'var(--m2-vh, 100dvh)');
  assert(
    Number(bounds.zIndex) > Number(w.getComputedStyle(d.querySelector('#goa2-m2-nav')).zIndex),
  );
  assert.equal(w.getComputedStyle(dialog).maxHeight, '100%');
  assert.equal(w.getComputedStyle(dialog).maxWidth, '100%');
  assert.equal(w.getComputedStyle(dialog).boxSizing, 'border-box');
  assert.equal(w.getComputedStyle(dialog).overflowY, 'auto');
  assert.equal(w.getComputedStyle(tabs).display, 'grid');
  assert.equal(w.getComputedStyle(tabs).gridTemplateColumns, 'repeat(3, minmax(0, 1fr))');
  assert.deepEqual(
    Array.from(tabs.children, (tab) => tab.textContent),
    labels,
  );
  for (const tab of tabs.children) {
    tab.click();
    await settle();
    assert.equal(selected, tab.textContent);
    assert.equal(tab.getAttribute('aria-selected'), 'true');
    assert.equal(dialog.querySelector('[role="tablist"]'), tabs, 'native tab nodes are retained');
  }
  assert(dialog.querySelector('button[disabled]').disabled);
  const textarea = dialog.querySelector('textarea');
  assert.equal(w.getComputedStyle(textarea).minWidth, '0px');
  assert.equal(w.getComputedStyle(textarea).width, '100%');
  assert.equal(w.getComputedStyle(dialog.querySelector('select')).width, '100%');
  assert.equal(w.getComputedStyle(dialog.querySelector('._placeControls_fix')).flexWrap, 'wrap');
  textarea.focus();
  textarea.value = '{"value":2}';
  viewport.height = 230;
  viewport.offsetTop = 40;
  viewport.dispatchEvent(new w.Event('resize'));
  await settle();
  assert.equal(d.documentElement.style.getPropertyValue('--m2-vh'), '230px');
  assert.equal(d.documentElement.style.getPropertyValue('--m2-viewport-top'), '40px');
  assert.equal(dialog.querySelector('textarea'), textarea);
  assert.equal(textarea.value, '{"value":2}');

  tabs.remove();
  section.innerHTML = `<div class="_confirmActions_fix"><button>Propose to the table</button><button>Back</button></div>`;
  let proposed = 0;
  section.querySelector('button').addEventListener('click', () => proposed++);
  await settle();
  assert.equal(dialog.dataset.m2, 'fix-dialog', 'confirmation remains adapted without the tabs');
  assert.equal(w.getComputedStyle(section.firstElementChild).flexWrap, 'wrap');
  assert.equal(proposed, 0, 'layout updates never propose corrections');
  section.querySelector('button').click();
  assert.equal(proposed, 1);

  media.matches = false;
  media.dispatchEvent(new w.Event('change'));
  await settle();
  assert.equal(w.getComputedStyle(backdrop).zIndex, '120');
  w.GOA2Mobile2D.destroy();
  assert(!dialog.hasAttribute('data-m2'));
  assert(!backdrop.hasAttribute('data-m2'));
  dialog.querySelector('[aria-label="Close"]').click();
  assert(!backdrop.isConnected);
});
