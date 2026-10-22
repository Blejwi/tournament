/**
 * Tournament engine: the public command/query interface (ADR 0004).
 * Everything outside src/engine imports from here only, never from engine internals.
 */
export type { Result } from './result';
export type { EngineError, EngineErrorCode } from './errors';
export type { PlayerId, TableId, TournamentId, TournamentState } from './types';

// Commands
export { createTournament, type CreateTournamentInput } from './tournament';
export { execute, type Command, type CommandType } from './commands';

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
  getPlayers,
  getTables,
  getTournament,
  type PlayerView,
  type TableView,
  type TournamentView,
} from './queries';
