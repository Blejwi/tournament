/**
 * Tournament engine: the public command/query interface (ADR 0004).
 * Everything outside src/engine imports from here only, never from engine internals.
 */
export type { Result } from './result';
export type { EngineError, EngineErrorCode } from './errors';
export type {
  BracketSection,
  CompetitionId,
  MatchPlaces,
  PlaceRange,
  DrawState,
  EntryId,
  ExpectedDurations,
  GameScore,
  GamesToWin,
  GroupId,
  Grouping,
  MatchId,
  MatchResult,
  PlayerId,
  SlotSource,
  StageConfig,
  StageId,
  StageType,
  TableId,
  Timestamp,
  TournamentId,
  TournamentState,
  LogEntry,
  LogEntryType,
} from './types';

// Commands
export { createTournament, type CreateTournamentInput } from './tournament';
export { execute, type Command, type CommandType } from './commands';

export { DEFAULT_EXPECTED_DURATIONS, type OverdueLevel } from './overdue';
/** Parses typed game scores ("11-7 9-11 11-5"); check them with validateResult. */
export { parseGames, parseResult } from './score';
/** Games won by slot A and slot B, from the points of each game (e.g. for a score preview). */
export { gamesWon } from './derive';
// Tournament file (export/import)
export {
  CURRENT_SCHEMA_VERSION,
  exportTournament,
  importTournament,
  type ImportTournamentInput,
} from './tournamentFile';

// Queries
export {
  BACKUP_INTERVAL_MINUTES,
  getBackupReminder,
  LIVE_WINDOW_MINUTES,
  type BackupActivity,
  type BackupReminder,
} from './backupReminder';
export {
  getExpectedDurations,
  getPlayers,
  getTables,
  getTournament,
  getCompetitions,
  getCompetition,
  type PlayerView,
  type TableView,
  type TournamentView,
  type CompetitionSummaryView,
  type CompetitionView,
  type StageSummaryView,
  type EntryView,
  type EntryPlayerView,
  getStage,
  type StageView,
  type GroupsStageView,
  type GroupView,
  type StandingsRowView,
  type SingleEliminationStageView,
  type DoubleEliminationStageView,
  type BracketStageView,
  type BracketSectionView,
  type BracketRoundView,
  type TiebreakStepView,
  type TiedRecordView,
  type TieView,
  type TiebreakRule,
  getMatch,
  getFinalPlaces,
  type FinalPlacesView,
  type FinalPlaceView,
  getWaitingList,
  getFreeTables,
  validateResult,
  type FreeTableView,
  getTableOverview,
  getOverdueMatches,
  type TableOverview,
  type TableOverviewRow,
  type TableStatus,
  type BusyView,
  type WaitingListOptions,
  getMatchCounts,
  type MatchCountsView,
  getChangeLog,
  type ChangeLogEntryView,
  type LoggedMatchView,
  getStats,
  LONGEST_MATCHES,
  type StatsView,
  type ProgressView,
  type DurationStatsView,
  type CompetitionStatsView,
  type StageStatsView,
  type TableStatsView,
  type LongestMatchView,
  type MatchView,
  type MatchStatus,
  type MatchLocationView,
  type ResultView,
  type SlotView,
  type FeederView,
} from './queries';
