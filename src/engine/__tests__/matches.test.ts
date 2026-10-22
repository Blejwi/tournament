import { describe, expect, it } from 'vitest';
import { execute, getFreeTables, getMatch, getWaitingList, parseGames, validateResult, type GameScore } from '@/engine';
import { errorOf } from './helpers';
import { drawnGroups, groupsOf, matchBetween, run, slotName, tableId } from './scenarios';

const MIN = 60_000;
const T0 = Date.UTC(2026, 4, 1, 9, 0);

/** One confirmed group of 4 (P1..P4 in draw positions 1..4) with 3 tables. */
function groupOfFour(options: { gamesToWin?: 2 | 3 | 4 } = {}) {
  return drawnGroups(4, { by: 'count', groups: 1 }, { seeds: { 1: 1, 2: 2, 3: 3, 4: 4 }, tables: 3, ...options });
}

const win3: GameScore[] = [
  [11, 7],
  [9, 11],
  [11, 5],
  [11, 8],
];

describe('calling a match to a table', () => {
  it('starts the match clock at the time it is called', () => {
    const { state, stage } = groupOfFour();
    const match = matchBetween(state, stage, 'P1', 'P4');
    const next = run(state, { type: 'assignMatch', match: match.id, table: tableId(state, 2), at: T0 });

    expect(getMatch(next, match.id, T0 + 5 * MIN)).toMatchObject({
      status: 'in_progress',
      table: { number: 2 },
      assignedAt: T0,
      elapsedMs: 5 * MIN,
    });
    expect(getFreeTables(next).map((t) => t.number)).toEqual([1, 3]);
  });

  it('makes the players’ other matches busy while they play', () => {
    const { state, stage } = groupOfFour();
    const next = run(state, { type: 'assignMatch', match: matchBetween(state, stage, 'P1', 'P4').id, table: tableId(state, 1), at: T0 });

    expect(matchBetween(next, stage, 'P1', 'P2').status).toBe('busy');
    expect(matchBetween(next, stage, 'P2', 'P3').status).toBe('ready');
  });

  it('only calls a ready match to a free, active table', () => {
    const { state, stage } = groupOfFour();
    const first = matchBetween(state, stage, 'P1', 'P4');
    const playing = run(state, { type: 'assignMatch', match: first.id, table: tableId(state, 1), at: T0 });
    const other = matchBetween(playing, stage, 'P2', 'P3');
    const busyMatch = matchBetween(playing, stage, 'P1', 'P2');

    expect(errorOf(execute(playing, { type: 'assignMatch', match: other.id, table: tableId(state, 1), at: T0 }))).toEqual({
      code: 'tableBusy',
      number: 1,
    });
    expect(errorOf(execute(playing, { type: 'assignMatch', match: busyMatch.id, table: tableId(state, 2), at: T0 }))).toEqual({
      code: 'matchNotReady',
      status: 'busy',
    });
    const inactive = run(playing, { type: 'setTableActive', table: tableId(state, 3), active: false });
    expect(errorOf(execute(inactive, { type: 'assignMatch', match: other.id, table: tableId(state, 3), at: T0 }))).toEqual({
      code: 'tableInactive',
      number: 3,
    });
    expect(errorOf(execute(playing, { type: 'assignMatch', match: other.id, table: 'nope', at: T0 }))).toEqual({
      code: 'tableNotFound',
      table: 'nope',
    });
    expect(errorOf(execute(playing, { type: 'assignMatch', match: 'nope', table: tableId(state, 2), at: T0 }))).toEqual({
      code: 'matchNotFound',
      match: 'nope',
    });
  });

  it('cannot call a match of an unconfirmed draw', () => {
    const { state, stage } = drawnGroups(4, { by: 'count', groups: 1 }, { tables: 1, confirm: false });
    const match = groupsOf(state, stage)[0].matches[0];
    expect(errorOf(execute(state, { type: 'assignMatch', match: match.id, table: tableId(state, 1), at: T0 }))).toEqual({
      code: 'matchNotReady',
      status: 'pending',
    });
  });

  it('takes a match off its table again', () => {
    const { state, stage } = groupOfFour();
    const match = matchBetween(state, stage, 'P1', 'P4');
    let next = run(state, { type: 'assignMatch', match: match.id, table: tableId(state, 1), at: T0 });
    next = run(next, { type: 'unassignMatch', match: match.id });

    expect(getMatch(next, match.id, T0)).toMatchObject({ status: 'ready', table: null, assignedAt: null });
    expect(getFreeTables(next).map((t) => t.number)).toEqual([1, 2, 3]);
  });

  it('keeps a table with a match on it from being removed', () => {
    const { state, stage } = groupOfFour();
    const next = run(state, { type: 'assignMatch', match: matchBetween(state, stage, 'P1', 'P4').id, table: tableId(state, 1), at: T0 });
    expect(errorOf(execute(next, { type: 'removeTable', table: tableId(state, 1) }))).toEqual({ code: 'tableInUse', number: 1 });
  });
});

