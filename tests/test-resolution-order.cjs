const assert = require('node:assert/strict');
const { test } = require('node:test');
const { browserFixture } = require('./helpers/browser.cjs');

function setup(t) {
  const f = browserFixture({
    hooks: ['predictResolutionOrder', 'resolutionEntries', 'renderSummary', 'updateTurnPortrait'],
  });
  t.after(() => f.close());
  f.install();
  const entry = (heroId, team, initiative) => ({
    heroId,
    name: heroId,
    team,
    initiative,
    card: 'Card',
  });
  const forecast = (entries, coin = 'BLUE', actor = null) =>
    Array.from(f.w.testUI.predictResolutionOrder(entries, coin, actor));
  const labels = (rows) => rows.map((e) => e.heroId + ':' + (e.tied ? 'TIE' : e.order));
  return { ...f, entry, forecast, labels };
}

test('Same-team ties stay grouped and consume their real positions', (t) => {
  const { entry: e, forecast, labels } = setup(t);
  assert.deepEqual(
    labels(
      forecast([
        e('first', 'RED', 12),
        e('a', 'BLUE', 10),
        e('b', 'BLUE', 10),
        e('c', 'BLUE', 10),
        e('enemy', 'RED', 8),
      ]),
    ),
    ['first:1', 'a:2', 'b:TIE', 'c:TIE', 'enemy:5'],
  );
});

test('Mixed ties form a separate group for each team at its earliest slot', (t) => {
  const { entry: e, forecast, labels } = setup(t);
  assert.deepEqual(
    labels(
      forecast([
        e('R1', 'RED', 9),
        e('B1', 'BLUE', 9),
        e('R2', 'RED', 9),
        e('B2', 'BLUE', 9),
        e('next', 'RED', 7),
      ]),
    ),
    ['B1:1', 'B2:TIE', 'R1:2', 'R2:TIE', 'next:5'],
  );
  assert.deepEqual(
    labels(
      forecast(
        [e('B1', 'BLUE', 9), e('O1', 'RED', 9), e('O2', 'RED', 9), e('next', 'BLUE', 7)],
        'RED',
      ),
    ),
    ['O1:1', 'O2:TIE', 'B1:2', 'next:4'],
  );
  assert.deepEqual(labels(forecast([e('B', 'BLUE', 9), e('O', 'RED', 9)], 'RED')), ['O:1', 'B:2']);
});

test('Coin flips are carried into later initiative groups; same-team ties do not flip it', (t) => {
  const { entry: e, forecast, labels } = setup(t);
  assert.deepEqual(
    labels(
      forecast([
        e('R-high', 'RED', 12),
        e('B-high', 'BLUE', 12),
        e('B-low', 'BLUE', 9),
        e('R-low', 'RED', 9),
      ]),
    ),
    ['B-high:1', 'R-high:2', 'R-low:3', 'B-low:4'],
  );
  assert.deepEqual(
    labels(
      forecast([
        e('R1', 'RED', 12),
        e('R2', 'RED', 12),
        e('R-low', 'RED', 9),
        e('B-low', 'BLUE', 9),
      ]),
    ),
    ['R1:1', 'R2:TIE', 'B-low:3', 'R-low:4'],
  );
});

test('Selected actor leads their group; new server state recalculates predictions', (t) => {
  const { entry: e, forecast, labels } = setup(t);
  const rows = [e('O1', 'RED', 9), e('B', 'BLUE', 9), e('O2', 'RED', 9)];
  const result = forecast(rows, 'RED', 'O2');
  assert.deepEqual(labels(result), ['O2:1', 'O1:TIE', 'B:2']);
  assert.equal(result.filter((e) => e.current).length, 1);
  assert.equal(result[0].heroId, 'O2');
  assert.deepEqual(
    labels(
      forecast(
        rows.filter((e) => e.heroId !== 'O2'),
        'BLUE',
        'B',
      ),
    ),
    ['B:1', 'O1:2'],
  );
  assert(!rows.some((e) => e.order), 'forecast never changes game data');
});

test('Collapsed native queue uses supplied card identities; ties render on portraits and compact list', (t) => {
  const { w, d, entry: e, forecast } = setup(t);
  const view = {
    phase: 'RESOLUTION',
    tie_breaker_team: 'RED',
    current_actor_id: 'O1',
    teams: {
      RED: {
        heroes: [
          { id: 'O1', name: 'Orange One' },
          { id: 'O2', name: 'Orange Two' },
        ],
      },
      BLUE: { heroes: [{ id: 'B', name: 'Blue' }] },
    },
    unresolved_cards: ['B', 'O1', 'O2'].map((hero_id) => ({
      hero_id,
      initiative: 9,
      card: { name: 'Card' },
    })),
  };
  d.querySelector('aside').__reactFiber$test = { memoizedProps: { view } };
  const entries = Array.from(w.testUI.resolutionEntries());
  assert.deepEqual(
    entries.map((e) => e.heroId),
    ['O1', 'O2', 'B'],
  );
  assert.equal(entries[1].tied, true);
  const rows = entries.map((resolution) => ({
    id: resolution.heroId,
    name: resolution.name,
    resolution,
    dots: [],
    piles: [],
    cardPiles: [],
    upgrades: {},
    detail: '',
  }));
  w.testUI.renderSummary(rows);
  assert.deepEqual(
    [...d.querySelectorAll('.m2-summary-turn b')].map((e) => e.textContent),
    ['NOW', 'TIE', '2.'],
  );
  const box = d.createElement('section');
  d.body.append(box);
  w.testUI.updateTurnPortrait(box, entries[1], false, false, true);
  assert.equal(box.querySelector('.m2-turn-number').textContent, 'TIE');
});
