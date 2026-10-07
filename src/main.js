// Reconcile with the live DOM in one animation-frame batch. Reuse generated nodes where possible.
// On desktop or outside 2D, restore the native layout rather than continuing to adapt it.
// 10. DOM reconciliation and teardown
// Order matters: discover/tag native containers, adapt shared components, update
// hero order and summaries, then reconcile card details and navigation.
function refresh() {
  frame = 0;
  if (dead) return;
  committedFiberCache.clear();
  const sidebar = q(c('sidebar')),
    header = q('header' + c('bar')),
    layout = header?.parentElement;
  const active =
    media.matches && !!sidebar && new URLSearchParams(location.search).get('3d') === '0';
  if (root.hasAttribute('data-m2-active') !== active)
    root.toggleAttribute('data-m2-active', active);
  root.dataset.m2Mode = mode;
  root.dataset.m2Panel = panel;
  updateEventHistory();
  if (!active) {
    for (const [el, attrs] of changedAttributes)
      for (const [key, value] of attrs) {
        if (value === null) el.removeAttribute(key);
        else el.setAttribute(key, value);
      }
    changedAttributes.clear();
    clearBoardRotation();
    deckUpdate();
    for (const box of document.querySelectorAll('[data-m2="hero"]'))
      box.style.removeProperty('order');
    return;
  }
  if (header) {
    for (const team of header.querySelectorAll('[aria-label*="life remaining"]')) {
      const m = (team.getAttribute('aria-label') || '').match(
        /(Red|Blue) team has (\d+) life remaining/i,
      );
      if (!m) continue;
      const current = Number(m[2]);
      const score = q(c('lifeScore'), team);
      if (score) {
        tag(score, 'life-fraction');
        const v = String(current);
        if (score.getAttribute('data-m2-fraction') !== v)
          score.setAttribute('data-m2-fraction', v);
      }
    }
  }
  if (header) {
    const meta = q(c('matchMeta'), header),
      coin = q(c('tieBreaker'), header);
    if (meta && coin) {
      const color = (coin.getAttribute('src') || '').includes('orange') ? 'Orange' : 'Blue';
      if (meta.dataset.m2Coin !== color) meta.dataset.m2Coin = color;
    }
    for (const lane of header.querySelectorAll(c('waveLane'))) {
      const count = lane.getAttribute('aria-label')?.match(/(\d+) Wave/i)?.[1];
      if (count !== undefined && lane.dataset.m2Waves !== count) lane.dataset.m2Waves = count;
    }
  }
  updateMobileHeader(header);
  tag(layout, 'layout');
  tag(header, 'header');
  tag(q(c('main'), layout || document), 'main');
  tag(q(c('boardArea')), 'board');
  tag(sidebar, 'sidebar');
  if (sidebar) {
    for (const box of sidebar.querySelectorAll(':scope>div'))
      if (q(c('name'), box) && q(c('label'), box) && !q(':scope>' + c('name'), box))
        tag(box, 'own-wrapper');
    for (const name of sidebar.querySelectorAll(c('name'))) {
      const box = name.parentElement;
      if (q(c('details'), box)) {
        tag(box, 'hero');
        const other = !name.textContent.includes('(You)');
        if (box.hasAttribute('data-m2-other') !== other)
          box.toggleAttribute('data-m2-other', other);
      }
    }
    for (const dots of sidebar.querySelectorAll(c('dots'))) {
      const box = dots.parentElement;
      if (!dots.children.length) tag(box, 'empty-pile');
      else if (box.getAttribute('data-m2') === 'empty-pile') box.removeAttribute('data-m2');
    }
  }
  // Use the visual viewport so browser chrome/keyboard changes do not push the
  // bottom controls off screen. Write only changed values to avoid needless layout work.
  const vh = Math.round(window.visualViewport?.height || innerHeight);
  const offset = Math.max(
    0,
    Math.round(innerHeight - vh - (window.visualViewport?.offsetTop || 0)),
  );
  if (root.style.getPropertyValue('--m2-vh') !== vh + 'px')
    root.style.setProperty('--m2-vh', vh + 'px');
  if (root.style.getPropertyValue('--m2-offset') !== offset + 'px')
    root.style.setProperty('--m2-offset', offset + 'px');
  const nativeDeck = q(c('modal') + ':has(' + c('cardGrid') + ')');
  tag(nativeDeck, 'deck');
  // Native X, backdrop, and Escape can unmount Deck independently of our toggle.
  if (deckOpen && nativeDeck) deckMounted = true;
  else if (deckOpen && deckMounted) setDeckOpen(false);
  deckUpdate();
  deckPaint();
  tag(q('[aria-label="Starting position"]'), 'setup');
  tag(q(c('gameToolsRow')), 'tools');
  updateCursorSetting();
  updateBoardRotation();
  updateUpgradeCards();
  updateChoiceLaunchers();
  const upgradeRequest = currentUpgradeRequest();
  const queue = resolutionEntries();
  const resolving = /^RESOLUTION$/i.test(
    q(c('phase'), header || document)?.textContent.trim() || '',
  );
  if (sidebar) {
    for (const label of sidebar.querySelectorAll(c('label'))) {
      if (/^Hand(?:\s|$)/i.test(label.textContent.trim())) tag(label.parentElement, 'hand-list');
    }
    updateOwnColors(sidebar);
    const publicView = componentProp(sidebar, 'view');
    const heroes = Array.from(sidebar.querySelectorAll('[data-m2="hero"]')).map((box) => {
      updateHeroDashboard(box, publicView);
      const name = q(c('name'), box),
        details = q(c('details'), box),
        hero = componentProp(box, 'hero');
      const entry = queue.find(
        (e) =>
          heroDisplayName(name)
            .split('·')[0]
            .replace(/\(You\)/g, '')
            .trim() === e.name,
      );
      const offboard = !!q('.m2-offboard-label', box);
      // Queue membership takes precedence over off-board status. A resolved played slot
      // marks completion; absence from the queue alone does not prove a turn was taken.
      const playedThisTurn = !!hero?.played_cards?.[Number(publicView?.turn) - 1];
      const done = resolving && !entry && (hero ? playedThisTurn : !q(c('currentCard'), box));
      box.style.order = String(entry ? entry.order : 99);
      box.classList.toggle('m2-current-hero', !!entry?.current);
      box.classList.toggle('m2-pending-hero', resolving && !!entry);
      box.classList.toggle('m2-done-hero', done);
      updateTurnPortrait(box, entry, done, offboard, resolving);
      const cardPiles = hero
        ? ['played_cards', 'discard_pile'].map((field, i) => ({
            label: i ? 'D' : 'P',
            cards: (hero[field] || [])
              .filter(Boolean)
              .map((card) => ({
                color: cardColors[card.color] || '#888',
                name: card.is_facedown ? 'Hidden card' : card.name,
                active:
                  !card.is_facedown &&
                  (card.is_active ||
                    (publicView?.effects || []).some(
                      (effect) => effect.is_active && effect.source_card_id === card.id,
                    )),
              })),
          }))
        : Array.from(box.querySelectorAll(c('dots'))).map((e) => ({
            label: q(c('label'), e.parentElement)?.textContent.startsWith('Played') ? 'P' : 'D',
            cards: Array.from(e.children).map((dot) => ({ color: dot.style.backgroundColor })),
          }));
      return {
        id: hero?.id,
        level: hero?.level,
        gold: hero?.gold,
        currentCard: hero ? heroTurnCard(box, hero, publicView) : null,
        currentActive: hero ? cardIsActive(heroTurnCard(box, hero, publicView), publicView) : false,
        offboard,
        upgrading: /^LEVEL[_ ]UP$/i.test(publicView?.phase || ''),
        upgradeRemaining: remainingUpgrades(upgradeRequest, hero?.id),
        planning: /^PLANNING$/i.test(publicView?.phase || ''),
        committed: !!hero?.current_turn_card || hasLocalSelection(box),
        upgrades: hero?.items || {},
        cardPiles,
        done,
        resolution: entry || null,
        name: heroDisplayName(name),
        detail: (details?.textContent.trim() || '').match(/Lv\s*\d+.*$/)?.[0] || '',
        color: q('span[style]', name || box)?.style.color || '',
        piles: Array.from(box.querySelectorAll(c('dots'))).map((e) => ({
          label: q(c('label'), e.parentElement)?.textContent.trim() || '',
          colors: Array.from(e.children).map((d) => d.style.backgroundColor),
        })),
        dots: Array.from(box.querySelectorAll(c('handColorDot') + ',.m2-own-colors i')).map(
          (e) => e.style.backgroundColor,
        ),
      };
    });
    heroes.sort((a, b) => (a.resolution?.order ?? 99) - (b.resolution?.order ?? 99));
    const sh = heroes.length * 32 + 12 + 'px';
    if (root.style.getPropertyValue('--m2-summary-h') !== sh)
      root.style.setProperty('--m2-summary-h', sh);
    renderSummary(heroes);
  }
  const commit =
    sidebar &&
    Array.from(sidebar.querySelectorAll('button')).find((b) =>
      /^Commit\b/.test(b.textContent.trim()),
    );
  tag(commit?.parentElement, 'commit');
  // Current card tooltips are portalled, inline-positioned boxes; inspect only
  // rendered tooltip elements; card props come from visible card components.
  for (const e of document.querySelectorAll('div[style]')) {
    if (
      e.style.position === 'fixed' &&
      e.style.zIndex === '9999' &&
      e.textContent.includes('Initiative:') &&
      e.textContent.includes('Primary Action:')
    )
      tag(e, 'tip');
  }
  const handList = q('[data-m2="hand-list"]');
  // Inspect cards over the board; empty displays never replace the board itself.
  const boardHost = q('[data-m2="board"]');
  const detailHost = boardHost || sidebar?.parentElement;
  for (const display of [detailsPanel, heroPanel])
    if (detailHost && display.parentElement !== detailHost) detailHost.append(display);
  updateHeroCardDisplay();
  const tip = q('[data-m2="tip"]');
  const selected = q('[data-m2="hand-list"] ' + c('row') + c('selected'));
  for (const row of sidebar?.querySelectorAll(c('row')) || []) {
    const rc = renderedCard(row);
    if (rc) {
      row.style.setProperty('--m2-card-accent', cardColors[rc.color] || '#c4c8ce');
      updateCardRow(row, rc);
    }
  }
  let card = selected ? renderedCard(selected) : null;
  if (commit) {
    commit.style.setProperty('--m2-card-accent', cardColors[card?.color] || '#4caf50');
  }
  if (!card && tip) {
    for (const node of [tip, ...tip.querySelectorAll('*')]) {
      card = renderedCard(node);
      if (card) break;
    }
  }
  // Include upgrades in the render key so item changes refresh visible values.
  // A dismissed card stays closed until a different selection or tooltip replaces it.
  const detailKey =
    card && JSON.stringify(card) !== hiddenCardKey && (!tip || tip !== dismissedTip)
      ? JSON.stringify([card, cardUpgrades(card)])
      : '';
  // A read-only hero inspection takes precedence over a retained Hand selection.
  const visibleDetailKey = selectedHeroCard ? '' : detailKey;
  if (detailsPanel.dataset.key !== visibleDetailKey) {
    detailsPanel.dataset.key = visibleDetailKey;
    detailsPanel.replaceChildren();
    if (visibleDetailKey) detailsPanel.append(textCard(card, 'hand', tip));
  }
  if (tip && card && tip.dataset.m2CardKey !== detailKey) {
    tip.dataset.m2CardKey = detailKey;
    tip.querySelector(':scope>.m2-text-card')?.remove();
    const unified = textCard(card, 'hand', tip);
    tip.append(unified);
    extras.add(unified);
  }
  if (tip !== dismissedTip && tip?.hasAttribute('data-m2-dismissed'))
    tip.removeAttribute('data-m2-dismissed');
  close.hidden = !active || !tip || tip === dismissedTip;
  close.style.display = close.hidden ? 'none' : '';
  updatePlanningActions();
  syncNavigation();
  // Drop detached nodes from bookkeeping after React replaces native subtrees.
  // Otherwise repeated turns/navigation could retain old DOM and associated listeners.
  for (const element of extras) if (!element.isConnected) extras.delete(element);
  for (const element of tagged) if (!element.isConnected) tagged.delete(element);
  for (const element of changedAttributes.keys())
    if (!element.isConnected) changedAttributes.delete(element);
}
// Many mutations can occur in one React update; collapse them into one refresh.
function schedule() {
  if (!frame) frame = requestAnimationFrame(refresh);
}
// Watch only structural and relevant native class/label changes. Our own data-m2
// attributes are intentionally excluded to avoid a self-triggering observer loop.
const observer = new MutationObserver(schedule);
observer.observe(document.body, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['class', 'aria-label'],
});
on(window, 'resize', schedule);
if (window.visualViewport) {
  on(window.visualViewport, 'resize', schedule);
  on(window.visualViewport, 'scroll', schedule);
}
on(media, 'change', schedule);

