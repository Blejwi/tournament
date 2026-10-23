import { describe, expect, it } from 'vitest';
import { execute, getFinalPlaces, getFreeTables, getMatch, getWaitingList, validateResult, type TournamentState } from '@/engine';
import { errorOf } from './helpers';
import { drawnBracket, drawnGroups, groupsOf, matchBetween, roundsOf, run, slotLabel, slotName, tableId } from './scenarios';

/** P1..P3 in one group (round robin, 3 matches). */
function groupOfThree() {
  return drawnGroups(3, { by: 'count', groups: 1 });
}

/** Seeds 1..n given to P1..Pn. */
const allSeeded = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, i + 1]));

const standingsOf = (state: TournamentState, stage: string) =>
  groupsOf(state, stage)[0].standings.map((r) => ({
    name: r.entry?.players[0].lastName,
    played: r.played,
    won: r.won,
    lost: r.lost,
    games: [r.gamesWon, r.gamesLost],
    points: [r.pointsWon, r.pointsLost],
    groupPoints: r.groupPoints,
  }));

const rowOf = (state: TournamentState, stage: string, name: string) => standingsOf(state, stage).find((r) => r.name === name);

describe('walkover', () => {
  it('gives the winner the match without games, and the loser 0 group points', () => {
    const { state, stage } = groupOfThree();
    const match = matchBetween(state, stage, 'P1', 'P2');
    const p2 = slotName(match, 0) === 'P2' ? 0 : 1;
    const next = run(state, { type: 'recordResult', match: match.id, result: { kind: 'walkover', winner: p2 }, at: 1000 });

    const view = getMatch(next, match.id, 2000)!;
    expect(view.status).toBe('walkover');
    expect(view.result).toEqual({ kind: 'walkover', winner: p2, gamesWon: [0, 0], games: null });
    expect(view.finishedAt).toBe(1000);
    expect(standingsOf(next, stage)[0]).toEqual({ name: 'P2', played: 1, won: 1, lost: 0, games: [0, 0], points: [0, 0], groupPoints: 1 });
    expect(rowOf(next, stage, 'P1')).toEqual({ name: 'P1', played: 1, won: 0, lost: 1, games: [0, 0], points: [0, 0], groupPoints: 0 });
  });
});

describe('retirement', () => {
  it('keeps the games completed before the retirement in the ratios', () => {
    const { state, stage } = groupOfThree();
    const match = matchBetween(state, stage, 'P1', 'P2');
    const p1 = slotName(match, 0) === 'P1' ? 0 : 1;
    const p2 = p1 === 0 ? 1 : 0;
    // P1 wins the first game 11-5, P2 the second 11-9, then P1 retires.
    const game = (p1Points: number, p2Points: number): [number, number] => (p1 === 0 ? [p1Points, p2Points] : [p2Points, p1Points]);
    const next = run(state, {
      type: 'recordResult',
      match: match.id,
      result: { kind: 'retirement', winner: p2, games: [game(11, 5), game(9, 11)] },
      at: 1000,
    });

    expect(getMatch(next, match.id, 2000)).toMatchObject({ status: 'finished', result: { kind: 'retirement', winner: p2, gamesWon: [1, 1] } });
    expect(rowOf(next, stage, 'P2')).toEqual({ name: 'P2', played: 1, won: 1, lost: 0, games: [1, 1], points: [16, 20], groupPoints: 1 });
    expect(rowOf(next, stage, 'P1')).toEqual({ name: 'P1', played: 1, won: 0, lost: 1, games: [1, 1], points: [20, 16], groupPoints: 0 });
  });

  it('can happen before the first game is finished', () => {
    const { state, stage } = groupOfThree();
    const match = matchBetween(state, stage, 'P1', 'P2');
    const next = run(state, { type: 'recordResult', match: match.id, result: { kind: 'retirement', winner: 0, games: [] }, at: 1000 });
    expect(getMatch(next, match.id, 1000)!.result).toEqual({ kind: 'retirement', winner: 0, gamesWon: [0, 0], games: [] });
  });

  it('rejects invalid games, and games that already decide the match', () => {
    const { state, stage } = groupOfThree();
    const match = matchBetween(state, stage, 'P1', 'P2');
    const record = (games: [number, number][]) =>
      execute(state, { type: 'recordResult', match: match.id, result: { kind: 'retirement', winner: 1, games }, at: 0 });
    expect(errorOf(record([[11, 10]]))).toEqual({ code: 'invalidGame', game: 1, a: 11, b: 10 });
    expect(
      errorOf(
        record([
          [11, 5],
          [11, 5],
          [11, 5],
        ]),
      ),
    ).toEqual({ code: 'retirementAfterDecided', gamesToWin: 3 });
    expect(
      validateResult(state, match.id, {
        kind: 'retirement',
        winner: 1,
        games: [
          [11, 5],
          [11, 5],
        ],
      }),
    ).toBeNull();
  });
});

