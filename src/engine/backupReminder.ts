import type { Timestamp, TournamentState } from './types';

/** How long after the last result the tournament still counts as live. */
export const LIVE_WINDOW_MINUTES = 30;
/** Default time between backup reminders. */
export const BACKUP_INTERVAL_MINUTES = 30;

/** When the operator last backed up, as tracked by the app (the engine has no clock). Epoch milliseconds. */
export interface BackupActivity {
  now: Timestamp;
  /** The oldest change not yet in a downloaded backup, or null when everything is backed up. */
  unsavedSince: Timestamp | null;
  /** The operator chose "later": no reminder before this time. */
  postponedUntil?: Timestamp | null;
  intervalMinutes?: number;
}

export interface BackupReminder {
  live: boolean;
  /** Show the (non-blocking) reminder to download a backup. */
  due: boolean;
}

const MINUTE = 60_000;

/** Live: a match is in progress, or a result was recorded in the last LIVE_WINDOW_MINUTES. */
function isLive(state: TournamentState, now: Timestamp): boolean {
  return state.competitions.some((c) =>
    c.stages.some((s) =>
      s.matches.some((m) =>
        m.result
          ? m.finishedAt !== null && now - m.finishedAt < LIVE_WINDOW_MINUTES * MINUTE
          : m.table !== null,
      ),
    ),
  );
}

/**
 * Whether to remind the operator to download a backup: only while the tournament is live, and only
 * once changes have gone `intervalMinutes` without a backup.
 */
export function getBackupReminder(state: TournamentState, activity: BackupActivity): BackupReminder {
  const { now, unsavedSince, postponedUntil, intervalMinutes = BACKUP_INTERVAL_MINUTES } = activity;
  const live = isLive(state, now);
  const due =
    live &&
    unsavedSince !== null &&
    now - unsavedSince >= intervalMinutes * MINUTE &&
    (postponedUntil == null || now >= postponedUntil);
  return { live, due };
}
