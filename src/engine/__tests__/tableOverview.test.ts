import { describe, expect, it } from 'vitest';
import { getOverdueMatches, getTableOverview, type GameScore } from '@/engine';
import { drawnGroups, groupsOf, matchBetween, run, tableId } from './scenarios';

const MIN = 60_000;
const T0 = Date.UTC(2026, 4, 1, 9, 0);
const win: GameScore[] = [
  [11, 5],
  [11, 6],
  [11, 7],
];

/** One confirmed group of 4 (3 games to win: 25 min expected) and tables 1–4. */
function groupOfFour() {
  return drawnGroups(4, { by: 'count', groups: 1 }, { seeds: { 1: 1, 2: 2, 3: 3, 4: 4 }, tables: 4 });
}

const row = (overview: ReturnType<typeof getTableOverview>, number: number) => overview.tables.find((t) => t.number === number)!;

describe('table overview', () => {
  it('lists every table by number with its status', () => {
    const { state, stage } = groupOfFour();
    const next = run(
      state,
      { type: 'assignMatch', match: matchBetween(state, stage, 'P1', 'P4').id, table: tableId(state, 1), at: T0 },
      { type: 'assignMatch', match: matchBetween(state, stage, 'P2', 'P3').id, table: tableId(state, 2), at: T0 + 20 * MIN },
      { type: 'setTableActive', table: tableId(state, 4), active: false },
    );

    const overview = getTableOverview(next, T0 + 30 * MIN);

    expect(overview.tables.map((t) => [t.number, t.status])).toEqual([
      [1, 'overdue'],
      [2, 'playing'],
      [3, 'free'],
      [4, 'inactive'],
    ]);
  });

  it('shows the current match of a busy table with its elapsed time and overdue level', () => {
    const { state, stage } = groupOfFour();
    const match = matchBetween(state, stage, 'P1', 'P4');
    const next = run(state, { type: 'assignMatch', match: match.id, table: tableId(state, 1), at: T0 });

    expect(row(getTableOverview(next, T0 + 10 * MIN), 1)).toMatchObject({
      status: 'playing',
      match: { id: match.id, status: 'in_progress', overdue: null },
      elapsedMs: 10 * MIN,
      idleMs: null,
    });
    expect(row(getTableOverview(next, T0 + 38 * MIN), 1)).toMatchObject({
      status: 'overdue',
      match: { id: match.id, overdue: 'red' },
      elapsedMs: 38 * MIN,
    });
  });

  it('counts idle time from the moment the last match on that table finished', () => {
    const { state, stage } = groupOfFour();
    const first = matchBetween(state, stage, 'P1', 'P4').id;
    const second = matchBetween(state, stage, 'P2', 'P3').id;
    const next = run(
      state,
      { type: 'assignMatch', match: first, table: tableId(state, 1), at: T0 },
      { type: 'recordResult', match: first, result: { kind: 'games', games: win }, at: T0 + 20 * MIN },
      { type: 'assignMatch', match: second, table: tableId(state, 1), at: T0 + 21 * MIN },
      { type: 'recordResult', match: second, result: { kind: 'games', games: win }, at: T0 + 40 * MIN },
    );

    expect(row(getTableOverview(next, T0 + 47 * MIN), 1)).toMatchObject({ status: 'free', match: null, elapsedMs: null, idleMs: 7 * MIN });
  });

  it('keeps counting idle time from the last finished match when a call is taken back', () => {
    const { state, stage } = groupOfFour();
    const first = matchBetween(state, stage, 'P1', 'P4').id;
    const next = run(
      state,
      { type: 'assignMatch', match: first, table: tableId(state, 1), at: T0 },
      { type: 'recordResult', match: first, result: { kind: 'games', games: win }, at: T0 + 20 * MIN },
      { type: 'assignMatch', match: matchBetween(state, stage, 'P2', 'P3').id, table: tableId(state, 1), at: T0 + 25 * MIN },
      { type: 'unassignMatch', match: matchBetween(state, stage, 'P2', 'P3').id, at: T0 + 26 * MIN },
    );

    expect(row(getTableOverview(next, T0 + 30 * MIN), 1).idleMs).toBe(10 * MIN);
  });

  it('never shows negative idle time when `now` lags just behind the result', () => {
    const { state, stage } = groupOfFour();
    const first = matchBetween(state, stage, 'P1', 'P4').id;
    const next = run(
      state,
      { type: 'assignMatch', match: first, table: tableId(state, 1), at: T0 },
      { type: 'recordResult', match: first, result: { kind: 'games', games: win }, at: T0 + 20 * MIN },
    );
    expect(row(getTableOverview(next, T0 + 20 * MIN - 500), 1).idleMs).toBe(0);
  });

  it('has no idle time for a table that has not had a match yet', () => {
    const { state } = groupOfFour();
    expect(row(getTableOverview(state, T0), 3)).toMatchObject({ status: 'free', idleMs: null });
  });

  it('counts overdue tables, and idle tables while ready matches wait', () => {
    const { state, stage } = groupOfFour();
    const next = run(
      state,
      { type: 'assignMatch', match: matchBetween(state, stage, 'P1', 'P4').id, table: tableId(state, 1), at: T0 },
      { type: 'setTableActive', table: tableId(state, 4), active: false },
    );

    // P2–P3 is ready; tables 2 and 3 are free; table 4 is inactive and doesn't count.
    expect(getTableOverview(next, T0 + 26 * MIN)).toMatchObject({ overdueCount: 1, idleCount: 2 });

    const allPlaying = run(next, { type: 'assignMatch', match: matchBetween(state, stage, 'P2', 'P3').id, table: tableId(state, 2), at: T0 });
    // Nothing is ready any more (everyone is playing), so the free table 3 is not an alarm.
    expect(getTableOverview(allPlaying, T0 + 10 * MIN)).toMatchObject({ overdueCount: 0, idleCount: 0 });
  });
});

describe('overdue alarm', () => {
  it('lists the overdue matches, red first, then the longest running', () => {
    const { state, stage } = drawnGroups(8, { by: 'count', groups: 2 }, { tables: 4, randomSeed: 3 });
    const [a, b] = [0, 1].map((g) => groupsOf(state, stage)[g].matches);
    const next = run(
      state,
      { type: 'assignMatch', match: a[0].id, table: tableId(state, 1), at: T0 },
      { type: 'assignMatch', match: a[1].id, table: tableId(state, 2), at: T0 + 5 * MIN },
      { type: 'assignMatch', match: b[0].id, table: tableId(state, 3), at: T0 + 10 * MIN },
      { type: 'assignMatch', match: b[1].id, table: tableId(state, 4), at: T0 + 30 * MIN },
    );

    // At +45: table 1 runs 45 min (red), table 2 40 (red), table 3 35 (amber), table 4 15 (in progress).
    expect(getOverdueMatches(next, T0 + 45 * MIN).map((m) => [m.table?.number, m.overdue])).toEqual([
      [1, 'red'],
      [2, 'red'],
      [3, 'amber'],
    ]);
  });
});