describe('recording a result', () => {
  function playing() {
    const { state, stage } = groupOfFour();
    const match = matchBetween(state, stage, 'P1', 'P4');
    return { stage, match, state: run(state, { type: 'assignMatch', match: match.id, table: tableId(state, 1), at: T0 }) };
  }

  it('finishes the match at the time given, frees the table and records the winner', () => {
    const { state, match } = playing();
    const next = run(state, { type: 'recordResult', match: match.id, result: { kind: 'games', games: win3 }, at: T0 + 22 * MIN });

    expect(getMatch(next, match.id, T0 + 30 * MIN)).toMatchObject({
      status: 'finished',
      table: { number: 1 },
      assignedAt: T0,
      finishedAt: T0 + 22 * MIN,
      elapsedMs: null,
      result: { winner: 0, gamesWon: [3, 1], games: win3 },
    });
    expect(getFreeTables(next).map((t) => t.number)).toEqual([1, 2, 3]);
  });

  it('can record a result for a match that was never called', () => {
    const { state, stage } = groupOfFour();
    const match = matchBetween(state, stage, 'P2', 'P3');
    const games: GameScore[] = [
      [5, 11],
      [9, 11],
      [10, 12],
    ];
    const next = run(state, { type: 'recordResult', match: match.id, result: { kind: 'games', games }, at: T0 });
    expect(getMatch(next, match.id, T0)).toMatchObject({ status: 'finished', assignedAt: null, result: { winner: 1 } });
  });

  it('rejects a second result (that is a correction)', () => {
    const { state, match } = playing();
    const next = run(state, { type: 'recordResult', match: match.id, result: { kind: 'games', games: win3 }, at: T0 });
    expect(errorOf(execute(next, { type: 'recordResult', match: match.id, result: { kind: 'games', games: win3 }, at: T0 }))).toEqual({
      code: 'matchFinished',
    });
  });

  it('needs the points of every game in a group match', () => {
    const { state, match } = playing();
    const result = execute(state, { type: 'recordResult', match: match.id, result: { kind: 'gamesOnly', games: [3, 1] }, at: T0 });
    expect(errorOf(result)).toEqual({ code: 'gamePointsRequired' });
  });
});

describe('score validation', () => {
  function errorFor(games: GameScore[], gamesToWin: 2 | 3 | 4 = 3) {
    const { state, stage } = groupOfFour({ gamesToWin });
    const match = matchBetween(state, stage, 'P1', 'P4');
    return errorOf(execute(state, { type: 'recordResult', match: match.id, result: { kind: 'games', games }, at: T0 }));
  }

  it('accepts a game to 11 with a 2-point lead, and past 10–10 a lead of exactly 2', () => {
    const { state, stage } = groupOfFour();
    const match = matchBetween(state, stage, 'P1', 'P4');
    const games: GameScore[] = [
      [11, 9],
      [12, 10],
      [0, 11],
      [17, 15],
    ];
    const next = run(state, { type: 'recordResult', match: match.id, result: { kind: 'games', games }, at: T0 });
    expect(getMatch(next, match.id, T0)!.result).toMatchObject({ winner: 0, gamesWon: [3, 1] });
  });

  it('rejects a game without 11 points, without a 2-point lead, or with a lead other than 2 past 10–10', () => {
    for (const [a, b] of [
      [10, 8],
      [11, 10],
      [13, 10],
      [14, 11],
      [11, 11],
      [-1, 11],
    ]) {
      expect(errorFor([[11, 5], [a, b], [11, 3], [11, 2]])).toEqual({ code: 'invalidGame', game: 2, a, b });
    }
  });

  it('rejects games after the match was decided', () => {
    expect(
      errorFor([
        [11, 5],
        [11, 5],
        [11, 5],
        [11, 5],
      ]),
    ).toEqual({ code: 'gamesAfterDecided', game: 4 });
    expect(
      errorFor(
        [
          [11, 5],
          [11, 5],
          [5, 11],
        ],
        2,
      ),
    ).toEqual({ code: 'gamesAfterDecided', game: 3 });
  });

  it('needs the winner to have exactly the games to win', () => {
    expect(
      errorFor([
        [11, 5],
        [5, 11],
        [11, 5],
      ]),
    ).toEqual({ code: 'matchNotDecided', gamesToWin: 3 });
    expect(errorFor([])).toEqual({ code: 'matchNotDecided', gamesToWin: 3 });
    expect(
      errorFor(
        [
          [11, 5],
          [11, 5],
          [5, 11],
        ],
        4,
      ),
    ).toEqual({ code: 'matchNotDecided', gamesToWin: 4 });
  });
});

