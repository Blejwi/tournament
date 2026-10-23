import type { ExpectedDurations, GamesToWin, TournamentState } from './types';

/** Expected match durations in minutes when the operator hasn't changed them. */
export const DEFAULT_EXPECTED_DURATIONS: ExpectedDurations = { 2: 15, 3: 25, 4: 35 };

/** How far past its expected duration a match on its table is: amber past 100%, red past 150%. */
export type OverdueLevel = 'amber' | 'red';

const MINUTE = 60_000;

export function expectedMs(state: TournamentState, gamesToWin: GamesToWin): number {
  return state.expectedDurations[gamesToWin] * MINUTE;
}

/** The overdue level of a match that has been on its table for `elapsedMs`; null while within its expected duration. */
export function overdueLevel(elapsedMs: number, expected: number): OverdueLevel | null {
  if (elapsedMs > expected * 1.5) return 'red';
  if (elapsedMs > expected) return 'amber';
  return null;
}
