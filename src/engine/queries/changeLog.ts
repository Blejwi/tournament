import type { LogEntry, LoggedMatch, MatchId, StageId, Timestamp, TournamentState, CompetitionId } from '../types';
import type { EntryPlayerView } from './competitions';
import { locationView, resultView, type MatchLocationView, type ResultView } from './matches';

/** The match a log entry is about, with names resolved for display. */
export interface LoggedMatchView {
  id: MatchId;
  competition: CompetitionId;
  /** Empty when the competition no longer exists. */
  competitionName: string;
  stage: StageId;
  /** Position of the stage in its competition's chain; null when the match no longer exists. */
  stageIndex: number | null;
  /** Where the match sits (group, bracket section); null when the match no longer exists. */
  location: MatchLocationView | null;
  round: number | null;
  order: number | null;
  /** The players in slot A and slot B when the entry was written. */
  players: [EntryPlayerView[], EntryPlayerView[]];
}

/**
 * One change-log entry as shown. `seq` is its 0-based position in the log (oldest = 0), stable
 * across calls, so it works as a list key. Each entry type adds its own fields.
 */
export type ChangeLogEntryView = { seq: number; at: Timestamp } & (
  | { type: 'matchAssigned'; match: LoggedMatchView; table: number }
  | { type: 'matchUnassigned'; match: LoggedMatchView; table: number }
  | { type: 'resultRecorded'; match: LoggedMatchView; result: ResultView; table: number | null }
  | { type: 'resultCorrected'; match: LoggedMatchView; before: ResultView; after: ResultView; reset: LoggedMatchView[] }
);

/** The change log, newest first. */
export function getChangeLog(state: TournamentState): ChangeLogEntryView[] {
  return state.log.map((entry, seq) => entryView(state, entry, seq)).reverse();
}

/** One case per entry type; TypeScript fails here until a new type has its view. */
function entryView(state: TournamentState, entry: LogEntry, seq: number): ChangeLogEntryView {
  const base = { seq, at: entry.at };
  switch (entry.type) {
    case 'matchAssigned':
    case 'matchUnassigned':
      return { ...base, type: entry.type, match: loggedMatchView(state, entry.match), table: entry.table.number };
    case 'resultRecorded':
      return {
        ...base,
        type: entry.type,
        match: loggedMatchView(state, entry.match),
        result: resultView(entry.result),
        table: entry.table?.number ?? null,
      };
    case 'resultCorrected':
      return {
        ...base,
        type: entry.type,
        match: loggedMatchView(state, entry.match),
        before: resultView(entry.before),
        after: resultView(entry.after),
        reset: entry.reset.map((m) => loggedMatchView(state, m)),
      };
  }
}

function loggedMatchView(state: TournamentState, logged: LoggedMatch): LoggedMatchView {
  const competition = state.competitions.find((c) => c.id === logged.competition);
  const stageIndex = competition?.stages.findIndex((s) => s.id === logged.stage) ?? -1;
  const stage = stageIndex >= 0 ? competition!.stages[stageIndex] : undefined;
  const match = stage?.matches.find((m) => m.id === logged.match);
  const player = (id: string): EntryPlayerView => {
    const p = state.players.find((x) => x.id === id);
    return { id, firstName: p?.firstName ?? '', lastName: p?.lastName ?? '', club: p?.club ?? '' };
  };
  return {
    id: logged.match,
    competition: logged.competition,
    competitionName: competition?.name ?? '',
    stage: logged.stage,
    stageIndex: match ? stageIndex : null,
    location: match && stage ? locationView(match, stage) : null,
    round: match?.round ?? null,
    order: match?.order ?? null,
    players: [logged.players[0].map(player), logged.players[1].map(player)],
  };
}