describe('standings', () => {
  it('orders a group by group points, 1 for a win and 0 for a loss, counting finished matches only', () => {
    const { state, stage } = groupOfFour();
    const p1Wins: GameScore[] = [
      [11, 5],
      [11, 5],
      [11, 5],
    ];
    const p1Loses: GameScore[] = p1Wins.map(([a, b]) => [b, a]);
    let next = state;
    // P4 beats P1, P3 beats P2, P4 beats P3; P1–P2 is still on its table.
    for (const [a, b, games] of [
      ['P1', 'P4', p1Loses],
      ['P2', 'P3', p1Loses],
      ['P4', 'P3', p1Wins],
    ] as const) {
      const match = matchBetween(next, stage, a, b);
      const aFirst = slotName(match, 0) === a;
      const oriented = aFirst ? games : games.map(([x, y]) => [y, x] as GameScore);
      next = run(next, { type: 'recordResult', match: match.id, result: { kind: 'games', games: [...oriented] }, at: T0 });
    }
    next = run(next, { type: 'assignMatch', match: matchBetween(next, stage, 'P1', 'P2').id, table: tableId(next, 1), at: T0 });

    const [group] = groupsOf(next, stage);
    expect(group.standings.map((r) => [r.entry!.players[0].lastName, r.groupPoints, r.played, r.won, r.lost])).toEqual([
      ['P4', 2, 2, 2, 0],
      ['P3', 1, 2, 1, 1],
      ['P1', 0, 1, 0, 1],
      ['P2', 0, 1, 0, 1],
    ]);
    expect(group.standings[0]).toMatchObject({ place: 1, gamesWon: 6, gamesLost: 0, pointsWon: 66, pointsLost: 30 });
    expect(group.complete).toBe(false);
  });
});

describe('waiting list', () => {
  const names = (list: ReturnType<typeof getWaitingList>) => list.map((m) => `${slotName(m, 0)}-${slotName(m, 1)}:${m.status}`);

  it('lists every ready match by round, then group', () => {
    const { state } = drawnGroups(6, { by: 'count', groups: 2 }, { seeds: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 } });
    // Group A: P1, P4, P5. Group B: P2, P3, P6. A group of 3 plays positions 2-3, then 1-2, then 3-1.
    expect(names(getWaitingList(state, T0))).toEqual([
      'P4-P5:ready',
      'P3-P6:ready',
      'P1-P4:ready',
      'P2-P3:ready',
      'P5-P1:ready',
      'P6-P2:ready',
    ]);
  });

  it('puts busy matches last and leaves out matches in progress', () => {
    const { state, stage } = groupOfFour();
    const first = matchBetween(state, stage, 'P1', 'P4');
    const next = run(state, { type: 'assignMatch', match: first.id, table: tableId(state, 1), at: T0 });

    expect(names(getWaitingList(next, T0))).toEqual([
      'P2-P3:ready',
      'P4-P3:busy',
      'P1-P2:busy',
      'P2-P4:busy',
      'P3-P1:busy',
    ]);
  });

  it('leaves out finished matches', () => {
    const { state, stage } = groupOfFour();
    const match = matchBetween(state, stage, 'P2', 'P3');
    const next = run(state, { type: 'recordResult', match: match.id, result: { kind: 'games', games: win3 }, at: T0 });
    expect(getWaitingList(next, T0).map((m) => m.id)).not.toContain(match.id);
    expect(getWaitingList(next, T0)).toHaveLength(5);
  });
});

describe('typing a score', () => {
  it('parses game scores separated by spaces or commas, slot A first', () => {
    expect(parseGames(' 11-7 9-11,11:5 ')).toEqual({
      ok: true,
      value: [
        [11, 7],
        [9, 11],
        [11, 5],
      ],
    });
    expect(parseGames('11-7 9-')).toEqual({ ok: false, error: { code: 'invalidScoreFormat', text: '9-' } });
  });

  it('validates a typed score live, without recording it', () => {
    const { state, stage } = groupOfFour();
    const match = matchBetween(state, stage, 'P1', 'P4').id;
    expect(validateResult(state, match, { kind: 'games', games: win3 })).toBeNull();
    expect(validateResult(state, match, { kind: 'games', games: [[11, 7]] })).toEqual({ code: 'matchNotDecided', gamesToWin: 3 });
  });
});

describe('match commands', () => {
  it('do not change the state they were given', () => {
    const { state, stage } = groupOfFour();
    const before = structuredClone(state);
    const match = matchBetween(state, stage, 'P1', 'P4').id;
    const called = run(state, { type: 'assignMatch', match, table: tableId(state, 1), at: T0 });
    const calledBefore = structuredClone(called);
    run(called, { type: 'recordResult', match, result: { kind: 'games', games: win3 }, at: T0 });
    expect(state).toEqual(before);
    expect(called).toEqual(calledBefore);
  });
});