describe('disqualification', () => {
  it('gives the match to the opponent, without games', () => {
    const { state, stage } = groupOfThree();
    const match = matchBetween(state, stage, 'P1', 'P2');
    const next = run(state, { type: 'recordResult', match: match.id, result: { kind: 'disqualification', winner: 1 }, at: 1000 });
    expect(getMatch(next, match.id, 1000)).toMatchObject({
      status: 'finished',
      result: { kind: 'disqualification', winner: 1, gamesWon: [0, 0], games: null },
    });
    expect(rowOf(next, stage, slotName(match, 1))).toMatchObject({ won: 1, groupPoints: 1, games: [0, 0] });
  });
});

describe('special results on a table and in the waiting list', () => {
  it('free the table and take the match off the waiting list, like any result', () => {
    const { state, stage } = drawnGroups(3, { by: 'count', groups: 1 }, { tables: 1 });
    const match = matchBetween(state, stage, 'P1', 'P2');
    const playing = run(state, { type: 'assignMatch', match: match.id, table: tableId(state, 1), at: 0 });
    const next = run(playing, { type: 'recordResult', match: match.id, result: { kind: 'walkover', winner: 0 }, at: 5000 });
    expect(getFreeTables(next).map((t) => t.number)).toEqual([1]);
    expect(getWaitingList(next, 5000).map((m) => m.id)).not.toContain(match.id);
    expect(errorOf(execute(next, { type: 'recordResult', match: match.id, result: { kind: 'walkover', winner: 1 }, at: 6000 }))).toEqual({
      code: 'matchFinished',
    });
  });

  it('cannot be recorded before both players are known', () => {
    const { state, stage } = drawnBracket(8);
    const final = roundsOf(state, stage).at(-1)![0];
    expect(errorOf(execute(state, { type: 'recordResult', match: final.id, result: { kind: 'walkover', winner: 0 }, at: 0 }))).toMatchObject({
      code: 'matchNotReady',
    });
  });
});

describe('special results in a bracket', () => {
  it.each(['walkover', 'retirement', 'disqualification'] as const)('a %s advances the winner', (kind) => {
    const { state, stage } = drawnBracket(8, { seeds: allSeeded(8) });
    const first = roundsOf(state, stage)[0][0]; // P1 v P8
    const result = kind === 'retirement' ? { kind, winner: 1 as const, games: [] } : { kind, winner: 1 as const };
    const next = run(state, { type: 'recordResult', match: first.id, result, at: 1000 });
    expect(slotLabel(roundsOf(next, stage)[1][0], 0)).toBe('P8');
  });

  it('makes the walkover loser a normal loser: a semi-final loser goes to the 3rd-place match and gets a place', () => {
    const { state, competition, stage } = drawnBracket(8, { seeds: allSeeded(8), thirdPlace: true });
    let next = state;
    for (const match of roundsOf(state, stage)[0]) {
      next = run(next, { type: 'recordResult', match: match.id, result: { kind: 'walkover', winner: 0 }, at: 1000 });
    }
    const [semi1, semi2] = roundsOf(next, stage)[1]; // P1 v P5, P3 v P7
    next = run(
      next,
      { type: 'recordResult', match: semi1.id, result: { kind: 'walkover', winner: 0 }, at: 2000 },
      { type: 'recordResult', match: semi2.id, result: { kind: 'gamesOnly', games: [0, 3] }, at: 2000 },
    );
    const third = roundsOf(next, stage, 'thirdPlace')[0][0];
    expect([slotLabel(third, 0), slotLabel(third, 1)]).toEqual(['P5', 'P3']);
    expect(third.status).toBe('ready');

    const final = roundsOf(next, stage).at(-1)![0];
    next = run(
      next,
      { type: 'recordResult', match: final.id, result: { kind: 'walkover', winner: 1 }, at: 3000 },
      { type: 'recordResult', match: third.id, result: { kind: 'walkover', winner: 0 }, at: 3000 },
    );
    const places = getFinalPlaces(next, competition)!.rows.map((r) => `${r.place.from} ${r.entry.players[0].lastName}`);
    expect(places.slice(0, 4)).toEqual(['1 P7', '2 P1', '3 P5', '4 P3']);
  });
});
