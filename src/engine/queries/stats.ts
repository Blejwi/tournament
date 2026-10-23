import { derive, type DerivedMatch } from '../derive';
import { expectedMs } from '../overdue';
import type { CompetitionId, Match, MatchResult, StageId, StageType, TableId, Timestamp, TournamentState } from '../types';
import { matchView, type MatchView } from './matches';

/** How many matches the longest-matches list shows. */
export const LONGEST_MATCHES = 5;

export interface ProgressView {
  /** Matches with a result (walkovers included). */
  done: number;
  /** Every match that will be played or walked over; matches decided by a BYE don't count. */
  total: number;
}

/** Durations of played matches (call to result). Walkovers and matches never called to a table don't count. */
export interface DurationStatsView {
  matches: number;
  /** null when no match counts yet. */
  averageMs: number | null;
}

export interface StageStatsView extends ProgressView {
  stage: StageId;
  stageIndex: number;
  type: StageType;
  durations: DurationStatsView;
}

export interface CompetitionStatsView extends ProgressView {
  competition: CompetitionId;
  name: string;
  durations: DurationStatsView;
  stages: StageStatsView[];
}

export interface TableStatsView {
  table: TableId;
  number: number;
  durations: DurationStatsView;
}

export interface LongestMatchView {
  durationMs: number;
  match: MatchView;
}

export interface StatsView {
  progress: ProgressView;
  /** In competition order. */
  competitions: CompetitionStatsView[];
  /** Every table, by number. */
  tables: TableStatsView[];
  /** The longest played matches, longest first (at most LONGEST_MATCHES). */
  longest: LongestMatchView[];
  /**
   * A rough estimate of the time until every drawn match is done: each unfinished match takes its
   * competition's average duration (the expected duration until one is finished), minus what a
   * match on a table has already played; the total is spread over the active tables. Stages not
   * drawn yet are not included. null when there is work left but no active table.
   */
  timeLeftMs: number | null;
}

/** Progress, average durations, the longest matches and a time-left estimate for the tournament. */
export function getStats(state: TournamentState, now: Timestamp): StatsView {
  const counted = derive(state).matches.filter(countsTowardProgress);

  const competitions = state.competitions.map((competition): CompetitionStatsView => {
    const own = counted.filter((m) => m.competition.id === competition.id);
    return {
      competition: competition.id,
      name: competition.name,
      ...progressOf(own),
      durations: durationsOf(own),
      stages: competition.stages.map((stage, stageIndex) => {
        const inStage = own.filter((m) => m.stage.id === stage.id);
        return { stage: stage.id, stageIndex, type: stage.type, ...progressOf(inStage), durations: durationsOf(inStage) };
      }),
    };
  });

  const tables = [...state.tables]
    .sort((a, b) => a.number - b.number)
    .map((t) => ({ table: t.id, number: t.number, durations: durationsOf(counted.filter((m) => m.match.table === t.id)) }));

  const longest = counted
    .map((m) => ({ m, duration: playedDuration(m.match) }))
    .filter((x): x is { m: DerivedMatch; duration: number } => x.duration !== null)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, LONGEST_MATCHES)
    .map(({ m, duration }) => ({ durationMs: duration, match: matchView(state, m, now) }));

  return { progress: progressOf(counted), competitions, tables, longest, timeLeftMs: timeLeft(state, counted, competitions, now) };
}

/** BYE-decided matches are finished without a result: nobody plays them. Disabled play-offs aren't played either. */
function countsTowardProgress(m: DerivedMatch): boolean {
  if (m.status === 'disabled') return false;
  return !(m.status === 'finished' && !m.match.result);
}

const isDone = (m: DerivedMatch) => m.match.result !== null;

function progressOf(matches: DerivedMatch[]): ProgressView {
  return { done: matches.filter(isDone).length, total: matches.length };
}

function durationsOf(matches: DerivedMatch[]): DurationStatsView {
  const durations = matches.map((m) => playedDuration(m.match)).filter((d) => d !== null);
  return {
    matches: durations.length,
    averageMs: durations.length ? durations.reduce((sum, d) => sum + d, 0) / durations.length : null,
  };
}

/** How long a finished match took on its table; null when it wasn't played there (e.g. a walkover). */
function playedDuration(match: Match): number | null {
  if (!match.result || !wasPlayed(match.result) || match.assignedAt === null || match.finishedAt === null) return null;
  return Math.max(0, match.finishedAt - match.assignedAt);
}

/** Whether a result's match was actually played, so its time says something about match durations. */
function wasPlayed(result: MatchResult): boolean {
  switch (result.kind) {
    case 'games':
    case 'gamesOnly':
      return true;
  }
}

function timeLeft(state: TournamentState, counted: DerivedMatch[], competitions: CompetitionStatsView[], now: Timestamp): number | null {
  const average = new Map(competitions.map((c) => [c.competition, c.durations.averageMs]));
  let work = 0;
  for (const m of counted) {
    if (isDone(m)) continue;
    const perMatch = average.get(m.competition.id) ?? expectedMs(state, m.competition.gamesToWin);
    const played = m.match.assignedAt !== null ? now - m.match.assignedAt : 0;
    work += Math.max(0, perMatch - played);
  }
  if (work === 0) return 0;
  const activeTables = state.tables.filter((t) => t.active).length;
  return activeTables ? work / activeTables : null;
}
