import { derive } from '../derive';
import type { TableId, Timestamp, TournamentState } from '../types';
import { matchView, type MatchView } from './matches';

/**
 * - free: active, no match on it (idle)
 * - playing: a match on it, within its expected duration
 * - overdue: a match on it past its expected duration
 * - inactive: switched off (broken, reserved) and no match on it
 */
export type TableStatus = 'free' | 'playing' | 'overdue' | 'inactive';

export interface TableOverviewRow {
  id: TableId;
  number: number;
  name: string;
  active: boolean;
  status: TableStatus;
  /** The match on the table now, or null. */
  match: MatchView | null;
  /** How long the current match has been on the table; null without one. */
  elapsedMs: number | null;
  /**
   * For a free table: time since the last match on it finished. Null when it is not free,
   * or when no match has finished on it yet.
   */
  idleMs: number | null;
  /** Free while a ready match is waiting: a table that should be in use. */
  idleAlert: boolean;
  /** How many matches have finished on this table. */
  matchesPlayed: number;
}

export interface TableOverview {
  /** Every table, by number. */
  tables: TableOverviewRow[];
  /** Tables whose match is overdue. */
  overdueCount: number;
  /** Free tables while ready matches wait (see `idleAlert`). */
  idleCount: number;
}

/** The hall at a glance: each table's status, current match, elapsed time and idle time at `now`. */
export function getTableOverview(state: TournamentState, now: Timestamp): TableOverview {
  const derived = derive(state);
  const readyWaiting = derived.matches.some((m) => m.status === 'ready');

  const tables = [...state.tables]
    .sort((a, b) => a.number - b.number)
    .map((table): TableOverviewRow => {
      const onTable = derived.matches.filter((m) => m.match.table === table.id);
      const current = onTable.find((m) => !m.match.result);
      const finished = onTable.filter((m) => m.match.result && m.match.finishedAt !== null);
      const lastFinishedAt = finished.length ? Math.max(...finished.map((m) => m.match.finishedAt!)) : null;
      const match = current ? matchView(state, current, now) : null;
      const status: TableStatus = match
        ? match.status === 'overdue'
          ? 'overdue'
          : 'playing'
        : table.active
          ? 'free'
          : 'inactive';
      return {
        id: table.id,
        number: table.number,
        name: table.name,
        active: table.active,
        status,
        match,
        elapsedMs: match?.elapsedMs ?? null,
        idleMs: status === 'free' && lastFinishedAt !== null ? now - lastFinishedAt : null,
        idleAlert: status === 'free' && readyWaiting,
        matchesPlayed: finished.length,
      };
    });

  return {
    tables,
    overdueCount: tables.filter((t) => t.status === 'overdue').length,
    idleCount: tables.filter((t) => t.idleAlert).length,
  };
}

/** The matches on a table past their expected duration, for the overdue alarm: red first, then the longest running. */
export function getOverdueMatches(state: TournamentState, now: Timestamp): MatchView[] {
  const rank = (m: MatchView) => (m.overdue === 'red' ? 0 : 1);
  return derive(state)
    .matches.filter((m) => m.status === 'in_progress')
    .map((m) => matchView(state, m, now))
    .filter((m) => m.status === 'overdue')
    .sort((a, b) => rank(a) - rank(b) || (b.elapsedMs ?? 0) - (a.elapsedMs ?? 0));
}
