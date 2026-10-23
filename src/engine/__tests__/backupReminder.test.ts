import { describe, expect, it } from 'vitest';
import { getBackupReminder, type GameScore } from '@/engine';
import { newTournament } from './helpers';
import { drawnGroups, matchBetween, run, tableId } from './scenarios';

const MIN = 60_000;
const T0 = Date.UTC(2026, 5, 1, 10, 0);
const at = (minutes: number) => T0 + minutes * MIN;
const win: GameScore[] = [
  [11, 5],
  [11, 6],
  [11, 7],
];

/** A confirmed group of 4 with table 1; `play` puts P1–P4 on table 1 at `at(0)`, and `finishAt` records its result. */
function tournament(options: { play?: boolean; finishAt?: number } = {}) {
  const { state, stage } = drawnGroups(4, { by: 'count', groups: 1 }, { tables: 1 });
  const match = matchBetween(state, stage, 'P1', 'P4').id;
  let next = state;
  if (options.play) next = run(next, { type: 'assignMatch', match, table: tableId(state, 1), at: at(0) });
  if (options.finishAt !== undefined) {
    next = run(next, { type: 'recordResult', match, result: { kind: 'games', games: win }, at: at(options.finishAt) });
  }
  return next;
}

describe('backup reminder', () => {
  it('stays quiet while the tournament is not live (nothing played yet)', () => {
    expect(getBackupReminder(newTournament(), { now: at(60), unsavedSince: at(0) })).toEqual({ live: false, due: false });
  });

  it('is live while a match is in progress', () => {
    expect(getBackupReminder(tournament({ play: true }), { now: at(90), unsavedSince: null }).live).toBe(true);
  });

  it('is live for 30 minutes after the last result', () => {
    const state = tournament({ play: true, finishAt: 20 });
    expect(getBackupReminder(state, { now: at(49), unsavedSince: null }).live).toBe(true);
    expect(getBackupReminder(state, { now: at(50), unsavedSince: null }).live).toBe(false);
  });

  it('appears during a live tournament once changes have gone 30 minutes without a backup', () => {
    const state = tournament({ play: true });
    expect(getBackupReminder(state, { now: at(29), unsavedSince: at(0) })).toEqual({ live: true, due: false });
    expect(getBackupReminder(state, { now: at(30), unsavedSince: at(0) })).toEqual({ live: true, due: true });
  });

  it('stays quiet when every change is in a downloaded backup', () => {
    expect(getBackupReminder(tournament({ play: true }), { now: at(60), unsavedSince: null })).toEqual({ live: true, due: false });
  });

  it('stays quiet while postponed', () => {
    const state = tournament({ play: true });
    const activity = { unsavedSince: at(0), postponedUntil: at(60) };
    expect(getBackupReminder(state, { now: at(59), ...activity }).due).toBe(false);
    expect(getBackupReminder(state, { now: at(60), ...activity }).due).toBe(true);
  });

  it('can use a different interval', () => {
    const state = tournament({ play: true });
    expect(getBackupReminder(state, { now: at(10), unsavedSince: at(0), intervalMinutes: 10 }).due).toBe(true);
  });
});
