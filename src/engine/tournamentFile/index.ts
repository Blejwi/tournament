import { fail, ok, type Result } from '../result';
import type { TournamentId, TournamentState } from '../types';
import { migrations, type RawFile } from './migrations';
import { fileSchema, type TournamentFile } from './schema';

/** The schema version this build writes: one past the last migration. */
export const CURRENT_SCHEMA_VERSION = Math.max(...Object.keys(migrations).map(Number)) + 1;

/** Turns a tournament into the text of a single JSON file: `schemaVersion`, the tournament state and the change log. */
export function exportTournament(state: TournamentState): string {
  const { log, ...tournament } = state;
  const file: TournamentFile = { schemaVersion: CURRENT_SCHEMA_VERSION, tournament, log };
  return JSON.stringify(file, null, 2);
}

export interface ImportTournamentInput {
  /** The id the imported tournament gets: a new one for "import as new", the replaced tournament's id for "replace". */
  id: TournamentId;
  /** The file's text. */
  file: string;
}

/**
 * Reads a tournament file: parses it, migrates older schema versions to the current one and
 * validates the result. Returns a typed error for anything it can't use; never throws.
 */
export function importTournament(input: ImportTournamentInput): Result<TournamentState> {
  let json: unknown;
  try {
    json = JSON.parse(input.file);
  } catch {
    return fail({ code: 'importNotJson' });
  }
  if (!isRawFile(json)) return fail({ code: 'importNotTournamentFile' });
  if (json.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return fail({ code: 'importNewerVersion', version: json.schemaVersion });
  }

  let file = json;
  while (file.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const migrate = migrations[file.schemaVersion];
    if (!migrate) return fail({ code: 'importNotTournamentFile' });
    file = migrate(file);
  }

  const parsed = fileSchema.safeParse(file);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path.map(String).join('.') ?? '';
    return fail({ code: 'importInvalidData', path });
  }
  return ok({ ...parsed.data.tournament, id: input.id, log: parsed.data.log });
}

function isRawFile(json: unknown): json is RawFile {
  return (
    typeof json === 'object' &&
    json !== null &&
    !Array.isArray(json) &&
    Number.isInteger((json as { schemaVersion?: unknown }).schemaVersion)
  );
}
