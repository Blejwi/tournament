import { describe, expect, it } from 'vitest';
import { execute, type GameScore, type TournamentState } from '@/engine';
import { errorOf } from './helpers';
import { drawnGroups, groupsOf, matchBetween, run, slotName } from './scenarios';

const T0 = Date.UTC(2026, 4, 1, 9, 0);

/** One confirmed group with P1..Pn in draw positions 1..n. */
function group(size: number) {
  const seeds = Object.fromEntries(Array.from({ length: size }, (_, i) => [i + 1, i + 1]));
  return drawnGroups(size, { by: 'count', groups: 1 }, { seeds });
}

/** `[a, b]` game scores from the winner's side, e.g. "11-5 11-5 11-5". */
const games = (...scores: string[]): GameScore[] => scores.map((s) => s.split('-').map(Number) as GameScore);
const threeNil = games('11-5', '11-5', '11-5');
const threeTwo = games('11-5', '5-11', '11-5', '5-11', '11-5');

/** Records that `winner` beat `loser` with the given games (winner's points first). */
function win(state: TournamentState, stage: string, winner: string, loser: string, score: GameScore[]): TournamentState {
  const match = matchBetween(state, stage, winner, loser);
  const oriented = slotName(match, 0) === winner ? score : score.map(([a, b]) => [b, a] as GameScore);
  return run(state, { type: 'recordResult', match: match.id, result: { kind: 'games', games: oriented }, at: T0 });
}

function play(setup: { state: TournamentState; stage: string }, ...results: [string, string, GameScore[]][]) {
  return results.reduce((s, [winner, loser, score]) => win(s, setup.stage, winner, loser, score), setup.state);
}

const order = (state: TournamentState, stage: string) => groupsOf(state, stage)[0].standings.map((r) => r.entry!.players[0].lastName);

describe('tiebreaks', () => {
  it('decides a tie between 2 entries by their match against each other', () => {
    const setup = group(4);
    // P1 and P2 have 2 wins each; P1 has the better games overall, but P2 beat P1.
    // P3 and P4 have 1 win each; P4 beat P3.
    const state = play(
      setup,
      ['P1', 'P3', threeNil],
      ['P1', 'P4', threeNil],
      ['P2', 'P1', threeTwo],
      ['P2', 'P4', threeTwo],
      ['P3', 'P2', threeNil],
      ['P4', 'P3', threeNil],
    );
    expect(order(state, setup.stage)).toEqual(['P2', 'P1', 'P4', 'P3']);
  });

  it('decides a 3-way tie by the game ratio in the matches between the tied entries', () => {
    const setup = group(3);
    // Everyone 1–1. Games: P3 5:3, P2 5:5, P1 3:5.
    const state = play(setup, ['P3', 'P1', threeNil], ['P1', 'P2', threeTwo], ['P2', 'P3', threeTwo]);
    expect(order(state, setup.stage)).toEqual(['P3', 'P2', 'P1']);
  });

  it('decides a 3-way tie level on games by the point ratio in those matches', () => {
    const setup = group(3);
    // Everyone 1–1 and 3:3 in games. Points: P2 60:48, P1 54:60, P3 48:54.
    const state = play(
      setup,
      ['P1', 'P2', games('11-9', '11-9', '11-9')],
      ['P2', 'P3', games('11-5', '11-5', '11-5')],
      ['P3', 'P1', games('11-7', '11-7', '11-7')],
    );
    expect(order(state, setup.stage)).toEqual(['P2', 'P1', 'P3']);
  });

  it('re-compares the rest of a partially broken tie among themselves only', () => {
    const setup = group(4);
    // P1, P2, P3 have 2 wins each and 3:3 games among them. Points among them: P3 56:35,
    // P1 33:42 and P2 44:56 (the same ratio), which separates P3 only.
    // P1 and P2 are then compared again on their own, from the first rule: P1 beat P2.
    const state = play(
      setup,
      ['P3', 'P1', games('11-0', '11-0', '11-0')],
      ['P1', 'P2', games('11-9', '11-0', '11-0')],
      ['P2', 'P3', games('13-11', '11-9', '11-3')],
      ['P1', 'P4', threeNil],
      ['P2', 'P4', threeNil],
      ['P3', 'P4', threeNil],
    );
    expect(order(state, setup.stage)).toEqual(['P3', 'P1', 'P2', 'P4']);

    const [view] = groupsOf(state, setup.stage);
    const names = (entries: { players: { lastName: string }[] }[]) => entries.map((e) => e.players[0].lastName);
    expect(view.tiebreak.map((step) => [step.place, step.rule, names(step.among)])).toEqual([
      [1, 'tiedPointRatio', ['P1', 'P2', 'P3']],
      [2, 'tiedGroupPoints', ['P1', 'P2']],
      [3, 'groupPoints', ['P1', 'P2', 'P3', 'P4']],
    ]);
    const record = (r: (typeof view.tiebreak)[number]['records'][number]) => [
      r.entry.players[0].lastName,
      r.groupPoints,
      r.gamesWon,
      r.gamesLost,
      r.pointsWon,
      r.pointsLost,
    ];
    expect(view.tiebreak[0].records.map(record)).toEqual([
      ['P1', 1, 3, 3, 33, 42],
      ['P2', 1, 3, 3, 44, 56],
      ['P3', 1, 3, 3, 56, 35],
    ]);
    expect(view.tiebreak[1].records.map(record)).toEqual([
      ['P1', 1, 3, 0, 33, 9],
      ['P2', 0, 0, 3, 9, 33],
    ]);
    expect(view.ties).toEqual([]);
  });
});

