import { describe, expect, it } from 'vitest';
import { getCompetition, getCompetitions, getPlayers, getStats, getWaitingList, type GameScore, type TournamentState } from '@/engine';
import { drawnBracket, drawnGroups, matchBetween, run, tableId } from './scenarios';

const MIN = 60_000;
const T0 = Date.UTC(2026, 4, 1, 9, 0);
const win3: GameScore[] = [
  [11, 7],
  [11, 9],
  [11, 5],
];

/**
 * Open: one group of P1–P4 (6 matches). U15: one group of P5–P7 (3 matches). Tables 1 and 2.
 * Both play to 3 games, so a match is expected to take 25 minutes.
 */
function openAndU15() {
  const open = drawnGroups(4, { by: 'count', groups: 1 }, { seeds: { 1: 1, 2: 2, 3: 3, 4: 4 }, tables: 2 });
  let state = open.state;
  for (const name of ['P5', 'P6', 'P7']) state = run(state, { type: 'addPlayer', firstName: 'Player', lastName: name, club: '' });
  state = run(state, { type: 'addCompetition', name: 'U15' });
  const u15 = getCompetitions(state).find((c) => c.name === 'U15')!.id;
  for (const p of getPlayers(state).filter((x) => ['P5', 'P6', 'P7'].includes(x.lastName))) {
    state = run(state, { type: 'enterPlayer', competition: u15, player: p.id });
  }
  state = run(state, { type: 'configureStages', competition: u15, stages: [{ type: 'groups', grouping: { by: 'count', groups: 1 } }] });
  const u15Stage = getCompetition(state, u15)!.stages[0].id;
  state = run(state, { type: 'generateDraw', stage: u15Stage, randomSeed: 1 }, { type: 'confirmStage', stage: u15Stage });
  return { state, open: { id: open.competition, stage: open.stage }, u15: { id: u15, stage: u15Stage } };
}

/** Calls the match to the table at `from` and records a 3–0 at `to` (minutes after T0). */
function play(state: TournamentState, match: string, table: number, from: number, to: number) {
  return run(
    state,
    { type: 'assignMatch', match, table: tableId(state, table), at: T0 + from * MIN },
    { type: 'recordResult', match, result: { kind: 'games', games: win3 }, at: T0 + to * MIN },
  );
}

/** Open: P1–P4 on table 1 for 20 min, P2–P3 on table 2 for 30 min. U15: P5–P7 on table 1 for 10 min. */
function threePlayed() {
  const setup = openAndU15();
  let state = play(setup.state, matchBetween(setup.state, setup.open.stage, 'P1', 'P4').id, 1, 0, 20);
  state = play(state, matchBetween(state, setup.open.stage, 'P2', 'P3').id, 2, 0, 30);
  state = play(state, matchBetween(state, setup.u15.stage, 'P5', 'P7').id, 1, 20, 30);
  return { ...setup, state };
}

