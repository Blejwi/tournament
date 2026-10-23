import { derive } from './derive';
import type { LogEntry, LoggedMatch, LoggedTable, MatchId, TableId, TournamentState } from './types';

/**
 * Change-log helpers for command handlers. A command that should be logged builds its new state,
 * then returns `ok(appendLog(next, { type, at: cmd.at, ... }))`. Snapshot what the entry needs
 * (`loggedMatch`, `loggedTable`) from the state BEFORE the change, so the entry shows what the
 * operator acted on (e.g. the old score of a correction).
 */

/** Adds an entry at the end of the log (the log is kept oldest first). */
export function appendLog(state: TournamentState, entry: LogEntry): TournamentState {
  return { ...state, log: [...state.log, entry] };
}

/** The match as it is in `state`: where it lives and who is in each slot right now. */
export function loggedMatch(state: TournamentState, match: MatchId): LoggedMatch {
  const derived = derive(state).match(match);
  if (!derived) throw new Error(`loggedMatch: no match ${match}`);
  const [a, b] = derived.entries;
  return {
    competition: derived.competition.id,
    stage: derived.stage.id,
    match,
    players: [[...(a?.players ?? [])], [...(b?.players ?? [])]],
  };
}

/** The table as it is in `state` (its number may change later); null for no table or an unknown one. */
export function loggedTable(state: TournamentState, table: TableId | null): LoggedTable | null {
  const found = table === null ? undefined : state.tables.find((t) => t.id === table);
  return found ? { table: found.id, number: found.number } : null;
}