describe('a tie the rules cannot break', () => {
  /** Everyone 1–1 with identical scores: nothing separates them. */
  function deadlock() {
    const setup = group(3);
    const state = play(setup, ['P1', 'P2', threeNil], ['P2', 'P3', threeNil], ['P3', 'P1', threeNil]);
    const [view] = groupsOf(state, setup.stage);
    const id = (name: string) => view.entries.find((e) => e.entry!.players[0].lastName === name)!.entry!.id;
    return { ...setup, state, id, groupId: view.id };
  }

  it('is flagged, keeps the draw order and leaves the places undecided', () => {
    const { state, stage } = deadlock();
    const [view] = groupsOf(state, stage);
    expect(order(state, stage)).toEqual(['P1', 'P2', 'P3']);
    expect(view.standings.map((r) => r.tied)).toEqual([true, true, true]);
    expect(view.tiebreak.map((s) => s.rule)).toEqual([null, null]);
    expect(view.ties.map((t) => [t.entries.map((e) => e.players[0].lastName), t.resolution])).toEqual([[['P1', 'P2', 'P3'], null]]);
  });

  it('is settled by the operator’s order', () => {
    const { state, stage, id, groupId } = deadlock();
    const next = run(state, { type: 'resolveTie', stage, group: groupId, order: [id('P2'), id('P3'), id('P1')], method: 'lot' });
    const [view] = groupsOf(next, stage);
    expect(order(next, stage)).toEqual(['P2', 'P3', 'P1']);
    expect(view.standings.map((r) => r.tied)).toEqual([false, false, false]);
    expect(view.tiebreak.map((s) => s.rule)).toEqual(['lot', 'lot']);
    expect(view.ties.map((t) => t.resolution)).toEqual(['lot']);
  });

  it('only takes an order of exactly the tied entries, once the group is complete', () => {
    const { state, stage, id, groupId } = deadlock();
    expect(errorOf(execute(state, { type: 'resolveTie', stage, group: groupId, order: [id('P2'), id('P1')], method: 'decision' }))).toEqual({
      code: 'tieNotFound',
    });
    expect(errorOf(execute(state, { type: 'resolveTie', stage, group: 'nope', order: [], method: 'decision' }))).toEqual({
      code: 'groupNotFound',
      group: 'nope',
    });
    const unfinished = group(3);
    const [view] = groupsOf(unfinished.state, unfinished.stage);
    const all = view.entries.map((e) => e.entry!.id);
    expect(
      errorOf(execute(unfinished.state, { type: 'resolveTie', stage: unfinished.stage, group: view.id, order: all, method: 'decision' })),
    ).toEqual({ code: 'groupNotComplete' });
  });

  it('can be settled again, replacing the earlier order', () => {
    const { state, stage, id, groupId } = deadlock();
    const next = run(
      state,
      { type: 'resolveTie', stage, group: groupId, order: [id('P2'), id('P3'), id('P1')], method: 'lot' },
      { type: 'resolveTie', stage, group: groupId, order: [id('P3'), id('P2'), id('P1')], method: 'decision' },
    );
    expect(order(next, stage)).toEqual(['P3', 'P2', 'P1']);
    expect(groupsOf(next, stage)[0].tiebreak.map((s) => s.rule)).toEqual(['decision', 'decision']);
  });
});