describe('stats', () => {
  it('shows progress as finished out of all matches, per competition, per stage and overall', () => {
    const { state, open, u15 } = threePlayed();
    const stats = getStats(state, T0 + 30 * MIN);

    expect(stats.progress).toEqual({ done: 3, total: 9 });
    expect(stats.competitions.map((c) => [c.name, c.done, c.total])).toEqual([
      ['Open', 2, 6],
      ['U15', 1, 3],
    ]);
    expect(stats.competitions[0]).toMatchObject({ competition: open.id, stages: [{ stage: open.stage, stageIndex: 0, done: 2, total: 6 }] });
    expect(stats.competitions[1]).toMatchObject({ competition: u15.id, stages: [{ stage: u15.stage, done: 1, total: 3 }] });
  });

  it('averages match durations (call to result) per competition, stage and table', () => {
    const { state } = threePlayed();
    const stats = getStats(state, T0 + 30 * MIN);

    expect(stats.competitions.map((c) => c.durations)).toEqual([
      { matches: 2, averageMs: 25 * MIN },
      { matches: 1, averageMs: 10 * MIN },
    ]);
    expect(stats.competitions.map((c) => c.stages[0].durations)).toEqual([
      { matches: 2, averageMs: 25 * MIN },
      { matches: 1, averageMs: 10 * MIN },
    ]);
    expect(stats.tables).toEqual([
      { table: tableId(state, 1), number: 1, durations: { matches: 2, averageMs: 15 * MIN } },
      { table: tableId(state, 2), number: 2, durations: { matches: 1, averageMs: 30 * MIN } },
    ]);
  });

  it('has no average before any match is finished', () => {
    const { state } = openAndU15();
    const stats = getStats(state, T0);
    expect(stats.competitions[0]).toMatchObject({ done: 0, total: 6, durations: { matches: 0, averageMs: null } });
    expect(stats.tables[0].durations).toEqual({ matches: 0, averageMs: null });
    expect(stats.longest).toEqual([]);
  });

  it('counts a result entered without a table call toward progress but not durations', () => {
    const { state: start, open } = openAndU15();
    const match = matchBetween(start, open.stage, 'P1', 'P4').id;
    const state = run(start, { type: 'recordResult', match, result: { kind: 'games', games: win3 }, at: T0 + 20 * MIN });
    const stats = getStats(state, T0 + 20 * MIN);
    expect(stats.competitions[0]).toMatchObject({ done: 1, total: 6, durations: { matches: 0, averageMs: null } });
  });

  it('leaves matches decided by a BYE out of progress, and counts games-only results in durations', () => {
    // 13 entries in a 16 bracket: 15 matches, 3 of them decided by BYEs.
    const { state: start } = drawnBracket(13, { tables: 1 });
    const match = getWaitingList(start, T0)[0].id;
    const state = run(
      start,
      { type: 'assignMatch', match, table: tableId(start, 1), at: T0 },
      { type: 'recordResult', match, result: { kind: 'gamesOnly', games: [3, 1] }, at: T0 + 18 * MIN },
    );
    const stats = getStats(state, T0 + 18 * MIN);
    expect(stats.competitions[0]).toMatchObject({ done: 1, total: 12, durations: { matches: 1, averageMs: 18 * MIN } });
  });

  it('lists the longest finished matches first, at most five', () => {
    const setup = openAndU15();
    const { open } = setup;
    let state = setup.state;
    const pairs: [string, string, number][] = [
      ['P1', 'P4', 12],
      ['P2', 'P3', 31],
      ['P3', 'P4', 22],
      ['P1', 'P2', 40],
      ['P2', 'P4', 9],
      ['P1', 'P3', 27],
    ];
    let clock = 0;
    for (const [a, b, minutes] of pairs) {
      state = play(state, matchBetween(state, open.stage, a, b).id, 1, clock, clock + minutes);
      clock += minutes;
    }

    const { longest } = getStats(state, T0 + clock * MIN);
    expect(longest.map((l) => l.durationMs / MIN)).toEqual([40, 31, 27, 22, 12]);
    expect(longest[0].match).toMatchObject({ id: matchBetween(state, open.stage, 'P1', 'P2').id, competition: open.id, table: { number: 1 } });
  });

  describe('time left', () => {
    it('spreads the remaining matches, at their competition’s average, over the active tables', () => {
      const { state: played, open } = threePlayed();
      // One more Open match on table 2, 5 minutes in: about 25 − 5 = 20 minutes still to go.
      const state = run(played, { type: 'assignMatch', match: matchBetween(played, open.stage, 'P3', 'P4').id, table: tableId(played, 2), at: T0 + 30 * MIN });
      const stats = getStats(state, T0 + 35 * MIN);
      // Open: 3 waiting × 25 + 20 on the table; U15: 2 waiting × 10. On 2 tables: (95 + 20) / 2.
      expect(stats.timeLeftMs).toBe(57.5 * MIN);
    });

    it('uses the expected duration for a competition with no finished match yet', () => {
      const { state } = openAndU15();
      // 9 matches × 25 minutes on 2 tables.
      expect(getStats(state, T0).timeLeftMs).toBe(112.5 * MIN);
    });

    it('never counts less than nothing for a match already past its average', () => {
      const { state: start, open } = openAndU15();
      const state = run(start, { type: 'assignMatch', match: matchBetween(start, open.stage, 'P1', 'P4').id, table: tableId(start, 1), at: T0 });
      // 8 waiting × 25 + 0 for the overdue one, on 2 tables.
      expect(getStats(state, T0 + 60 * MIN).timeLeftMs).toBe(100 * MIN);
    });

    it('is zero when every match is done, and unknown with no active table', () => {
      const { state: start, stage } = drawnGroups(2, { by: 'count', groups: 1 }, { tables: 1 });
      const match = matchBetween(start, stage, 'P1', 'P2').id;
      const done = play(start, match, 1, 0, 20);
      expect(getStats(done, T0 + 20 * MIN).timeLeftMs).toBe(0);
      const noTables = run(start, { type: 'setTableActive', table: tableId(start, 1), active: false });
      expect(getStats(noTables, T0).timeLeftMs).toBeNull();
    });
  });

  it.todo('counts walkovers toward progress but not toward durations (with walkovers, #0014)');
});
