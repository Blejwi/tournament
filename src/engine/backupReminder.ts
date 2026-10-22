import type { TournamentState } from './types';

/** How recent the last change must be for the tournament to count as live. */
export const LIVE_WINDOW_MINUTES = 30;
/** Default time between backup reminders. */
export const BACKUP_INTERVAL_MINUTES = 30;

/**
 * When the operator last changed things and backed up, as tracked by the app (the engine has no clock).
 * All times are ISO timestamps.
 */
export interface BackupActivity {
  now: string;
  /** The last successful change to the tournament, or null if none was made in this session. */
  lastChangeAt: string | null;
  /** The oldest change not yet in a downloaded backup, or null when everything is backed up. */
  unsavedSince: string | null;
  /** The operator chose "later": no reminder before this time. */
  postponedUntil?: string | null;
  intervalMinutes?: number;
}

export interface BackupReminder {
  live: boolean;
  /** Show the (non-blocking) reminder to download a backup. */
  due: boolean;
}

const MINUTE = 60_000;
const minutesBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / MINUTE;

/**
 * Whether to remind the operator to download a backup: only while the tournament is live, and only
 * once changes have gone `intervalMinutes` without a backup.
 *
 * "Live" is deliberately simple for now: any change in the last LIVE_WINDOW_MINUTES. Once matches
 * exist it should become "a match is in progress or a result was recorded recently", read from `state`.
 */
export function getBackupReminder(_state: TournamentState, activity: BackupActivity): BackupReminder {
  const { now, lastChangeAt, unsavedSince, postponedUntil, intervalMinutes = BACKUP_INTERVAL_MINUTES } = activity;
  const live = lastChangeAt !== null && minutesBetween(lastChangeAt, now) < LIVE_WINDOW_MINUTES;
  const due =
    live &&
    unsavedSince !== null &&
    minutesBetween(unsavedSince, now) >= intervalMinutes &&
    (postponedUntil == null || Date.parse(now) >= Date.parse(postponedUntil));
  return { live, due };
}
