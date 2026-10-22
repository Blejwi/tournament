import { fail, ok, type Result } from '../result';
import type { GamesToWin, TournamentState } from '../types';

export type SettingsCommand =
  /** Sets how long a match with this many games to win is expected to take, in whole minutes (overdue detection). */
  { type: 'setExpectedDuration'; gamesToWin: GamesToWin; minutes: number };

type Cmd<T extends SettingsCommand['type']> = Extract<SettingsCommand, { type: T }>;

export function setExpectedDuration(state: TournamentState, cmd: Cmd<'setExpectedDuration'>): Result<TournamentState> {
  if (![2, 3, 4].includes(cmd.gamesToWin)) return fail({ code: 'invalidGamesToWin' });
  if (!Number.isInteger(cmd.minutes) || cmd.minutes < 1) return fail({ code: 'invalidExpectedDuration' });
  return ok({ ...state, expectedDurations: { ...state.expectedDurations, [cmd.gamesToWin]: cmd.minutes } });
}
