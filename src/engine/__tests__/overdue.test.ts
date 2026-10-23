import { describe, expect, it } from 'vitest';
import { execute, getExpectedDurations, getMatch } from '@/engine';
import { errorOf, newTournament } from './helpers';
import { drawnGroups, matchBetween, run, tableId } from './scenarios';

const MIN = 60_000;
const T0 = Date.UTC(2026, 4, 1, 9, 0);

/** A best-of-5 (3 games to win) group with P1–P4 on table 1, called at T0. Expected duration: 25 min by default. */
function playingOnTable() {
  const { state, stage } = drawnGroups(4, { by: 'count', groups: 1 }, { seeds: { 1: 1, 2: 2, 3: 3, 4: 4 }, tables: 2 });
  const match = matchBetween(state, stage, 'P1', 'P4').id;
  return { state: run(state, { type: 'assignMatch', match, table: tableId(state, 1), at: T0 }), match, stage };
}

describe('overdue matches', () => {
  it('is in progress up to and including its expected duration', () => {
    const { state, match } = playingOnTable();
    expect(getMatch(state, match, T0 + 25 * MIN)).toMatchObject({ status: 'in_progress', overdue: null, expectedMs: 25 * MIN });
  });

  it('turns amber just past 100% of the expected duration', () => {
    const { state, match } = playingOnTable();
    expect(getMatch(state, match, T0 + 25 * MIN + 1)).toMatchObject({ status: 'overdue', overdue: 'amber' });
  });

  it('stays amber at exactly 150% and turns red just past it', () => {
    const { state, match } = playingOnTable();
    expect(getMatch(state, match, T0 + 37.5 * MIN)).toMatchObject({ status: 'overdue', overdue: 'amber' });
    expect(getMatch(state, match, T0 + 37.5 * MIN + 1)).toMatchObject({ status: 'overdue', overdue: 'red' });
  });

  it('uses the expected duration set for the competition’s games to win', () => {
    const { state, match } = playingOnTable();
    const changed = run(
      state,
      { type: 'setExpectedDuration', gamesToWin: 3, minutes: 20 },
      { type: 'setExpectedDuration', gamesToWin: 2, minutes: 10 },
    );

    expect(getExpectedDurations(changed)).toEqual({ 2: 10, 3: 20, 4: 35 });
    expect(getMatch(changed, match, T0 + 20 * MIN)).toMatchObject({ status: 'in_progress', expectedMs: 20 * MIN });
    expect(getMatch(changed, match, T0 + 20 * MIN + 1)).toMatchObject({ status: 'overdue', overdue: 'amber' });
    expect(getMatch(changed, match, T0 + 30 * MIN + 1)).toMatchObject({ status: 'overdue', overdue: 'red' });
  });

  it('starts from 15, 25 and 35 minutes for 2, 3 and 4 games to win', () => {
    expect(getExpectedDurations(newTournament())).toEqual({ 2: 15, 3: 25, 4: 35 });
  });

  it('only accepts a whole number of minutes of at least 1', () => {
    const state = newTournament();
    for (const minutes of [0, -5, 12.5, Number.NaN]) {
      expect(errorOf(execute(state, { type: 'setExpectedDuration', gamesToWin: 2, minutes }))).toEqual({ code: 'invalidExpectedDuration' });
    }
    expect(errorOf(execute(state, { type: 'setExpectedDuration', gamesToWin: 5 as 2, minutes: 10 }))).toEqual({ code: 'invalidGamesToWin' });
  });

  it('is never overdue once the result is in', () => {
    const { state, match } = playingOnTable();
    const finished = run(state, {
      type: 'recordResult',
      match,
      result: { kind: 'games', games: [[11, 1], [11, 2], [11, 3]] },
      at: T0 + 60 * MIN,
    });
    expect(getMatch(finished, match, T0 + 90 * MIN)).toMatchObject({ status: 'finished', overdue: null });
  });
});
