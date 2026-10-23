import { derive } from '../derive';
import { findMatch, replaceMatch, type StageLocation } from '../locate';
import { fail, ok, type Result } from '../result';
import { validateScore } from '../score';
import { handlerFor } from '../stages';
import type { MatchId, MatchResult, TableId, Timestamp, TournamentState } from '../types';

export type MatchCommand =
  /** Calls a ready match to a free table; the match clock starts at `at`. */
  | { type: 'assignMatch'; match: MatchId; table: TableId; at: Timestamp }
  /** Takes a match off its table (a wrong call); it goes back to the waiting list. */
  | { type: 'unassignMatch'; match: MatchId }
  /** Moves the start of a match on its table, e.g. "started 5 min ago" when the players came late. */
  | { type: 'setMatchStart'; match: MatchId; at: Timestamp }
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
  return ok(replaceMatch(state, located.value, { ...located.value.match, table: table.id, assignedAt: cmd.at }));
}

export function unassignMatch(state: TournamentState, cmd: Cmd<'unassignMatch'>): Result<TournamentState> {
  const located = findMatch(state, cmd.match);
  if (!located.ok) return located;
  const { match } = located.value;
  if (match.table === null || match.result) return fail({ code: 'matchNotOnTable' });
  return ok(replaceMatch(state, located.value, { ...match, table: null, assignedAt: null }));
}

export function setMatchStart(state: TournamentState, cmd: Cmd<'setMatchStart'>): Result<TournamentState> {
  const located = findMatch(state, cmd.match);
  if (!located.ok) return located;
  const { match } = located.value;
  if (match.table === null || match.result) return fail({ code: 'matchNotOnTable' });
  return ok(replaceMatch(state, located.value, { ...match, assignedAt: cmd.at }));
}

export function recordResult(state: TournamentState, cmd: Cmd<'recordResult'>): Result<TournamentState> {
  const valid = checkResult(state, cmd.match, cmd.result);
  if (!valid.ok) return valid;
  const located = findMatch(state, cmd.match);
  if (!located.ok) return located;
  return ok(replaceMatch(state, located.value, { ...located.value.match, result: structuredClone(cmd.result), finishedAt: cmd.at }));
}

/** Whether `result` could be recorded for the match now: the match is playable and the score is valid. */
export function checkResult(state: TournamentState, matchId: MatchId, result: MatchResult): Result<void> {
  const located = findMatch(state, matchId);
  if (!located.ok) return located;
  const status = derive(state).match(matchId)!.status;
  if (status === 'finished' || status === 'walkover') return fail({ code: 'matchFinished' });
  if (status === 'pending' || status === 'disabled') return fail({ code: 'matchNotReady', status });
  return checkScore(located.value, result);
}

/** Whether `result` is a valid score for a match of this stage (the scoring rules only, not the match's status). */
export function checkScore({ competition, stage }: StageLocation, result: MatchResult): Result<void> {
  if (result.kind === 'gamesOnly' && !handlerFor(stage).allowsGamesOnly) return fail({ code: 'gamePointsRequired' });
  return validateScore(result, competition.gamesToWin);
}

/** A table is in use while a match on it has no result. */
export function tableInUse(state: TournamentState, table: TableId): boolean {
  return state.competitions.some((c) => c.stages.some((s) => s.matches.some((m) => m.table === table && !m.result)));
}
