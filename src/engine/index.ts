/**
 * Tournament engine: the public command/query interface (ADR 0004).
 * Everything outside src/engine imports from here only, never from engine internals.
 */
export type { Result } from './result';
export type { EngineError, EngineErrorCode } from './errors';
export type {
  CompetitionId,
  EntryId,
  GameScore,
  GamesToWin,
  GroupId,
  Grouping,
  MatchId,
  PlayerId,
  SlotSource,
  StageConfig,
  StageId,
  StageType,
  TableId,
  Timestamp,
  TournamentId,
  TournamentState,
} from './types';

// Commands
export { createTournament, type CreateTournamentInput } from './tournament';
export { execute, type Command, type CommandType } from './commands';

// Queries
export {
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
} from './queries';
