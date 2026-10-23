import { derive } from '../derive';
import { findMatch, replaceMatch } from '../locate';
import { appendLog, loggedMatch, loggedTable } from '../log';
import { fail, ok, type Result } from '../result';
import { validateScore } from '../score';
import { handlerFor } from '../stages';
import type { LogEntry, MatchId, MatchResult, TableId, Timestamp, TournamentState } from '../types';

export type MatchCommand =
  /** Calls a ready match to a free table; the match clock starts at `at`. */
  | { type: 'assignMatch'; match: MatchId; table: TableId; at: Timestamp }
  /** Takes a match off its table (a wrong call) at `at`; it goes back to the waiting list. */
  | { type: 'unassignMatch'; match: MatchId; at: Timestamp }
  /** Records the result; the match finishes at `at` and its table is free again. */
  | { type: 'recordResult'; match: MatchId; result: MatchResult; at: Timestamp };

type Cmd<T extends MatchCommand['type']> = Extract<MatchCommand, { type: T }>;

export function assignMatch(state: TournamentState, cmd: Cmd<'assignMatch'>): Result<TournamentState> {
  const located = findMatch(state, cmd.match);
  if (!located.ok) return located;
  const table = state.tables.find((t) => t.id === cmd.table);
  if (!table) return fail({ code: 'tableNotFound', table: cmd.table });
  const derived = derive(state);
  const status = derived.match(cmd.match)!.status;
  if (status !== 'ready') return fail({ code: 'matchNotReady', status });
  if (!table.active) return fail({ code: 'tableInactive', number: table.number });
  if (tableInUse(state, table.id)) return fail({ code: 'tableBusy', number: table.number });
  const next = replaceMatch(state, located.value, { ...located.value.match, table: table.id, assignedAt: cmd.at });
  return ok(appendLog(next, { type: 'matchAssigned', at: cmd.at, match: loggedMatch(state, cmd.match), table: loggedTable(state, table.id)! }));
}

export function unassignMatch(state: TournamentState, cmd: Cmd<'unassignMatch'>): Result<TournamentState> {
  const located = findMatch(state, cmd.match);
  if (!located.ok) return located;
  const { match } = located.value;
  if (match.table === null || match.result) return fail({ code: 'matchNotOnTable' });
  const next = replaceMatch(state, located.value, { ...match, table: null, assignedAt: null });
  return ok(appendLog(next, { type: 'matchUnassigned', at: cmd.at, match: loggedMatch(state, cmd.match), table: loggedTable(state, match.table)! }));
}

export function recordResult(state: TournamentState, cmd: Cmd<'recordResult'>): Result<TournamentState> {
  const valid = checkResult(state, cmd.match, cmd.result);
  if (!valid.ok) return valid;
  const located = findMatch(state, cmd.match);
  if (!located.ok) return located;
  const { match } = located.value;
  const next = replaceMatch(state, located.value, { ...match, result: structuredClone(cmd.result), finishedAt: cmd.at });
  const logged = { at: cmd.at, match: loggedMatch(state, cmd.match), table: loggedTable(state, match.table) };
  const { result } = cmd;
  const entry: LogEntry =
    result.kind === 'games' || result.kind === 'gamesOnly'
      ? { type: 'resultRecorded', ...logged, result: structuredClone(result) }
      : { type: 'specialResultRecorded', ...logged, result: structuredClone(result) };
  return ok(appendLog(next, entry));
}

/** Whether `result` could be recorded for the match now: the match is playable and the score is valid. */
export function checkResult(state: TournamentState, matchId: MatchId, result: MatchResult): Result<void> {
  const located = findMatch(state, matchId);
  if (!located.ok) return located;
  const { competition, stage } = located.value;
  const status = derive(state).match(matchId)!.status;
  if (status === 'finished' || status === 'walkover') return fail({ code: 'matchFinished' });
  if (status === 'pending' || status === 'disabled') return fail({ code: 'matchNotReady', status });
  if (result.kind === 'gamesOnly' && !handlerFor(stage).allowsGamesOnly) return fail({ code: 'gamePointsRequired' });
  return validateScore(result, competition.gamesToWin);
}

/** A table is in use while a match on it has no result. */
export function tableInUse(state: TournamentState, table: TableId): boolean {
  return state.competitions.some((c) => c.stages.some((s) => s.matches.some((m) => m.table === table && !m.result)));
}
