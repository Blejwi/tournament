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
 * - 4: adds `tieResolutions` (the operator's orders for unbreakable ties) to every group (#0004).
 * - 5: adds `tournament.expectedDurations` (minutes per games-to-win value, the defaults; #0005).
 */

/** A document parsed from JSON whose shape isn't trusted yet. */
export type RawFile = { schemaVersion: number } & Record<string, unknown>;

type Migration = (file: RawFile) => RawFile;

export const migrations: Record<number, Migration> = {
  1: (file) => ({ ...file, schemaVersion: 2, log: [] }),
  2: (file) => ({ ...file, schemaVersion: 3, tournament: { ...(file.tournament as object), competitions: [] } }),
  3: (file) => {
    const tournament = file.tournament as { competitions?: unknown };
    const competitions = Array.isArray(tournament?.competitions)
      ? tournament.competitions.map((competition: { stages?: unknown }) => ({
          ...competition,
          stages: Array.isArray(competition?.stages)
            ? competition.stages.map((stage: { type?: unknown; groups?: unknown }) =>
                stage?.type === 'groups' && Array.isArray(stage.groups)
                  ? { ...stage, groups: stage.groups.map((group: object) => ({ ...group, tieResolutions: [] })) }
                  : stage,
              )
            : competition?.stages,
        }))
      : tournament?.competitions;
    return { ...file, schemaVersion: 4, tournament: { ...tournament, competitions } };
  },
  4: (file) => ({
    ...file,
    schemaVersion: 5,
    tournament: { ...(file.tournament as object), expectedDurations: { 2: 15, 3: 25, 4: 35 } },
  }),
};