// Public teardown for console installs and upgrades: release observers, timers, and DOM changes.
window.GOA2Mobile2D = {
  version: '0.16.0',
  destroy() {
    flushEventHistory();
    dead = true;
    for (const [el, attrs] of changedAttributes)
      for (const [key, value] of attrs) {
        if (value === null) el.removeAttribute(key);
        else el.setAttribute(key, value);
      }
    changedAttributes.clear();
    clearBoardRotation();
    ac.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
    basicCanvases.clear();
    deckState?.watchers?.forEach((stop) => stop());
    deckState?.host.remove();
    deckState?.zoom.remove();
    deckState?.modal.removeAttribute('data-m2-deck-ready');
    for (const e of document.querySelectorAll('.m2-current-hero,[data-m2="hero"]')) {
      e.classList.remove(
        'm2-current-hero',
        'm2-done-hero',
        'm2-pending-hero',
        'm2-hero-expanded',
      );
      e.style.removeProperty('order');
    }
    for (const e of document.querySelectorAll('.m2-adapted-row')) {
      e.classList.remove('m2-adapted-row');
    }
    for (const e of document.querySelectorAll('[style]'))
      e.style.removeProperty('--m2-card-accent');
    style.remove();
    nav.remove();
    close.remove();
    summary.remove();
    detailsPanel.remove();
    heroPanel.remove();
    clearInterval(eventHistoryTimer);
    for (const e of extras) e.remove();
    for (const e of tagged) {
      e.removeAttribute('data-m2');
      e.removeAttribute('data-m2-dismissed');
      e.removeAttribute('data-m2-other');
      e.removeAttribute('data-m2-fraction');
    }
    for (const e of document.querySelectorAll('[data-m2-history-empty]')) {
      e.hidden = false;
      e.removeAttribute('data-m2-history-empty');
    }
    for (const e of document.querySelectorAll('[data-m2-upgrade-key]'))
      e.removeAttribute('data-m2-upgrade-key');
    for (const e of document.querySelectorAll(
      '[data-m2-coin],[data-m2-waves],[data-m2-card-key]',
    )) {
      e.removeAttribute('data-m2-coin');
      e.removeAttribute('data-m2-waves');
      e.removeAttribute('data-m2-card-key');
    }
    for (const n of [
      'data-m2-hide-cursors',
      'data-m2-deck-open',
      'data-m2-active',
      'data-m2-mode',
      'data-m2-panel',
    ])
      root.removeAttribute(n);
    root.style.removeProperty('--m2-head');
    root.style.removeProperty('--m2-summary-h');
    root.style.removeProperty('--m2-vh');
    root.style.removeProperty('--m2-offset');
    delete window.GOA2Mobile2D;
  },
};
refresh();
