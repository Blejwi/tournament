/**
 * Schema migrations for tournament files (and stored tournaments, which use the same format).
 *
 * `migrations[n]` turns a version-n document into a version-(n+1) document. Migrations work on raw
 * JSON (`RawFile`) and must not validate: the migrated result is checked once against the current
 * schema afterwards. Never edit a migration once released; add a new one instead.
 *
 * Versions:
 * - 1: `{ schemaVersion, tournament }`, the first saved format (tournament, tables, players).
 * - 2: adds the change log section `log` (empty until #0016).
 * - 3: adds `tournament.competitions` (entries, stage chain, draws and matches; #0003).
 * - 4: adds `tournament.expectedDurations` (minutes per games-to-win value, the defaults; #0005).
 */

/** A document parsed from JSON whose shape isn't trusted yet. */
export type RawFile = { schemaVersion: number } & Record<string, unknown>;

type Migration = (file: RawFile) => RawFile;

export const migrations: Record<number, Migration> = {
  1: (file) => ({ ...file, schemaVersion: 2, log: [] }),
  2: (file) => ({ ...file, schemaVersion: 3, tournament: { ...(file.tournament as object), competitions: [] } }),
  3: (file) => ({
    ...file,
    schemaVersion: 4,
    tournament: { ...(file.tournament as object), expectedDurations: { 2: 15, 3: 25, 4: 35 } },
  }),
};
