import { describe, expect, it } from 'vitest';
import { execute, getChangeLog } from '@/engine';
import { errorOf } from './helpers';
import { drawnGroups, matchBetween, run, tableId } from './scenarios';

const MIN = 60_000;
const T0 = Date.UTC(2026, 4, 1, 9, 0);

/** A best-of-5 group P1–P4 with tables 1 and 2; P1 v P4 is the match under test. */
function setup() {
  const { state, stage, competition } = drawnGroups(4, { by: 'count', groups: 1 }, { seeds: { 1: 1, 2: 2, 3: 3, 4: 4 }, tables: 2 });
  const match = matchBetween(state, stage, 'P1', 'P4');
  return { state, stage, competition, match: match.id, slotA: match.slots[0].entry!.players[0].lastName };
}

const lastNames = (players: { lastName: string }[]) => players.map((p) => p.lastName);

describe('change log', () => {
  it('is empty for a new tournament', () => {
    expect(getChangeLog(setup().state)).toEqual([]);
  });

  it('records a table assignment with its time, the table and the players', () => {
    const { state, match, competition, slotA } = setup();
    const next = run(state, { type: 'assignMatch', match, table: tableId(state, 2), at: T0 });

    const [entry] = getChangeLog(next);
    expect(entry).toMatchObject({ type: 'matchAssigned', at: T0, table: 2, match: { id: match, competition, competitionName: 'Open' } });
    expect(lastNames(entry.match.players[0])).toEqual([slotA]);
    expect(entry.match.players.flat().map((p) => p.lastName).sort()).toEqual(['P1', 'P4']);
  });

  it('records taking a match off its table, with the table it was on', () => {
    const { state, match } = setup();
    const next = run(
      state,
      { type: 'assignMatch', match, table: tableId(state, 1), at: T0 },
      { type: 'unassignMatch', match, at: T0 + 2 * MIN },
    );
    expect(getChangeLog(next)[0]).toMatchObject({ type: 'matchUnassigned', at: T0 + 2 * MIN, table: 1, match: { id: match } });
  });

  it('records a score entry with the score as entered', () => {
    const { state, match } = setup();
    const games: [number, number][] = [[11, 7], [9, 11], [11, 5], [11, 8]];
    const next = run(
      state,
      { type: 'assignMatch', match, table: tableId(state, 1), at: T0 },
      { type: 'recordResult', match, result: { kind: 'games', games }, at: T0 + 20 * MIN },
    );
    expect(getChangeLog(next)[0]).toMatchObject({
      type: 'resultRecorded',
      at: T0 + 20 * MIN,
      result: { winner: 0, gamesWon: [3, 1], games },
      table: 1,
      match: { id: match },
    });
  });

  it('lists the newest entry first, one entry per action', () => {
    const { state, stage, match } = setup();
    const other = matchBetween(state, stage, 'P2', 'P3').id;
    const next = run(
      state,
      { type: 'assignMatch', match, table: tableId(state, 1), at: T0 },
      { type: 'assignMatch', match: other, table: tableId(state, 2), at: T0 + MIN },
      { type: 'recordResult', match, result: { kind: 'games', games: [[11, 1], [11, 2], [11, 3]] }, at: T0 + 10 * MIN },
    );
    expect(getChangeLog(next).map((e) => [e.type, e.match.id, e.at])).toEqual([
      ['resultRecorded', match, T0 + 10 * MIN],
      ['matchAssigned', other, T0 + MIN],
      ['matchAssigned', match, T0],
    ]);
  });

  it('writes nothing for a rejected command', () => {
    const { state, match } = setup();
    errorOf(execute(state, { type: 'unassignMatch', match, at: T0 }));
    errorOf(execute(state, { type: 'recordResult', match, result: { kind: 'games', games: [[11, 1]] }, at: T0 }));
    expect(getChangeLog(state)).toEqual([]);
  });
});
